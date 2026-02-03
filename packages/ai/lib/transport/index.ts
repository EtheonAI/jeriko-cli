/**
 * @repo/ai - Chat Transports
 *
 * Transport layer for AI chat communication.
 * Supports WebSocket (real-time) and HTTP (SSE fallback).
 */

export * from './websocket-transport';
export * from './http-transport';

import type { UIMessage } from '../types/ui-message';
import type { UIMessageStreamChunk } from '../types/stream-chunks';
import { WebSocketChatTransport, type WebSocketTransportOptions } from './websocket-transport';
import { HTTPChatTransport, type HTTPTransportOptions } from './http-transport';

// ============================================================================
// Chat Transport Interface
// ============================================================================

export interface ChatTransport {
  /**
   * Send messages and receive a stream of response chunks
   */
  sendMessages(options: {
    chatId: string;
    messages: UIMessage[];
    abortSignal?: AbortSignal;
    trigger?: 'submit-message' | 'resume-stream' | 'regenerate-message';
    messageId?: string;
    metadata?: unknown;
    headers?: Record<string, string>;
    body?: object;
  }): Promise<ReadableStream<UIMessageStreamChunk>>;

  /**
   * Reconnect to an existing stream (for resumable streams)
   */
  reconnectToStream(options: {
    chatId: string;
    metadata?: unknown;
    headers?: Record<string, string>;
    body?: object;
  }): Promise<ReadableStream<UIMessageStreamChunk> | null>;
}

// ============================================================================
// Transport Selection
// ============================================================================

export type TransportType = 'websocket' | 'http' | 'auto';

export interface TransportConfig {
  type: TransportType;
  websocket?: WebSocketTransportOptions;
  http?: HTTPTransportOptions;
}

/**
 * Create a chat transport based on configuration
 */
export function createTransport(config: TransportConfig): ChatTransport {
  const { type, websocket, http } = config;

  if (type === 'websocket' && websocket) {
    return new WebSocketChatTransport(websocket);
  }

  if (type === 'http' && http) {
    return new HTTPChatTransport(http);
  }

  if (type === 'auto') {
    // Auto-select: prefer WebSocket if available, fall back to HTTP
    if (websocket && typeof WebSocket !== 'undefined') {
      return new WebSocketChatTransport(websocket);
    }
    if (http) {
      return new HTTPChatTransport(http);
    }
  }

  // Default to HTTP
  return new HTTPChatTransport(http ?? { api: '/api/chat' });
}

// ============================================================================
// Adaptive Transport
// ============================================================================

/**
 * Adaptive transport that automatically switches between WebSocket and HTTP
 * based on connection status and errors.
 */
export class AdaptiveChatTransport implements ChatTransport {
  private wsTransport: WebSocketChatTransport | null = null;
  private httpTransport: HTTPChatTransport;
  private useWebSocket = true;
  private wsFailures = 0;
  private readonly maxWsFailures = 3;

  constructor(options: {
    websocket?: WebSocketTransportOptions;
    http: HTTPTransportOptions;
  }) {
    if (options.websocket && typeof WebSocket !== 'undefined') {
      this.wsTransport = new WebSocketChatTransport({
        ...options.websocket,
        autoConnect: false, // Manual connect
      });

      // Handle WebSocket errors
      this.wsTransport.on('onError', () => {
        this.wsFailures++;
        if (this.wsFailures >= this.maxWsFailures) {
          this.useWebSocket = false;
        }
      });

      // Reset failures on successful connection
      this.wsTransport.on('onConnect', () => {
        this.wsFailures = 0;
      });
    }

    this.httpTransport = new HTTPChatTransport(options.http);
  }

  async sendMessages(options: Parameters<ChatTransport['sendMessages']>[0]): Promise<ReadableStream<UIMessageStreamChunk>> {
    // Try WebSocket first if available and not failed
    if (this.useWebSocket && this.wsTransport) {
      try {
        return await this.wsTransport.sendMessages(options);
      } catch (error) {
        this.wsFailures++;
        if (this.wsFailures >= this.maxWsFailures) {
          this.useWebSocket = false;
        }
        // Fall through to HTTP
      }
    }

    // Fall back to HTTP
    return this.httpTransport.sendMessages(options);
  }

  async reconnectToStream(options: Parameters<ChatTransport['reconnectToStream']>[0]): Promise<ReadableStream<UIMessageStreamChunk> | null> {
    if (this.useWebSocket && this.wsTransport) {
      try {
        return await this.wsTransport.reconnectToStream(options);
      } catch {
        // Fall through to HTTP
      }
    }

    return this.httpTransport.reconnectToStream(options);
  }

  /**
   * Force reconnection to WebSocket
   */
  async forceWebSocketReconnect(): Promise<void> {
    if (this.wsTransport) {
      this.wsFailures = 0;
      this.useWebSocket = true;
      await this.wsTransport.connect();
    }
  }

  /**
   * Get current transport status
   */
  getStatus(): { usingWebSocket: boolean; wsConnected: boolean; wsFailures: number } {
    return {
      usingWebSocket: this.useWebSocket,
      wsConnected: this.wsTransport?.isConnected() ?? false,
      wsFailures: this.wsFailures,
    };
  }
}

/**
 * Create an adaptive transport
 */
export function createAdaptiveTransport(options: {
  websocket?: WebSocketTransportOptions;
  http: HTTPTransportOptions;
}): AdaptiveChatTransport {
  return new AdaptiveChatTransport(options);
}
