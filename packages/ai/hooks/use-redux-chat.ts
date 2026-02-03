/**
 * @repo/ai - useReduxChat Hook
 *
 * Integration hook that connects AI chat with Redux store
 * for message persistence, session management, and state synchronization.
 */

'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import {
  useRealTimeChat,
  type UseRealTimeChatOptions,
  type UseRealTimeChatReturn,
  type SendMessageOptions,
} from './use-realtime-chat';
import type { UIMessage, FinishReason } from '../lib/types/ui-message';

// ============================================================================
// Types
// ============================================================================

/**
 * Redux store dispatch function type
 */
export type Dispatch = (action: unknown) => void;

/**
 * Redux state selector
 */
export type Selector<T> = (state: unknown) => T;

/**
 * Store interface for flexibility
 */
export interface StoreInterface {
  dispatch: Dispatch;
  getState: () => unknown;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Redux chat actions interface
 */
export interface ReduxChatActions {
  /** Set messages for a session */
  setMessages?: (payload: { sessionId: string; messages: UIMessage[] }) => unknown;

  /** Add a single message */
  addMessage?: (payload: UIMessage & { sessionId: string }) => unknown;

  /** Update a message */
  updateMessage?: (payload: { sessionId: string; messageId: string; updates: Partial<UIMessage> }) => unknown;

  /** Set streaming state */
  setStreaming?: (payload: boolean) => unknown;

  /** Set loading state */
  setLoading?: (payload: boolean) => unknown;

  /** Set error state */
  setError?: (payload: string | null) => unknown;

  /** Update session */
  updateSession?: (payload: { id: string; updates: Record<string, unknown> }) => unknown;

  /** Set current session */
  setCurrentSession?: (payload: string | null) => unknown;
}

/**
 * Redux chat selectors interface
 */
export interface ReduxChatSelectors {
  /** Select messages for a session */
  selectMessages?: Selector<UIMessage[]>;

  /** Select current session ID */
  selectCurrentSessionId?: Selector<string | null>;

  /** Select streaming state */
  selectIsStreaming?: Selector<boolean>;

  /** Select loading state */
  selectIsLoading?: Selector<boolean>;

  /** Select error state */
  selectError?: Selector<string | null>;
}

/**
 * WebSocket integration options
 */
export interface WebSocketIntegration {
  /** Join room on mount */
  joinRoom?: (sessionId: string) => void;

  /** Leave room on unmount */
  leaveRoom?: (sessionId: string) => void;

  /** Send typing indicator */
  sendTypingIndicator?: (sessionId: string, isTyping: boolean) => void;
}

export interface UseReduxChatOptions extends Omit<UseRealTimeChatOptions, 'messages' | 'id'> {
  /** Redux store */
  store?: StoreInterface;

  /** Redux dispatch function (alternative to store) */
  dispatch?: Dispatch;

  /** Redux state getter (alternative to store) */
  getState?: () => unknown;

  /** Session ID to use */
  sessionId: string;

  /** Redux actions */
  actions?: ReduxChatActions;

  /** Redux selectors */
  selectors?: ReduxChatSelectors;

  /** WebSocket integration */
  websocket?: WebSocketIntegration;

  /** Auto-save messages to Redux on change */
  autoSave?: boolean;

  /** Debounce auto-save (ms) */
  autoSaveDebounce?: number;

  /** Sync messages from Redux on mount */
  syncOnMount?: boolean;
}

export interface UseReduxChatReturn extends Omit<UseRealTimeChatReturn, 'id'> {
  /** Session ID */
  sessionId: string;

  /** Sync messages to Redux */
  syncToRedux: () => void;

  /** Load messages from Redux */
  loadFromRedux: () => void;

