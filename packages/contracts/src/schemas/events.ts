/**
 * SSE Event Schemas - Agent Service → Frontend
 *
 * Canonical event schemas for orchestrator communication.
 * These match the event types defined in services/agent/src/events.py
 */

import { z } from "zod";

// ============================================================================
// Base Event Schema
// ============================================================================

export const BaseEventSchema = z.object({
  type: z.string(),
  timestamp: z.number(),
});

// ============================================================================
// Session Lifecycle Events
// ============================================================================

export const SessionCreatedEventSchema = z.object({
  type: z.literal("session_created"),
  timestamp: z.number(),
  sessionId: z.string().min(1),
  sandboxId: z.string().min(1),
  nekoUrl: z.string().url().optional(),
});

export const SessionReconnectedEventSchema = z.object({
  type: z.literal("session_reconnected"),
  timestamp: z.number(),
  sessionId: z.string().min(1),
  sandboxId: z.string().min(1),
});

export const SessionExpiredEventSchema = z.object({
  type: z.literal("session_expired"),
  timestamp: z.number(),
  sessionId: z.string().min(1),
});

export const SessionTerminatedEventSchema = z.object({
  type: z.literal("session_terminated"),
  timestamp: z.number(),
  sessionId: z.string().min(1),
});

// ============================================================================
// Sandbox Events
// ============================================================================

export const SandboxInfoEventSchema = z.object({
  type: z.literal("sandbox_info"),
  timestamp: z.number(),
  sandboxId: z.string().min(1),
  nekoUrl: z.string().url().optional(),
  streamUrl: z.string().url().optional(),
});

export const NekoReadyEventSchema = z.object({
  type: z.literal("neko_ready"),
  timestamp: z.number(),
  sandboxId: z.string().min(1),
  nekoUrl: z.string().url(),
});

// ============================================================================
// Tool Execution Events
// ============================================================================

export const ToolCallStartedEventSchema = z.object({
  type: z.literal("tool_call_started"),
  timestamp: z.number(),
  toolCallId: z.string().min(1),
  tool: z.string().min(1),
  input: z.any(),
});

export const ToolStreamChunkEventSchema = z.object({
  type: z.literal("tool_stream_chunk"),
  timestamp: z.number(),
  toolCallId: z.string().min(1),
  chunk: z.string(),
  stream: z.enum(["stdout", "stderr"]).default("stdout"),
});

export const ToolCallCompletedEventSchema = z.object({
  type: z.literal("tool_call_completed"),
  timestamp: z.number(),
  toolCallId: z.string().min(1),
  tool: z.string().min(1),
  success: z.boolean().default(true),
  result: z.unknown(),
});

export const ToolCallFailedEventSchema = z.object({
  type: z.literal("tool_call_failed"),
  timestamp: z.number(),
  toolCallId: z.string().min(1),
  tool: z.string().min(1),
  success: z.literal(false),
  error: z.string(),
});

// ============================================================================
// File Events
// ============================================================================

export const FileCreatedEventSchema = z.object({
  type: z.literal("file_created"),
  timestamp: z.number(),
  path: z.string().min(1),
  contentPreview: z.string().optional(),
});

export const FileUpdatedEventSchema = z.object({
  type: z.literal("file_updated"),
  timestamp: z.number(),
  path: z.string().min(1),
  contentPreview: z.string().optional(),
});

export const FileReadEventSchema = z.object({
  type: z.literal("file_read"),
  timestamp: z.number(),
  path: z.string().min(1),
  contentPreview: z.string().optional(),
});

// ============================================================================
// Browser Events
// ============================================================================

export const BrowserFrameEventSchema = z.object({
  type: z.literal("browser_frame"),
  timestamp: z.number(),
  screenshot: z.string().min(1),
  url: z.string().default(""),
  title: z.string().default(""),
});

export const BrowserStateEventSchema = z.object({
  type: z.literal("browser_state"),
  timestamp: z.number(),
  state: z.any(),
});

// ============================================================================
// LLM Content Events
// ============================================================================

