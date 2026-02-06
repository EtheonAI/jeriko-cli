/**
 * @repo/ai - HTTP Chat Transport
 *
 * HTTP/SSE-based chat transport for AI streaming responses.
 * Used as fallback when WebSocket is not available.
 */

import type { UIMessage } from "../types/ui-message";
import type { UIMessageStreamChunk } from "../types/stream-chunks";
import { parseSSEChunk, parseAISDKDataStream } from "../types/stream-chunks";

// ============================================================================
// Types
// ============================================================================

export interface HTTPTransportOptions {
  /** API endpoint URL */
  api: string;

  /** Additional headers */
  headers?: Record<string, string>;

  /** Fetch credentials mode */
  credentials?: RequestCredentials;

  /** Request timeout in ms */
  timeout?: number;
}

export interface HTTPChatOptions {
  /** Chat/conversation ID */
  chatId: string;

  /** Messages to send */
  messages: UIMessage[];

  /** Abort signal */
  abortSignal?: AbortSignal;

  /** Request trigger */
  trigger?: "submit-message" | "resume-stream" | "regenerate-message";

  /** Message ID for regeneration */
  messageId?: string;

  /** Additional metadata */
  metadata?: unknown;

  /** Override headers for this request */
  headers?: Record<string, string>;

  /** Additional body data */
  body?: object;
}

// ============================================================================
// HTTP Transport Implementation
// ============================================================================

export class HTTPChatTransport {
  private readonly options: Required<HTTPTransportOptions>;

  constructor(options: HTTPTransportOptions) {
    this.options = {
      api: options.api,
      headers: options.headers ?? {},
      credentials: options.credentials ?? "same-origin",
      timeout: options.timeout ?? 120000,
    };
  }

  /**
   * Send messages and get a stream of responses
   */
  async sendMessages(options: HTTPChatOptions): Promise<ReadableStream<UIMessageStreamChunk>> {
    const { chatId, messages, abortSignal, trigger, messageId, metadata, headers, body } = options;

    // Create abort controller for timeout
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => {
      timeoutController.abort();
    }, this.options.timeout);

    // Combine abort signals
    const combinedSignal = abortSignal
      ? combineAbortSignals([abortSignal, timeoutController.signal])
      : timeoutController.signal;

    try {
      const response = await fetch(this.options.api, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.options.headers,
          ...headers,
        },
        credentials: this.options.credentials,
        signal: combinedSignal,
        body: JSON.stringify({
          chatId,
          messages,
          trigger,
          messageId,
          metadata,
          ...body,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      // Transform the SSE stream into UIMessageStreamChunk stream
      return this.transformSSEStream(response.body);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Attempt to reconnect to an existing stream (for resumable streams)
   */
  async reconnectToStream(options: {
    chatId: string;
    metadata?: unknown;
    headers?: Record<string, string>;
    body?: object;
  }): Promise<ReadableStream<UIMessageStreamChunk> | null> {
    try {
      const response = await fetch(`${this.options.api}/reconnect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.options.headers,
          ...options.headers,
        },
        credentials: this.options.credentials,
        body: JSON.stringify({
          chatId: options.chatId,
          metadata: options.metadata,
          ...options.body,
        }),
      });

      if (response.status === 404) {
        // No active stream found
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        return null;
      }

      return this.transformSSEStream(response.body);
    } catch {
      return null;
    }
  }

  /**
   * Transform raw SSE stream to UIMessageStreamChunk stream
   */
  private transformSSEStream(
    body: ReadableStream<Uint8Array>
  ): ReadableStream<UIMessageStreamChunk> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let hasStarted = false;
    let hasTextEnded = false;
    const textId = "text-0";

    const processLine = (line: string): UIMessageStreamChunk | null => {
      if (!line.trim()) return null;
      // Try AI SDK data stream format first (single-char prefix: 0:"text", d:{...})
      return parseAISDKDataStream(line) || parseSSEChunk(line);
    };

    const enqueueChunk = (
      controller: ReadableStreamDefaultController<UIMessageStreamChunk>,
      chunk: UIMessageStreamChunk
    ) => {
      // Track text lifecycle events already provided by the stream.
      // Only text-start counts — "start" is a message-level event, not text-level.
      if (chunk.type === "text-start") {
        hasStarted = true;
      }
      if (chunk.type === "text-end") {
        hasTextEnded = true;
      }

      // Auto-inject lifecycle events for streams that don't provide them
      // (e.g. agent proxy sends text-delta without text-start/text-end)
      if (!hasStarted && chunk.type === "text-delta") {
        hasStarted = true;
        controller.enqueue({ type: "start" });
        controller.enqueue({ type: "text-start", id: textId });
      }

      controller.enqueue(chunk);

      // Check for error chunk
      if (chunk.type === "error") {
        controller.close();
        reader.cancel();
        return false;
      }

      // On finish, inject text-end if the stream didn't already provide it
      if (chunk.type === "finish" && hasStarted && !hasTextEnded) {
        controller.enqueue({ type: "text-end", id: textId });
      }

      return true;
    };

    return new ReadableStream<UIMessageStreamChunk>({
      async pull(controller) {
        try {
          const { done, value } = await reader.read();

          if (done) {
            // Process any remaining buffer
            if (buffer.trim()) {
              const lines = buffer.split("\n");
              for (const line of lines) {
                const chunk = processLine(line);
                if (chunk) {
                  const ok = enqueueChunk(controller, chunk);
                  if (!ok) return;
                }
              }
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines (AI SDK uses newline-delimited format)
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const chunk = processLine(line);
            if (chunk) {
              const ok = enqueueChunk(controller, chunk);
              if (!ok) return;
            }
          }
        } catch (error) {
          controller.error(error);
          reader.cancel();
        }
      },

      cancel() {
        reader.cancel();
      },
    });
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Combine multiple abort signals into one
 */
function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }

    signal.addEventListener(
      "abort",
      () => {
        controller.abort(signal.reason);
      },
      { once: true }
    );
  }

  return controller.signal;
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create an HTTP chat transport
 */
export function createHTTPTransport(options: HTTPTransportOptions): HTTPChatTransport {
  return new HTTPChatTransport(options);
}

/**
 * Default HTTP transport options
 */
export const defaultHTTPOptions: HTTPTransportOptions = {
  api: "/api/chat",
  credentials: "same-origin",
  timeout: 120000,
};
