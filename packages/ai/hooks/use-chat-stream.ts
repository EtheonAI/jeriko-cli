/**
 * @repo/ai - Advanced Chat Stream Hook
 *
 * High-performance chat hook with optimistic updates, caching,
 * resumable streams, and multi-step tool handling.
 */

'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  Attachment,
  Message,
  MessageMetadata,
  MessagePart,
  MessageStatus,
  ToolCallState,
} from '../lib/types/core';
import {
  generateMessageId,
  generateToolCallId,
  MessageBuilder,
  readStream,
} from '../lib/streaming';
import { generateMessageCacheKey, responseCache } from '../lib/cache';

// ============================================================================
// Types
// ============================================================================

export type ChatStatus =
  | 'idle'          // Ready for input
  | 'submitting'    // Sending message
  | 'streaming'     // Receiving response
  | 'tool-calling'  // Executing tools
  | 'error';        // Error state

export interface UseChatStreamOptions {
  // API configuration
  api?: string;
  headers?: Record<string, string>;
  credentials?: RequestCredentials;

  // Initial state
  initialMessages?: Message[];
  threadId?: string;

  // Caching
  enableCache?: boolean;
  cacheTtl?: number;

  // Streaming
  enableResume?: boolean;
  smoothStreaming?: boolean;
  smoothDelay?: number;

  // Callbacks
  onMessageStart?: (message: Message) => void;
  onMessageComplete?: (message: Message) => void;
  onToolCall?: (toolCallId: string, toolName: string, args: unknown) => void;
  onToolResult?: (toolCallId: string, result: unknown) => void;
  onError?: (error: Error) => void;
  onFinish?: (messages: Message[]) => void;

  // Persistence
  saveMessages?: (messages: Message[]) => Promise<void>;
  loadMessages?: () => Promise<Message[]>;
}

export interface UseChatStreamReturn {
  // State
  messages: Message[];
  status: ChatStatus;
  error: Error | null;
  isLoading: boolean;
  isStreaming: boolean;

  // Actions
  sendMessage: (content: string | MessagePart[], attachments?: Attachment[]) => Promise<void>;
  append: (message: Partial<Message>) => Promise<void>;
  regenerate: (messageId?: string) => Promise<void>;
  stop: () => void;
  clear: () => void;
  retry: () => Promise<void>;

  // Message management
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  deleteMessage: (id: string) => void;

  // Utilities
  getTextContent: (message: Message) => string;
  getLastAssistantMessage: () => Message | undefined;
}

// ============================================================================
// Internal State Store (For optimistic updates)
// ============================================================================

interface ChatStore {
  messages: Message[];
  status: ChatStatus;
  error: Error | null;
  listeners: Set<() => void>;
}

