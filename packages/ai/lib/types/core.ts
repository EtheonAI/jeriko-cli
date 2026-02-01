/**
 * @repo/ai - Core Type System
 *
 * Advanced type definitions for the Rubic AI platform.
 * Designed to be more comprehensive and type-safe than Vercel AI SDK.
 */

import { z } from 'zod';

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type MessageStatus =
  | 'pending'      // Message created, not yet sent
  | 'sending'      // Being transmitted
  | 'streaming'    // Actively streaming response
  | 'complete'     // Fully received
  | 'error'        // Failed
  | 'cancelled';   // User cancelled

// Text Part
export interface TextPart {
  type: 'text';
  text: string;
}

// Image Part
export interface ImagePart {
  type: 'image';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  mimeType?: string;
}

// File Part
export interface FilePart {
  type: 'file';
  url: string;
  name: string;
  mimeType: string;
  size?: number;
}

// Audio Part
export interface AudioPart {
  type: 'audio';
  url: string;
  duration?: number;
  transcript?: string;
  mimeType?: string;
}

// Tool Call Part (when AI invokes a tool)
export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  state: ToolCallState;
}

// Tool Result Part (tool execution result)
export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

// Reasoning Part (chain-of-thought)
export interface ReasoningPart {
  type: 'reasoning';
  text: string;
  isCollapsed?: boolean;
}

// Code Part
export interface CodePart {
  type: 'code';
  code: string;
  language: string;
  filename?: string;
  executable?: boolean;
}

// Union of all message parts
export type MessagePart =
  | TextPart
  | ImagePart
  | FilePart
  | AudioPart
  | ToolCallPart
  | ToolResultPart
  | ReasoningPart
  | CodePart;

// Tool call states (granular for UI feedback)
export type ToolCallState =
  | 'pending'           // Tool call queued
  | 'input-streaming'   // Tool inputs being generated
  | 'input-available'   // Ready to execute
  | 'executing'         // Currently running
  | 'output-streaming'  // Result being streamed
  | 'output-available'  // Complete with result
  | 'error';            // Execution failed

// Message metadata
export interface MessageMetadata {
  model?: string;
  provider?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  latency?: number;
  finishReason?: 'stop' | 'length' | 'tool-calls' | 'content-filter' | 'error';
  cached?: boolean;
  cacheHit?: 'full' | 'partial' | 'none';
}

// The core Message type
export interface Message {
  id: string;
  role: MessageRole;
  parts: MessagePart[];
  status: MessageStatus;
  createdAt: Date;
  updatedAt?: Date;
  metadata?: MessageMetadata;
  // Optimistic update tracking
  isOptimistic?: boolean;
  optimisticId?: string;
}

// Chat thread containing messages
export interface ChatThread {
  id: string;
  title: string | null;
  messages: Message[];
  status: 'active' | 'archived' | 'deleted';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Attachment Types
// ============================================================================

export type AttachmentType = 'file' | 'image' | 'document' | 'audio' | 'video' | 'code';

export type AttachmentSource =
  | 'local'        // Uploaded from device
  | 'clipboard'    // Pasted
  | 'drag-drop'    // Drag and dropped
  | 'url'          // From URL
  | 'google-drive' // Google Drive
  | 'onedrive'     // Microsoft OneDrive
  | 'dropbox'      // Dropbox
  | 'github'       // GitHub
  | 'notion';      // Notion

export type AttachmentStatus =
  | 'pending'      // Queued for upload
  | 'uploading'    // Currently uploading
  | 'processing'   // Server processing (e.g., extracting text)
  | 'ready'        // Ready to use
  | 'error';       // Upload/processing failed

export interface Attachment {
  id: string;
  name: string;
  type: AttachmentType;
  source: AttachmentSource;
  status: AttachmentStatus;
  mimeType: string;
  size: number;
  progress?: number;          // Upload progress 0-100
  url?: string;               // Final URL after upload
  thumbnailUrl?: string;      // Preview thumbnail
  file?: File;                // Original file (client-side only)
  error?: string;             // Error message if failed
  metadata?: {
    width?: number;           // Image/video dimensions
    height?: number;
    duration?: number;        // Audio/video duration
    pages?: number;           // Document pages
    extractedText?: string;   // OCR/extracted content
  };
}

export interface AttachmentConfig {
  maxSize: number;            // Max file size in bytes
  maxFiles: number;           // Max number of files
  allowedTypes: string[];     // MIME types or extensions
  uploadEndpoint: string;     // Upload API endpoint
  chunkSize?: number;         // For chunked uploads
  parallel?: number;          // Parallel upload count
}

// ============================================================================
// Tool Types
// ============================================================================

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  category?: string;          // For grouping tools
  icon?: string;              // Icon identifier
  inputSchema: z.ZodSchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
  // Advanced options
  timeout?: number;           // Execution timeout
  retries?: number;           // Retry count
  cacheable?: boolean;        // Can cache results
  requiresConfirmation?: boolean; // User must confirm
  dangerous?: boolean;        // Shows warning
}

