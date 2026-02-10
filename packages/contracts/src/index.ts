/**
 * @repo/contracts
 *
 * Type-safe contracts for orchestrator communication.
 * Provides Zod schemas, TypeScript types, and format adapters for:
 * - SSE events (agent service → frontend)
 * - Tool definitions (agent service tools)
 * - Messages, sessions, and API keys
 *
 * @example
 * ```ts
 * import { SSEEventSchema, parseSSEEvent } from '@repo/contracts';
 *
 * const event = parseSSEEvent(sseString);
 * if (event) {
 *   const validated = SSEEventSchema.parse(event);
 *   // Use typed event
 * }
 * ```
 */

// Re-export all schemas
export * from "./schemas";

// Re-export all adapters
export * from "./adapters";

// Re-export all types
export * from "./types";
