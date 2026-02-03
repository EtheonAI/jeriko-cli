/**
 * @repo/ai - WebSocket Chat Transport
 *
 * High-performance WebSocket transport for real-time AI chat streaming.
 * Features auto-reconnect, room management, and event handling.
 */

import type { UIMessage } from '../types/ui-message';
import type { UIMessageStreamChunk, UIMessageStreamWriter } from '../types/stream-chunks';
import { generateId } from '../streaming';

// ============================================================================
// Types
// ============================================================================

export type WebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface WebSocketTransportOptions {
  /** WebSocket server URL */
  url: string;

  /** Auto-connect on creation */
  autoConnect?: boolean;

  /** Auto-reconnect on disconnect */
  autoReconnect?: boolean;

  /** Max reconnect attempts */
  maxReconnectAttempts?: number;

  /** Base reconnect delay in ms (uses exponential backoff) */
  reconnectDelay?: number;

  /** Heartbeat interval in ms */
  heartbeatInterval?: number;

  /** Connection timeout in ms */
  connectionTimeout?: number;

  /** Authentication token */
  authToken?: string;

  /** Additional headers/metadata */
  metadata?: Record<string, unknown>;
}

export interface ChatTransportOptions {
  /** Chat/conversation ID */
  chatId: string;

  /** Session ID for multi-session support */
  sessionId?: string;

  /** Messages to send */
  messages: UIMessage[];

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Request trigger type */
  trigger?: 'submit-message' | 'resume-stream' | 'regenerate-message';

  /** Message ID for regeneration */
  messageId?: string;

  /** Additional metadata */
  metadata?: unknown;

  /** Additional headers */
  headers?: Record<string, string>;

  /** Additional body data */
  body?: object;
}

export interface WebSocketEvents {
  onConnect?: () => void;
  onDisconnect?: (reason?: string) => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
  onMessage?: (message: unknown) => void;
  onChunk?: (chunk: UIMessageStreamChunk) => void;
}

// ============================================================================
// WebSocket Message Types
// ============================================================================

interface WSMessage {
  type: string;
  payload?: unknown;
  requestId?: string;
  error?: string;
}

interface WSChatRequest {
  type: 'chat:send';
  payload: {
    chatId: string;
    sessionId?: string;
    messages: UIMessage[];
    trigger?: string;
    messageId?: string;
    metadata?: unknown;
  };
  requestId: string;
}

interface WSChatStreamChunk {
  type: 'chat:chunk';
  payload: UIMessageStreamChunk;
  requestId: string;
}

interface WSChatComplete {
  type: 'chat:complete';
  requestId: string;
  payload?: {
    finishReason?: string;
  };
}

interface WSChatError {
  type: 'chat:error';
  requestId: string;
  error: string;
}

interface WSJoinRoom {
  type: 'room:join';
  payload: { roomId: string };
}

interface WSLeaveRoom {
  type: 'room:leave';
  payload: { roomId: string };
}

// ============================================================================
// WebSocket Transport Implementation
// ============================================================================

export class WebSocketChatTransport {
  private ws: WebSocket | null = null;
  private status: WebSocketStatus = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pendingRequests = new Map<string, {
    resolve: (stream: ReadableStream<UIMessageStreamChunk>) => void;
    reject: (error: Error) => void;
    controller: ReadableStreamDefaultController<UIMessageStreamChunk> | null;
    abortSignal?: AbortSignal;
  }>();
  private joinedRooms = new Set<string>();

  private readonly options: Required<WebSocketTransportOptions>;
  private events: WebSocketEvents = {};

  constructor(options: WebSocketTransportOptions) {
    this.options = {
      url: options.url,
      autoConnect: options.autoConnect ?? true,
      autoReconnect: options.autoReconnect ?? true,
      maxReconnectAttempts: options.maxReconnectAttempts ?? 10,
      reconnectDelay: options.reconnectDelay ?? 1000,
      heartbeatInterval: options.heartbeatInterval ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 10000,
      authToken: options.authToken ?? '',
      metadata: options.metadata ?? {},
    };

    if (this.options.autoConnect) {
      this.connect();
    }
  }

