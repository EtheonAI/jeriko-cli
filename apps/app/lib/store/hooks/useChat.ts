"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setMessages,
  addMessage,
  updateMessage,
  appendToMessage,
  setStreaming,
  setCurrentStreamingMessage,
  setInputValue,
  setChatLoading,
  setChatError,
  clearSessionMessages,
  setTaskMode,
  setInputMode,
  addChatFile,
  updateChatFile,
  removeChatFile,
  clearChatFiles,
  setChatExtData,
  setShowSharePopover,
  setPlaybookInfo,
  addTypingUser,
  removeTypingUser,
  clearTypingUsers,
  resetChatState,
  type Message,
  type TaskMode,
  type InputMode,
  type ChatFile,
  type ChatExtData,
  type PlaybookInfo,
} from "../slices/chat.slice";
import { wsSend } from "../middleware/websocket.middleware";
import { useGetMessagesQuery, useSendMessageMutation } from "../api/api.slice";

/**
 * Chat Hook - Integrates WebSocket streaming, RTK Query, and chat slice
 *
 * Action Triggers:
 * - fetchMessages: API Call (RTK Query)
 * - sendMessage: API Call (RTK Query) + WebSocket streaming
 * - setInputValue: State only
 * - setTaskMode: State only
 * - setInputMode: State only
 * - addFile/removeFile: State only
 * - sendTypingIndicator: WebSocket message
 *
 * Streaming events (WebSocket):
 * - message:stream:start -> setStreaming(true)
 * - message:stream -> appendToMessage
 * - message:stream:end -> setStreaming(false)
 */
