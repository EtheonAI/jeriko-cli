/**
 * Message Schemas - Frontend ↔ Agent Service
 *
 * Schemas for messages, sessions, and API keys used by the orchestrator.
 */

import { z } from "zod";

// ============================================================================
// Message Parts
// ============================================================================

export const TextPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

export const ReasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
});

export const SourceUrlPartSchema = z.object({
  type: z.literal("source-url"),
  url: z.string(),
  sourceId: z.string().optional(),
  title: z.string().optional(),
});

export const MessagePartSchema = z.discriminatedUnion("type", [
  TextPartSchema,
  ReasoningPartSchema,
  SourceUrlPartSchema,
]);

// ============================================================================
// Message Schema
// ============================================================================

export const MessageSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
  parts: z.array(z.record(z.string(), z.unknown())).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
});

// ============================================================================
// Session Schema
// ============================================================================

export const SessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().nullable(),
  status: z.enum(["active", "archived", "deleted"]),
  model: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

// ============================================================================
// API Key Schema
// ============================================================================

export const ApiKeySchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  key: z.string().regex(/^rk_live_[A-Za-z0-9_-]{32}$/),
  keyPrefix: z.string(),
  name: z.string().min(1),
  isActive: z.boolean(),
  expiresAt: z.union([z.string(), z.date()]).nullable(),
  lastUsedAt: z.union([z.string(), z.date()]).nullable(),
  totalRequests: z.number().int().min(0),
});

// ============================================================================
// Type Exports
// ============================================================================

export type TextPart = z.infer<typeof TextPartSchema>;
export type ReasoningPart = z.infer<typeof ReasoningPartSchema>;
export type SourceUrlPart = z.infer<typeof SourceUrlPartSchema>;
export type MessagePart = z.infer<typeof MessagePartSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
