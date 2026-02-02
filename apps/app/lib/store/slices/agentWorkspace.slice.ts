import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Agent Workspace Slice
 * Manages the agent workspace UI state (Manus-style agentWorkspace)
 *
 * Manus keys:
 * - sidebarType
 * - isSidebarPreviewFullscreen
 * - isSidebarVisibleInMobile
 * - animationLock
 * - isTimelinePlaying
 * - vncDialogVisible
 * - chatReplySearchMetadata
 * - chatReplySearchResults
 * - isPlannerExpanded
 * - prevAutoOpenedSidebarType
 * - fileHistoryVisible
 * - chatComputerDialogVisible
 * - disableChatWorkspaceInitAnimation
 * - disableSidebarInitAnimation
 */

export type SidebarType =
  | "none"
  | "browser"
  | "code"
  | "files"
  | "terminal"
  | "preview"
  | "vnc"
  | "planner"
  | "timeline"
  | null;

export interface ChatReplySearchMetadata {
  query: string;
  totalResults: number;
  currentIndex: number;
  sessionId: string;
}

export interface ChatReplySearchResult {
  messageId: string;
  content: string;
  matchStart: number;
  matchEnd: number;
}

export interface AgentWorkspaceState {
  // Sidebar
  sidebarType: SidebarType;
  isSidebarPreviewFullscreen: boolean;
  isSidebarVisibleInMobile: boolean;
  prevAutoOpenedSidebarType: SidebarType;

  // Animation
  animationLock: boolean;
  disableChatWorkspaceInitAnimation: boolean;
  disableSidebarInitAnimation: boolean;

  // Timeline
  isTimelinePlaying: boolean;

  // VNC (Virtual Network Computing - remote desktop)
  vncDialogVisible: boolean;

  // Chat reply search
  chatReplySearchMetadata: ChatReplySearchMetadata | null;
  chatReplySearchResults: ChatReplySearchResult[];

  // Planner
  isPlannerExpanded: boolean;

  // File history
  fileHistoryVisible: boolean;

  // Computer dialog
  chatComputerDialogVisible: boolean;
}

const initialState: AgentWorkspaceState = {
  sidebarType: null,
  isSidebarPreviewFullscreen: false,
  isSidebarVisibleInMobile: false,
  prevAutoOpenedSidebarType: null,
  animationLock: false,
  disableChatWorkspaceInitAnimation: false,
  disableSidebarInitAnimation: false,
  isTimelinePlaying: false,
  vncDialogVisible: false,
  chatReplySearchMetadata: null,
  chatReplySearchResults: [],
  isPlannerExpanded: false,
  fileHistoryVisible: false,
  chatComputerDialogVisible: false,
};

