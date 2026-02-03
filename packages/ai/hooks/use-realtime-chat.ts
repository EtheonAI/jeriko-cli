/**
 * @repo/ai - useRealTimeChat Hook
 *
 * Advanced chat hook with WebSocket streaming, Redux integration,
 * optimistic updates, and comprehensive tool handling.
 *
 * Follows Vercel AI SDK 6.x patterns with enhanced real-time capabilities.
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  UIMessage,
  UIMessagePart,
  ChatStatus,
  FinishReason,
  MessageMetadata,
  StaticToolUIPart,
  DynamicToolUIPart,
  ToolApproval,
} from '../lib/types/ui-message';
import type { UIMessageStreamChunk } from '../lib/types/stream-chunks';
import { isToolUIPart, getToolName, hasPendingToolCalls } from '../lib/types/ui-message';
import { generateId } from '../lib/streaming';
import type { ChatTransport } from '../lib/transport';
import { createAdaptiveTransport, createHTTPTransport } from '../lib/transport';

// ============================================================================
// Types
// ============================================================================

export interface CreateMessage {
  id?: string;
  role?: 'user' | 'assistant';
  parts?: UIMessagePart[];
  metadata?: MessageMetadata;
}

export interface SendMessageOptions {
  /** Text content */
  text?: string;

  /** File attachments */
  files?: FileList | File[] | FileUIPart[];

  /** Pre-built message parts */
  parts?: UIMessagePart[];

  /** Message metadata */
  metadata?: MessageMetadata;

  /** Message ID for edit/regenerate */
  messageId?: string;

  /** Additional request headers */
  headers?: Record<string, string>;

  /** Additional request body */
  body?: object;
}

interface FileUIPart {
  type: 'file';
  mediaType: string;
  url: string;
  filename?: string;
}

export interface ToolCallInfo {
  toolCallId: string;
  toolName: string;
  input: unknown;
  dynamic?: boolean;
}

export interface UseRealTimeChatOptions {
  /** Unique chat ID */
  id?: string;

  /** Initial messages */
  messages?: UIMessage[];

  /** Chat transport (WebSocket, HTTP, or adaptive) */
  transport?: ChatTransport;

  /** API endpoint for HTTP transport */
  api?: string;

  /** WebSocket URL */
  wsUrl?: string;

  /** Auth token */
  authToken?: string;

  /** Session ID for multi-session support */
  sessionId?: string;

  /** Auto-resume streams on mount */
  resume?: boolean;

  /** Callback when a tool call is received */
  onToolCall?: (toolCall: ToolCallInfo) => void | Promise<void>;

  /** Callback when stream finishes */
  onFinish?: (options: {
    message: UIMessage;
    messages: UIMessage[];
    isAbort: boolean;
    isError: boolean;
    finishReason?: FinishReason;
  }) => void;

  /** Callback when error occurs */
  onError?: (error: Error) => void;

  /** Custom ID generator */
  generateId?: () => string;

  /** Throttle interval for UI updates (ms) */
  throttle?: number;

  /** Auto-send when tool results are available */
  sendAutomaticallyWhen?: (options: { messages: UIMessage[] }) => boolean | Promise<boolean>;
}

export interface UseRealTimeChatReturn {
  /** Current messages */
  messages: UIMessage[];