export function useChatIntegration(sessionId: string | null) {
  const dispatch = useAppDispatch();
  const chatState = useAppSelector((state) => state.chat);
  const { status: wsStatus } = useAppSelector((state) => state.websocket);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);

  // RTK Query hooks
  const {
    data: messagesData,
    isLoading: isFetchingMessages,
    refetch: refetchMessages,
  } = useGetMessagesQuery(sessionId || "", {
    skip: !sessionId,
  });

  const [sendMessageMutation, { isLoading: isSendingMessage }] = useSendMessageMutation();

  // Sync messages from RTK Query to Redux state
  useEffect(() => {
    if (messagesData && sessionId) {
      dispatch(setMessages({ sessionId, messages: messagesData }));
    }
  }, [messagesData, sessionId, dispatch]);

  // Sync loading state
  useEffect(() => {
    dispatch(setChatLoading(isFetchingMessages || isSendingMessage));
  }, [isFetchingMessages, isSendingMessage, dispatch]);

  // Clear typing users on session change + cleanup typing timeout on unmount
  useEffect(() => {
    dispatch(clearTypingUsers());
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
  }, [sessionId, dispatch]);

  /**
   * Send a message
   * Trigger: API Call + WebSocket streaming
   */
  const sendMessage = useCallback(
    async (content: string, attachments?: ChatFile[]) => {
      if (!sessionId || !content.trim()) return { success: false };

      // Clear input immediately for responsive UX
      dispatch(setInputValue(""));
      dispatch(clearChatFiles());

      // Create optimistic message
      const tempMessageId = `temp_${Date.now()}`;
      const userMessage: Message = {
        id: tempMessageId,
        sessionId,
        role: "user",
        content,
        attachments: attachments?.map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          size: f.size,
          url: f.url,
          thumbnailUrl: f.thumbnailUrl,
        })),
        createdAt: new Date().toISOString(),
      };

      // Add user message optimistically
      dispatch(addMessage(userMessage));

      try {
        // Send via API
        const result = await sendMessageMutation({
          sessionId,
          content,
        }).unwrap();

        // Update with real message ID
        dispatch(
          updateMessage({
            sessionId,
            messageId: tempMessageId,
            updates: { id: result.id },
          })
        );

        // Response will come via WebSocket streaming
        return { success: true, messageId: result.id };
      } catch (error: any) {
        dispatch(setChatError(error?.message || "Failed to send message"));
        return { success: false, error: error?.message };
      }
    },
    [sessionId, dispatch, sendMessageMutation]
  );

  /**
   * Send typing indicator (debounced)
   * Trigger: WebSocket message
   */
  const sendTypingIndicator = useCallback(() => {
    if (!sessionId || wsStatus !== "connected") return;

    const now = Date.now();
    // Only send if at least 2 seconds have passed since last send
    if (now - lastTypingRef.current < 2000) return;

    lastTypingRef.current = now;
    dispatch(wsSend("typing:start", { sessionId }));

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to send stop typing
    typingTimeoutRef.current = setTimeout(() => {
      dispatch(wsSend("typing:stop", { sessionId }));
    }, 3000);
  }, [sessionId, wsStatus, dispatch]);

  /**
   * Stop typing indicator
   * Trigger: WebSocket message
   */
  const stopTypingIndicator = useCallback(() => {
    if (!sessionId || wsStatus !== "connected") return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    dispatch(wsSend("typing:stop", { sessionId }));
  }, [sessionId, wsStatus, dispatch]);

  /**
   * Update input value
   * Trigger: State only
   */
  const updateInputValue = useCallback(
    (value: string) => {
      dispatch(setInputValue(value));

      // Send typing indicator if there's content
      if (value.trim()) {
        sendTypingIndicator();
      } else {
        stopTypingIndicator();
      }
    },
    [dispatch, sendTypingIndicator, stopTypingIndicator]
  );

  /**
   * Set task mode (standard, adaptive, agent)
   * Trigger: State only
   */
  const updateTaskMode = useCallback(
    (mode: TaskMode) => {
      dispatch(setTaskMode(mode));
    },
    [dispatch]
  );

  /**
   * Set input mode (text, voice)
   * Trigger: State only
   */
  const updateInputMode = useCallback(
    (mode: InputMode) => {
      dispatch(setInputMode(mode));
    },
    [dispatch]
  );

  /**
   * Add file attachment
   * Trigger: State only
   */
  const addFile = useCallback(
    (file: ChatFile) => {
      dispatch(addChatFile(file));
    },
    [dispatch]
  );

  /**
   * Update file upload progress
   * Trigger: State only
   */
  const updateFile = useCallback(
    (fileId: string, updates: Partial<ChatFile>) => {
      dispatch(updateChatFile({ id: fileId, updates }));
    },
    [dispatch]
  );

  /**
   * Remove file attachment
   * Trigger: State only
   */
  const removeFile = useCallback(
    (fileId: string) => {
      dispatch(removeChatFile(fileId));
    },
    [dispatch]
  );

  /**
   * Clear all file attachments
   * Trigger: State only
   */
  const clearFiles = useCallback(() => {
    dispatch(clearChatFiles());
  }, [dispatch]);

  /**
   * Set chat extended data
   * Trigger: State only
   */
  const updateChatExtData = useCallback(
    (data: ChatExtData | null) => {
      dispatch(setChatExtData(data));
    },
    [dispatch]
  );

  /**
   * Show/hide share popover
   * Trigger: State only
   */
  const toggleSharePopover = useCallback(
    (show: string | null) => {
      dispatch(setShowSharePopover(show));
    },
    [dispatch]
  );

  /**
   * Set playbook info
   * Trigger: State only
   */
  const updatePlaybookInfo = useCallback(
    (playbook: PlaybookInfo | null) => {
      dispatch(setPlaybookInfo(playbook));
    },
    [dispatch]
  );

  /**
   * Clear session messages
   * Trigger: State only
   */
  const clearMessages = useCallback(() => {
    if (sessionId) {
      dispatch(clearSessionMessages(sessionId));
    }
  }, [sessionId, dispatch]);

  /**
   * Reset chat state for new conversation
   * Trigger: State only
   */
  const reset = useCallback(() => {
    dispatch(resetChatState());
  }, [dispatch]);

  /**
   * Refresh messages from server
   * Trigger: API Call
   */
  const refresh = useCallback(() => {
    refetchMessages();
  }, [refetchMessages]);

  // Get messages for current session
  const messages = sessionId ? chatState.messages[sessionId] || [] : [];

  return {
    // State
    messages,
    inputValue: chatState.inputValue,
    files: chatState.files,
    taskMode: chatState.taskMode,
    inputMode: chatState.inputMode,
    isStreaming: chatState.isStreaming,
    isLoading: chatState.isLoading,
    error: chatState.error,
    typingUsers: chatState.typingUsers,
    showSharePopover: chatState.showSharePopover,
    playbookInfo: chatState.playbookInfo,
    chatExtData: chatState.chatExtData,
    isConnected: wsStatus === "connected",

    // Actions
    sendMessage,
    setInputValue: updateInputValue,
    setTaskMode: updateTaskMode,
    setInputMode: updateInputMode,
    addFile,
    updateFile,
    removeFile,
    clearFiles,
    setChatExtData: updateChatExtData,
    toggleSharePopover,
    setPlaybookInfo: updatePlaybookInfo,
    clearMessages,
    reset,
    refresh,
  };
}

export default useChatIntegration;