  /** Clear chat and Redux state */
  clearChat: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useReduxChat(options: UseReduxChatOptions): UseReduxChatReturn {
  const {
    store,
    dispatch: providedDispatch,
    getState: providedGetState,
    sessionId,
    actions = {},
    selectors = {},
    websocket,
    autoSave = true,
    autoSaveDebounce = 500,
    syncOnMount = true,
    ...chatOptions
  } = options;

  // Resolve dispatch and getState
  const dispatch = providedDispatch ?? store?.dispatch;
  const getState = providedGetState ?? store?.getState;

  if (!dispatch || !getState) {
    throw new Error('useReduxChat requires either store or dispatch+getState');
  }

  // Refs for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedMessagesRef = useRef<string>('');

  // Get initial messages from Redux
  const getInitialMessages = useCallback((): UIMessage[] => {
    if (!selectors.selectMessages) return [];

    try {
      const state = getState();
      return selectors.selectMessages(state) ?? [];
    } catch {
      return [];
    }
  }, [getState, selectors]);

  // Initialize real-time chat
  const chat = useRealTimeChat({
    ...chatOptions,
    id: sessionId,
    sessionId,
    messages: syncOnMount ? getInitialMessages() : [],

    // Override onFinish to sync to Redux
    onFinish: (finishOptions) => {
      // Call original callback
      chatOptions.onFinish?.(finishOptions);

      // Sync to Redux
      if (autoSave && actions.setMessages) {
        dispatch(actions.setMessages({
          sessionId,
          messages: finishOptions.messages,
        }));
      }

      // Update session last activity
      if (actions.updateSession) {
        dispatch(actions.updateSession({
          id: sessionId,
          updates: {
            lastActivityAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }));
      }
    },

    // Override onError to sync error state
    onError: (error) => {
      chatOptions.onError?.(error);

      if (actions.setError) {
        dispatch(actions.setError(error.message));
      }
    },
  });

  // ========================================
  // Redux Sync Functions
  // ========================================

  const syncToRedux = useCallback(() => {
    if (!actions.setMessages) return;

    const messagesJson = JSON.stringify(chat.messages);

    // Skip if nothing changed
    if (messagesJson === lastSavedMessagesRef.current) return;

    lastSavedMessagesRef.current = messagesJson;

    dispatch(actions.setMessages({
      sessionId,
      messages: chat.messages,
    }));
  }, [dispatch, actions, sessionId, chat.messages]);

  const loadFromRedux = useCallback(() => {
    const messages = getInitialMessages();
    if (messages.length > 0) {
      chat.setMessages(messages);
    }
  }, [chat, getInitialMessages]);

  const clearChat = useCallback(() => {
    chat.setMessages([]);

    if (actions.setMessages) {
      dispatch(actions.setMessages({
        sessionId,
        messages: [],
      }));
    }

    if (actions.setError) {
      dispatch(actions.setError(null));
    }
  }, [chat, dispatch, actions, sessionId]);

  // ========================================
  // Auto-save Effect
  // ========================================

  useEffect(() => {
    if (!autoSave) return;

    // Debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      syncToRedux();
    }, autoSaveDebounce);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [chat.messages, autoSave, autoSaveDebounce, syncToRedux]);

  // ========================================
  // Status Sync Effect
  // ========================================

  useEffect(() => {
    if (actions.setStreaming) {
      dispatch(actions.setStreaming(chat.status === 'streaming'));
    }

    if (actions.setLoading) {
      dispatch(actions.setLoading(chat.status === 'submitted' || chat.status === 'streaming'));
    }
  }, [chat.status, dispatch, actions]);

  // ========================================
  // Error Sync Effect
  // ========================================

  useEffect(() => {
    if (actions.setError && chat.error) {
      dispatch(actions.setError(chat.error.message));
    }
  }, [chat.error, dispatch, actions]);

  // ========================================
  // WebSocket Room Management
  // ========================================

  useEffect(() => {
    if (websocket?.joinRoom) {
      websocket.joinRoom(sessionId);
    }

    return () => {
      if (websocket?.leaveRoom) {
        websocket.leaveRoom(sessionId);
      }
    };
  }, [sessionId, websocket]);

  // ========================================
  // Typing Indicator
  // ========================================

  const originalSendMessage = chat.sendMessage;

  const sendMessageWithTyping = useCallback(async (
    optionsOrText?: SendMessageOptions | string
  ): Promise<void> => {
    // Send typing indicator
    if (websocket?.sendTypingIndicator) {
      websocket.sendTypingIndicator(sessionId, true);
    }

    try {
      await originalSendMessage(optionsOrText);
    } finally {
      // Clear typing indicator
      if (websocket?.sendTypingIndicator) {
        websocket.sendTypingIndicator(sessionId, false);
      }
    }
  }, [originalSendMessage, websocket, sessionId]);

  // ========================================
  // Session Change Detection
  // ========================================

  const prevSessionIdRef = useRef(sessionId);

  useEffect(() => {
    if (prevSessionIdRef.current !== sessionId) {
      // Session changed, load new messages
      if (syncOnMount) {
        loadFromRedux();
      }

      // Update current session in Redux
      if (actions.setCurrentSession) {
        dispatch(actions.setCurrentSession(sessionId));
      }

      prevSessionIdRef.current = sessionId;
    }
  }, [sessionId, syncOnMount, loadFromRedux, dispatch, actions]);

  // ========================================
  // Return
  // ========================================

  return {
    ...chat,
    sessionId,
    sendMessage: sendMessageWithTyping,
    syncToRedux,
    loadFromRedux,
    clearChat,
  };
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Redux chat actions compatible with common Redux slice patterns
 */
export function createReduxChatActions(sliceActions: {
  setMessages?: (payload: { sessionId: string; messages: unknown[] }) => unknown;
  addMessage?: (payload: unknown) => unknown;
  updateMessage?: (payload: { sessionId: string; messageId: string; updates: unknown }) => unknown;
  setStreaming?: (payload: boolean) => unknown;
  setChatLoading?: (payload: boolean) => unknown;
  setChatError?: (payload: string | null) => unknown;
  updateSession?: (payload: { id: string; updates: unknown }) => unknown;
  setCurrentSession?: (payload: string | null) => unknown;
}): ReduxChatActions {
  return {
    setMessages: sliceActions.setMessages as ReduxChatActions['setMessages'],
    addMessage: sliceActions.addMessage as ReduxChatActions['addMessage'],
    updateMessage: sliceActions.updateMessage as ReduxChatActions['updateMessage'],
    setStreaming: sliceActions.setStreaming,
    setLoading: sliceActions.setChatLoading,
    setError: sliceActions.setChatError,
    updateSession: sliceActions.updateSession as ReduxChatActions['updateSession'],
    setCurrentSession: sliceActions.setCurrentSession,
  };
}

/**
 * Create Redux chat selectors
 */
export function createReduxChatSelectors(options: {
  messagesSelector: (state: unknown, sessionId: string) => UIMessage[];
  currentSessionIdSelector?: (state: unknown) => string | null;
  isStreamingSelector?: (state: unknown) => boolean;
  isLoadingSelector?: (state: unknown) => boolean;
  errorSelector?: (state: unknown) => string | null;
}, sessionId: string): ReduxChatSelectors {
  return {
    selectMessages: (state) => options.messagesSelector(state, sessionId),
    selectCurrentSessionId: options.currentSessionIdSelector,
    selectIsStreaming: options.isStreamingSelector,
    selectIsLoading: options.isLoadingSelector,
    selectError: options.errorSelector,
  };
}
