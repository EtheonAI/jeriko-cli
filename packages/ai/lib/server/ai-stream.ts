/**
 * @repo/ai - AI Stream Integration
 *
 * Integration utilities for streaming AI responses from various providers
 * (OpenAI, Anthropic, etc.) using the Vercel AI SDK.
 */

import { ServerStreamWriter, createDataStream, type CreateStreamOptions } from './stream-writer';
import type { UIMessage, FinishReason } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// Types
// ============================================================================

export interface AIStreamOptions {
  /** Model ID */
  model: string;

  /** System prompt */
  system?: string;

  /** Messages to send */
  messages: UIMessage[];

  /** Tools available for the model */
  tools?: Record<string, ToolDefinition>;

  /** Temperature (0-2) */
  temperature?: number;

  /** Max tokens to generate */
  maxTokens?: number;

  /** Stop sequences */
  stopSequences?: string[];

  /** Enable reasoning/thinking */
  reasoning?: boolean;

  /** Tool choice */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };

  /** Abort signal */
  abortSignal?: AbortSignal;

  /** Message ID for the response */
  messageId?: string;

  /** Callback for each chunk */
  onChunk?: (chunk: unknown) => void;

  /** Callback for tool calls */
  onToolCall?: (toolCall: {
    toolCallId: string;
    toolName: string;
    args: unknown;
  }) => Promise<unknown>;

  /** Maximum number of steps (for multi-step tool use) */
  maxSteps?: number;
}

export interface ToolDefinition {
  description: string;
  parameters: Record<string, unknown>;
  execute?: (args: unknown) => Promise<unknown>;
  requiresApproval?: boolean;
}

export interface AIStreamResult {
  stream: ReadableStream<Uint8Array>;
  response: Response;
}

// ============================================================================
// Vercel AI SDK Integration
// ============================================================================

/**
 * Create an AI stream from Vercel AI SDK result
 *
 * This integrates with the Vercel AI SDK's streamText/generateText functions
 * and converts their output to our UIMessageStreamChunk format.
 */
export async function createAIStream(
  options: AIStreamOptions
): Promise<AIStreamResult> {
  const { messageId = generateId('msg') } = options;

  const { stream, writer } = createDataStream({
    onChunk: options.onChunk as (chunk: unknown) => void,
  });

  // Start streaming
  writer.writeStart({ messageId });

  // Process in background
  processAIStream(writer, options).catch((error) => {
    if (!writer.isClosed()) {
      writer.writeError(error.message);
      writer.writeFinish({ finishReason: 'error' });
      writer.close();
    }
  });

  const response = new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });

  return { stream, response };
}

async function processAIStream(
  writer: ServerStreamWriter,
  options: AIStreamOptions
): Promise<void> {
  const {
    model,
    system,
    messages,
    tools,
    temperature,
    maxTokens,
    stopSequences,
    reasoning,
    toolChoice,
    abortSignal,
    onToolCall,
    maxSteps = 5,
  } = options;

  // Import Vercel AI SDK dynamically
  const { streamText, generateText } = await import('ai');

  // Convert our UIMessage format to Vercel AI SDK format
  const aiMessages = convertToAIMessages(messages);

  // Get the model instance
  const modelInstance = await getModelInstance(model);

  // Convert tools to Vercel AI SDK format
  const aiTools = tools ? convertToAITools(tools) : undefined;

  let currentStep = 0;
  let shouldContinue = true;

  while (shouldContinue && currentStep < maxSteps) {
    currentStep++;

    if (currentStep > 1) {
      writer.writeStepStart();
    }

    // Stream the response
    // Use type assertion to bypass strict type checking with Vercel AI SDK
    const streamOptions = {
      model: modelInstance,
      system,
      messages: aiMessages,
      tools: aiTools,
      temperature,
      maxOutputTokens: maxTokens,
      stopSequences,
      abortSignal,
      toolChoice,
    } as Parameters<typeof streamText>[0];

    const result = await streamText(streamOptions);

    const textId = generateId('text');
    let hasStartedText = false;
    let hasToolCalls = false;

    // Process the stream
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta': {
          if (!hasStartedText) {
            writer.writeTextStart(textId);
            hasStartedText = true;
          }
          writer.writeTextDelta(textId, (part as { text: string }).text);
          break;
        }

        case 'reasoning-delta': {
          if (reasoning) {
            const reasoningId = generateId('reasoning');
            writer.writeReasoningStart(reasoningId);
            writer.writeReasoningDelta(reasoningId, (part as { text: string }).text);
            writer.writeReasoningEnd(reasoningId);
          }
          break;
        }

        case 'tool-call': {
          hasToolCalls = true;

          // Close text if open
          if (hasStartedText) {
            writer.writeTextEnd(textId);
            hasStartedText = false;
          }

          const toolCallId = (part as { toolCallId: string }).toolCallId;
          const toolName = (part as { toolName: string }).toolName;
          const args = (part as { input: unknown }).input;

          // Stream tool call
          writer.writeToolInputAvailable({
            toolCallId,
            toolName,
            input: args,
          });

          // Check if tool requires approval
          const toolDef = tools?.[toolName];
          if (toolDef?.requiresApproval) {
            const approvalId = generateId('approval');
            writer.writeToolApprovalRequest(toolCallId, approvalId);
            // Don't execute, wait for approval
            continue;
          }

          // Execute tool
          let output: unknown;
          let error: string | undefined;

          try {
            if (onToolCall) {
              output = await onToolCall({ toolCallId, toolName, args });
            } else if (toolDef?.execute) {
              output = await toolDef.execute(args);
            } else {
              throw new Error(`No executor for tool: ${toolName}`);
            }

            writer.writeToolOutput({ toolCallId, output });

            // Add tool result to messages for next step
            aiMessages.push({
              role: 'assistant',
              content: [{ type: 'tool-call', toolCallId, toolName, args }],
            } as any);

            aiMessages.push({
              role: 'tool',
              content: [{ type: 'tool-result', toolCallId, result: output }],
            } as any);
          } catch (e) {
            error = e instanceof Error ? e.message : String(e);
            writer.writeToolError({ toolCallId, errorText: error });

            // Add error to messages
            aiMessages.push({
              role: 'assistant',
              content: [{ type: 'tool-call', toolCallId, toolName, args }],
            } as any);

            aiMessages.push({
              role: 'tool',
              content: [{ type: 'tool-result', toolCallId, result: { error } }],
            } as any);
          }

          break;
        }

        case 'finish': {
          // Close text if still open
          if (hasStartedText) {
            writer.writeTextEnd(textId);
          }

          if (currentStep > 1) {
            writer.writeStepEnd();
          }

          // Determine if we should continue
          shouldContinue = hasToolCalls && part.finishReason === 'tool-calls';

          if (!shouldContinue) {
            writer.writeFinish({
              finishReason: part.finishReason as FinishReason,
              messageMetadata: {
                usage: (part as { totalUsage?: unknown }).totalUsage,
              },
            });
          }

          break;
        }

        case 'error': {
          const errorPart = part as { error?: unknown };
          const errorMsg = errorPart.error && typeof errorPart.error === 'object' && 'message' in errorPart.error
            ? String((errorPart.error as { message: unknown }).message)
            : 'Unknown error';
          throw new Error(errorMsg);
        }
      }
    }
  }

  // If we exceeded max steps, finish
  if (currentStep >= maxSteps && shouldContinue) {
    writer.writeFinish({
      finishReason: 'length',
      messageMetadata: { maxStepsReached: true },
    });
  }

  writer.close();
}

