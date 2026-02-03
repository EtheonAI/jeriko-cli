/**
 * @repo/ai - Server Stream Writer
 *
 * High-performance server-side stream writer for AI responses.
 * Creates SSE streams compatible with the client-side useRealTimeChat hook.
 */

import type {
  UIMessageStreamChunk,
  UIMessageStreamWriter,
} from '../types/stream-chunks';
import type { FinishReason } from '../types/ui-message';
import type { ProviderMetadata } from '../types/ui-message';
import { formatSSEChunk } from '../types/stream-chunks';
import { generateId } from '../streaming';

// ============================================================================
// Types
// ============================================================================

export interface CreateStreamOptions {
  /** Message ID for the response */
  messageId?: string;

  /** Initial message metadata */
  messageMetadata?: Record<string, unknown>;

  /** Headers to include in response */
  headers?: Record<string, string>;
}

export interface StreamWriterOptions {
  /** Encoder for writing to stream */
  encoder?: TextEncoder;

  /** Callback for each chunk (for logging/monitoring) */
  onChunk?: (chunk: UIMessageStreamChunk) => void;
}

// ============================================================================
// Stream Writer Implementation
// ============================================================================

export class ServerStreamWriter implements UIMessageStreamWriter {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private encoder: TextEncoder;
  private closed = false;
  private textIdCounter = 0;
  private reasoningIdCounter = 0;
  private currentTextId: string | null = null;
  private currentReasoningId: string | null = null;
  private onChunk?: (chunk: UIMessageStreamChunk) => void;

  constructor(
    controller: ReadableStreamDefaultController<Uint8Array>,
    options: StreamWriterOptions = {}
  ) {
    this.controller = controller;
    this.encoder = options.encoder ?? new TextEncoder();
    this.onChunk = options.onChunk;
  }

  // ========================================
  // Core Write Methods
  // ========================================

  write(chunk: UIMessageStreamChunk): void {
    if (this.closed || !this.controller) return;

    try {
      const sseMessage = formatSSEChunk(chunk);
      this.controller.enqueue(this.encoder.encode(sseMessage));
      this.onChunk?.(chunk);
    } catch (error) {
      console.error('Failed to write chunk:', error);
    }
  }

  // ========================================
  // Text Methods
  // ========================================

  writeTextStart(id?: string, providerMetadata?: ProviderMetadata): void {
    const textId = id ?? `text-${this.textIdCounter++}`;
    this.currentTextId = textId;

    this.write({
      type: 'text-start',
      id: textId,
      providerMetadata,
    });
  }

  writeTextDelta(id: string, delta: string): void {
    this.write({
      type: 'text-delta',
      id,
      delta,
    });
  }

  writeTextEnd(id: string): void {
    this.write({
      type: 'text-end',
      id,
    });

    if (this.currentTextId === id) {
      this.currentTextId = null;
    }
  }

  writeText(text: string): void {
    const id = `text-${this.textIdCounter++}`;
    this.writeTextStart(id);
    this.writeTextDelta(id, text);
    this.writeTextEnd(id);
  }

