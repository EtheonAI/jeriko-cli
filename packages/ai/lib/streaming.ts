/**
 * @repo/ai - Advanced Streaming System
 *
 * High-performance streaming utilities for real-time AI responses.
 * Supports SSE, WebSocket, and hybrid transports.
 */

import type {
  DataStreamWriter,
  Message,
  MessagePart,
  StreamEvent,
  StreamEventType,
  ToolCallState,
} from './types/core';

// ============================================================================
// ID Generation
// ============================================================================

let counter = 0;

export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const count = (counter++).toString(36);
  return prefix ? `${prefix}_${timestamp}${random}${count}` : `${timestamp}${random}${count}`;
}

export function generateMessageId(): string {
  return generateId('msg');
}

export function generateToolCallId(): string {
  return generateId('tool');
}

export function generateAttachmentId(): string {
  return generateId('att');
}

// ============================================================================
// SSE Stream Utilities
// ============================================================================

export interface SSEParseResult {
  type: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export function parseSSEMessage(chunk: string): SSEParseResult | null {
  const lines = chunk.split('\n');
  let eventType = 'message';
  let data = '';
  let id: string | undefined;
  let retry: number | undefined;

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      data += line.slice(5).trim();
    } else if (line.startsWith('id:')) {
      id = line.slice(3).trim();
    } else if (line.startsWith('retry:')) {
      retry = parseInt(line.slice(6).trim(), 10);
    }
  }

  if (!data) return null;

  try {
    return {
      type: eventType,
      data: JSON.parse(data),
      id,
      retry,
    };
  } catch {
    return {
      type: eventType,
      data,
      id,
      retry,
    };
  }
}

export function formatSSEMessage(event: Partial<StreamEvent>): string {
  const lines: string[] = [];

  if (event.type) {
    lines.push(`event: ${event.type}`);
  }

  lines.push(`data: ${JSON.stringify(event)}`);

  if (event.messageId) {
    lines.push(`id: ${event.messageId}`);
  }

  return lines.join('\n') + '\n\n';
}

// ============================================================================
// Data Stream Writer Implementation
// ============================================================================

export function createDataStreamWriter(
  writable: WritableStreamDefaultWriter<Uint8Array>
): DataStreamWriter {
  const encoder = new TextEncoder();
  let isClosed = false;

  const write = (event: Partial<StreamEvent>): void => {
    if (isClosed) return;

    const fullEvent: StreamEvent = {
      type: event.type ?? ('data' as StreamEventType),
      messageId: event.messageId ?? '',
      timestamp: Date.now(),
      data: event.data,
    };

    const sseMessage = formatSSEMessage(fullEvent);
    writable.write(encoder.encode(sseMessage));
  };

  return {
    write,

    writeText(delta: string): void {
      write({
        type: 'text-delta',
        data: { delta },
      });
    },

    writeToolCall(toolCallId: string, toolName: string, args?: unknown): void {
      if (args !== undefined) {
        write({
          type: 'tool-call-complete',
          data: { toolCallId, toolName, args },
        });
      } else {
        write({
          type: 'tool-call-start',
          data: { toolCallId, toolName },
        });
      }
    },

    writeToolResult(toolCallId: string, result: unknown, isError = false): void {
      write({
        type: 'tool-result',
        data: { toolCallId, result, isError },
      });
    },

    close(): void {
      if (isClosed) return;
      isClosed = true;

      write({ type: 'stream-end', data: null });
      writable.close();
    },
  };
}

// ============================================================================
// Stream Reader for Client
// ============================================================================

export interface StreamReaderCallbacks {
  onTextDelta?: (delta: string, fullText: string) => void;
  onToolCallStart?: (toolCallId: string, toolName: string) => void;
  onToolCallDelta?: (toolCallId: string, argsDelta: string) => void;
  onToolCallComplete?: (toolCallId: string, args: Record<string, unknown>) => void;
  onToolResult?: (toolCallId: string, result: unknown, isError: boolean) => void;
  onReasoningDelta?: (delta: string) => void;
  onMessageComplete?: (message: Message) => void;
  onError?: (error: Error) => void;
  onStreamEnd?: () => void;
}

