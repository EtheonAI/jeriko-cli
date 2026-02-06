import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type MessageRole = "user" | "assistant" | "system" | "tool";
export type TaskMode = "standard" | "adaptive" | "agent";
export type InputMode = "text" | "voice";
export type MicrophonePermission = "prompt" | "granted" | "denied";
export type SendQuestionBehavior = "enter" | "ctrl_enter" | "cmd_enter";

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

export interface SlideTemplate {
  uid: string;
  name: string;
  cover: string;
  official: boolean;
  isFree: boolean;
  previewUrls: string[];
  imagePreviewUrls: Array<{ thumbnail: string; raw: string }>;
}

export interface ImageStyle {
  id: string;
  name: string;
  previewUrl: string;
  prompt?: string;
}

export interface DataVisualization {
  type: "chart" | "table" | "graph";
  data: unknown;
  config?: Record<string, unknown>;
}

export interface FileSuggestion {
  id: string;
  name: string;
  path: string;
  type: string;
  relevance: number;
}

export interface ChatState {
  messages: Record<string, Message[]>; // sessionId -> messages
  isStreaming: boolean;
  currentStreamingMessageId: string | null;
  currentStreamingSessionId: string | null;
  inputValue: string;
  isLoading: boolean;
  error: string | null;
  // Manus-style features
  taskMode: TaskMode;
  inputMode: InputMode;
  microphonePermission: MicrophonePermission;
  sendQuestionBehavior: SendQuestionBehavior | null;
  // File attachments for current input
  files: ChatFile[];
  // Extended data for chat context
  chatExtData: ChatExtData | null;
  // Share popover state
  showSharePopover: string | null; // sessionId or null
  // Playbook/template info
  playbookInfo: PlaybookInfo | null;
  recommendedPlaybooks: PlaybookInfo[];
  recommendedPlaybooksLoading: boolean;
  inputPlaybookId: string | null;
  inputPlaybookTemplate: string | null;
  // Slide templates
  slideTemplateList: SlideTemplate[];
  slideTemplateListLoading: boolean;
  pinnedSlideTemplateId: string | null;
  // Data visualization
  dataVisualization: DataVisualization | null;
  // Page visibility
  isPageVisible: boolean;
  // File suggestions
  fileSuggestions: FileSuggestion[];
  // App banner
  isAppBannerVisible: boolean;
  // Image styles
  imageStyleList: ImageStyle[];
  imageStyleListLoading: boolean;
  // Agent mode
  agentModeIntroduceScene: string | null;
  // Typing indicator
  isTyping: boolean;
  typingUsers: string[];
}

const initialState: ChatState = {
  messages: {},
  isStreaming: false,
  currentStreamingMessageId: null,
  currentStreamingSessionId: null,
  inputValue: "",
  isLoading: false,
  error: null,
  // Manus-style features
  taskMode: "standard",
  inputMode: "text",
  microphonePermission: "prompt",
  sendQuestionBehavior: null,
  files: [],
  chatExtData: null,
  showSharePopover: null,
  playbookInfo: null,
  recommendedPlaybooks: [],
  recommendedPlaybooksLoading: false,
  inputPlaybookId: null,
  inputPlaybookTemplate: null,
  slideTemplateList: [],
  slideTemplateListLoading: false,
  pinnedSlideTemplateId: null,
  dataVisualization: null,
  isPageVisible: true,
  fileSuggestions: [],
  isAppBannerVisible: false,
  imageStyleList: [],
  imageStyleListLoading: false,
  agentModeIntroduceScene: null,
  isTyping: false,
  typingUsers: [],
};

