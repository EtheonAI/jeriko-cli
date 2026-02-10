/**
 * SSE Adapter - Convert between SSE string format and typed events
 *
 * Handles parsing and formatting of Server-Sent Events (SSE) for the orchestrator.
 */

import { SSEEvent, SSEEventSchema } from "../schemas/events";

// ============================================================================
// SSE Parsing
// ============================================================================

/**
 * Parse an SSE event string into a typed event object
 */
export function parseSSEEvent(eventString: string): SSEEvent | null {
  // SSE format: "data: {...}\n\n"
  const match = eventString.match(/^data:\s*(.+)$/m);
  if (!match) {
    return null;
  }

  const dataString = match[1].trim();

  // Handle [DONE] sentinel
  if (dataString === "[DONE]") {
    return null;
  }

  try {
    const rawData = JSON.parse(dataString);
    const result = SSEEventSchema.safeParse(rawData);

    if (result.success) {
      return result.data;
    }

    console.warn("Invalid SSE event:", result.error);
    return null;
  } catch (error) {
    console.warn("Failed to parse SSE event:", error);
    return null;
  }
}

/**
 * Parse multiple SSE events from a stream chunk
 */
export function parseSSEChunk(chunk: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = chunk.split("\n\n").filter(Boolean);

  for (const line of lines) {
    const event = parseSSEEvent(line);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

// ============================================================================
// SSE Formatting
// ============================================================================

/**
 * Format a typed event object into an SSE string
 */
export function formatSSEEvent(event: SSEEvent): string {
  const validated = SSEEventSchema.parse(event);
  const dataString = JSON.stringify(validated);
  return `data: ${dataString}\n\n`;
}

/**
 * Format the stream termination sentinel
 */
export function formatSSEDone(): string {
  return "data: [DONE]\n\n";
}

/**
 * Format multiple events into a single SSE chunk
 */
export function formatSSEChunk(events: SSEEvent[]): string {
  return events.map(formatSSEEvent).join("");
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a string is a valid SSE event
 */
export function isSSEEvent(str: string): boolean {
  return /^data:\s*.+$/m.test(str);
}

/**
 * Check if a string is the SSE done sentinel
 */
export function isSSEDone(str: string): boolean {
  return str.includes("[DONE]");
}
