/**
 * @repo/ai - ToolLoopAgent
 *
 * Enhanced ToolLoopAgent wrapper with Rubic-specific defaults and features.
 * Wraps AI SDK v6's ToolLoopAgent with:
 * - Custom middleware support
 * - Progress tracking
 * - Cost tracking integration
 * - Tool approval workflow
 */

import type {
  Agent,
  AgentConfig,
  AgentGenerateOptions,
  AgentGenerateResult,
  AgentStreamOptions,
  AgentStreamResult,
  AgentStep,
  AgentToolCall,
  AgentToolResult,
  AgentStreamChunk,
  StopCondition,
  TokenUsage,
} from './types';
import { stepCountIs } from './types';
import type { UIMessage, FinishReason } from '../types/ui-message';
import { generateId } from '../streaming';

// ============================================================================
// ToolLoopAgent Implementation
// ============================================================================

export interface ToolLoopAgentConfig extends AgentConfig {
  /** Agent name for identification */
  name?: string;

  /** Unique ID */
  id?: string;

  /** Prepare step hook - modify options per-step */
  prepareStep?: (context: PrepareStepContext) => Promise<PrepareStepResult>;

  /** Called when a tool needs approval */
  onToolApproval?: (toolCall: AgentToolCall) => Promise<boolean>;
}

export interface PrepareStepContext {
  steps: AgentStep[];
  stepNumber: number;
  messages: UIMessage[];
}

export interface PrepareStepResult {
  /** Override tool choice for this step */
  toolChoice?: AgentConfig['toolChoice'];

  /** Override available tools for this step */
  tools?: AgentConfig['tools'];

  /** Additional instructions for this step */
  additionalInstructions?: string;
}

/**
 * ToolLoopAgent - Multi-step agent with tool calling
 *
 * @example
 * ```ts
 * const agent = new RubicToolLoopAgent({
 *   model: 'anthropic/claude-sonnet-4-5-20250929',
 *   instructions: 'You are a helpful research assistant.',
 *   tools: { search: webSearchTool, browse: browserTool },
 *   maxSteps: 10,
 * });
 *
 * const result = await agent.generate({ messages });
 * ```
 */
export class RubicToolLoopAgent implements Agent {
  readonly id: string;
  readonly name: string;
  readonly config: ToolLoopAgentConfig;

  private stopCondition: StopCondition;

  constructor(config: ToolLoopAgentConfig) {
    this.id = config.id ?? generateId('agent');
    this.name = config.name ?? 'ToolLoopAgent';
    this.config = {
      maxSteps: 20, // AI SDK v6 default
      temperature: 0.7,
      reasoning: false,
      ...config,
    };
    this.stopCondition = config.stopWhen ?? stepCountIs(config.maxSteps ?? 20);
  }

  // ========================================
  // Generate (Non-streaming)
  // ========================================

  async generate(options: AgentGenerateOptions): Promise<AgentGenerateResult> {
    const startTime = Date.now();
    const steps: AgentStep[] = [];
    let currentMessages = [...options.messages];
    let finishReason: FinishReason = 'stop';
    let totalUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    let stepNumber = 0;
    let shouldStop = false;

    while (!shouldStop && stepNumber < (this.config.maxSteps ?? 20)) {
      stepNumber++;
      const stepStartTime = Date.now();

      // Prepare step
      let stepConfig = { ...this.config };
      if (this.config.prepareStep) {
        const prepared = await this.config.prepareStep({
          steps,
          stepNumber,
          messages: currentMessages,
        });

        if (prepared.toolChoice) stepConfig.toolChoice = prepared.toolChoice;
        if (prepared.tools) stepConfig.tools = prepared.tools;
        if (prepared.additionalInstructions) {
          stepConfig.instructions = `${stepConfig.instructions ?? ''}\n\n${prepared.additionalInstructions}`;
        }
      }

      // Execute step
      const stepResult = await this.executeStep(currentMessages, stepConfig, options.abortSignal);

      // Track usage
      if (stepResult.usage) {
        totalUsage.promptTokens += stepResult.usage.promptTokens;
        totalUsage.completionTokens += stepResult.usage.completionTokens;
        totalUsage.totalTokens += stepResult.usage.totalTokens;
        if (stepResult.usage.reasoningTokens) {
          totalUsage.reasoningTokens = (totalUsage.reasoningTokens ?? 0) + stepResult.usage.reasoningTokens;
        }
      }

      // Build step record
      const step: AgentStep = {
        stepNumber,
        type: stepResult.toolCalls?.length ? 'tool-execution' : 'generation',
        text: stepResult.text,
        toolCalls: stepResult.toolCalls,
        toolResults: stepResult.toolResults,
        duration: Date.now() - stepStartTime,
      };
      steps.push(step);

      // Update messages with response
      if (stepResult.assistantMessage) {
        currentMessages = [...currentMessages, stepResult.assistantMessage];
      }

      // Add tool results as messages (tool results are embedded in the assistant message parts)
      // No separate messages needed for tool results in UI message format

      // Check stop conditions
      finishReason = stepResult.finishReason;
      shouldStop = this.checkStopCondition(step, finishReason);
    }

    // Build final response message
    const responseMessage = currentMessages[currentMessages.length - 1] ?? {
      id: generateId('msg'),
      role: 'assistant' as const,
      parts: [],
      createdAt: new Date(),
    };

    return {
      message: responseMessage,
      messages: currentMessages,
      finishReason,
      usage: totalUsage,
      steps,
      duration: Date.now() - startTime,
    };
  }

