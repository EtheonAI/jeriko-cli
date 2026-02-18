"use client";

import { useCallback, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setMessages,
  addMessage,
  updateMessage,
  appendToMessage,
  setStreaming,
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
import { getTrpcClient } from "@/lib/trpc/vanilla";

/**
 * Chat Hook - Integrates WebSocket streaming and vanilla tRPC with chat slice
 *
 * NOTE: The primary chat flow uses AI SDK's useChat (via useChatSession).
 * This hook is for supplementary chat state management (input, files, typing, etc.)
 * and for loading historical messages from the DB.
 */
export function useChatIntegration(sessionId: string | null) {
  const dispatch = useAppDispatch();
  const chatState = useAppSelector((state) => state.chat);
  const wsStatus = useAppSelector((state) => state.websocket.status);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingRef = useRef<number>(0);
  const hasFetchedRef = useRef(false);

  // Fetch historical messages for a session
  const fetchMessages = useCallback(
    async (sid?: string) => {
      const targetId = sid ?? sessionId;
      if (!targetId) return;
      dispatch(setChatLoading(true));
      try {
        const messages = await getTrpcClient().messages.list.query({ sessionId: targetId });
        if (messages && Array.isArray(messages)) {
          dispatch(setMessages({ sessionId: targetId, messages: messages as any }));
        }
        hasFetchedRef.current = true;
      } catch (err: any) {
        dispatch(setChatError(err?.message || "Failed to load messages"));
      } finally {
        dispatch(setChatLoading(false));
      }
    },
    [sessionId, dispatch]
  );

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

  // Send a message via tRPC (for non-AI-SDK flows)
  const sendMessage = useCallback(
    async (content: string, attachments?: ChatFile[]) => {
      if (!sessionId || !content.trim()) return { success: false };

      dispatch(setInputValue(""));
      dispatch(clearChatFiles());

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

      dispatch(addMessage(userMessage));

      try {
        const result = await getTrpcClient().messages.create.mutate({
          sessionId,
          content,
          role: "user",
        } as any);
        dispatch(
          updateMessage({
            sessionId,
            messageId: tempMessageId,
            updates: { id: (result as any).id },
          })
        );
        return { success: true, messageId: (result as any).id };
      } catch (error: any) {
        dispatch(setChatError(error?.message || "Failed to send message"));
        return { success: false, error: error?.message };
      }
    },
    [sessionId, dispatch]
  );

  // Typing indicator (debounced)
  const sendTypingIndicator = useCallback(() => {
    if (!sessionId || wsStatus !== "connected") return;
    const now = Date.now();
    if (now - lastTypingRef.current < 2000) return;
    lastTypingRef.current = now;
    dispatch(wsSend("typing:start", { sessionId }));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      dispatch(wsSend("typing:stop", { sessionId }));
    }, 3000);
  }, [sessionId, wsStatus, dispatch]);

  const stopTypingIndicator = useCallback(() => {
    if (!sessionId || wsStatus !== "connected") return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    dispatch(wsSend("typing:stop", { sessionId }));
  }, [sessionId, wsStatus, dispatch]);

  const updateInputValue = useCallback(
    (value: string) => {
      dispatch(setInputValue(value));
      if (value.trim()) sendTypingIndicator();
      else stopTypingIndicator();
    },
    [dispatch, sendTypingIndicator, stopTypingIndicator]
  );

  const updateTaskMode = useCallback((mode: TaskMode) => dispatch(setTaskMode(mode)), [dispatch]);
  const updateInputMode = useCallback((mode: InputMode) => dispatch(setInputMode(mode)), [dispatch]);
  const addFile = useCallback((file: ChatFile) => dispatch(addChatFile(file)), [dispatch]);
  const updateFile = useCallback((fileId: string, updates: Partial<ChatFile>) => dispatch(updateChatFile({ id: fileId, updates })), [dispatch]);
  const removeFile = useCallback((fileId: string) => dispatch(removeChatFile(fileId)), [dispatch]);
  const clearFiles = useCallback(() => dispatch(clearChatFiles()), [dispatch]);
  const updateChatExtData = useCallback((data: ChatExtData | null) => dispatch(setChatExtData(data)), [dispatch]);
  const toggleSharePopover = useCallback((show: boolean) => dispatch(setShowSharePopover(show)), [dispatch]);
  const updatePlaybookInfo = useCallback((playbook: PlaybookInfo | null) => dispatch(setPlaybookInfo(playbook)), [dispatch]);
  const clearMessages = useCallback(() => { if (sessionId) dispatch(clearSessionMessages(sessionId)); }, [sessionId, dispatch]);
  const reset = useCallback(() => dispatch(resetChatState()), [dispatch]);

  const messages = sessionId ? chatState.messages[sessionId] || [] : [];

  return {
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
    fetchMessages,
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
    refresh: fetchMessages,
  };
}

export default useChatIntegration;
