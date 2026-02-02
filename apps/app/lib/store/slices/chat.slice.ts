import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata?: {
    toolName?: string;
    toolCallId?: string;
    model?: string;
    tokens?: { input: number; output: number };
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface ChatState {
  messages: Record<string, Message[]>; // sessionId -> messages
  isStreaming: boolean;
  currentStreamingMessageId: string | null;
  inputValue: string;
  isLoading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  messages: {},
  isStreaming: false,
  currentStreamingMessageId: null,
  inputValue: "",
  isLoading: false,
  error: null,
};

export const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setMessages: (
      state,
      action: PayloadAction<{ sessionId: string; messages: Message[] }>
    ) => {
      state.messages[action.payload.sessionId] = action.payload.messages;
      state.isLoading = false;
    },
    addMessage: (state, action: PayloadAction<Message>) => {
      const { sessionId } = action.payload;
      if (!state.messages[sessionId]) {
        state.messages[sessionId] = [];
      }
      state.messages[sessionId].push(action.payload);
    },
    updateMessage: (
      state,
      action: PayloadAction<{
        sessionId: string;
        messageId: string;
        updates: Partial<Message>;
      }>
    ) => {
      const { sessionId, messageId, updates } = action.payload;
      const messages = state.messages[sessionId];
      if (messages) {
        const index = messages.findIndex((m) => m.id === messageId);
        if (index !== -1) {
          messages[index] = { ...messages[index], ...updates };
        }
      }
    },
    appendToMessage: (
      state,
      action: PayloadAction<{
        sessionId: string;
        messageId: string;
        content: string;
      }>
    ) => {
      const { sessionId, messageId, content } = action.payload;
      const messages = state.messages[sessionId];
      if (messages) {
        const message = messages.find((m) => m.id === messageId);
        if (message) {
          message.content += content;
        }
      }
    },
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
      if (!action.payload) {
        state.currentStreamingMessageId = null;
      }
    },
    setCurrentStreamingMessage: (state, action: PayloadAction<string | null>) => {
      state.currentStreamingMessageId = action.payload;
    },
    setInputValue: (state, action: PayloadAction<string>) => {
      state.inputValue = action.payload;
    },
    setChatLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setChatError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
    clearSessionMessages: (state, action: PayloadAction<string>) => {
      delete state.messages[action.payload];
    },
  },
});

export const {
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
} = chatSlice.actions;

export default chatSlice.reducer;