export const chatSlice = createSlice({
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

    // Batch add messages for performance (WebSocket batching)
    addMessages: (state, action: PayloadAction<Message[]>) => {
      for (const message of action.payload) {
        const { sessionId } = message;
        if (!state.messages[sessionId]) {
          state.messages[sessionId] = [];
        }
        state.messages[sessionId].push(message);
      }
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
        state.currentStreamingSessionId = null;
      }
    },
    setCurrentStreamingMessage: (state, action: PayloadAction<string | null>) => {
      state.currentStreamingMessageId = action.payload;
    },
    setCurrentStreamingSession: (state, action: PayloadAction<string | null>) => {
      state.currentStreamingSessionId = action.payload;
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

    // Task mode
    setTaskMode: (state, action: PayloadAction<TaskMode>) => {
      state.taskMode = action.payload;
    },

    // Input mode
    setInputMode: (state, action: PayloadAction<InputMode>) => {
      state.inputMode = action.payload;
    },

    // Microphone permission
    setMicrophonePermission: (state, action: PayloadAction<MicrophonePermission>) => {
      state.microphonePermission = action.payload;
    },

    // Send question behavior
    setSendQuestionBehavior: (state, action: PayloadAction<SendQuestionBehavior | null>) => {
      state.sendQuestionBehavior = action.payload;
    },

    // File management
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

    // Chat extended data
    setChatExtData: (state, action: PayloadAction<ChatExtData | null>) => {
      state.chatExtData = action.payload;
    },

    updateChatExtData: (state, action: PayloadAction<Partial<ChatExtData>>) => {
      if (state.chatExtData) {
        state.chatExtData = { ...state.chatExtData, ...action.payload };
      } else {
        state.chatExtData = action.payload as ChatExtData;
      }
    },

    // Share popover
    setShowSharePopover: (state, action: PayloadAction<string | null>) => {
      state.showSharePopover = action.payload;
    },

    // Playbook info
    setPlaybookInfo: (state, action: PayloadAction<PlaybookInfo | null>) => {
      state.playbookInfo = action.payload;
    },

    setRecommendedPlaybooks: (state, action: PayloadAction<PlaybookInfo[]>) => {
      state.recommendedPlaybooks = action.payload;
      state.recommendedPlaybooksLoading = false;
    },

    setRecommendedPlaybooksLoading: (state, action: PayloadAction<boolean>) => {
      state.recommendedPlaybooksLoading = action.payload;
    },

    setInputPlaybookId: (state, action: PayloadAction<string | null>) => {
      state.inputPlaybookId = action.payload;
    },

    setInputPlaybookTemplate: (state, action: PayloadAction<string | null>) => {
      state.inputPlaybookTemplate = action.payload;
    },

    // Slide templates
    setSlideTemplateList: (state, action: PayloadAction<SlideTemplate[]>) => {
      state.slideTemplateList = action.payload;
      state.slideTemplateListLoading = false;
    },

    setSlideTemplateListLoading: (state, action: PayloadAction<boolean>) => {
      state.slideTemplateListLoading = action.payload;
    },

    setPinnedSlideTemplateId: (state, action: PayloadAction<string | null>) => {
      state.pinnedSlideTemplateId = action.payload;
    },

    // Data visualization
    setDataVisualization: (state, action: PayloadAction<DataVisualization | null>) => {
      state.dataVisualization = action.payload;
    },

    // Page visibility
    setIsPageVisible: (state, action: PayloadAction<boolean>) => {
      state.isPageVisible = action.payload;
    },

    // File suggestions
    setFileSuggestions: (state, action: PayloadAction<FileSuggestion[]>) => {
      state.fileSuggestions = action.payload;
    },

    clearFileSuggestions: (state) => {
      state.fileSuggestions = [];
    },

    // App banner
    setIsAppBannerVisible: (state, action: PayloadAction<boolean>) => {
      state.isAppBannerVisible = action.payload;
    },

    // Image styles
    setImageStyleList: (state, action: PayloadAction<ImageStyle[]>) => {
      state.imageStyleList = action.payload;
      state.imageStyleListLoading = false;
    },

    setImageStyleListLoading: (state, action: PayloadAction<boolean>) => {
      state.imageStyleListLoading = action.payload;
    },

    // Agent mode
    setAgentModeIntroduceScene: (state, action: PayloadAction<string | null>) => {
      state.agentModeIntroduceScene = action.payload;
    },

    // Typing indicator
    setIsTyping: (state, action: PayloadAction<boolean>) => {
      state.isTyping = action.payload;
    },

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

    // Reset chat state for new conversation
    resetChatState: (state) => {
      state.inputValue = "";
      state.files = [];
      state.chatExtData = null;
      state.playbookInfo = null;
      state.isTyping = false;
      state.typingUsers = [];
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility
    builder.addCase(
      "chat/setRecommendedPlaybooksV2",
      (state, action: PayloadAction<PlaybookInfo[]>) => {
        state.recommendedPlaybooks = action.payload ?? [];
        state.recommendedPlaybooksLoading = false;
      }
    );
    builder.addCase(
      "chat/setSlideTemplateList",
      (state, action: PayloadAction<SlideTemplate[]>) => {
        state.slideTemplateList = action.payload ?? [];
        state.slideTemplateListLoading = false;
      }
    );
    builder.addCase("chat/setSlideTemplateListLoading", (state, action: PayloadAction<boolean>) => {
      state.slideTemplateListLoading = action.payload;
    });
    builder.addCase("chat/setImageStyleList", (state, action: PayloadAction<ImageStyle[]>) => {
      state.imageStyleList = action.payload ?? [];
      state.imageStyleListLoading = false;
    });
    builder.addCase("chat/setImageStyleListLoading", (state, action: PayloadAction<boolean>) => {
      state.imageStyleListLoading = action.payload;
    });
  },
});

export const {
  setMessages,
  addMessage,
  addMessages,
  updateMessage,
  appendToMessage,
  setStreaming,
  setCurrentStreamingMessage,
  setCurrentStreamingSession,
  setInputValue,
  setChatLoading,
  setChatError,
  clearSessionMessages,
  setTaskMode,
  setInputMode,
  setMicrophonePermission,
  setSendQuestionBehavior,
  addChatFile,
  updateChatFile,
  removeChatFile,
  clearChatFiles,
  setChatExtData,
  updateChatExtData,
  setShowSharePopover,
  setPlaybookInfo,
  setRecommendedPlaybooks,
  setRecommendedPlaybooksLoading,
  setInputPlaybookId,
  setInputPlaybookTemplate,
  setSlideTemplateList,
  setSlideTemplateListLoading,
  setPinnedSlideTemplateId,
  setDataVisualization,
  setIsPageVisible,
  setFileSuggestions,
  clearFileSuggestions,
  setIsAppBannerVisible,
  setImageStyleList,
  setImageStyleListLoading,
  setAgentModeIntroduceScene,
  setIsTyping,
  addTypingUser,
  removeTypingUser,
  clearTypingUsers,
  resetChatState,
} = chatSlice.actions;

export default chatSlice.reducer;
