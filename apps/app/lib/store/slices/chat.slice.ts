import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SourceUrlUIPart, UIMessage } from "@repo/ai/lib/types";

export type MessageRole = "user" | "assistant" | "system" | "tool";
export type TaskMode = "standard" | "adaptive" | "agent";
export type InputMode = "text" | "voice";

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  /** Full AI SDK UIMessage parts — preserved for historical replay (planner, tool results) */
  parts?: Record<string, unknown>[];
  attachments?: MessageAttachment[];
  metadata?: {
    toolName?: string;
    toolCallId?: string;
    model?: string;
    tokens?: { input: number; output: number };
    agentType?: string;
    taskId?: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt?: string;
}

export interface ChatFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  url?: string;
  thumbnailUrl?: string;
  uploadProgress?: number;
  status: "pending" | "uploading" | "completed" | "error";
  error?: string;
}

export interface ChatExtData {
  sessionId?: string;
  projectId?: string;
  connectorIds?: string[];
  knowledgeBaseIds?: string[];
  [key: string]: unknown;
}

export interface PlaybookInfo {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  icon?: string;
}

export interface RecommendedPlaybooksV2 {
  playbooks: unknown[] | null;
  loading: boolean;
  total: number;
  currentPage: number;
}

export interface DebugModelOverride {
  enabled: boolean;
  config: unknown;
  configText: string;
}

// --- Merged from chatPage.slice.ts ---

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

// --- End chatPage types ---

export interface ChatState {
  messages: Record<string, Message[]>;
  isStreaming: boolean;
  currentStreamingSessionId: string | null;
  inputValue: string;
  isLoading: boolean;
  error: string | null;
  taskMode: TaskMode;
  inputMode: InputMode;
  files: ChatFile[];
  chatExtData: ChatExtData | null;
  showSharePopover: boolean;
  playbookInfo: PlaybookInfo | null;
  typingUsers: string[];
  // Manus-aligned keys
  sendQuestionBehavior: unknown;
  slideTemplateList: unknown[];
  slideTemplateListLoading: boolean;
  recommendedPlaybooksV2: RecommendedPlaybooksV2;
  dataVisualization: unknown;
  debugModelOverride: DebugModelOverride;
  isPageVisible: boolean;
  fileSuggestions: unknown[];
  inputPlaybookId: string | null;
  inputPlaybookTemplate: unknown;
  isAppBannerVisible: boolean;
  imageStyleList: unknown[];
  imageStyleListLoading: boolean;
  agentModeIntroduceScene: unknown;
  pinnedSlideTemplateId: string | null;
  textContentLength: number;
  editorContent: Record<string, unknown>;
  // --- Merged from chatPage ---
  dagExpanded: boolean;
  selectedAgentId: string | null;
  sidebarType: "sources" | "agents" | null;
  sidebarOpen: boolean;
  isAtBottom: boolean;
  hasNewMessages: boolean;
  uiMessages: Record<string, UIMessage[]>;
  streamingState: StreamingState;
  pendingApprovals: ToolApprovalRequest[];
  sources: Record<string, SourceUrlUIPart[]>;
  activeSessionId: string | null;
}

