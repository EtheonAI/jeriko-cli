import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SourceUrlUIPart, UIMessage } from "@repo/ai/lib/types";

export interface StreamingState {
  messageId: string | null;
  activePartId: string | null;
  partialText: string;
}

export interface ToolApprovalRequest {
  id: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  sessionId: string;
  messageId: string;
  createdAt: string;
}

export interface ChatPageState {
  // UI State
  dagExpanded: boolean;
  selectedAgentId: string | null;
  sidebarType: "sources" | "agents" | null;
  sidebarOpen: boolean;
  isAtBottom: boolean;
  hasNewMessages: boolean;

  // UIMessage storage (sessionId -> messages)
  uiMessages: Record<string, UIMessage[]>;

  // Streaming state
  streamingState: StreamingState;

  // Pending approvals
  pendingApprovals: ToolApprovalRequest[];

  // Sources (sessionId -> sources)
  sources: Record<string, SourceUrlUIPart[]>;

  // Active session
  activeSessionId: string | null;
}

const initialState: ChatPageState = {
  dagExpanded: true,
  selectedAgentId: null,
  sidebarType: null,
  sidebarOpen: false,
  isAtBottom: true,
  hasNewMessages: false,
  uiMessages: {},
  streamingState: {
    messageId: null,
    activePartId: null,
    partialText: "",
  },
  pendingApprovals: [],
  sources: {},
  activeSessionId: null,
};

export const chatPageSlice = createSlice({
  name: "chatPage",
  initialState,
  reducers: {
    // UI State
    setDagExpanded: (state, action: PayloadAction<boolean>) => {
      state.dagExpanded = action.payload;
    },

    setSelectedAgentId: (state, action: PayloadAction<string | null>) => {
      state.selectedAgentId = action.payload;
    },

    setSidebarType: (state, action: PayloadAction<"sources" | "agents" | null>) => {
      state.sidebarType = action.payload;
    },

    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },

    toggleSidebar: (state, action: PayloadAction<"sources" | "agents">) => {
      if (state.sidebarType === action.payload && state.sidebarOpen) {
        state.sidebarOpen = false;
      } else {
        state.sidebarType = action.payload;
        state.sidebarOpen = true;
      }
    },

    setIsAtBottom: (state, action: PayloadAction<boolean>) => {
      state.isAtBottom = action.payload;
      if (action.payload) {
        state.hasNewMessages = false;
      }
    },

    setHasNewMessages: (state, action: PayloadAction<boolean>) => {
      state.hasNewMessages = action.payload;
    },

    // UIMessage management
    setUIMessages: (
      state,
      action: PayloadAction<{ sessionId: string; messages: UIMessage[] }>
    ) => {
      state.uiMessages[action.payload.sessionId] = action.payload.messages;
    },

    addUIMessage: (
      state,
      action: PayloadAction<{ sessionId: string; message: UIMessage }>
    ) => {
      const { sessionId, message } = action.payload;
      if (!state.uiMessages[sessionId]) {
        state.uiMessages[sessionId] = [];
      }
      state.uiMessages[sessionId].push(message);
    },

    updateUIMessage: (
      state,
      action: PayloadAction<{
        sessionId: string;
        messageId: string;
        updates: Partial<UIMessage>;
      }>
    ) => {
      const { sessionId, messageId, updates } = action.payload;
      const messages = state.uiMessages[sessionId];
      if (messages) {
        const index = messages.findIndex((m) => m.id === messageId);
        if (index !== -1) {
          messages[index] = { ...messages[index], ...updates };
        }
      }
    },

    clearUIMessages: (state, action: PayloadAction<string>) => {
      delete state.uiMessages[action.payload];
    },

    // Streaming state
    startMessageStream: (
      state,
      action: PayloadAction<{ messageId: string }>
    ) => {
      state.streamingState.messageId = action.payload.messageId;
      state.streamingState.partialText = "";
    },

    processStreamChunk: (
      state,
      action: PayloadAction<{ partId: string; text: string }>
    ) => {
      state.streamingState.activePartId = action.payload.partId;
      state.streamingState.partialText += action.payload.text;
    },

    endMessageStream: (state) => {
      state.streamingState.messageId = null;
      state.streamingState.activePartId = null;
      state.streamingState.partialText = "";
    },

    // Tool approvals
    addToolApproval: (state, action: PayloadAction<ToolApprovalRequest>) => {
      state.pendingApprovals.push(action.payload);
    },

    removeToolApproval: (state, action: PayloadAction<string>) => {
      state.pendingApprovals = state.pendingApprovals.filter(
        (a) => a.id !== action.payload
      );
    },

    clearToolApprovals: (state, action: PayloadAction<string>) => {
      state.pendingApprovals = state.pendingApprovals.filter(
        (a) => a.sessionId !== action.payload
      );
    },

    // Sources
    setSources: (
      state,
      action: PayloadAction<{ sessionId: string; sources: SourceUrlUIPart[] }>
    ) => {
      state.sources[action.payload.sessionId] = action.payload.sources;
    },

    addSource: (
      state,
      action: PayloadAction<{ sessionId: string; source: SourceUrlUIPart }>
    ) => {
      const { sessionId, source } = action.payload;
      if (!state.sources[sessionId]) {
        state.sources[sessionId] = [];
      }
      // Avoid duplicates
      if (!state.sources[sessionId].find((s) => s.sourceId === source.sourceId)) {
        state.sources[sessionId].push(source);
      }
    },

    clearSources: (state, action: PayloadAction<string>) => {
      delete state.sources[action.payload];
    },

    // Active session
    setActiveSessionId: (state, action: PayloadAction<string | null>) => {
      state.activeSessionId = action.payload;
    },

    // Reset
    resetChatPageState: (state) => {
      state.dagExpanded = true;
      state.selectedAgentId = null;
      state.sidebarType = null;
      state.sidebarOpen = false;
      state.isAtBottom = true;
      state.hasNewMessages = false;
      state.streamingState = {
        messageId: null,
        activePartId: null,
        partialText: "",
      };
    },
  },
});

export const {
  setDagExpanded,
  setSelectedAgentId,
  setSidebarType,
  setSidebarOpen,
  toggleSidebar,
  setIsAtBottom,
  setHasNewMessages,
  setUIMessages,
  addUIMessage,
  updateUIMessage,
  clearUIMessages,
  startMessageStream,
  processStreamChunk,
  endMessageStream,
  addToolApproval,
  removeToolApproval,
  clearToolApprovals,
  setSources,
  addSource,
  clearSources,
  setActiveSessionId,
  resetChatPageState,
} = chatPageSlice.actions;

export default chatPageSlice.reducer;
