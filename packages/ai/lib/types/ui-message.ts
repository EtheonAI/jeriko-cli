/**
 * @repo/ai - UI Message Type System
 *
 * Enhanced message types following Vercel AI SDK 6.x UIMessage patterns
 * with full tool state handling, streaming states, and metadata support.
 */

import { z } from 'zod';

// ============================================================================
// Core Message Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Hook/Chat status states
 */
export type ChatStatus =
  | 'submitted'   // Message sent, awaiting stream start
  | 'streaming'   // Actively receiving response
  | 'ready'       // Idle, ready for new message
  | 'error';      // Error occurred

/**
 * Text part streaming state
 */
export type PartStreamingState = 'streaming' | 'done';

// ============================================================================
// Message Part Types (Following Vercel AI SDK patterns)
// ============================================================================

/**
 * Text content part
 */
export interface TextUIPart {
  type: 'text';
  text: string;
  state?: PartStreamingState;
  providerMetadata?: ProviderMetadata;
}

/**
 * Reasoning/thinking content part (for chain-of-thought)
 */
export interface ReasoningUIPart {
  type: 'reasoning';
  text: string;
  state?: PartStreamingState;
  providerMetadata?: ProviderMetadata;
}

/**
 * File attachment part
 */
export interface FileUIPart {
  type: 'file';
  mediaType: string;
  filename?: string;
  url: string;
  providerMetadata?: ProviderMetadata;
}

/**
 * Source URL citation part
 */
export interface SourceUrlUIPart {
  type: 'source-url';
  sourceId: string;
  url: string;
  title?: string;
  providerMetadata?: ProviderMetadata;
}

/**
 * Source document citation part
 */
export interface SourceDocumentUIPart {
  type: 'source-document';
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
  providerMetadata?: ProviderMetadata;
}

/**
 * Step boundary marker
 */
export interface StepStartUIPart {
  type: 'step-start';
}

/**
 * Custom data part (for application-specific data)
 */
export interface DataUIPart<T = unknown> {
  type: `data-${string}`;
  id?: string;
  data: T;
}

// ============================================================================
// Tool Invocation States
// ============================================================================

/**
 * Tool invocation states - granular states for UI feedback
 */
export type ToolInvocationState =
  | 'input-streaming'      // Tool arguments being generated
  | 'input-available'      // Arguments ready, waiting for execution
  | 'approval-requested'   // Waiting for user approval
  | 'approval-responded'   // User has responded to approval
  | 'output-available'     // Tool executed successfully
  | 'output-error'         // Tool execution failed
  | 'output-denied';       // User denied execution

/**
 * Tool approval info
 */
export interface ToolApproval {
  id: string;
  approved?: boolean;
  reason?: string;
}

/**
 * Base tool invocation fields
 */
interface ToolInvocationBase {
  toolCallId: string;
  title?: string;
  providerExecuted?: boolean;
  callProviderMetadata?: ProviderMetadata;
}

/**
 * Tool invocation with input streaming
 */
export interface ToolInputStreamingState extends ToolInvocationBase {
  state: 'input-streaming';
  input: unknown | undefined;
  output?: never;
  errorText?: never;
  approval?: never;
}

/**
 * Tool invocation with input available
 */
export interface ToolInputAvailableState<TInput = unknown> extends ToolInvocationBase {
  state: 'input-available';
  input: TInput;
  output?: never;
  errorText?: never;
  approval?: never;
}

/**
 * Tool invocation waiting for approval
 */
export interface ToolApprovalRequestedState<TInput = unknown> extends ToolInvocationBase {
  state: 'approval-requested';
  input: TInput;
  output?: never;
  errorText?: never;
  approval: { id: string };
}

/**
 * Tool invocation after approval response
 */
export interface ToolApprovalRespondedState<TInput = unknown> extends ToolInvocationBase {
  state: 'approval-responded';
  input: TInput;
  output?: never;
  errorText?: never;
  approval: ToolApproval & { approved: boolean };
}

/**
 * Tool invocation with output available
 */