export const ContentEventSchema = z.object({
  type: z.literal("content"),
  timestamp: z.number(),
  content: z.string(),
});

export const ReasoningEventSchema = z.object({
  type: z.literal("reasoning"),
  timestamp: z.number(),
  text: z.string(),
});

export const ReasoningEndEventSchema = z.object({
  type: z.literal("reasoning_end"),
  timestamp: z.number(),
});

export const SourceUrlEventSchema = z.object({
  type: z.literal("source_url"),
  timestamp: z.number(),
  url: z.string().url(),
  sourceId: z.string().optional(),
  title: z.string().optional(),
});

export const UsageEventSchema = z.object({
  type: z.literal("usage"),
  timestamp: z.number(),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  reasoningTokens: z.number().int().min(0).optional(),
});

export const ErrorEventSchema = z.object({
  type: z.literal("error"),
  timestamp: z.number(),
  error: z.string(),
  code: z.string().optional(),
});

export const WarningEventSchema = z.object({
  type: z.literal("warning"),
  timestamp: z.number(),
  message: z.string(),
});

// ============================================================================
// Union of All Event Types
// ============================================================================

export const SSEEventSchema = z.discriminatedUnion("type", [
  SessionCreatedEventSchema,
  SessionReconnectedEventSchema,
  SessionExpiredEventSchema,
  SessionTerminatedEventSchema,
  SandboxInfoEventSchema,
  NekoReadyEventSchema,
  ToolCallStartedEventSchema,
  ToolStreamChunkEventSchema,
  ToolCallCompletedEventSchema,
  ToolCallFailedEventSchema,
  FileCreatedEventSchema,
  FileUpdatedEventSchema,
  FileReadEventSchema,
  BrowserFrameEventSchema,
  BrowserStateEventSchema,
  ContentEventSchema,
  ReasoningEventSchema,
  ReasoningEndEventSchema,
  SourceUrlEventSchema,
  UsageEventSchema,
  ErrorEventSchema,
  WarningEventSchema,
]);

// ============================================================================
// Type Exports
// ============================================================================

export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type SessionCreatedEvent = z.infer<typeof SessionCreatedEventSchema>;
export type SessionReconnectedEvent = z.infer<typeof SessionReconnectedEventSchema>;
export type SessionExpiredEvent = z.infer<typeof SessionExpiredEventSchema>;
export type SessionTerminatedEvent = z.infer<typeof SessionTerminatedEventSchema>;
export type SandboxInfoEvent = z.infer<typeof SandboxInfoEventSchema>;
export type NekoReadyEvent = z.infer<typeof NekoReadyEventSchema>;
export type ToolCallStartedEvent = z.infer<typeof ToolCallStartedEventSchema>;
export type ToolStreamChunkEvent = z.infer<typeof ToolStreamChunkEventSchema>;
export type ToolCallCompletedEvent = z.infer<typeof ToolCallCompletedEventSchema>;
export type ToolCallFailedEvent = z.infer<typeof ToolCallFailedEventSchema>;
export type FileCreatedEvent = z.infer<typeof FileCreatedEventSchema>;
export type FileUpdatedEvent = z.infer<typeof FileUpdatedEventSchema>;
export type FileReadEvent = z.infer<typeof FileReadEventSchema>;
export type BrowserFrameEvent = z.infer<typeof BrowserFrameEventSchema>;
export type BrowserStateEvent = z.infer<typeof BrowserStateEventSchema>;
export type ContentEvent = z.infer<typeof ContentEventSchema>;
export type ReasoningEvent = z.infer<typeof ReasoningEventSchema>;
export type ReasoningEndEvent = z.infer<typeof ReasoningEndEventSchema>;
export type SourceUrlEvent = z.infer<typeof SourceUrlEventSchema>;
export type UsageEvent = z.infer<typeof UsageEventSchema>;
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;
export type WarningEvent = z.infer<typeof WarningEventSchema>;
export type SSEEvent = z.infer<typeof SSEEventSchema>;