  // ========================================
  // Public API
  // ========================================

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.status === 'connected') {
        resolve();
        return;
      }

      if (this.status === 'connecting') {
        // Wait for existing connection attempt
        const checkConnection = setInterval(() => {
          if (this.status === 'connected') {
            clearInterval(checkConnection);
            resolve();
          } else if (this.status === 'error' || this.status === 'disconnected') {
            clearInterval(checkConnection);
            reject(new Error('Connection failed'));
          }
        }, 100);
        return;
      }

      this.setStatus('connecting');

      // Build URL with auth token
      const url = new URL(this.options.url);
      if (this.options.authToken) {
        url.searchParams.set('token', this.options.authToken);
      }

      // Connection timeout
      const timeout = setTimeout(() => {
        if (this.status === 'connecting') {
          this.ws?.close();
          this.setStatus('error');
          reject(new Error('Connection timeout'));
        }
      }, this.options.connectionTimeout);

      try {
        this.ws = new WebSocket(url.toString());

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.events.onConnect?.();

          // Re-join any rooms
          for (const roomId of this.joinedRooms) {
            this.send({ type: 'room:join', payload: { roomId } });
          }

          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeout);
          this.stopHeartbeat();
          this.setStatus('disconnected');
          this.events.onDisconnect?.(event.reason);

          // Reject pending requests
          for (const [requestId, request] of this.pendingRequests) {
            request.reject(new Error('Connection closed'));
            this.pendingRequests.delete(requestId);
          }

          // Auto-reconnect
          if (this.options.autoReconnect && !event.wasClean) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeout);
          this.setStatus('error');
          const error = new Error('WebSocket error');
          this.events.onError?.(error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        clearTimeout(timeout);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.stopReconnect();
    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setStatus('disconnected');
    this.joinedRooms.clear();
  }

  /**
   * Send messages and get a stream of responses
   */
  async sendMessages(options: ChatTransportOptions): Promise<ReadableStream<UIMessageStreamChunk>> {
    if (this.status !== 'connected') {
      await this.connect();
    }

    const requestId = generateId('req');

    const self = this;

    return new Promise((resolve, reject) => {
      let controller: ReadableStreamDefaultController<UIMessageStreamChunk> | null = null;

      const stream = new ReadableStream<UIMessageStreamChunk>({
        start(c) {
          controller = c;
        },
        cancel() {
          // Client cancelled the stream
          self.pendingRequests.delete(requestId);
        },
      });

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        controller,
        abortSignal: options.abortSignal,
      });

      // Handle abort signal
      if (options.abortSignal) {
        options.abortSignal.addEventListener('abort', () => {
          const request = this.pendingRequests.get(requestId);
          if (request) {
            request.controller?.close();
            this.pendingRequests.delete(requestId);
            // Send cancel message to server
            this.send({
              type: 'chat:cancel',
              requestId,
            });
          }
        }, { once: true });
      }

      // Send chat request
      const chatRequest: WSChatRequest = {
        type: 'chat:send',
        requestId,
        payload: {
          chatId: options.chatId,
          sessionId: options.sessionId,
          messages: options.messages,
          trigger: options.trigger,
          messageId: options.messageId,
          metadata: options.metadata,
        },
      };

      this.send(chatRequest);

      // Resolve with stream immediately
      // Chunks will be pushed to the stream as they arrive
      resolve(stream);
    });
  }

  /**
   * Reconnect to an existing stream (for resumable streams)
   */
  async reconnectToStream(options: {
    chatId: string;
    metadata?: unknown;
    headers?: Record<string, string>;
    body?: object;
  }): Promise<ReadableStream<UIMessageStreamChunk> | null> {
    if (this.status !== 'connected') {
      await this.connect();
    }

    const requestId = generateId('req');

    return new Promise((resolve, reject) => {
      let controller: ReadableStreamDefaultController<UIMessageStreamChunk> | null = null;

      const stream = new ReadableStream<UIMessageStreamChunk>({
        start(c) {
          controller = c;
        },
      });

      this.pendingRequests.set(requestId, {
        resolve: () => resolve(stream),
        reject,
        controller,
      });

      this.send({
        type: 'chat:reconnect',
        requestId,
        payload: {
          chatId: options.chatId,
          metadata: options.metadata,
        },
      });
    });
  }

  /**
   * Join a room for real-time updates
   */
  joinRoom(roomId: string): void {
    this.joinedRooms.add(roomId);
    if (this.status === 'connected') {
      this.send({ type: 'room:join', payload: { roomId } } as WSJoinRoom);
    }
  }

  /**
   * Leave a room
   */
  leaveRoom(roomId: string): void {
    this.joinedRooms.delete(roomId);
    if (this.status === 'connected') {
      this.send({ type: 'room:leave', payload: { roomId } } as WSLeaveRoom);
    }
  }

  /**
   * Set event handlers
   */
  on<K extends keyof WebSocketEvents>(event: K, handler: WebSocketEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Remove event handler
   */
  off<K extends keyof WebSocketEvents>(event: K): void {
    delete this.events[event];
  }

  /**
   * Get current connection status
   */
  getStatus(): WebSocketStatus {
    return this.status;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Update auth token
   */
  setAuthToken(token: string): void {
    this.options.authToken = token;
  }

  // ========================================
  // Private Methods
  // ========================================

  private setStatus(status: WebSocketStatus): void {
    this.status = status;
  }

  private send(message: WSMessage | WSChatRequest | WSJoinRoom | WSLeaveRoom): void {
    if (this.ws && this.status === 'connected') {
      this.ws.send(JSON.stringify(message));
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WSMessage;
      this.events.onMessage?.(message);

      switch (message.type) {
        case 'chat:chunk': {
          const chunkMessage = message as WSChatStreamChunk;
          const request = this.pendingRequests.get(chunkMessage.requestId);
          if (request?.controller) {
            request.controller.enqueue(chunkMessage.payload);
            this.events.onChunk?.(chunkMessage.payload);
          }
          break;
        }

        case 'chat:complete': {
          const completeMessage = message as WSChatComplete;
          const request = this.pendingRequests.get(completeMessage.requestId);
          if (request?.controller) {
            request.controller.close();
            this.pendingRequests.delete(completeMessage.requestId);
          }
          break;
        }

        case 'chat:error': {
          const errorMessage = message as WSChatError;
          const request = this.pendingRequests.get(errorMessage.requestId);
          if (request) {
            // Push error chunk before closing
            request.controller?.enqueue({
              type: 'error',
              errorText: errorMessage.error,
            });
            request.controller?.close();
            this.pendingRequests.delete(errorMessage.requestId);
          }
          break;
        }

        case 'chat:reconnect:not-found': {
          const request = this.pendingRequests.get(message.requestId ?? '');
          if (request) {
            request.resolve(null as any); // No active stream
            this.pendingRequests.delete(message.requestId ?? '');
          }
          break;
        }

        case 'pong':
          // Heartbeat response, ignore
          break;

        default:
          // Unknown message type, might be a custom event
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.status === 'connected') {
        this.send({ type: 'ping' });
      }
    }, this.options.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.events.onError?.(new Error('Max reconnect attempts reached'));
      return;
    }

    this.stopReconnect();

    // Exponential backoff with jitter
    const delay = Math.min(
      this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts) + Math.random() * 1000,
      30000 // Max 30 seconds
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.events.onReconnect?.(this.reconnectAttempts);
      this.connect().catch(() => {
        // Will trigger another reconnect attempt
      });
    }, delay);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let defaultTransport: WebSocketChatTransport | null = null;

/**
 * Get or create the default WebSocket transport
 */
export function getWebSocketTransport(options?: WebSocketTransportOptions): WebSocketChatTransport {
  if (!defaultTransport && options) {
    defaultTransport = new WebSocketChatTransport(options);
  }
  if (!defaultTransport) {
    throw new Error('WebSocket transport not initialized. Call getWebSocketTransport with options first.');
  }
  return defaultTransport;
}

/**
 * Create a new WebSocket transport instance
 */
export function createWebSocketTransport(options: WebSocketTransportOptions): WebSocketChatTransport {
  return new WebSocketChatTransport(options);
}