export interface ToolOutputAvailableState<TInput = unknown, TOutput = unknown> extends ToolInvocationBase {
  state: 'output-available';
  input: TInput;
  output: TOutput;
  errorText?: never;
  preliminary?: boolean;
  approval?: ToolApproval & { approved: true };
}

/**
 * Tool invocation with error
 */
export interface ToolOutputErrorState<TInput = unknown> extends ToolInvocationBase {
  state: 'output-error';
  input: TInput | undefined;
  rawInput?: unknown;
  output?: never;
  errorText: string;
  approval?: ToolApproval & { approved: true };
}

/**
 * Tool invocation denied by user
 */
export interface ToolOutputDeniedState<TInput = unknown> extends ToolInvocationBase {
  state: 'output-denied';
  input: TInput;
  output?: never;
  errorText?: never;
  approval: ToolApproval & { approved: false };
}

/**
 * Union of all tool invocation states
 */
export type ToolInvocation<TInput = unknown, TOutput = unknown> =
  | ToolInputStreamingState
  | ToolInputAvailableState<TInput>
  | ToolApprovalRequestedState<TInput>
  | ToolApprovalRespondedState<TInput>
  | ToolOutputAvailableState<TInput, TOutput>
  | ToolOutputErrorState<TInput>
  | ToolOutputDeniedState<TInput>;

/**
 * Static tool part (type is tool-{toolName})
 */
export interface StaticToolUIPart<TInput = unknown, TOutput = unknown> {
  type: `tool-${string}`;
  toolCallId: string;
  title?: string;
  providerExecuted?: boolean;
  callProviderMetadata?: ProviderMetadata;
  state: ToolInvocationState;
  input: TInput | undefined;
  output?: TOutput;
  errorText?: string;
  rawInput?: unknown;
  preliminary?: boolean;
  approval?: ToolApproval;
}

/**
 * Dynamic tool part (for tools not known at compile time)
 */
export interface DynamicToolUIPart {
  type: 'dynamic-tool';
  toolName: string;
  toolCallId: string;
  title?: string;
  providerExecuted?: boolean;
  callProviderMetadata?: ProviderMetadata;
  state: ToolInvocationState;
  input: unknown | undefined;
  output?: unknown;
  errorText?: string;
  preliminary?: boolean;
  approval?: ToolApproval;
}

// ============================================================================
// Combined Message Part Type
// ============================================================================

/**
 * All possible message part types
 */
export type UIMessagePart<TDataTypes extends Record<string, unknown> = Record<string, unknown>> =
  | TextUIPart
  | ReasoningUIPart
  | FileUIPart
  | SourceUrlUIPart
  | SourceDocumentUIPart
  | StepStartUIPart
  | DataUIPart<TDataTypes[keyof TDataTypes]>
  | StaticToolUIPart
  | DynamicToolUIPart;

// ============================================================================
// Provider Metadata
// ============================================================================

export interface ProviderMetadata {
  [key: string]: unknown;
}

// ============================================================================
// Message Metadata
// ============================================================================

export interface MessageMetadata {
  model?: string;
  provider?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latency?: number;
  finishReason?: FinishReason;
  cached?: boolean;
  cacheHit?: 'full' | 'partial' | 'none';
  [key: string]: unknown;
}

export type FinishReason =
  | 'stop'           // Natural completion
  | 'length'         // Max tokens reached
  | 'tool-calls'     // Stopped for tool calls
  | 'content-filter' // Content filtered
  | 'error'          // Error occurred
  | 'other';

// ============================================================================
// UI Message Type
// ============================================================================

/**
 * Main UI Message type - used for client-server communication
 */
export interface UIMessage<
  TMetadata = MessageMetadata,
  TDataTypes extends Record<string, unknown> = Record<string, unknown>,