  /** Set messages directly */
  setMessages: (messages: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])) => void;

  /** Chat status */
  status: ChatStatus;

  /** Last error */
  error: Error | undefined;

  /** Send a message */
  sendMessage: (options?: SendMessageOptions | string) => Promise<void>;

  /** Regenerate last assistant message or specific message */
  regenerate: (options?: { messageId?: string }) => Promise<void>;

  /** Stop current generation */
  stop: () => void;

  /** Resume an interrupted stream */
  resumeStream: () => Promise<void>;

  /** Clear error state */
  clearError: () => void;

  /** Add tool output */
  addToolOutput: <T = unknown>(options: {
    toolCallId: string;
    output: T;
  }) => void;

  /** Add tool error */
  addToolError: (options: {
    toolCallId: string;
    errorText: string;
  }) => void;

  /** Add tool approval response */
  addToolApprovalResponse: (options: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => void;

  /** Chat ID */
  id: string;

  /** Last message */
  lastMessage: UIMessage | undefined;

  /** Whether chat has messages */
  hasMessages: boolean;

  /** Pending tool calls */
  pendingToolCalls: Array<StaticToolUIPart | DynamicToolUIPart>;

  /** Whether there are tools awaiting approval */
  hasToolsAwaitingApproval: boolean;
}

// ============================================================================
// Internal State
// ============================================================================

interface ChatState {
  messages: UIMessage[];
  status: ChatStatus;
  error: Error | undefined;
}