const initialState: ChatState = {
  messages: {},
  isStreaming: false,
  currentStreamingSessionId: null,
  inputValue: "",
  isLoading: false,
  error: null,
  taskMode: "agent",
  inputMode: "text",
  files: [],
  chatExtData: null,
  showSharePopover: false,
  playbookInfo: null,
  typingUsers: [],
  // Manus-aligned defaults
  sendQuestionBehavior: null,
  slideTemplateList: [],
  slideTemplateListLoading: false,
  recommendedPlaybooksV2: { playbooks: null, loading: false, total: 0, currentPage: 0 },
  dataVisualization: null,
  debugModelOverride: { enabled: false, config: null, configText: "" },
  isPageVisible: true,
  fileSuggestions: [],
  inputPlaybookId: null,
  inputPlaybookTemplate: null,
  isAppBannerVisible: false,
  imageStyleList: [],
  imageStyleListLoading: false,
  agentModeIntroduceScene: null,
  pinnedSlideTemplateId: null,
  textContentLength: 0,
  editorContent: {},
  // --- Merged from chatPage ---
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

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setMessages: (state, action: PayloadAction<{ sessionId: string; messages: Message[] }>) => {
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
    normalizeMessageParts: (
      state,
      action: PayloadAction<{
        sessionId: string;
        messageId: string;
      }>
    ) => {
      const { sessionId, messageId } = action.payload;
      const messages = state.messages[sessionId];
      if (messages) {
        const message = messages.find((m) => m.id === messageId);
        if (message && message.parts && Array.isArray(message.parts)) {
          // Filter out null/undefined parts and ensure valid structure
          message.parts = message.parts.filter(
            (part) => part !== null && part !== undefined && typeof part === "object"
          );
        }
      }
    },
    clearSessionMessages: (state, action: PayloadAction<string>) => {
      delete state.messages[action.payload];
    },

    // Streaming
    setStreaming: (state, action: PayloadAction<boolean>) => {
      state.isStreaming = action.payload;
      if (!action.payload) {
        state.currentStreamingSessionId = null;
      }
    },
    setCurrentStreamingSession: (state, action: PayloadAction<string | null>) => {
      state.currentStreamingSessionId = action.payload;
    },

    // Input
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

    // Task & input mode
    setTaskMode: (state, action: PayloadAction<TaskMode>) => {
      state.taskMode = action.payload;
    },
    setInputMode: (state, action: PayloadAction<InputMode>) => {
      state.inputMode = action.payload;
    },

    // File attachments
    addChatFile: (state, action: PayloadAction<ChatFile>) => {
      state.files.push(action.payload);
    },
    updateChatFile: (state, action: PayloadAction<{ id: string; updates: Partial<ChatFile> }>) => {
      const index = state.files.findIndex((f) => f.id === action.payload.id);
      if (index !== -1) {
        state.files[index] = { ...state.files[index], ...action.payload.updates };
      }
    },
    removeChatFile: (state, action: PayloadAction<string>) => {
      state.files = state.files.filter((f) => f.id !== action.payload);
    },
    clearChatFiles: (state) => {
      state.files = [];
    },

    // Context
    setChatExtData: (state, action: PayloadAction<ChatExtData | null>) => {
      state.chatExtData = action.payload;
    },
    setShowSharePopover: (state, action: PayloadAction<boolean>) => {
      state.showSharePopover = action.payload;
    },
    setPlaybookInfo: (state, action: PayloadAction<PlaybookInfo | null>) => {
      state.playbookInfo = action.payload;
    },

    // Typing
    addTypingUser: (state, action: PayloadAction<string>) => {
      if (!state.typingUsers.includes(action.payload)) {
        state.typingUsers.push(action.payload);
      }
    },
    removeTypingUser: (state, action: PayloadAction<string>) => {
      state.typingUsers = state.typingUsers.filter((u) => u !== action.payload);
    },
    clearTypingUsers: (state) => {
      state.typingUsers = [];
    },

    // Manus-aligned reducers
    setSendQuestionBehavior: (state, action: PayloadAction<unknown>) => {
      state.sendQuestionBehavior = action.payload;
    },
    setSlideTemplateList: (state, action: PayloadAction<unknown[]>) => {
      state.slideTemplateList = action.payload;
    },
    setSlideTemplateListLoading: (state, action: PayloadAction<boolean>) => {
      state.slideTemplateListLoading = action.payload;
    },
    setRecommendedPlaybooksV2: (state, action: PayloadAction<RecommendedPlaybooksV2>) => {
      state.recommendedPlaybooksV2 = action.payload;
    },
    setDataVisualization: (state, action: PayloadAction<unknown>) => {
      state.dataVisualization = action.payload;
    },
    setDebugModelOverride: (state, action: PayloadAction<DebugModelOverride>) => {
      state.debugModelOverride = action.payload;
    },
    setIsPageVisible: (state, action: PayloadAction<boolean>) => {
      state.isPageVisible = action.payload;
    },
    setFileSuggestions: (state, action: PayloadAction<unknown[]>) => {
      state.fileSuggestions = action.payload;
    },
    setInputPlaybookId: (state, action: PayloadAction<string | null>) => {
      state.inputPlaybookId = action.payload;
    },
    setInputPlaybookTemplate: (state, action: PayloadAction<unknown>) => {
      state.inputPlaybookTemplate = action.payload;
    },
    setIsAppBannerVisible: (state, action: PayloadAction<boolean>) => {
      state.isAppBannerVisible = action.payload;
    },
    setImageStyleList: (state, action: PayloadAction<unknown[]>) => {
      state.imageStyleList = action.payload;
    },
    setImageStyleListLoading: (state, action: PayloadAction<boolean>) => {
      state.imageStyleListLoading = action.payload;
    },
    setAgentModeIntroduceScene: (state, action: PayloadAction<unknown>) => {
      state.agentModeIntroduceScene = action.payload;
    },
    setPinnedSlideTemplateId: (state, action: PayloadAction<string | null>) => {
      state.pinnedSlideTemplateId = action.payload;
    },
    setTextContentLength: (state, action: PayloadAction<number>) => {
      state.textContentLength = action.payload;
    },
    setEditorContent: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.editorContent = action.payload;
    },

    // --- Merged from chatPage.slice.ts ---

    // Chat page UI state
    setDagExpanded: (state, action: PayloadAction<boolean>) => {
      state.dagExpanded = action.payload;
    },
    setSelectedAgentId: (state, action: PayloadAction<string | null>) => {
      state.selectedAgentId = action.payload;
    },
    setChatSidebarType: (state, action: PayloadAction<"sources" | "agents" | null>) => {
      state.sidebarType = action.payload;
    },
    setChatSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    toggleChatSidebar: (state, action: PayloadAction<"sources" | "agents">) => {
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
    setUIMessages: (state, action: PayloadAction<{ sessionId: string; messages: UIMessage[] }>) => {
      state.uiMessages[action.payload.sessionId] = action.payload.messages;
    },
    addUIMessage: (state, action: PayloadAction<{ sessionId: string; message: UIMessage }>) => {
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
    startMessageStream: (state, action: PayloadAction<{ messageId: string }>) => {
      state.streamingState.messageId = action.payload.messageId;
      state.streamingState.partialText = "";
    },
    processStreamChunk: (state, action: PayloadAction<{ partId: string; text: string }>) => {
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
      state.pendingApprovals = state.pendingApprovals.filter((a) => a.id !== action.payload);
    },
    clearToolApprovals: (state, action: PayloadAction<string>) => {
      state.pendingApprovals = state.pendingApprovals.filter((a) => a.sessionId !== action.payload);
    },

    // Sources
    setChatSources: (
      state,
      action: PayloadAction<{ sessionId: string; sources: SourceUrlUIPart[] }>
    ) => {
      state.sources[action.payload.sessionId] = action.payload.sources;
    },
    addChatSource: (
      state,
      action: PayloadAction<{ sessionId: string; source: SourceUrlUIPart }>
    ) => {
      const { sessionId, source } = action.payload;
      if (!state.sources[sessionId]) {
        state.sources[sessionId] = [];
      }
      if (!state.sources[sessionId].find((s) => s.sourceId === source.sourceId)) {
        state.sources[sessionId].push(source);
      }
    },
    clearChatSources: (state, action: PayloadAction<string>) => {
      delete state.sources[action.payload];
    },

    // Active session
    setActiveSessionId: (state, action: PayloadAction<string | null>) => {
      state.activeSessionId = action.payload;
    },

    // --- End merged from chatPage ---

    // Reset
    resetChatState: (state) => {
      state.inputValue = "";
      state.files = [];
      state.chatExtData = null;
      state.playbookInfo = null;
      state.typingUsers = [];
    },

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
  setMessages,
  addMessage,
  updateMessage,
  appendToMessage,
  normalizeMessageParts,
  clearSessionMessages,
  setStreaming,
  setCurrentStreamingSession,
  setInputValue,
  setChatLoading,
  setChatError,
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
  setSendQuestionBehavior,
  setSlideTemplateList,
  setSlideTemplateListLoading,
  setRecommendedPlaybooksV2,
  setDataVisualization,
  setDebugModelOverride,
  setIsPageVisible,
  setFileSuggestions,
  setInputPlaybookId,
  setInputPlaybookTemplate,
  setIsAppBannerVisible,
  setImageStyleList,
  setImageStyleListLoading,
  setAgentModeIntroduceScene,
  setPinnedSlideTemplateId,
  setTextContentLength,
  setEditorContent,
  // --- Merged from chatPage ---
  setDagExpanded,
  setSelectedAgentId,
  setChatSidebarType,
  setChatSidebarOpen,
  toggleChatSidebar,
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
  setChatSources,
  addChatSource,
  clearChatSources,
  setActiveSessionId,
  resetChatPageState,
} = chatSlice.actions;

export default chatSlice.reducer;
