/**
 * @repo/ai - Stream Chunk Types
 *
 * Types for UI message stream chunks - used for real-time communication
 * between server and client during streaming responses.
 */

import type { FinishReason, ProviderMetadata } from './ui-message';

// ============================================================================
// Text Chunks
// ============================================================================

export interface TextStartChunk {
  type: 'text-start';
  id: string;
  providerMetadata?: ProviderMetadata;
}

export interface TextDeltaChunk {
  type: 'text-delta';
  id: string;
  delta: string;
  providerMetadata?: ProviderMetadata;
}

export interface TextEndChunk {
  type: 'text-end';
  id: string;
  providerMetadata?: ProviderMetadata;
}

// ============================================================================
// Reasoning Chunks
// ============================================================================

export interface ReasoningStartChunk {
  type: 'reasoning-start';
  id: string;
  providerMetadata?: ProviderMetadata;
}

export interface ReasoningDeltaChunk {
  type: 'reasoning-delta';
  id: string;
  delta: string;
  providerMetadata?: ProviderMetadata;
}

export interface ReasoningEndChunk {
  type: 'reasoning-end';
  id: string;
  providerMetadata?: ProviderMetadata;
}

// ============================================================================
// Tool Chunks
// ============================================================================

export interface ToolInputStartChunk {
  type: 'tool-input-start';
  toolCallId: string;
  toolName: string;
  dynamic?: boolean;
  title?: string;
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
}

export interface ToolInputDeltaChunk {
  type: 'tool-input-delta';
  toolCallId: string;
  inputTextDelta: string;
}

export interface ToolInputAvailableChunk {
  type: 'tool-input-available';
  toolCallId: string;
  toolName: string;
  input: unknown;
  dynamic?: boolean;
  title?: string;
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
}

export interface ToolInputErrorChunk {
  type: 'tool-input-error';
  toolCallId: string;
  toolName: string;
  input?: unknown;
  errorText: string;
  dynamic?: boolean;
  providerExecuted?: boolean;
  providerMetadata?: ProviderMetadata;
}

export interface ToolApprovalRequestChunk {
  type: 'tool-approval-request';
  toolCallId: string;
  approvalId: string;
}

export interface ToolOutputAvailableChunk {
  type: 'tool-output-available';
  toolCallId: string;
  output: unknown;
  preliminary?: boolean;
  providerExecuted?: boolean;
}

export interface ToolOutputErrorChunk {
  type: 'tool-output-error';
  toolCallId: string;
  errorText: string;
  providerExecuted?: boolean;
}

export interface ToolOutputDeniedChunk {
  type: 'tool-output-denied';
  toolCallId: string;
}

// ============================================================================
// File & Source Chunks
// ============================================================================

export interface FileChunk {
  type: 'file';
  mediaType: string;
  url: string;
  filename?: string;
}

export interface SourceUrlChunk {
  type: 'source-url';
  sourceId: string;
  url: string;
  title?: string;
  providerMetadata?: ProviderMetadata;
}

export interface SourceDocumentChunk {
  type: 'source-document';
  sourceId: string;
  mediaType: string;
  title: string;
  filename?: string;
  providerMetadata?: ProviderMetadata;
}

// ============================================================================
// Step Chunks
// ============================================================================

export interface StartStepChunk {
  type: 'start-step';
}

export interface FinishStepChunk {
  type: 'finish-step';
}

// ============================================================================
// Control Chunks
// ============================================================================

export interface StartChunk {
  type: 'start';
  messageId?: string;
  messageMetadata?: unknown;
}

export interface FinishChunk {
  type: 'finish';
  finishReason?: FinishReason;
  messageMetadata?: unknown;
}

export interface MessageMetadataChunk {
  type: 'message-metadata';
  messageMetadata: unknown;
}

export interface ErrorChunk {
  type: 'error';
  errorText: string;
}