export async function readStream(
  response: Response,
  callbacks: StreamReaderCallbacks
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError?.(new Error('No response body'));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE messages
      const messages = buffer.split('\n\n');
      buffer = messages.pop() ?? '';

      for (const message of messages) {
        if (!message.trim()) continue;

        const parsed = parseSSEMessage(message);
        if (!parsed) continue;

        const { type, data } = parsed;
        const eventData = data as Record<string, unknown>;

        switch (type) {
          case 'text-delta':
            fullText += (eventData.delta as string) ?? '';
            callbacks.onTextDelta?.(
              (eventData.delta as string) ?? '',
              fullText
            );
            break;

          case 'tool-call-start':
            callbacks.onToolCallStart?.(
              eventData.toolCallId as string,
              eventData.toolName as string
            );
            break;

          case 'tool-call-delta':
            callbacks.onToolCallDelta?.(
              eventData.toolCallId as string,
              eventData.argsDelta as string
            );
            break;

          case 'tool-call-complete':
            callbacks.onToolCallComplete?.(
              eventData.toolCallId as string,
              eventData.args as Record<string, unknown>
            );
            break;

          case 'tool-result':
            callbacks.onToolResult?.(
              eventData.toolCallId as string,
              eventData.result,
              (eventData.isError as boolean) ?? false
            );
            break;

          case 'reasoning-delta':
            callbacks.onReasoningDelta?.(eventData.delta as string);
            break;

          case 'message-complete':
            callbacks.onMessageComplete?.(eventData as unknown as Message);
            break;

          case 'stream-end':
            callbacks.onStreamEnd?.();
            break;

          case 'error':
            callbacks.onError?.(new Error(eventData.message as string));
            break;
        }
      }
    }
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// Smooth Streaming (Word-by-word chunking)
// ============================================================================

export interface SmoothStreamOptions {
  delayMs?: number;
  chunkBy?: 'word' | 'sentence' | 'character';
}