interface StreamingState {
  message: UIMessage;
  activeTextParts: Map<string, { index: number; text: string }>;
  activeReasoningParts: Map<string, { index: number; text: string }>;
  partialToolCalls: Map<string, { index: number; argsText: string; toolName: string; dynamic?: boolean }>;
  finishReason?: FinishReason;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useRealTimeChat(options: UseRealTimeChatOptions = {}): UseRealTimeChatReturn {
  const {
    id: providedId,
    messages: initialMessages = [],
    transport: providedTransport,
    api = '/api/chat',
    wsUrl,
    authToken,
    sessionId,
    resume = false,
    onToolCall,
    onFinish,
    onError,
    generateId: customGenerateId = generateId,
    throttle: throttleMs,
    sendAutomaticallyWhen,
  } = options;

  // Generate stable chat ID
  const chatIdRef = useRef(providedId ?? customGenerateId('chat'));
  const chatId = chatIdRef.current;

  // Transport
  const transportRef = useRef<ChatTransport>(
    providedTransport ?? createAdaptiveTransport({
      websocket: wsUrl ? {
        url: wsUrl,
        authToken,
        autoConnect: true,
        autoReconnect: true,
      } : undefined,
      http: { api },
    })
  );

  // State
  const stateRef = useRef<ChatState>({
    messages: initialMessages,
    status: 'ready',
    error: undefined,
  });

  // Listeners for state updates
  const listenersRef = useRef(new Set<() => void>());

  // Streaming state
  const streamingRef = useRef<StreamingState | null>(null);

  // Abort controller
  const abortControllerRef = useRef<AbortController | null>(null);

  // Callbacks ref (to avoid stale closures)
  const callbacksRef = useRef({ onToolCall, onFinish, onError, sendAutomaticallyWhen });
  callbacksRef.current = { onToolCall, onFinish, onError, sendAutomaticallyWhen };

  // Last update time (for throttling)
  const lastUpdateRef = useRef(0);
  const pendingUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ========================================
  // State Management
  // ========================================

  const notifyListeners = useCallback(() => {
    // Throttle updates if configured
    if (throttleMs) {
      const now = Date.now();
      const elapsed = now - lastUpdateRef.current;

      if (elapsed < throttleMs) {
        if (!pendingUpdateRef.current) {
          pendingUpdateRef.current = setTimeout(() => {
            pendingUpdateRef.current = null;
            lastUpdateRef.current = Date.now();
            listenersRef.current.forEach((listener) => listener());
          }, throttleMs - elapsed);
        }
        return;
      }

      lastUpdateRef.current = now;
    }

    listenersRef.current.forEach((listener) => listener());
  }, [throttleMs]);

  const updateState = useCallback((updates: Partial<ChatState>) => {
    Object.assign(stateRef.current, updates);
    notifyListeners();
  }, [notifyListeners]);

  const setMessages = useCallback((
    updater: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
  ) => {
    const newMessages = typeof updater === 'function'
      ? updater(stateRef.current.messages)
      : updater;
    updateState({ messages: newMessages });
  }, [updateState]);

  // ========================================
  // useSyncExternalStore subscriptions
  // ========================================

  const subscribeMessages = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const getMessages = useCallback(() => stateRef.current.messages, []);

  const messages = useSyncExternalStore(
    subscribeMessages,
    getMessages,
    getMessages
  );

  const subscribeStatus = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const getStatus = useCallback(() => stateRef.current.status, []);

  const status = useSyncExternalStore(
    subscribeStatus,
    getStatus,
    getStatus
  );

  const subscribeError = useCallback((callback: () => void) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  const getError = useCallback(() => stateRef.current.error, []);

  const error = useSyncExternalStore(
    subscribeError,
    getError,
    getError
  );

  // ========================================
  // Stream Processing
  // ========================================

  const processChunk = useCallback((chunk: UIMessageStreamChunk) => {
    const streaming = streamingRef.current;
    if (!streaming) return;

    switch (chunk.type) {
      case 'start': {
        if (chunk.messageId) {
          streaming.message.id = chunk.messageId;
        }
        if (chunk.messageMetadata) {
          streaming.message.metadata = {
            ...streaming.message.metadata,
            ...(chunk.messageMetadata as MessageMetadata),
          };
        }
        break;
      }

      case 'text-start': {
        const textPart: UIMessagePart = {
          type: 'text',
          text: '',
          state: 'streaming',
        };
        streaming.message.parts.push(textPart);
        streaming.activeTextParts.set(chunk.id, {
          index: streaming.message.parts.length - 1,
          text: '',
        });
        break;
      }

      case 'text-delta': {
        const textInfo = streaming.activeTextParts.get(chunk.id);
        if (textInfo) {
          textInfo.text += chunk.delta;
          const part = streaming.message.parts[textInfo.index] as { type: 'text'; text: string };
          if (part) {
            part.text = textInfo.text;
          }
        }
        break;
      }

      case 'text-end': {
        const textInfo = streaming.activeTextParts.get(chunk.id);
        if (textInfo) {
          const part = streaming.message.parts[textInfo.index] as { type: 'text'; state?: string };
          if (part) {
            part.state = 'done';
          }
          streaming.activeTextParts.delete(chunk.id);
        }
        break;
      }

      case 'reasoning-start': {
        const reasoningPart: UIMessagePart = {
          type: 'reasoning',
          text: '',
          state: 'streaming',
        };
        streaming.message.parts.push(reasoningPart);
        streaming.activeReasoningParts.set(chunk.id, {
          index: streaming.message.parts.length - 1,
          text: '',
        });
        break;
      }

      case 'reasoning-delta': {
        const reasoningInfo = streaming.activeReasoningParts.get(chunk.id);
        if (reasoningInfo) {
          reasoningInfo.text += chunk.delta;
          const part = streaming.message.parts[reasoningInfo.index] as { type: 'reasoning'; text: string };
          if (part) {
            part.text = reasoningInfo.text;
          }
        }
        break;
      }

      case 'reasoning-end': {
        const reasoningInfo = streaming.activeReasoningParts.get(chunk.id);
        if (reasoningInfo) {
          const part = streaming.message.parts[reasoningInfo.index] as { type: 'reasoning'; state?: string };
          if (part) {
            part.state = 'done';
          }
          streaming.activeReasoningParts.delete(chunk.id);
        }
        break;
      }

      case 'tool-input-start': {
        const toolPart: UIMessagePart = chunk.dynamic
          ? {
              type: 'dynamic-tool',
              toolName: chunk.toolName,
              toolCallId: chunk.toolCallId,
              state: 'input-streaming',
              input: undefined,
              title: chunk.title,
              providerExecuted: chunk.providerExecuted,
            }
          : {
              type: `tool-${chunk.toolName}` as const,
              toolCallId: chunk.toolCallId,
              state: 'input-streaming',
              input: undefined,
              title: chunk.title,
              providerExecuted: chunk.providerExecuted,
            };

        streaming.message.parts.push(toolPart);
        streaming.partialToolCalls.set(chunk.toolCallId, {
          index: streaming.message.parts.length - 1,
          argsText: '',
          toolName: chunk.toolName,
          dynamic: chunk.dynamic,
        });
        break;
      }

      case 'tool-input-delta': {
        const toolInfo = streaming.partialToolCalls.get(chunk.toolCallId);
        if (toolInfo) {
          toolInfo.argsText += chunk.inputTextDelta;
          try {
            const partialInput = JSON.parse(toolInfo.argsText);
            const part = streaming.message.parts[toolInfo.index] as StaticToolUIPart | DynamicToolUIPart;
            if (part) {
              part.input = partialInput;
            }
          } catch {
            // Partial JSON, ignore parse error
          }
        }
        break;
      }

      case 'tool-input-available': {
        const toolInfo = streaming.partialToolCalls.get(chunk.toolCallId);
        const existingPartIndex = toolInfo?.index ?? streaming.message.parts.findIndex(
          (p) => isToolUIPart(p) && p.toolCallId === chunk.toolCallId
        );

        if (existingPartIndex >= 0) {
          const part = streaming.message.parts[existingPartIndex] as StaticToolUIPart | DynamicToolUIPart;
          part.state = 'input-available';
          part.input = chunk.input;
        } else {
          // New tool call (not streamed)
          const toolPart: UIMessagePart = chunk.dynamic
            ? {
                type: 'dynamic-tool',
                toolName: chunk.toolName,
                toolCallId: chunk.toolCallId,
                state: 'input-available',
                input: chunk.input,
                title: chunk.title,
              }
            : {
                type: `tool-${chunk.toolName}` as const,
                toolCallId: chunk.toolCallId,
                state: 'input-available',
                input: chunk.input,
                title: chunk.title,
              };
          streaming.message.parts.push(toolPart);
        }

        // Call onToolCall callback
        if (!chunk.providerExecuted) {
          callbacksRef.current.onToolCall?.({
            toolCallId: chunk.toolCallId,
            toolName: chunk.toolName,
            input: chunk.input,
            dynamic: chunk.dynamic,
          });
        }
        break;
      }

      case 'tool-output-available': {
        const part = streaming.message.parts.find(
          (p) => isToolUIPart(p) && p.toolCallId === chunk.toolCallId
        ) as StaticToolUIPart | DynamicToolUIPart | undefined;

        if (part) {
          part.state = 'output-available';
          part.output = chunk.output;
          part.preliminary = chunk.preliminary;
        }
        break;
      }

      case 'tool-output-error': {
        const part = streaming.message.parts.find(
          (p) => isToolUIPart(p) && p.toolCallId === chunk.toolCallId
        ) as StaticToolUIPart | DynamicToolUIPart | undefined;

        if (part) {
          part.state = 'output-error';
          part.errorText = chunk.errorText;
        }
        break;
      }

      case 'tool-approval-request': {
        const part = streaming.message.parts.find(
          (p) => isToolUIPart(p) && p.toolCallId === chunk.toolCallId
        ) as StaticToolUIPart | DynamicToolUIPart | undefined;

        if (part) {
          part.state = 'approval-requested';
          part.approval = { id: chunk.approvalId };
        }
        break;
      }

      case 'tool-output-denied': {
        const part = streaming.message.parts.find(
          (p) => isToolUIPart(p) && p.toolCallId === chunk.toolCallId
        ) as StaticToolUIPart | DynamicToolUIPart | undefined;

        if (part) {
          part.state = 'output-denied';
        }
        break;
      }

      case 'file': {
        streaming.message.parts.push({
          type: 'file',
          mediaType: chunk.mediaType,
          url: chunk.url,
          filename: chunk.filename,
        });
        break;
      }

      case 'source-url': {
        streaming.message.parts.push({
          type: 'source-url',
          sourceId: chunk.sourceId,
          url: chunk.url,
          title: chunk.title,
        });
        break;
      }

      case 'finish': {
        streaming.finishReason = chunk.finishReason;
        if (chunk.messageMetadata) {
          streaming.message.metadata = {
            ...streaming.message.metadata,
            ...(chunk.messageMetadata as MessageMetadata),
          };
        }
        break;
      }

      case 'error': {
        const err = new Error(chunk.errorText);
        updateState({ status: 'error', error: err });
        callbacksRef.current.onError?.(err);
        break;
      }

      case 'finish-step': {
        // Clear active streaming parts for the step
        streaming.activeTextParts.clear();
        streaming.activeReasoningParts.clear();
        break;
      }

      case 'start-step': {
        streaming.message.parts.push({ type: 'step-start' });
        break;
      }

      default:
        // Handle data chunks or unknown types
        if (chunk.type.startsWith('data-')) {
          streaming.message.parts.push(chunk as UIMessagePart);
        }
    }

    // Update messages with current streaming state
    const msgs = stateRef.current.messages;
    const lastMsg = msgs[msgs.length - 1];

    if (lastMsg?.id === streaming.message.id) {
      // Replace last message
      updateState({
        messages: [...msgs.slice(0, -1), { ...streaming.message }],
      });
    } else {
      // Append new message
      updateState({
        messages: [...msgs, { ...streaming.message }],
      });
    }
  }, [updateState]);

  // ========================================
  // Core Actions
  // ========================================

  const makeRequest = useCallback(async (
    trigger: 'submit-message' | 'resume-stream' | 'regenerate-message',
    options?: { messageId?: string; headers?: Record<string, string>; body?: object }
  ) => {
    const { messageId, headers, body } = options ?? {};

    updateState({ status: 'submitted', error: undefined });

    abortControllerRef.current = new AbortController();

    // Initialize streaming state
    const lastMessage = stateRef.current.messages[stateRef.current.messages.length - 1];
    const isExistingAssistantMessage = lastMessage?.role === 'assistant';

    streamingRef.current = {
      message: isExistingAssistantMessage
        ? { ...lastMessage }
        : {
            id: customGenerateId('msg'),
            role: 'assistant',
            parts: [],
            metadata: undefined,
            createdAt: new Date(),
          },
      activeTextParts: new Map(),
      activeReasoningParts: new Map(),
      partialToolCalls: new Map(),
    };

    let isAbort = false;
    let isError = false;

    try {
      let stream: ReadableStream<UIMessageStreamChunk>;

      if (trigger === 'resume-stream') {
        const reconnected = await transportRef.current.reconnectToStream({
          chatId,
          metadata: { sessionId },
          headers,
          body,
        });

        if (!reconnected) {
          updateState({ status: 'ready' });
          return;
        }
        stream = reconnected;
      } else {
        stream = await transportRef.current.sendMessages({
          chatId,
          messages: stateRef.current.messages,
          trigger,
          messageId,
          abortSignal: abortControllerRef.current.signal,
          headers,
          body,
          metadata: { sessionId },
        });
      }

      updateState({ status: 'streaming' });

      // Process stream
      const reader = stream.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          processChunk(value);
        }
      } finally {
        reader.releaseLock();
      }

      updateState({ status: 'ready' });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        isAbort = true;
        updateState({ status: 'ready' });
      } else {
        isError = true;
        const error = err instanceof Error ? err : new Error(String(err));
        updateState({ status: 'error', error });
        callbacksRef.current.onError?.(error);
      }
    } finally {
      // Call onFinish callback
      if (streamingRef.current) {
        callbacksRef.current.onFinish?.({
          message: streamingRef.current.message,
          messages: stateRef.current.messages,
          isAbort,
          isError,
          finishReason: streamingRef.current.finishReason,
        });
      }

      streamingRef.current = null;
      abortControllerRef.current = null;

      // Check if we should auto-send
      if (!isError && callbacksRef.current.sendAutomaticallyWhen) {
        const shouldSend = await callbacksRef.current.sendAutomaticallyWhen({
          messages: stateRef.current.messages,
        });
        if (shouldSend) {
          makeRequest('submit-message', { messageId: stateRef.current.messages[stateRef.current.messages.length - 1]?.id });
        }
      }
    }
  }, [chatId, sessionId, customGenerateId, processChunk, updateState]);

  const sendMessage = useCallback(async (
    optionsOrText?: SendMessageOptions | string
  ): Promise<void> => {
    // Parse options
    const opts: SendMessageOptions = typeof optionsOrText === 'string'
      ? { text: optionsOrText }
      : optionsOrText ?? {};

    const { text, files, parts: providedParts, metadata, messageId, headers, body } = opts;

    // Build message parts
    const parts: UIMessagePart[] = providedParts ?? [];

    // Add file parts
    if (files) {
      const fileArray = Array.isArray(files) ? files : Array.from(files as FileList);
      for (const file of fileArray) {
        if ('url' in file && 'mediaType' in file) {
          // It's already a FileUIPart
          parts.push(file as FileUIPart);
        } else if (file instanceof File) {
          // Convert File to data URL (in a real app, you'd upload and get URL)
          const dataUrl = await fileToDataUrl(file);
          parts.push({
            type: 'file',
            mediaType: file.type,
            url: dataUrl,
            filename: file.name,
          });
        }
      }
    }

    // Add text part
    if (text) {
      parts.push({ type: 'text', text });
    }

    // If no parts, nothing to send (unless triggering existing messages)
    if (parts.length === 0 && !messageId) {
      // Just trigger with existing messages
      await makeRequest('submit-message', { headers, body });
      return;
    }

    // Handle message edit (replace existing)
    if (messageId) {
      const messageIndex = stateRef.current.messages.findIndex((m) => m.id === messageId);

      if (messageIndex >= 0) {
        const existingMessage = stateRef.current.messages[messageIndex];

        if (existingMessage.role !== 'user') {
          throw new Error('Can only edit user messages');
        }

        // Truncate messages and update the edited one
        const newMessages = stateRef.current.messages.slice(0, messageIndex);
        newMessages.push({
          ...existingMessage,
          parts,
          metadata,
          updatedAt: new Date(),
        });

        updateState({ messages: newMessages });
      }
    } else {
      // New message
      const userMessage: UIMessage = {
        id: customGenerateId('msg'),
        role: 'user',
        parts,
        metadata,
        createdAt: new Date(),
      };

      updateState({
        messages: [...stateRef.current.messages, userMessage],
      });
    }

    await makeRequest('submit-message', { messageId, headers, body });
  }, [customGenerateId, makeRequest, updateState]);

  const regenerate = useCallback(async (options?: { messageId?: string }): Promise<void> => {
    const { messageId } = options ?? {};

    const msgs = stateRef.current.messages;
    const targetIndex = messageId
      ? msgs.findIndex((m) => m.id === messageId)
      : msgs.length - 1;

    if (targetIndex < 0) {
      throw new Error('Message not found');
    }

    // If targeting assistant message, remove it
    if (msgs[targetIndex].role === 'assistant') {
      updateState({ messages: msgs.slice(0, targetIndex) });
    }

    await makeRequest('regenerate-message', { messageId });
  }, [makeRequest, updateState]);

  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const resumeStream = useCallback(async () => {
    await makeRequest('resume-stream');
  }, [makeRequest]);

  const clearError = useCallback(() => {
    if (stateRef.current.status === 'error') {
      updateState({ status: 'ready', error: undefined });
    }
  }, [updateState]);

  const addToolOutput = useCallback(<T = unknown>(options: {
    toolCallId: string;
    output: T;
  }) => {
    const { toolCallId, output } = options;

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.role !== 'assistant') return msg;

        const updatedParts = msg.parts.map((part) => {
          if (isToolUIPart(part) && part.toolCallId === toolCallId) {
            return { ...part, state: 'output-available' as const, output };
          }
          return part;
        });

        return { ...msg, parts: updatedParts };
      })
    );

    // Check if we should auto-send
    if (callbacksRef.current.sendAutomaticallyWhen) {
      const result = callbacksRef.current.sendAutomaticallyWhen({
        messages: stateRef.current.messages,
      });
      Promise.resolve(result).then((shouldSend: boolean) => {
        if (shouldSend && stateRef.current.status === 'ready') {
          makeRequest('submit-message');
        }
      });
    }
  }, [setMessages, makeRequest]);

  const addToolError = useCallback((options: {
    toolCallId: string;
    errorText: string;
  }) => {
    const { toolCallId, errorText } = options;

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.role !== 'assistant') return msg;

        const updatedParts = msg.parts.map((part) => {
          if (isToolUIPart(part) && part.toolCallId === toolCallId) {
            return { ...part, state: 'output-error' as const, errorText };
          }
          return part;
        });

        return { ...msg, parts: updatedParts };
      })
    );
  }, [setMessages]);

  const addToolApprovalResponse = useCallback((options: {
    id: string;
    approved: boolean;
    reason?: string;
  }) => {
    const { id, approved, reason } = options;

    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.role !== 'assistant') return msg;

        const updatedParts = msg.parts.map((part) => {
          if (isToolUIPart(part) && part.approval?.id === id) {
            return {
              ...part,
              state: approved ? 'approval-responded' as const : 'output-denied' as const,
              approval: { id, approved, reason } as ToolApproval,
            };
          }
          return part;
        });

        return { ...msg, parts: updatedParts };
      })
    );

    // Check if we should auto-send
    if (callbacksRef.current.sendAutomaticallyWhen) {
      const result = callbacksRef.current.sendAutomaticallyWhen({
        messages: stateRef.current.messages,
      });
      Promise.resolve(result).then((shouldSend: boolean) => {
        if (shouldSend && stateRef.current.status === 'ready') {
          makeRequest('submit-message');
        }
      });
    }
  }, [setMessages, makeRequest]);

  // ========================================
  // Computed Values
  // ========================================

  const lastMessage = messages[messages.length - 1];
  const hasMessages = messages.length > 0;

  const pendingToolCalls = useMemo(() => {
    if (!lastMessage || lastMessage.role !== 'assistant') return [];

    return lastMessage.parts.filter((part): part is StaticToolUIPart | DynamicToolUIPart =>
      isToolUIPart(part) &&
      (part.state === 'input-streaming' ||
       part.state === 'input-available' ||
       part.state === 'approval-requested' ||
       part.state === 'approval-responded')
    );
  }, [lastMessage]);

  const hasToolsAwaitingApproval = useMemo(() => {
    return pendingToolCalls.some((tool) => tool.state === 'approval-requested');
  }, [pendingToolCalls]);

  // ========================================
  // Effects
  // ========================================

  // Resume stream on mount if requested
  useEffect(() => {
    if (resume) {
      resumeStream();
    }
  }, [resume, resumeStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (pendingUpdateRef.current) {
        clearTimeout(pendingUpdateRef.current);
      }
    };
  }, []);

  // ========================================
  // Return
  // ========================================

  return {
    messages,
    setMessages,
    status,
    error,
    sendMessage,
    regenerate,
    stop,
    resumeStream,
    clearError,
    addToolOutput,
    addToolError,
    addToolApprovalResponse,
    id: chatId,
    lastMessage,
    hasMessages,
    pendingToolCalls,
    hasToolsAwaitingApproval,
  };
}

// ============================================================================
// Utilities
// ============================================================================

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