// ============================================================================
// Data Chunks (Custom Application Data)
// ============================================================================

export interface DataChunk<T = unknown> {
  type: `data-${string}`;
  id?: string;
  data: T;
  transient?: boolean; // If true, not added to message state
}

// ============================================================================
// Union Type
// ============================================================================

export type UIMessageStreamChunk =
  // Text
  | TextStartChunk
  | TextDeltaChunk
  | TextEndChunk
  // Reasoning
  | ReasoningStartChunk
  | ReasoningDeltaChunk
  | ReasoningEndChunk
  // Tool
  | ToolInputStartChunk
  | ToolInputDeltaChunk
  | ToolInputAvailableChunk
  | ToolInputErrorChunk
  | ToolApprovalRequestChunk
  | ToolOutputAvailableChunk
  | ToolOutputErrorChunk
  | ToolOutputDeniedChunk
  // File & Source
  | FileChunk
  | SourceUrlChunk
  | SourceDocumentChunk
  // Step
  | StartStepChunk
  | FinishStepChunk
  // Control
  | StartChunk
  | FinishChunk
  | MessageMetadataChunk
  | ErrorChunk
  // Data
  | DataChunk;

// ============================================================================
// Type Guards
// ============================================================================

export function isTextChunk(chunk: UIMessageStreamChunk): chunk is TextStartChunk | TextDeltaChunk | TextEndChunk {
  return chunk.type === 'text-start' || chunk.type === 'text-delta' || chunk.type === 'text-end';
}

export function isReasoningChunk(chunk: UIMessageStreamChunk): chunk is ReasoningStartChunk | ReasoningDeltaChunk | ReasoningEndChunk {
  return chunk.type === 'reasoning-start' || chunk.type === 'reasoning-delta' || chunk.type === 'reasoning-end';
}

export function isToolChunk(chunk: UIMessageStreamChunk): boolean {
  return chunk.type.startsWith('tool-');
}

export function isDataChunk(chunk: UIMessageStreamChunk): chunk is DataChunk {
  return chunk.type.startsWith('data-');
}

export function isControlChunk(chunk: UIMessageStreamChunk): chunk is StartChunk | FinishChunk | ErrorChunk {
  return chunk.type === 'start' || chunk.type === 'finish' || chunk.type === 'error';
}

// ============================================================================
// SSE Formatting
// ============================================================================

/**
 * Format a chunk as an SSE message
 */
export function formatSSEChunk(chunk: UIMessageStreamChunk): string {
  const lines: string[] = [];
  lines.push(`event: ${chunk.type}`);
  lines.push(`data: ${JSON.stringify(chunk)}`);
  return lines.join('\n') + '\n\n';
}

/**
 * Parse an SSE message into a chunk
 */
export function parseSSEChunk(message: string): UIMessageStreamChunk | null {
  const lines = message.split('\n');
  let data = '';

  for (const line of lines) {
    if (line.startsWith('data:')) {
      data += line.slice(5).trim();
    }
  }

  if (!data) return null;

  try {
    return JSON.parse(data) as UIMessageStreamChunk;
  } catch {
    return null;
  }
}

/**
 * Parse AI SDK data stream line into UIMessageStreamChunk
 *
 * AI SDK data stream format:
 * - 0:"text" - text delta
 * - 1:{...} - tool call
 * - 2:{...} - tool result
 * - 9:{...} - tool call streaming start
 * - a:{...} - tool call delta
 * - b:{...} - tool result
 * - d:{"finishReason":"stop"} - finish
 * - e:{...} - usage/metadata
 */
