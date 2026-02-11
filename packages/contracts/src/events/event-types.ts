import { z } from 'zod';

/**
 * Canonical 21-event protocol for Rubic agent-to-client streaming.
 *
 * CRITICAL: These event types are frozen as of Feb 2026.
 * DO NOT add/remove/rename without Phase 6 approval.
 *
 * Status:
 * - 18 verified in production (used by Python agent)
 * - 3 reserved for future use (Node orchestrator)
 */

// Text content events (3)
export const textStartEvent = z.object({
  type: z.literal('text-start'),
  timestamp: z.string().datetime(),
});

export const textDeltaEvent = z.object({
  type: z.literal('text-delta'),
  delta: z.string().describe('Incremental text content'),
  timestamp: z.string().datetime(),
});

export const textEndEvent = z.object({
  type: z.literal('text-end'),
  timestamp: z.string().datetime(),
});

// Reasoning events (3)
export const reasoningStartEvent = z.object({
  type: z.literal('reasoning-start'),
  timestamp: z.string().datetime(),
});

export const reasoningDeltaEvent = z.object({
  type: z.literal('reasoning-delta'),
  delta: z.string().describe('Incremental reasoning content'),
  timestamp: z.string().datetime(),
});

export const reasoningEndEvent = z.object({
  type: z.literal('reasoning-end'),
  timestamp: z.string().datetime(),
});

// Tool input events (2)
export const toolInputStartEvent = z.object({
  type: z.literal('tool-input-start'),
  toolCallId: z.string(),
  toolName: z.string(),
  timestamp: z.string().datetime(),
});

export const toolInputAvailableEvent = z.object({
  type: z.literal('tool-input-available'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
  timestamp: z.string().datetime(),
});

// Tool output events (2)
export const toolOutputAvailableEvent = z.object({
  type: z.literal('tool-output-available'),
  toolCallId: z.string(),
  result: z.unknown(),
  timestamp: z.string().datetime(),
});

export const toolOutputErrorEvent = z.object({
  type: z.literal('tool-output-error'),
  toolCallId: z.string(),
  error: z.string(),
  timestamp: z.string().datetime(),
});

// Step events (2)
export const startStepEvent = z.object({
  type: z.literal('start-step'),
  stepId: z.string(),
  description: z.string(),
  timestamp: z.string().datetime(),
});

export const finishStepEvent = z.object({
  type: z.literal('finish-step'),
  stepId: z.string(),
  status: z.enum(['completed', 'failed', 'skipped']),
  timestamp: z.string().datetime(),
});

// Metadata events (2)
export const sourceUrlEvent = z.object({
  type: z.literal('source-url'),
  url: z.string().url(),
  title: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const messageMetadataEvent = z.object({
  type: z.literal('message-metadata'),
  metadata: z.record(z.string(), z.unknown()).describe('Arbitrary metadata (screenshots, browser frames, etc.)'),
  timestamp: z.string().datetime(),
});

// Stream lifecycle events (2)
export const startEvent = z.object({
  type: z.literal('start'),
  sessionId: z.string(),
  messageId: z.string().optional(),
  timestamp: z.string().datetime(),
});

export const finishEvent = z.object({
  type: z.literal('finish'),
  finishReason: z.enum(['stop', 'length', 'tool_calls', 'error']),
  usage: z.object({
    promptTokens: z.number().int(),
    completionTokens: z.number().int(),
    totalTokens: z.number().int(),
  }).optional(),
  timestamp: z.string().datetime(),
});

// Runtime control events (2)
export const errorEvent = z.object({
  type: z.literal('error'),
  error: z.string(),
  timestamp: z.string().datetime(),
});

export const abortEvent = z.object({
  type: z.literal('abort'),
  reason: z.string().optional(),
  timestamp: z.string().datetime(),
});

// RESERVED EVENTS (not yet used - for Node orchestrator Phase 5+)
export const toolInputDeltaEvent = z.object({
  type: z.literal('tool-input-delta'),
  toolCallId: z.string(),
  delta: z.unknown().describe('Incremental tool input streaming'),
  timestamp: z.string().datetime(),
});

export const toolStreamingStartEvent = z.object({
  type: z.literal('tool-streaming-start'),
  toolCallId: z.string(),
  toolName: z.string(),
  timestamp: z.string().datetime(),
});

export const toolStreamingChunkEvent = z.object({
  type: z.literal('tool-streaming-chunk'),
  toolCallId: z.string(),
  chunk: z.unknown(),
  timestamp: z.string().datetime(),
});

// Union of all events
export const streamEventSchema = z.discriminatedUnion('type', [
  // Active (18)
  textStartEvent,
  textDeltaEvent,
  textEndEvent,
  reasoningStartEvent,
  reasoningDeltaEvent,
  reasoningEndEvent,
  toolInputStartEvent,
  toolInputAvailableEvent,
  toolOutputAvailableEvent,
  toolOutputErrorEvent,
  startStepEvent,
  finishStepEvent,
  sourceUrlEvent,
  messageMetadataEvent,
  startEvent,
  finishEvent,
  errorEvent,
  abortEvent,
  // Reserved (3)
  toolInputDeltaEvent,
  toolStreamingStartEvent,
  toolStreamingChunkEvent,
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;

// Type exports
export type TextStartEvent = z.infer<typeof textStartEvent>;
export type TextDeltaEvent = z.infer<typeof textDeltaEvent>;
export type TextEndEvent = z.infer<typeof textEndEvent>;
export type ReasoningStartEvent = z.infer<typeof reasoningStartEvent>;
export type ReasoningDeltaEvent = z.infer<typeof reasoningDeltaEvent>;
export type ReasoningEndEvent = z.infer<typeof reasoningEndEvent>;
export type ToolInputStartEvent = z.infer<typeof toolInputStartEvent>;
export type ToolInputAvailableEvent = z.infer<typeof toolInputAvailableEvent>;
export type ToolOutputAvailableEvent = z.infer<typeof toolOutputAvailableEvent>;
export type ToolOutputErrorEvent = z.infer<typeof toolOutputErrorEvent>;
export type StartStepEvent = z.infer<typeof startStepEvent>;
export type FinishStepEvent = z.infer<typeof finishStepEvent>;
export type SourceUrlEvent = z.infer<typeof sourceUrlEvent>;
export type MessageMetadataEvent = z.infer<typeof messageMetadataEvent>;
export type StartEvent = z.infer<typeof startEvent>;
export type FinishEvent = z.infer<typeof finishEvent>;
export type ErrorEvent = z.infer<typeof errorEvent>;
export type AbortEvent = z.infer<typeof abortEvent>;

// Event type string literal
export type EventType = StreamEvent['type'];

// Event registry metadata
export const EVENT_REGISTRY = {
  active: [
    'text-start',
    'text-delta',
    'text-end',
    'reasoning-start',
    'reasoning-delta',
    'reasoning-end',
    'tool-input-start',
    'tool-input-available',
    'tool-output-available',
    'tool-output-error',
    'start-step',
    'finish-step',
    'source-url',
    'message-metadata',
    'start',
    'finish',
    'error',
    'abort',
  ] as const,
  reserved: [
    'tool-input-delta',
    'tool-streaming-start',
    'tool-streaming-chunk',
  ] as const,
  total: 21,
  version: '1.0.0',
  frozenDate: '2026-02-16',
};