> {
  /** Unique message identifier */
  id: string;

  /** Message role */
  role: MessageRole;

  /** Message parts (content) */
  parts: Array<UIMessagePart<TDataTypes>>;

  /** Optional metadata */
  metadata?: TMetadata;

  /** Creation timestamp */
  createdAt?: Date;

  /** Last update timestamp */
  updatedAt?: Date;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isTextUIPart(part: UIMessagePart | null | undefined): part is TextUIPart {
  return part != null && part.type === 'text';
}

export function isReasoningUIPart(part: UIMessagePart | null | undefined): part is ReasoningUIPart {
  return part != null && part.type === 'reasoning';
}

export function isFileUIPart(part: UIMessagePart | null | undefined): part is FileUIPart {
  return part != null && part.type === 'file';
}

export function isStaticToolUIPart(part: UIMessagePart | null | undefined): part is StaticToolUIPart {
  return part != null && typeof part.type === 'string' && part.type.startsWith('tool-');
}

export function isDynamicToolUIPart(part: UIMessagePart | null | undefined): part is DynamicToolUIPart {
  return part != null && part.type === 'dynamic-tool';
}

export function isToolUIPart(part: UIMessagePart | null | undefined): part is StaticToolUIPart | DynamicToolUIPart {
  return isStaticToolUIPart(part) || isDynamicToolUIPart(part);
}

export function isDataUIPart(part: UIMessagePart | null | undefined): part is DataUIPart {
  return part != null && typeof part.type === 'string' && part.type.startsWith('data-');
}

export function isSourceUrlUIPart(part: UIMessagePart | null | undefined): part is SourceUrlUIPart {
  return part != null && part.type === 'source-url';
}

export function isSourceDocumentUIPart(part: UIMessagePart | null | undefined): part is SourceDocumentUIPart {
  return part != null && part.type === 'source-document';
}

export function isStepStartUIPart(part: UIMessagePart | null | undefined): part is StepStartUIPart {
  return part != null && part.type === 'step-start';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the tool name from a tool part
 */
export function getToolName(part: StaticToolUIPart | DynamicToolUIPart): string {
  if (isDynamicToolUIPart(part)) {
    return part.toolName;
  }
  return part.type.slice(5); // Remove 'tool-' prefix
}

/**
 * Extract text content from a message
 */
export function getMessageText(message: UIMessage): string {
  return message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join('');
}

/**
 * Check if message has pending tool calls
 */
export function hasPendingToolCalls(message: UIMessage): boolean {
  return message.parts
    .filter(isToolUIPart)
    .some((part) =>
      part.state === 'input-streaming' ||
      part.state === 'input-available' ||
      part.state === 'approval-requested' ||
      part.state === 'approval-responded'
    );
}

/**
 * Check if message has tools awaiting approval
 */
export function hasToolsAwaitingApproval(message: UIMessage): boolean {
  return message.parts
    .filter(isToolUIPart)
    .some((part) => part.state === 'approval-requested');
}

/**
 * Get all tool parts from a message
 */
export function getToolParts(message: UIMessage): Array<StaticToolUIPart | DynamicToolUIPart> {
  return message.parts.filter(isToolUIPart);
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const textUIPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const reasoningUIPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
  state: z.enum(['streaming', 'done']).optional(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const fileUIPartSchema = z.object({
  type: z.literal('file'),
  mediaType: z.string(),
  filename: z.string().optional(),
  url: z.string(),
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

export const toolInvocationStateSchema = z.enum([
  'input-streaming',
  'input-available',
  'approval-requested',
  'approval-responded',
  'output-available',
  'output-error',
  'output-denied',
]);

export const dynamicToolUIPartSchema = z.object({
  type: z.literal('dynamic-tool'),
  toolName: z.string(),
  toolCallId: z.string(),
  title: z.string().optional(),
  providerExecuted: z.boolean().optional(),
  state: toolInvocationStateSchema,
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
  preliminary: z.boolean().optional(),
  approval: z.object({
    id: z.string(),
    approved: z.boolean().optional(),
    reason: z.string().optional(),
  }).optional(),
});

// Helper for date coercion
const dateSchema = z.preprocess((val) => {
  if (val instanceof Date) return val;
  if (typeof val === 'string' || typeof val === 'number') return new Date(val);
  return val;
}, z.date());

export const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant']),
  parts: z.array(z.unknown()), // Loose validation for parts
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: dateSchema.optional(),
  updatedAt: dateSchema.optional(),
});

export type ValidatedUIMessage = z.infer<typeof uiMessageSchema>;