  /**
   * Stream text character by character or word by word
   */
  async streamText(
    text: string,
    options: {
      chunkBy?: 'character' | 'word' | 'sentence';
      delayMs?: number;
      id?: string;
    } = {}
  ): Promise<void> {
    const { chunkBy = 'word', delayMs = 15, id } = options;
    const textId = id ?? `text-${this.textIdCounter++}`;

    this.writeTextStart(textId);

    let chunks: string[];
    switch (chunkBy) {
      case 'character':
        chunks = text.split('');
        break;
      case 'sentence':
        chunks = text.split(/(?<=[.!?])\s+/);
        break;
      case 'word':
      default:
        chunks = text.split(/(\s+)/);
    }

    for (const chunk of chunks) {
      if (chunk) {
        this.writeTextDelta(textId, chunk);
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }

    this.writeTextEnd(textId);
  }

  // ========================================
  // Reasoning Methods
  // ========================================

  writeReasoningStart(id?: string, providerMetadata?: ProviderMetadata): void {
    const reasoningId = id ?? `reasoning-${this.reasoningIdCounter++}`;
    this.currentReasoningId = reasoningId;

    this.write({
      type: 'reasoning-start',
      id: reasoningId,
      providerMetadata,
    });
  }

  writeReasoningDelta(id: string, delta: string): void {
    this.write({
      type: 'reasoning-delta',
      id,
      delta,
    });
  }

  writeReasoningEnd(id: string): void {
    this.write({
      type: 'reasoning-end',
      id,
    });

    if (this.currentReasoningId === id) {
      this.currentReasoningId = null;
    }
  }

  /**
   * Stream reasoning text
   */
  async streamReasoning(
    text: string,
    options: { delayMs?: number; id?: string } = {}
  ): Promise<void> {
    const { delayMs = 10, id } = options;
    const reasoningId = id ?? `reasoning-${this.reasoningIdCounter++}`;

    this.writeReasoningStart(reasoningId);

    const words = text.split(/(\s+)/);
    for (const word of words) {
      if (word) {
        this.writeReasoningDelta(reasoningId, word);
        if (delayMs > 0) {
          await sleep(delayMs);
        }
      }
    }

    this.writeReasoningEnd(reasoningId);
  }

  // ========================================
  // Tool Methods
  // ========================================

  writeToolInputStart(options: {
    toolCallId: string;
    toolName: string;
    dynamic?: boolean;
    title?: string;
  }): void {
    this.write({
      type: 'tool-input-start',
      ...options,
    });
  }

  writeToolInputDelta(toolCallId: string, delta: string): void {
    this.write({
      type: 'tool-input-delta',
      toolCallId,
      inputTextDelta: delta,
    });
  }

  writeToolInputAvailable(options: {
    toolCallId: string;
    toolName: string;
    input: unknown;
    dynamic?: boolean;
  }): void {
    this.write({
      type: 'tool-input-available',
      ...options,
    });
  }

  writeToolOutput(options: {
    toolCallId: string;
    output: unknown;
    preliminary?: boolean;
  }): void {
    this.write({
      type: 'tool-output-available',
      ...options,
    });
  }

  writeToolError(options: {
    toolCallId: string;
    errorText: string;
  }): void {
    this.write({
      type: 'tool-output-error',
      ...options,
    });
  }

  writeToolApprovalRequest(toolCallId: string, approvalId: string): void {
    this.write({
      type: 'tool-approval-request',
      toolCallId,
      approvalId,
    });
  }

  writeToolDenied(toolCallId: string): void {
    this.write({
      type: 'tool-output-denied',
      toolCallId,
    });
  }

  /**
   * Stream a complete tool call with optional execution
   */
  async streamToolCall<TInput = unknown, TOutput = unknown>(options: {
    toolCallId?: string;
    toolName: string;
    input: TInput;
    execute?: (input: TInput) => Promise<TOutput>;
    requireApproval?: boolean;
    dynamic?: boolean;
    title?: string;
  }): Promise<{ toolCallId: string; output?: TOutput; error?: string }> {
    const {
      toolCallId = generateId('tool'),
      toolName,
      input,
      execute,
      requireApproval = false,
      dynamic = false,
      title,
    } = options;

    // Stream tool input
    this.writeToolInputStart({ toolCallId, toolName, dynamic, title });

    // Stream input JSON character by character for effect
    const inputJson = JSON.stringify(input);
    for (let i = 0; i < inputJson.length; i++) {
      this.writeToolInputDelta(toolCallId, inputJson[i]);
      await sleep(5);
    }

    this.writeToolInputAvailable({ toolCallId, toolName, input, dynamic });

    // If approval required, write approval request
    if (requireApproval) {
      const approvalId = generateId('approval');
      this.writeToolApprovalRequest(toolCallId, approvalId);
      // Approval handling is done client-side, so we stop here
      return { toolCallId };
    }

    // Execute tool if provided
    if (execute) {
      try {
        const output = await execute(input);
        this.writeToolOutput({ toolCallId, output });
        return { toolCallId, output };
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error);
        this.writeToolError({ toolCallId, errorText });
        return { toolCallId, error: errorText };
      }
    }

    return { toolCallId };
  }