  // ========================================
  // Stream
  // ========================================

  async stream(options: AgentStreamOptions): Promise<AgentStreamResult> {
    const resultPromise = this.generateWithStreaming(options);

    // Create a pass-through stream
    const chunks: AgentStreamChunk[] = [];
    let resolveStream: (stream: ReadableStream<AgentStreamChunk>) => void;
    const streamPromise = new Promise<ReadableStream<AgentStreamChunk>>((resolve) => {
      resolveStream = resolve;
    });

    // Start generation in background, collect chunks
    const fullResult = resultPromise.then(async (result) => {
      // Stream is complete, resolve with collected chunks
      const stream = new ReadableStream<AgentStreamChunk>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });
      resolveStream(stream);
      return result;
    });

    // For now, return a simulated stream
    // In production, this would hook into AI SDK's actual streaming
    const stream = await this.createSimulatedStream(options, (chunk) => {
      chunks.push(chunk);
      options.onChunk?.(chunk);
    });

    return {
      stream,
      result: fullResult,
    };
  }

  // ========================================
  // Private Methods
  // ========================================

  private async executeStep(
    messages: UIMessage[],
    config: AgentConfig,
    abortSignal?: AbortSignal
  ): Promise<StepExecutionResult> {
    // Import AI SDK dynamically
    const { streamText, generateText } = await import('ai');
    const modelInstance = await this.getModelInstance(config.model);

    // Convert messages to AI SDK format
    const aiMessages = this.convertToAIMessages(messages);

    // Convert tools to AI SDK format
    const aiTools = config.tools ? this.convertToAITools(config.tools) : undefined;

    // Build generate options - ensure messages is always an array
    const generateOptions: Parameters<typeof generateText>[0] = {
      model: modelInstance as Parameters<typeof generateText>[0]['model'],
      system: config.instructions,
      messages: aiMessages.length > 0 ? aiMessages : [{ role: 'user' as const, content: '' }],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      abortSignal,
    } as Parameters<typeof generateText>[0];

    // Add optional fields
    if (aiTools) {
      (generateOptions as Record<string, unknown>).tools = aiTools;
    }
    if (config.toolChoice) {
      (generateOptions as Record<string, unknown>).toolChoice = config.toolChoice;
    }

    // Generate
    const result = await generateText(generateOptions);

    // Process tool calls
    const toolCalls: AgentToolCall[] = [];
    const toolResults: AgentToolResult[] = [];

    if (result.toolCalls?.length) {
      for (const tc of result.toolCalls) {
        // Handle both AI SDK formats (args or input)
        const toolCallArgs = (tc as unknown as { args?: unknown; input?: unknown }).args ??
                             (tc as unknown as { args?: unknown; input?: unknown }).input;
        const call: AgentToolCall = {
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: toolCallArgs,
          needsApproval: config.tools?.[tc.toolName]?.needsApproval,
        };
        toolCalls.push(call);

        // Check approval if needed
        if (call.needsApproval && this.config.onToolApproval) {
          const approved = await this.config.onToolApproval(call);
          if (!approved) {
            toolResults.push({
              toolCallId: call.toolCallId,
              toolName: call.toolName,
              output: { error: 'Tool execution denied by user' },
              isError: true,
              duration: 0,
            });
            continue;
          }
        }

        // Execute tool
        const toolDef = config.tools?.[tc.toolName];
        if (toolDef?.execute) {
          const toolStartTime = Date.now();
          try {
            const output = await toolDef.execute(toolCallArgs, {
              toolCallId: tc.toolCallId,
              abortSignal,
            });
            toolResults.push({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              output,
              isError: false,
              duration: Date.now() - toolStartTime,
            });
          } catch (error) {
            toolResults.push({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              output: { error: error instanceof Error ? error.message : String(error) },
              isError: true,
              duration: Date.now() - toolStartTime,
            });
          }
        }
      }
    }

    // Convert AI SDK usage to our TokenUsage format
    const usage: TokenUsage = {
      promptTokens: (result.usage as { promptTokens?: number })?.promptTokens ?? 0,
      completionTokens: (result.usage as { completionTokens?: number })?.completionTokens ?? 0,
      totalTokens: (result.usage as { totalTokens?: number })?.totalTokens ?? 0,
    };

    // Build assistant message
    const assistantMessage: UIMessage = {
      id: generateId('msg'),
      role: 'assistant',
      parts: [],
      metadata: {
        model: config.model,
        usage,
        finishReason: result.finishReason as FinishReason,
      },
      createdAt: new Date(),
    };

    if (result.text) {
      assistantMessage.parts.push({ type: 'text', text: result.text });
    }

    for (const toolCall of toolCalls) {
      assistantMessage.parts.push({
        type: `tool-${toolCall.toolName}` as `tool-${string}`,
        toolCallId: toolCall.toolCallId,
        state: 'output-available',
        input: toolCall.input,
        output: toolResults.find((r) => r.toolCallId === toolCall.toolCallId)?.output,
      } as any);
    }

    return {
      text: result.text,
      toolCalls,
      toolResults,
      assistantMessage,
      finishReason: result.finishReason as FinishReason,
      usage,
    };
  }

  private checkStopCondition(step: AgentStep, finishReason: FinishReason): boolean {
    // Always stop on natural completion
    if (finishReason === 'stop' || finishReason === 'length' || finishReason === 'error') {
      return true;
    }

    switch (this.stopCondition.type) {
      case 'step-count':
        return step.stepNumber >= this.stopCondition.maxSteps;

      case 'tool-call': {
        const targetToolName = (this.stopCondition as { type: 'tool-call'; toolName: string }).toolName;
        return step.toolCalls?.some((tc) => tc.toolName === targetToolName) ?? false;
      }

      case 'custom':
        return (this.stopCondition as { type: 'custom'; check: (step: AgentStep) => boolean }).check(step);

      default:
        return false;
    }
  }

  private async getModelInstance(modelId: string): Promise<unknown> {
    const [provider, ...modelParts] = modelId.split('/');
    const modelName = modelParts.join('/') || modelId;

    switch (provider) {
      case 'anthropic': {
        const { anthropic } = await import('@ai-sdk/anthropic');
        return anthropic(modelName);
      }
      case 'openai': {
        const { openai } = await import('@ai-sdk/openai');
        return openai(modelName);
      }
      case 'google': {
        const { google } = await import('@ai-sdk/google');
        return google(modelName);
      }
      default: {
        // Assume anthropic by default
        const { anthropic } = await import('@ai-sdk/anthropic');
        return anthropic(modelId);
      }
    }
  }

  private convertToAIMessages(messages: UIMessage[]): Array<{
    role: 'user' | 'assistant' | 'system';
    content: string | Array<unknown>;
  }> {
    return messages.map((msg) => {
      const textParts = msg.parts
        .filter((p) => p.type === 'text')
        .map((p) => (p as { text: string }).text);

      return {
        role: msg.role,
        content: textParts.join('\n') || '',
      };
    });
  }

  private convertToAITools(tools: NonNullable<AgentConfig['tools']>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [name, def] of Object.entries(tools)) {
      // Dynamic import of ai tool function
      result[name] = {
        description: def.description,
        parameters: def.parameters,
      };
    }

    return result;
  }

  private async createSimulatedStream(
    options: AgentStreamOptions,
    onChunk: (chunk: AgentStreamChunk) => void
  ): Promise<ReadableStream<AgentStreamChunk>> {
    return new ReadableStream({
      async start(controller) {
        // This is a placeholder - in production, hook into AI SDK streaming
        controller.close();
      },
    });
  }

  private async generateWithStreaming(options: AgentStreamOptions): Promise<AgentGenerateResult> {
    // For streaming, we use the same generate logic but emit chunks
    // This is a simplified implementation
    return this.generate(options);
  }
}

interface StepExecutionResult {
  text?: string;
  toolCalls?: AgentToolCall[];
  toolResults?: AgentToolResult[];
  assistantMessage: UIMessage;
  finishReason: FinishReason;
  usage?: TokenUsage;
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createToolLoopAgent(config: ToolLoopAgentConfig): RubicToolLoopAgent {
  return new RubicToolLoopAgent(config);
}