export const agentWorkspaceSlice = createSlice({
  name: "agentWorkspace",
  initialState,
  reducers: {
    // Sidebar
    setSidebarType: (state, action: PayloadAction<SidebarType>) => {
      state.prevAutoOpenedSidebarType = state.sidebarType;
      state.sidebarType = action.payload;
    },

    setIsSidebarPreviewFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isSidebarPreviewFullscreen = action.payload;
    },

    toggleSidebarPreviewFullscreen: (state) => {
      state.isSidebarPreviewFullscreen = !state.isSidebarPreviewFullscreen;
    },

    setIsSidebarVisibleInMobile: (state, action: PayloadAction<boolean>) => {
      state.isSidebarVisibleInMobile = action.payload;
    },

    toggleSidebarVisibleInMobile: (state) => {
      state.isSidebarVisibleInMobile = !state.isSidebarVisibleInMobile;
    },

    setPrevAutoOpenedSidebarType: (state, action: PayloadAction<SidebarType>) => {
      state.prevAutoOpenedSidebarType = action.payload;
    },

    // Animation
    setAnimationLock: (state, action: PayloadAction<boolean>) => {
      state.animationLock = action.payload;
    },

    setDisableChatWorkspaceInitAnimation: (state, action: PayloadAction<boolean>) => {
      state.disableChatWorkspaceInitAnimation = action.payload;
    },

    setDisableSidebarInitAnimation: (state, action: PayloadAction<boolean>) => {
      state.disableSidebarInitAnimation = action.payload;
    },

    // Timeline
    setIsTimelinePlaying: (state, action: PayloadAction<boolean>) => {
      state.isTimelinePlaying = action.payload;
    },

    toggleTimelinePlaying: (state) => {
      state.isTimelinePlaying = !state.isTimelinePlaying;
    },

    // VNC
    setVncDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.vncDialogVisible = action.payload;
    },

    openVncDialog: (state) => {
      state.vncDialogVisible = true;
    },

    closeVncDialog: (state) => {
      state.vncDialogVisible = false;
    },

    // Chat reply search
    setChatReplySearchMetadata: (
      state,
      action: PayloadAction<ChatReplySearchMetadata | null>
    ) => {
      state.chatReplySearchMetadata = action.payload;
    },

    setChatReplySearchResults: (
      state,
      action: PayloadAction<ChatReplySearchResult[]>
    ) => {
      state.chatReplySearchResults = action.payload;
    },

    startChatReplySearch: (
      state,
      action: PayloadAction<{ query: string; sessionId: string }>
    ) => {
      state.chatReplySearchMetadata = {
        query: action.payload.query,
        sessionId: action.payload.sessionId,
        totalResults: 0,
        currentIndex: 0,
      };
      state.chatReplySearchResults = [];
    },

    clearChatReplySearch: (state) => {
      state.chatReplySearchMetadata = null;
      state.chatReplySearchResults = [];
    },

    goToNextSearchResult: (state) => {
      if (state.chatReplySearchMetadata && state.chatReplySearchResults.length > 0) {
        state.chatReplySearchMetadata.currentIndex =
          (state.chatReplySearchMetadata.currentIndex + 1) %
          state.chatReplySearchResults.length;
      }
    },

    goToPrevSearchResult: (state) => {
      if (state.chatReplySearchMetadata && state.chatReplySearchResults.length > 0) {
        state.chatReplySearchMetadata.currentIndex =
          (state.chatReplySearchMetadata.currentIndex -
            1 +
            state.chatReplySearchResults.length) %
          state.chatReplySearchResults.length;
      }
    },

    // Planner
    setIsPlannerExpanded: (state, action: PayloadAction<boolean>) => {
      state.isPlannerExpanded = action.payload;
    },

    togglePlannerExpanded: (state) => {
      state.isPlannerExpanded = !state.isPlannerExpanded;
    },

    // File history
    setFileHistoryVisible: (state, action: PayloadAction<boolean>) => {
      state.fileHistoryVisible = action.payload;
    },

    toggleFileHistoryVisible: (state) => {
      state.fileHistoryVisible = !state.fileHistoryVisible;
    },

    // Computer dialog
    setChatComputerDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.chatComputerDialogVisible = action.payload;
    },

    openChatComputerDialog: (state) => {
      state.chatComputerDialogVisible = true;
    },

    closeChatComputerDialog: (state) => {
      state.chatComputerDialogVisible = false;
    },

    // Reset
    resetAgentWorkspace: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setSidebarType,
  setIsSidebarPreviewFullscreen,
  toggleSidebarPreviewFullscreen,
  setIsSidebarVisibleInMobile,
  toggleSidebarVisibleInMobile,
  setPrevAutoOpenedSidebarType,
  setAnimationLock,
  setDisableChatWorkspaceInitAnimation,
  setDisableSidebarInitAnimation,
  setIsTimelinePlaying,
  toggleTimelinePlaying,
  setVncDialogVisible,
  openVncDialog,
  closeVncDialog,
  setChatReplySearchMetadata,
  setChatReplySearchResults,
  startChatReplySearch,
  clearChatReplySearch,
  goToNextSearchResult,
  goToPrevSearchResult,
  setIsPlannerExpanded,
  togglePlannerExpanded,
  setFileHistoryVisible,
  toggleFileHistoryVisible,
  setChatComputerDialogVisible,
  openChatComputerDialog,
  closeChatComputerDialog,
  resetAgentWorkspace,
} = agentWorkspaceSlice.actions;

export default agentWorkspaceSlice.reducer;