  // ========================================
  // File & Source Methods
  // ========================================

  writeFile(options: { mediaType: string; url: string; filename?: string }): void {
    this.write({
      type: 'file',
      ...options,
    });
  }

  writeSourceUrl(options: { sourceId: string; url: string; title?: string }): void {
    this.write({
      type: 'source-url',
      ...options,
    });
  }

  writeSourceDocument(options: {
    sourceId: string;
    mediaType: string;
    title: string;
    filename?: string;
  }): void {
    this.write({
      type: 'source-document',
      ...options,
    });
  }

  // ========================================
  // Control Methods
  // ========================================

  writeStart(options?: { messageId?: string; messageMetadata?: unknown }): void {
    this.write({
      type: 'start',
      ...options,
    });
  }

  writeFinish(options?: { finishReason?: FinishReason; messageMetadata?: unknown }): void {
    // Close any open text/reasoning parts
    if (this.currentTextId) {
      this.writeTextEnd(this.currentTextId);
    }
    if (this.currentReasoningId) {
      this.writeReasoningEnd(this.currentReasoningId);
    }

    this.write({
      type: 'finish',
      ...options,
    });
  }

  writeError(errorText: string): void {
    this.write({
      type: 'error',
      errorText,
    });
  }

  writeStepStart(): void {
    this.write({ type: 'start-step' });
  }

  writeStepEnd(): void {
    this.write({ type: 'finish-step' });
  }

  writeData<T>(type: string, data: T, options?: { id?: string; transient?: boolean }): void {
    this.write({
      type: `data-${type}` as const,
      data,
      ...options,
    } as UIMessageStreamChunk);
  }

  // ========================================
  // Stream Control
  // ========================================

  close(): void {
    if (this.closed) return;
    this.closed = true;

    try {
      this.controller?.close();
    } catch {
      // Controller may already be closed
    }

    this.controller = null;
  }

  isClosed(): boolean {
    return this.closed;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a streaming response with a writer
 */
export function createStreamResponse(
  handler: (writer: ServerStreamWriter) => Promise<void>,
  options: CreateStreamOptions = {}
): Response {
  const { messageId, messageMetadata, headers = {} } = options;

  let writer: ServerStreamWriter | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      writer = new ServerStreamWriter(controller);

      try {
        // Write start chunk
        writer.writeStart({ messageId, messageMetadata });

        // Execute handler
        await handler(writer);

        // Write finish if not already closed
        if (!writer.isClosed()) {
          writer.writeFinish({ finishReason: 'stop' });
          writer.close();
        }
      } catch (error) {
        const errorText = error instanceof Error ? error.message : String(error);

        if (writer && !writer.isClosed()) {
          writer.writeError(errorText);
          writer.writeFinish({ finishReason: 'error' });
          writer.close();
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...headers,
    },
  });
}

/**
 * Create a data stream and writer for manual control
 */
export function createDataStream(options: StreamWriterOptions = {}): {
  stream: ReadableStream<Uint8Array>;
  writer: ServerStreamWriter;
} {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });

  const writer = new ServerStreamWriter(controller!, options);

  return { stream, writer };
}

// ============================================================================
// Utility Functions
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pipe an async generator to a stream writer
 */
export async function pipeAsyncGeneratorToWriter(
  generator: AsyncGenerator<string>,
  writer: ServerStreamWriter,
  options: { textId?: string } = {}
): Promise<void> {
  const textId = options.textId ?? `text-${Date.now()}`;

  writer.writeTextStart(textId);

  for await (const chunk of generator) {
    writer.writeTextDelta(textId, chunk);
  }

  writer.writeTextEnd(textId);
}

/**
 * Create a text stream from async generator
 */
export function createTextStream(
  generator: AsyncGenerator<string>,
  options: CreateStreamOptions = {}
): Response {
  return createStreamResponse(async (writer) => {
    await pipeAsyncGeneratorToWriter(generator, writer);
  }, options);
}
