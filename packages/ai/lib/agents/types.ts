/**
 * @repo/ai - Agent Type Definitions
 *
 * Core types for the Rubic agent system following AI SDK v6 patterns.
 * Supports DAG-based multi-agent orchestration with real-time streaming.
 */

import type { z } from 'zod';
import type { UIMessage, FinishReason, MessageMetadata } from '../types/ui-message';

// ============================================================================
// Agent Interface (AI SDK v6 Compatible)
// ============================================================================

/**
 * Core Agent interface - all custom agents must implement this.
 * Compatible with AI SDK v6's createAgentUIStreamResponse.
 */
export interface Agent<TOptions = unknown> {
  /**
   * Generate a response (non-streaming)
   */
  generate(options: AgentGenerateOptions<TOptions>): Promise<AgentGenerateResult>;

  /**
   * Stream a response
   */
  stream(options: AgentStreamOptions<TOptions>): Promise<AgentStreamResult>;
}

export interface AgentGenerateOptions<TOptions = unknown> {
  /** Input messages */
  messages: UIMessage[];

  /** Optional call-time options */
  options?: TOptions;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;
}

export interface AgentStreamOptions<TOptions = unknown> extends AgentGenerateOptions<TOptions> {
  /** Callback for each chunk */
  onChunk?: (chunk: AgentStreamChunk) => void;

  /** Callback for tool calls */
  onToolCall?: (toolCall: AgentToolCall) => Promise<unknown>;
}

export interface AgentGenerateResult {
  /** Response message */
  message: UIMessage;

  /** All messages including response */
  messages: UIMessage[];

  /** Finish reason */
  finishReason: FinishReason;

  /** Token usage */
  usage?: TokenUsage;

  /** Execution steps */
  steps: AgentStep[];

  /** Total duration in ms */
  duration: number;
}

export interface AgentStreamResult {
  /** Readable stream of chunks */
  stream: ReadableStream<AgentStreamChunk>;

  /** Promise that resolves to the final result */
  result: Promise<AgentGenerateResult>;
}

// ============================================================================
// Agent Step & Tool Types
// ============================================================================

export interface AgentStep {
  /** Step number (1-indexed) */
  stepNumber: number;

  /** Step type */
  type: 'generation' | 'tool-execution' | 'aggregation';

  /** Text generated in this step */
  text?: string;

  /** Tool calls made in this step */
  toolCalls?: AgentToolCall[];

  /** Tool results from this step */
  toolResults?: AgentToolResult[];

  /** Step metadata */
  metadata?: Record<string, unknown>;

  /** Duration of this step */
  duration: number;
}

export interface AgentToolCall {
  toolCallId: string;
  toolName: string;
  input: unknown;
  /** Whether tool requires approval */
  needsApproval?: boolean;
}

export interface AgentToolResult {
  toolCallId: string;
  toolName: string;
  output: unknown;
  isError: boolean;
  duration: number;
}

// ============================================================================
// Stream Chunk Types
// ============================================================================

export type AgentStreamChunk =
  | { type: 'step-start'; stepNumber: number }
  | { type: 'step-end'; stepNumber: number }
  | { type: 'text-delta'; delta: string }
  | { type: 'text-done'; text: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'reasoning-done'; text: string }
  | { type: 'tool-call-start'; toolCallId: string; toolName: string }
  | { type: 'tool-call-args-delta'; toolCallId: string; argsDelta: string }
  | { type: 'tool-call-args-done'; toolCallId: string; args: unknown }
  | { type: 'tool-call-result'; toolCallId: string; result: unknown; isError: boolean }
  | { type: 'tool-approval-request'; toolCallId: string; approvalId: string }
  | { type: 'finish'; finishReason: FinishReason; usage?: TokenUsage }
  | { type: 'error'; error: string }
  | { type: 'data'; dataType: string; data: unknown };

// ============================================================================
// Agent Configuration
// ============================================================================

export interface AgentConfig {
  /** Model ID (e.g., 'anthropic/claude-sonnet-4-5-20250929') */
  model: string;

  /** System instructions */
  instructions?: string;

  /** Available tools */
  tools?: Record<string, AgentToolDefinition>;

  /** Maximum steps before stopping */
  maxSteps?: number;

  /** Temperature (0-2) */
  temperature?: number;

  /** Max tokens per generation */
  maxTokens?: number;

  /** Stop condition */
  stopWhen?: StopCondition;

  /** Tool choice */
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'tool'; toolName: string };

  /** Enable reasoning/thinking output */
  reasoning?: boolean;

  /** Middleware to apply */
  middleware?: AgentMiddleware[];
}

export interface AgentToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Tool description for the model */
  description: string;

  /** Input schema (Zod) */
  parameters: z.ZodType<TInput>;

  /** Execution function */
  execute?: (input: TInput, context: ToolExecutionContext) => Promise<TOutput>;

  /** Whether this tool requires user approval */
  needsApproval?: boolean;

  /** Category for grouping */
  category?: string;

  /** Icon identifier */
  icon?: string;
}

export interface ToolExecutionContext {
  toolCallId: string;
  abortSignal?: AbortSignal;
  onProgress?: (progress: number, message?: string) => void;
}

// ============================================================================
// Stop Conditions
// ============================================================================

export type StopCondition =
  | { type: 'step-count'; maxSteps: number }
  | { type: 'tool-call'; toolName: string }
  | { type: 'custom'; check: (step: AgentStep) => boolean };

export function stepCountIs(maxSteps: number): StopCondition {
  return { type: 'step-count', maxSteps };
}

export function toolCalled(toolName: string): StopCondition {
  return { type: 'tool-call', toolName };
}

export function customStop(check: (step: AgentStep) => boolean): StopCondition {
  return { type: 'custom', check };
}

// ============================================================================
// Middleware
// ============================================================================

export interface AgentMiddleware {
  /** Unique name for this middleware */
  name: string;

  /** Called before generation */
  beforeGenerate?: (options: AgentGenerateOptions) => Promise<AgentGenerateOptions>;

  /** Called after generation */
  afterGenerate?: (result: AgentGenerateResult) => Promise<AgentGenerateResult>;

  /** Transform stream chunks */
  transformChunk?: (chunk: AgentStreamChunk) => AgentStreamChunk | null;
}

// ============================================================================
// Token Usage
// ============================================================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
  cachedPromptTokens?: number;
}

// ============================================================================
// Agent Types (for routing)
// ============================================================================

export type AgentType =
  | 'tool-loop'      // Standard ToolLoopAgent
  | 'dag'            // DAG-based parallel execution
  | 'council'        // Multi-specialist ensemble
  | 'router'         // Task classification/routing
  | 'cached'         // Semantic cache wrapper
  | 'custom';

export interface AgentMetadata {
  id: string;
  name: string;
  type: AgentType;
  description?: string;
  icon?: string;
  capabilities?: string[];
}