// ============================================================================
// Conversion Utilities
// ============================================================================

function convertToAIMessages(messages: UIMessage[]): Array<{
  role: 'user' | 'assistant' | 'system';
  content: string | Array<unknown>;
}> {
  return messages.map((msg) => {
    // Extract text content
    const textParts = msg.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { type: 'text'; text: string }).text);

    const text = textParts.join('\n');

    // Handle multimodal content
    const content: Array<unknown> = [];

    for (const part of msg.parts) {
      switch (part.type) {
        case 'text':
          content.push({ type: 'text', text: (part as { text: string }).text });
          break;
        case 'file':
          const filePart = part as { mediaType: string; url: string };
          if (filePart.mediaType.startsWith('image/')) {
            content.push({ type: 'image', image: filePart.url });
          } else {
            content.push({ type: 'file', data: filePart.url, mimeType: filePart.mediaType });
          }
          break;
      }
    }

    return {
      role: msg.role,
      content: content.length > 1 ? content : text,
    };
  });
}

function convertToAITools(
  tools: Record<string, ToolDefinition>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [name, def] of Object.entries(tools)) {
    result[name] = {
      description: def.description,
      parameters: def.parameters,
    };
  }

  return result;
}

async function getModelInstance(modelId: string): Promise<unknown> {
  // Parse model ID (format: provider/model)
  const [provider, ...modelParts] = modelId.split('/');
  const modelName = modelParts.join('/');

  switch (provider) {
    case 'openai': {
      const { openai } = await import('@ai-sdk/openai');
      return openai(modelName);
    }

    case 'anthropic': {
      try {
        const { anthropic } = await import('@ai-sdk/anthropic');
        return anthropic(modelName);
      } catch {
        throw new Error('Anthropic provider not available. Install @ai-sdk/anthropic to use Anthropic models.');
      }
    }

    case 'google': {
      try {
        const { google } = await import('@ai-sdk/google');
        return google(modelName);
      } catch {
        throw new Error('Google provider not available. Install @ai-sdk/google to use Google models.');
      }
    }

    default:
      // Assume it's an OpenAI model if no provider specified
      const { openai: defaultOpenai } = await import('@ai-sdk/openai');
      return defaultOpenai(modelId);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a simple text stream response
 */
export function textStream(
  text: string,
  options: { delayMs?: number } = {}
): Response {
  const { delayMs = 15 } = options;
  const { stream, writer } = createDataStream();

  (async () => {
    writer.writeStart({});
    await writer.streamText(text, { delayMs });
    writer.writeFinish({ finishReason: 'stop' });
    writer.close();
  })();

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * Create an error response
 */
export function errorStream(error: string | Error): Response {
  const errorText = error instanceof Error ? error.message : error;
  const { stream, writer } = createDataStream();

  writer.writeStart({});
  writer.writeError(errorText);
  writer.writeFinish({ finishReason: 'error' });
  writer.close();

  return new Response(stream, {
    status: 200, // Use 200 so error is delivered via SSE
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