export async function* smoothStream(
  textStream: AsyncIterable<string>,
  options: SmoothStreamOptions = {}
): AsyncGenerator<string> {
  const { delayMs = 15, chunkBy = 'word' } = options;

  let buffer = '';

  for await (const chunk of textStream) {
    buffer += chunk;

    // Split based on chunking strategy
    let tokens: string[];
    let separator: string;

    switch (chunkBy) {
      case 'word':
        tokens = buffer.split(/(\s+)/);
        separator = '';
        break;
      case 'sentence':
        tokens = buffer.split(/(?<=[.!?])\s+/);
        separator = ' ';
        break;
      case 'character':
      default:
        tokens = buffer.split('');
        separator = '';
    }

    // Yield complete tokens, keep partial in buffer
    const lastToken = tokens.pop();
    buffer = lastToken ?? '';

    for (const token of tokens) {
      yield token + separator;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  // Yield remaining buffer
  if (buffer) {
    yield buffer;
  }
}

// ============================================================================
// Message Builder (Accumulates streaming parts into Message)
// ============================================================================

export class MessageBuilder {
  private message: Message;
  private textAccumulator = '';
  private reasoningAccumulator = '';
  private toolCalls = new Map<string, {
    name: string;
    argsAccumulator: string;
    state: ToolCallState;
    result?: unknown;
  }>();

  constructor(role: 'assistant' | 'user' = 'assistant') {
    this.message = {
      id: generateMessageId(),
      role,
      parts: [],
      status: 'streaming',
      createdAt: new Date(),
    };
  }

  appendText(delta: string): this {
    this.textAccumulator += delta;
    this.updateTextPart();
    return this;
  }

  appendReasoning(delta: string): this {
    this.reasoningAccumulator += delta;
    this.updateReasoningPart();
    return this;
  }

  startToolCall(toolCallId: string, toolName: string): this {
    this.toolCalls.set(toolCallId, {
      name: toolName,
      argsAccumulator: '',
      state: 'input-streaming',
    });
    this.updateToolCallPart(toolCallId);
    return this;
  }

  appendToolCallArgs(toolCallId: string, argsDelta: string): this {
    const toolCall = this.toolCalls.get(toolCallId);
    if (toolCall) {
      toolCall.argsAccumulator += argsDelta;
      this.updateToolCallPart(toolCallId);
    }
    return this;
  }

  completeToolCall(toolCallId: string, args: Record<string, unknown>): this {
    const toolCall = this.toolCalls.get(toolCallId);
    if (toolCall) {
      toolCall.state = 'executing';
      this.updateToolCallPart(toolCallId, args);
    }
    return this;
  }

  setToolResult(toolCallId: string, result: unknown, isError = false): this {
    const toolCall = this.toolCalls.get(toolCallId);
    if (toolCall) {
      toolCall.state = isError ? 'error' : 'output-available';
      toolCall.result = result;
      this.addToolResultPart(toolCallId, result, isError);
    }
    return this;
  }

  setMetadata(metadata: Message['metadata']): this {
    this.message.metadata = metadata;
    return this;
  }

  complete(): Message {
    this.message.status = 'complete';
    this.message.updatedAt = new Date();
    return this.message;
  }

  error(errorMessage: string): Message {
    this.message.status = 'error';
    this.message.metadata = {
      ...this.message.metadata,
      finishReason: 'error',
    };
    this.message.updatedAt = new Date();
    return this.message;
  }

  getMessage(): Message {
    return { ...this.message };
  }

  private updateTextPart(): void {
    const existingIndex = this.message.parts.findIndex((p) => p.type === 'text');
    const textPart: MessagePart = {
      type: 'text',
      text: this.textAccumulator,
    };

    if (existingIndex >= 0) {
      this.message.parts[existingIndex] = textPart;
    } else {
      this.message.parts.push(textPart);
    }
  }

  private updateReasoningPart(): void {
    const existingIndex = this.message.parts.findIndex((p) => p.type === 'reasoning');
    const reasoningPart: MessagePart = {
      type: 'reasoning',
      text: this.reasoningAccumulator,
    };

    if (existingIndex >= 0) {
      this.message.parts[existingIndex] = reasoningPart;
    } else {
      // Insert reasoning before text
      const textIndex = this.message.parts.findIndex((p) => p.type === 'text');
      if (textIndex >= 0) {
        this.message.parts.splice(textIndex, 0, reasoningPart);
      } else {
        this.message.parts.push(reasoningPart);
      }
    }
  }

  private updateToolCallPart(toolCallId: string, args?: Record<string, unknown>): void {
    const toolCall = this.toolCalls.get(toolCallId);
    if (!toolCall) return;

    const existingIndex = this.message.parts.findIndex(
      (p) => p.type === 'tool-call' && (p as { toolCallId: string }).toolCallId === toolCallId
    );

    const toolCallPart: MessagePart = {
      type: 'tool-call',
      toolCallId,
      toolName: toolCall.name,
      args: args ?? this.tryParseArgs(toolCall.argsAccumulator),
      state: toolCall.state,
    };

    if (existingIndex >= 0) {
      this.message.parts[existingIndex] = toolCallPart;
    } else {
      this.message.parts.push(toolCallPart);
    }
  }

  private addToolResultPart(toolCallId: string, result: unknown, isError: boolean): void {
    const toolCall = this.toolCalls.get(toolCallId);
    if (!toolCall) return;

    const toolResultPart: MessagePart = {
      type: 'tool-result',
      toolCallId,
      toolName: toolCall.name,
      result,
      isError,
    };

    this.message.parts.push(toolResultPart);
  }

  private tryParseArgs(argsString: string): Record<string, unknown> {
    try {
      return JSON.parse(argsString);
    } catch {
      return {};
    }
  }
}

// ============================================================================
// Response Builder (Creates SSE response)
// ============================================================================

export function createStreamResponse(
  stream: ReadableStream<Uint8Array>,
  options: {
    headers?: Record<string, string>;
    status?: number;
  } = {}
): Response {
  return new Response(stream, {
    status: options.status ?? 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      ...options.headers,
    },
  });
}

export function createDataStream(): {
  stream: ReadableStream<Uint8Array>;
  writer: DataStreamWriter;
} {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const encoder = new TextEncoder();
  let isClosed = false;

  const writer: DataStreamWriter = {
    write(event: Partial<StreamEvent>): void {
      if (isClosed) return;

      const fullEvent: StreamEvent = {
        type: event.type ?? ('data' as StreamEventType),
        messageId: event.messageId ?? '',
        timestamp: Date.now(),
        data: event.data,
      };

      const sseMessage = formatSSEMessage(fullEvent);
      controller.enqueue(encoder.encode(sseMessage));
    },

    writeText(delta: string): void {
      this.write({
        type: 'text-delta',
        data: { delta },
      });
    },

    writeToolCall(toolCallId: string, toolName: string, args?: unknown): void {
      if (args !== undefined) {
        this.write({
          type: 'tool-call-complete',
          data: { toolCallId, toolName, args },
        });
      } else {
        this.write({
          type: 'tool-call-start',
          data: { toolCallId, toolName },
        });
      }
    },

    writeToolResult(toolCallId: string, result: unknown, isError = false): void {
      this.write({
        type: 'tool-result',
        data: { toolCallId, result, isError },
      });
    },

    close(): void {
      if (isClosed) return;
      isClosed = true;

      this.write({ type: 'stream-end', data: null });
      controller.close();
    },
  };

  return { stream, writer };
}
