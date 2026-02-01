/**
 * @repo/ai - Chat Provider
 *
 * Context provider for chat state management with:
 * - Optimistic updates
 * - Real-time streaming
 * - Message persistence
 * - Tool orchestration
 */

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useChatStream, type UseChatStreamReturn, type UseChatStreamOptions } from '../hooks/use-chat-stream';
import type { Attachment, Message, MessagePart } from '../lib/types/core';

// ============================================================================
// Types
// ============================================================================

export interface ChatContextValue extends UseChatStreamReturn {
  // Thread info
  threadId?: string;

  // Computed
  hasMessages: boolean;
  lastMessage: Message | undefined;
  pendingTools: string[];
}

export interface ChatProviderProps extends UseChatStreamOptions {
  children: ReactNode;
}

// ============================================================================
// Context
// ============================================================================

const ChatContext = createContext<ChatContextValue | null>(null);

// ============================================================================
// Hook
// ============================================================================

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

// ============================================================================
// Provider
// ============================================================================

export function ChatProvider({
  children,
  threadId,
  ...options
}: ChatProviderProps) {
  const chatStream = useChatStream({
    threadId,
    ...options,
  });

  // Computed values
  const hasMessages = chatStream.messages.length > 0;
  const lastMessage = chatStream.messages[chatStream.messages.length - 1];

  const pendingTools = useMemo(() => {
    if (!lastMessage || lastMessage.role !== 'assistant') return [];

    return lastMessage.parts
      .filter((part): part is Extract<MessagePart, { type: 'tool-call' }> =>
        part.type === 'tool-call' &&
        ['pending', 'input-streaming', 'input-available', 'executing'].includes(
          (part as { state?: string }).state ?? ''
        )
      )
      .map((part) => part.toolCallId);
  }, [lastMessage]);

  // Context value
  const value = useMemo<ChatContextValue>(() => ({
    ...chatStream,
    threadId,
    hasMessages,
    lastMessage,
    pendingTools,
  }), [chatStream, threadId, hasMessages, lastMessage, pendingTools]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

// ============================================================================
// HOC for easy wrapping
// ============================================================================

export function withChat<P extends object>(
  Component: React.ComponentType<P & { chat: ChatContextValue }>,
  options?: UseChatStreamOptions
) {
  return function WithChatComponent(props: P) {
    return (
      <ChatProvider {...options}>
        <ChatConsumer>
          {(chat) => <Component {...props} chat={chat} />}
        </ChatConsumer>
      </ChatProvider>
    );
  };
}

function ChatConsumer({
  children,
}: {
  children: (chat: ChatContextValue) => ReactNode;
}) {
  const chat = useChat();
  return <>{children(chat)}</>;
}