export interface ToolContext {
  userId?: string;
  sessionId: string;
  messageId: string;
  abortSignal?: AbortSignal;
  onProgress?: (progress: number) => void;
  dataStream?: DataStreamWriter;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
  duration: number;
  cached?: boolean;
}

// ============================================================================
// Streaming Types
// ============================================================================

export type StreamEventType =
  | 'stream-start'
  | 'text-delta'
  | 'reasoning-delta'
  | 'tool-call-start'
  | 'tool-call-delta'
  | 'tool-call-complete'
  | 'tool-result'
  | 'message-complete'
  | 'stream-end'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  messageId: string;
  timestamp: number;
  data: unknown;
}

export interface TextDeltaEvent extends StreamEvent {
  type: 'text-delta';
  data: { delta: string; fullText: string };
}

export interface ToolCallStartEvent extends StreamEvent {
  type: 'tool-call-start';
  data: { toolCallId: string; toolName: string };
}

export interface ToolCallDeltaEvent extends StreamEvent {
  type: 'tool-call-delta';
  data: { toolCallId: string; argsDelta: string };
}

export interface ToolCallCompleteEvent extends StreamEvent {
  type: 'tool-call-complete';
  data: { toolCallId: string; args: Record<string, unknown> };
}

export interface ToolResultEvent extends StreamEvent {
  type: 'tool-result';
  data: { toolCallId: string; result: unknown; isError: boolean };
}

// Data stream writer interface
export interface DataStreamWriter {
  write: (event: Partial<StreamEvent>) => void;
  writeText: (delta: string) => void;
  writeToolCall: (toolCallId: string, toolName: string, args?: unknown) => void;
  writeToolResult: (toolCallId: string, result: unknown, isError?: boolean) => void;
  close: () => void;
}

// ============================================================================
// Provider Types
// ============================================================================

export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'mistral' | 'groq' | 'local';

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  contextWindow: number;
  maxOutput: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsStreaming?: boolean;
  inputCostPer1k?: number;    // Cost per 1k input tokens
  outputCostPer1k?: number;   // Cost per 1k output tokens
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt?: number;
  tags?: string[];
}

export interface CacheConfig {
  enabled: boolean;
  maxSize: number;            // Max entries
  ttl: number;                // Default TTL in ms
  storage: 'memory' | 'indexeddb' | 'localStorage';
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

const textPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});

const imagePartSchema = z.object({
  type: z.literal('image'),
  url: z.string().url(),
  alt: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  mimeType: z.string().optional(),
});

const filePartSchema = z.object({
  type: z.literal('file'),
  url: z.string(),
  name: z.string(),
  mimeType: z.string(),
  size: z.number().optional(),
});

const audioPartSchema = z.object({
  type: z.literal('audio'),
  url: z.string(),
  duration: z.number().optional(),
  transcript: z.string().optional(),
  mimeType: z.string().optional(),
});

const toolCallPartSchema = z.object({
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
  state: z.enum(['pending', 'input-streaming', 'input-available', 'executing', 'output-streaming', 'output-available', 'error']),
});

const toolResultPartSchema = z.object({
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
  isError: z.boolean().optional(),
});

const reasoningPartSchema = z.object({
  type: z.literal('reasoning'),
  text: z.string(),
  isCollapsed: z.boolean().optional(),
});

const codePartSchema = z.object({
  type: z.literal('code'),
  code: z.string(),
  language: z.string(),
  filename: z.string().optional(),
  executable: z.boolean().optional(),
});

export const messagePartSchema = z.discriminatedUnion('type', [
  textPartSchema,
  imagePartSchema,
  filePartSchema,
  audioPartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
  reasoningPartSchema,
  codePartSchema,
]);

export const messageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  parts: z.array(messagePartSchema),
  status: z.enum(['pending', 'sending', 'streaming', 'complete', 'error', 'cancelled']),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  metadata: z.object({
    model: z.string().optional(),
    provider: z.string().optional(),
    tokens: z.object({
      input: z.number(),
      output: z.number(),
      total: z.number(),
    }).optional(),
    latency: z.number().optional(),
    finishReason: z.enum(['stop', 'length', 'tool-calls', 'content-filter', 'error']).optional(),
    cached: z.boolean().optional(),
    cacheHit: z.enum(['full', 'partial', 'none']).optional(),
  }).optional(),
  isOptimistic: z.boolean().optional(),
  optimisticId: z.string().optional(),
});

export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['file', 'image', 'document', 'audio', 'video', 'code']),
  source: z.enum(['local', 'clipboard', 'drag-drop', 'url', 'google-drive', 'onedrive', 'dropbox', 'github', 'notion']),
  status: z.enum(['pending', 'uploading', 'processing', 'ready', 'error']),
  mimeType: z.string(),
  size: z.number(),
  progress: z.number().optional(),
  url: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  error: z.string().optional(),
});

// Type inference from schemas
export type ValidatedMessage = z.infer<typeof messageSchema>;
export type ValidatedAttachment = z.infer<typeof attachmentSchema>;