function createChatStore(initialMessages: Message[] = []): ChatStore {
  return {
    messages: initialMessages,
    status: 'idle',
    error: null,
    listeners: new Set(),
  };
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useChatStream(options: UseChatStreamOptions = {}): UseChatStreamReturn {
  const {
    api = '/api/chat',
    headers = {},
    credentials = 'same-origin',
    initialMessages = [],
    threadId,
    enableCache = true,
    cacheTtl = 60 * 60 * 1000, // 1 hour
    enableResume = false,
    smoothStreaming = true,
    smoothDelay = 15,
    onMessageStart,
    onMessageComplete,
    onToolCall,
    onToolResult,
    onError,
    onFinish,
    saveMessages,
    loadMessages,
  } = options;

  // Store ref for optimistic updates
  const storeRef = useRef<ChatStore>(createChatStore(initialMessages));

  // Abort controller for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Message builder for streaming
  const messageBuilderRef = useRef<MessageBuilder | null>(null);

  // Last sent message (for retry)
  const lastInputRef = useRef<{ content: MessagePart[]; attachments?: Attachment[] } | null>(null);

  // ========================================
  // State synchronization
  // ========================================

  const subscribe = useCallback((callback: () => void) => {
    storeRef.current.listeners.add(callback);
    return () => storeRef.current.listeners.delete(callback);
  }, []);

  const getSnapshot = useCallback(() => storeRef.current, []);

  const store = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const notifyListeners = useCallback(() => {
    storeRef.current.listeners.forEach((listener) => listener());
  }, []);

  const updateStore = useCallback((updates: Partial<ChatStore>) => {
    Object.assign(storeRef.current, updates);
    notifyListeners();
  }, [notifyListeners]);

  // ========================================
  // Message helpers
  // ========================================

  const setMessages = useCallback((
    updater: Message[] | ((prev: Message[]) => Message[])
  ) => {
    const newMessages = typeof updater === 'function'
      ? updater(storeRef.current.messages)
      : updater;
    updateStore({ messages: newMessages });
  }, [updateStore]);

  const updateMessage = useCallback((id: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, ...updates, updatedAt: new Date() } : msg
      )
    );
  }, [setMessages]);

  const deleteMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, [setMessages]);

  const getTextContent = useCallback((message: Message): string => {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('\n');
  }, []);

  const getLastAssistantMessage = useCallback((): Message | undefined => {
    return [...storeRef.current.messages]
      .reverse()
      .find((msg) => msg.role === 'assistant');
  }, []);

  // ========================================
  // Core send logic
  // ========================================

  const sendMessage = useCallback(async (
    content: string | MessagePart[],
    attachments?: Attachment[]
  ): Promise<void> => {
    // Convert string to parts
    const parts: MessagePart[] = typeof content === 'string'
      ? [{ type: 'text', text: content }]
      : content;

    // Add attachment parts
    if (attachments?.length) {
      for (const attachment of attachments) {
        if (attachment.status === 'ready' && attachment.url) {
          if (attachment.type === 'image') {
            parts.push({
              type: 'image',
              url: attachment.url,
              alt: attachment.name,
              mimeType: attachment.mimeType,
            });
          } else {
            parts.push({
              type: 'file',
              url: attachment.url,
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
            });
          }
        }
      }
    }

    // Store for retry
    lastInputRef.current = { content: parts, attachments };

    // Create optimistic user message
    const userMessage: Message = {
      id: generateMessageId(),
      role: 'user',
      parts,
      status: 'complete',
      createdAt: new Date(),
      isOptimistic: true,
    };

    // Add user message immediately (optimistic)
    setMessages((prev) => [...prev, userMessage]);
    updateStore({ status: 'submitting', error: null });

    // Check cache
    if (enableCache) {
      const cacheKey = generateMessageCacheKey(
        [...storeRef.current.messages, userMessage].map((m) => ({
          role: m.role,
          parts: m.parts,
        })),
        'default'
      );

      const cachedResponse = await responseCache.get<Message>(cacheKey);
      if (cachedResponse) {
        const cachedMessage = {
          ...cachedResponse,
          id: generateMessageId(),
          metadata: { ...cachedResponse.metadata, cached: true, cacheHit: 'full' as const },
        };
        setMessages((prev) => [...prev, cachedMessage]);
        updateStore({ status: 'idle' });
        onMessageComplete?.(cachedMessage);
        onFinish?.(storeRef.current.messages);
        return;
      }
    }

    // Prepare abort controller
    abortControllerRef.current = new AbortController();

    // Create assistant message placeholder
    messageBuilderRef.current = new MessageBuilder('assistant');
    const assistantMessage = messageBuilderRef.current.getMessage();
    onMessageStart?.(assistantMessage);
    setMessages((prev) => [...prev, assistantMessage]);
    updateStore({ status: 'streaming' });

    try {
      // Send request
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        credentials,
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          messages: storeRef.current.messages.map((m) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
          })),
          threadId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Read stream
      await readStream(response, {
        onTextDelta: (delta, fullText) => {
          if (!messageBuilderRef.current) return;

          messageBuilderRef.current.appendText(delta);
          const updatedMessage = messageBuilderRef.current.getMessage();

          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = updatedMessage;
              return newMessages;
            }
            return prev;
          });
        },

        onToolCallStart: (toolCallId, toolName) => {
          if (!messageBuilderRef.current) return;

          updateStore({ status: 'tool-calling' });
          messageBuilderRef.current.startToolCall(toolCallId, toolName);

          const updatedMessage = messageBuilderRef.current.getMessage();
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = updatedMessage;
              return newMessages;
            }
            return prev;
          });
        },

        onToolCallDelta: (toolCallId, argsDelta) => {
          if (!messageBuilderRef.current) return;

          messageBuilderRef.current.appendToolCallArgs(toolCallId, argsDelta);

          const updatedMessage = messageBuilderRef.current.getMessage();
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = updatedMessage;
              return newMessages;
            }
            return prev;
          });
        },

        onToolCallComplete: (toolCallId, args) => {
          if (!messageBuilderRef.current) return;

          messageBuilderRef.current.completeToolCall(toolCallId, args);
          onToolCall?.(toolCallId, '', args);

          const updatedMessage = messageBuilderRef.current.getMessage();
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = updatedMessage;
              return newMessages;
            }
            return prev;
          });
        },

        onToolResult: (toolCallId, result, isError) => {
          if (!messageBuilderRef.current) return;

          messageBuilderRef.current.setToolResult(toolCallId, result, isError);
          onToolResult?.(toolCallId, result);

          const updatedMessage = messageBuilderRef.current.getMessage();
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = updatedMessage;
              return newMessages;
            }
            return prev;
          });

          updateStore({ status: 'streaming' });
        },

        onReasoningDelta: (delta) => {
          if (!messageBuilderRef.current) return;

          messageBuilderRef.current.appendReasoning(delta);

          const updatedMessage = messageBuilderRef.current.getMessage();
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = updatedMessage;
              return newMessages;
            }
            return prev;
          });
        },

        onMessageComplete: (message) => {
          if (!messageBuilderRef.current) return;

          const completedMessage = messageBuilderRef.current.complete();
          onMessageComplete?.(completedMessage);

          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = completedMessage;
              return newMessages;
            }
            return prev;
          });

          // Cache the response
          if (enableCache) {
            const cacheKey = generateMessageCacheKey(
              storeRef.current.messages.slice(0, -1).map((m) => ({
                role: m.role,
                parts: m.parts,
              })),
              'default'
            );
            responseCache.set(cacheKey, completedMessage, { ttl: cacheTtl });
          }
        },

        onStreamEnd: () => {
          updateStore({ status: 'idle' });
          onFinish?.(storeRef.current.messages);

          // Persist messages
          if (saveMessages) {
            saveMessages(storeRef.current.messages).catch(console.error);
          }
        },

        onError: (error) => {
          updateStore({ status: 'error', error });
          onError?.(error);

          if (messageBuilderRef.current) {
            const errorMessage = messageBuilderRef.current.error(error.message);
            setMessages((prev) => {
              const lastIndex = prev.length - 1;
              if (prev[lastIndex]?.role === 'assistant') {
                const newMessages = [...prev];
                newMessages[lastIndex] = errorMessage;
                return newMessages;
              }
              return prev;
            });
          }
        },
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled
        updateStore({ status: 'idle' });
        if (messageBuilderRef.current) {
          const cancelledMessage = {
            ...messageBuilderRef.current.getMessage(),
            status: 'cancelled' as MessageStatus,
          };
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            if (prev[lastIndex]?.role === 'assistant') {
              const newMessages = [...prev];
              newMessages[lastIndex] = cancelledMessage;
              return newMessages;
            }
            return prev;
          });
        }
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        updateStore({ status: 'error', error: err });
        onError?.(err);
      }
    } finally {
      abortControllerRef.current = null;
      messageBuilderRef.current = null;
    }
  }, [
    api,
    headers,
    credentials,
    threadId,
    enableCache,
    cacheTtl,
    onMessageStart,
    onMessageComplete,
    onToolCall,
    onToolResult,
    onError,
    onFinish,
    saveMessages,
    setMessages,
    updateStore,
  ]);

  // ========================================
  // Other actions
  // ========================================

  const append = useCallback(async (message: Partial<Message>): Promise<void> => {
    const fullMessage: Message = {
      id: message.id ?? generateMessageId(),
      role: message.role ?? 'user',
      parts: message.parts ?? [],
      status: message.status ?? 'complete',
      createdAt: message.createdAt ?? new Date(),
      ...message,
    };

    setMessages((prev) => [...prev, fullMessage]);

    // If it's a user message, trigger response
    if (fullMessage.role === 'user') {
      await sendMessage(fullMessage.parts);
    }
  }, [sendMessage, setMessages]);

  const regenerate = useCallback(async (messageId?: string): Promise<void> => {
    // Find the message to regenerate from
    const messages = storeRef.current.messages;
    let targetIndex = messageId
      ? messages.findIndex((m) => m.id === messageId)
      : messages.length - 1;

    // If targeting an assistant message, go back to the previous user message
    if (messages[targetIndex]?.role === 'assistant') {
      targetIndex--;
    }

    if (targetIndex < 0 || messages[targetIndex]?.role !== 'user') {
      return;
    }

    // Remove messages from target onwards
    const userMessage = messages[targetIndex];
    if (!userMessage) return;
    setMessages((prev) => prev.slice(0, targetIndex));

    // Re-send the user message
    await sendMessage(userMessage.parts);
  }, [sendMessage, setMessages]);

  const stop = useCallback((): void => {
    abortControllerRef.current?.abort();
  }, []);

  const clear = useCallback((): void => {
    setMessages([]);
    updateStore({ status: 'idle', error: null });
  }, [setMessages, updateStore]);

  const retry = useCallback(async (): Promise<void> => {
    if (!lastInputRef.current) return;

    // Remove the last assistant message if it errored
    const messages = storeRef.current.messages;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'assistant' && lastMessage.status === 'error') {
      setMessages((prev) => prev.slice(0, -1));
    }

    // Also remove the last user message to re-add it
    setMessages((prev) => prev.slice(0, -1));

    await sendMessage(lastInputRef.current.content, lastInputRef.current.attachments);
  }, [sendMessage, setMessages]);

  // ========================================
  // Load initial messages
  // ========================================

  useEffect(() => {
    if (loadMessages) {
      loadMessages()
        .then((messages) => {
          if (messages.length > 0) {
            setMessages(messages);
          }
        })
        .catch(console.error);
    }
  }, [loadMessages, setMessages]);

  // ========================================
  // Return
  // ========================================

  return {
    // State
    messages: store.messages,
    status: store.status,
    error: store.error,
    isLoading: store.status === 'submitting' || store.status === 'streaming',
    isStreaming: store.status === 'streaming',

    // Actions
    sendMessage,
    append,
    regenerate,
    stop,
    clear,
    retry,

    // Message management
    setMessages,
    updateMessage,
    deleteMessage,

    // Utilities
    getTextContent,
    getLastAssistantMessage,
  };
}