export function parseAISDKDataStream(line: string): UIMessageStreamChunk | null {
  if (!line || line.length < 2) return null;

  const prefix = line[0];
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return null;

  const content = line.slice(colonIndex + 1);

  try {
    switch (prefix) {
      case '0': {
        // Text delta
        const text = JSON.parse(content) as string;
        return {
          type: 'text-delta',
          id: 'text-0',
          delta: text,
        };
      }

      case '9': {
        // Tool call streaming start
        const data = JSON.parse(content) as {
          toolCallId: string;
          toolName: string;
        };
        return {
          type: 'tool-input-start',
          toolCallId: data.toolCallId,
          toolName: data.toolName,
        };
      }

      case 'a': {
        // Tool call delta
        const data = JSON.parse(content) as {
          toolCallId: string;
          argsTextDelta: string;
        };
        return {
          type: 'tool-input-delta',
          toolCallId: data.toolCallId,
          inputTextDelta: data.argsTextDelta,
        };
      }

      case 'b': {
        // Tool result
        const data = JSON.parse(content) as {
          toolCallId: string;
          result: unknown;
        };
        return {
          type: 'tool-output-available',
          toolCallId: data.toolCallId,
          output: data.result,
        };
      }

      case 'd': {
        // Finish
        const data = JSON.parse(content) as {
          finishReason?: string;
        };
        return {
          type: 'finish',
          finishReason: (data.finishReason as FinishReason) ?? 'stop',
        };
      }

      case 'e': {
        // Usage/metadata - convert to message metadata
        const data = JSON.parse(content) as unknown;
        return {
          type: 'message-metadata',
          messageMetadata: data,
        };
      }

      case '3': {
        // Error
        const errorText = JSON.parse(content) as string;
        return {
          type: 'error',
          errorText,
        };
      }

      default:
        // Unknown prefix, try to parse as JSON
        try {
          return JSON.parse(content) as UIMessageStreamChunk;
        } catch {
          return null;
        }
    }
  } catch {
    return null;
  }
}

// ============================================================================
// Stream Writer Interface
// ============================================================================

export interface UIMessageStreamWriter {
  /** Write a raw chunk */
  write(chunk: UIMessageStreamChunk): void;

  /** Write text start */
  writeTextStart(id: string, providerMetadata?: ProviderMetadata): void;

  /** Write text delta */
  writeTextDelta(id: string, delta: string): void;

  /** Write text end */
  writeTextEnd(id: string): void;

  /** Write a complete text in one go (convenience method) */
  writeText(text: string): void;

  /** Write reasoning start */
  writeReasoningStart(id: string, providerMetadata?: ProviderMetadata): void;

  /** Write reasoning delta */
  writeReasoningDelta(id: string, delta: string): void;

  /** Write reasoning end */
  writeReasoningEnd(id: string): void;

  /** Write tool input start */
  writeToolInputStart(options: {
    toolCallId: string;
    toolName: string;
    dynamic?: boolean;
    title?: string;
  }): void;

  /** Write tool input delta */
  writeToolInputDelta(toolCallId: string, delta: string): void;

  /** Write tool input available */
  writeToolInputAvailable(options: {
    toolCallId: string;
    toolName: string;
    input: unknown;
    dynamic?: boolean;
  }): void;

  /** Write tool output available */
  writeToolOutput(options: {
    toolCallId: string;
    output: unknown;
    preliminary?: boolean;
  }): void;

  /** Write tool output error */
  writeToolError(options: {
    toolCallId: string;
    errorText: string;
  }): void;

  /** Write a file */
  writeFile(options: { mediaType: string; url: string; filename?: string }): void;

  /** Write source URL */
  writeSourceUrl(options: { sourceId: string; url: string; title?: string }): void;

  /** Write stream start */
  writeStart(options?: { messageId?: string; messageMetadata?: unknown }): void;

  /** Write stream finish */
  writeFinish(options?: { finishReason?: FinishReason; messageMetadata?: unknown }): void;

  /** Write error */
  writeError(errorText: string): void;

  /** Write custom data */
  writeData<T>(type: string, data: T, options?: { id?: string; transient?: boolean }): void;

  /** Close the stream */
  close(): void;

  /** Check if stream is closed */
  isClosed(): boolean;
}
