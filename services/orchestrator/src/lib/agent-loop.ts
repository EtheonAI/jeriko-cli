/**
 * Streaming agent loop — uses AI SDK streamText with all tools.
 * Returns a ReadableStream of SSE events following the UIMessage stream protocol.
 */

import { streamText, stepCountIs, type ModelMessage, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createAllTools, type ToolContext } from './tools/index.js';
import { buildManusSystemPrompt, type SystemPromptContext } from './system-prompt.js';
import { getOrCreateSandbox } from './e2b-manager.js';

export interface AgentLoopInput {
  sessionId: string;
  userId: string;
  userName?: string;
  messages: ModelMessage[];
  maxSteps?: number;
  abortSignal?: AbortSignal;
}

export interface AgentLoopResult {
  stream: ReadableStream<Uint8Array>;
  sandboxId: string | null;
}

const encoder = new TextEncoder();

function sseEvent(data: Record<string, unknown>): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

/**
 * Run the streaming agent loop.
 * Returns a ReadableStream that emits SSE events compatible with UIMessage stream protocol.
 */
export async function runStreamingAgentLoop(input: AgentLoopInput): Promise<AgentLoopResult> {
  const {
    sessionId,
    userId,
    userName,
    messages,
    maxSteps = 25,
    abortSignal,
  } = input;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const anthropicModel = process.env.ORCHESTRATOR_MODEL || 'claude-sonnet-4-5-20250929';
  const openaiModel = process.env.OPENAI_MODEL || 'gpt-4o';
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;

  // Create sandbox (lazy — won't block if sandbox service is down)
  let sandboxId: string | null = null;
  let nekoUrl: string | null = null;
  try {
    const sandbox = await getOrCreateSandbox(sessionId, userId);
    sandboxId = sandbox.sandboxId;
    nekoUrl = sandbox.nekoUrl;
  } catch {
    // Sandbox not available — tools requiring sandbox will fail gracefully
  }

  // Build tool context
  const toolCtx: ToolContext = {
    sessionId,
    userId,
    userName,
    db: createNoopDb(),
    sandboxId: sandboxId || 'no-sandbox',
    ws: createNoopWs(),
    storage: createNoopStorage(),
    processMap: new Map(),
  };

  // Build system prompt
  const promptCtx: SystemPromptContext = {
    userName,
    sessionId,
    sandboxId: sandboxId || undefined,
    currentDate: new Date().toISOString().split('T')[0] ?? new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  // Create all tools
  const tools = createAllTools(toolCtx);

  // If no API key at all, return a fallback stream
  if (!anthropicApiKey && !openaiApiKey) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const id = `text-${Date.now()}`;
        controller.enqueue(sseEvent({ type: 'start' }));
        controller.enqueue(sseEvent({ type: 'text-start', id }));
        controller.enqueue(
          sseEvent({
            type: 'text-delta',
            id,
            delta: 'No LLM API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY in the orchestrator environment.',
          }),
        );
        controller.enqueue(sseEvent({ type: 'text-end', id }));
        controller.enqueue(sseEvent({ type: 'finish', finishReason: 'stop' }));
        controller.close();
      },
    });
    return { stream, sandboxId };
  }

  // Build model — controlled by LLM_PROVIDER env var, defaults to auto-detect
  const provider = process.env.LLM_PROVIDER || 'auto';
  let model: LanguageModel;

  if (provider === 'openai' || (provider === 'auto' && !anthropicApiKey && openaiApiKey)) {
    const openai = createOpenAI({ apiKey: openaiApiKey! });
    model = openai(openaiModel);
  } else {
    const anthropic = createAnthropic({
      apiKey: anthropicApiKey!,
      ...(anthropicBaseUrl ? { baseURL: anthropicBaseUrl } : {}),
    });
    model = anthropic(anthropicModel);
  }

  let systemPrompt: string;
  try {
    systemPrompt = buildManusSystemPrompt(promptCtx);
  } catch {
    systemPrompt = 'You are Rubic, a helpful AI assistant with access to tools for file operations, shell commands, browser control, code execution, web search, and deployment.';
  }

  // Run streamText with all tools
  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    stopWhen: stepCountIs(maxSteps),
    tools,
    abortSignal,
  });

  // Get the UIMessage stream response and extract its body
  const response = result.toUIMessageStreamResponse({
    headers: {
      'x-vercel-ai-ui-message-stream': 'v1',
    },
  });

  const uiStream = response.body;
  if (!uiStream) {
    throw new Error('Failed to create UI message stream');
  }

  // Wrap stream to inject sandbox_info metadata at the start
  if (sandboxId) {
    const wrappedStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        // Send sandbox info as first metadata event
        controller.enqueue(
          sseEvent({
            type: 'message-metadata',
            sandboxId,
            ...(nekoUrl ? { nekoUrl } : {}),
          }),
        );

        const reader = uiStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Stream error';
          controller.enqueue(sseEvent({ type: 'error', error: errMsg }));
        } finally {
          controller.close();
        }
      },
    });

    return { stream: wrappedStream, sandboxId };
  }

  return { stream: uiStream, sandboxId };
}

// ── Noop implementations for services not yet connected ──

function createNoopDb(): ToolContext['db'] {
  return {
    insertMessage: async () => ({
      id: `msg_${Date.now()}`,
      sessionId: '',
      role: 'assistant',
      content: '',
      createdAt: new Date(),
    }),
    insertManusPage: async () => ({
      id: `page_${Date.now()}`,
      userId: '',
      title: '',
      content: '',
      isPublic: false,
      createdAt: new Date(),
    }),
    query: {},
  };
}

function createNoopWs(): ToolContext['ws'] {
  return {
    emit: async () => {},
  };
}

function createNoopStorage(): ToolContext['storage'] {
  return {
    uploadFromUrl: async (url: string) => url,
    uploadFromSandbox: async (_sid: string, path: string) => path,
  };
}
