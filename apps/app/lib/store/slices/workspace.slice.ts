import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Agent Workspace Slice
 * Manages the agent workspace UI state including sidebar, preview, and VNC
 */

export type SidebarType =
  | "files"
  | "browser"
  | "terminal"
  | "logs"
  | "code"
  | "preview"
  | "database"
  | "settings"
  | null;

export interface ComputerPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ChatReplySearchMetadata {
  query: string;
  totalResults: number;
  currentIndex: number;
}

export interface WorkspaceState {
  // Sidebar state
  sidebarType: SidebarType;
  isSidebarPreviewFullscreen: boolean;
  isSidebarVisibleInMobile: boolean;
  prevAutoOpenedSidebarType: SidebarType;

  // Animation and transitions
  animationLock: boolean;
  disableChatWorkspaceInitAnimation: boolean | null;
  disableSidebarInitAnimation: boolean;

  // Timeline/playback
  isTimelinePlaying: boolean;

  // VNC/Remote Desktop
  vncDialogVisible: boolean;
  initialComputerPosition: ComputerPosition;
  chatComputerDialogVisible: boolean;

  // Chat search
  chatReplySearchMetadata: ChatReplySearchMetadata | null;
  chatReplySearchResults: Record<string, string[]>;

  // Planner
  isPlannerExpanded: boolean;

  // File history
  fileHistoryVisible: boolean;

  // Session switching
  sessionSwitchKeyword: string;
  sessionSwitchSessions: string[];
}

const initialState: WorkspaceState = {
  sidebarType: null,
  isSidebarPreviewFullscreen: false,
  isSidebarVisibleInMobile: false,
  prevAutoOpenedSidebarType: null,
  animationLock: false,
  disableChatWorkspaceInitAnimation: null,
  disableSidebarInitAnimation: false,
  isTimelinePlaying: false,
  vncDialogVisible: false,
  initialComputerPosition: { top: 0, left: 0, width: 0, height: 0 },
  chatComputerDialogVisible: false,
  chatReplySearchMetadata: null,
  chatReplySearchResults: {},
  isPlannerExpanded: false,
  fileHistoryVisible: false,
  sessionSwitchKeyword: "",
  sessionSwitchSessions: [],
};

export const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    // Sidebar management
    setSidebarType: (state, action: PayloadAction<SidebarType>) => {
      state.prevAutoOpenedSidebarType = state.sidebarType;
      state.sidebarType = action.payload;
    },

    closeSidebar: (state) => {
      state.prevAutoOpenedSidebarType = state.sidebarType;
      state.sidebarType = null;
    },

    toggleSidebarFullscreen: (state) => {
      state.isSidebarPreviewFullscreen = !state.isSidebarPreviewFullscreen;
    },

    setSidebarFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isSidebarPreviewFullscreen = action.payload;
    },

    setSidebarVisibleInMobile: (state, action: PayloadAction<boolean>) => {
      state.isSidebarVisibleInMobile = action.payload;
    },

    // Animation control
    setAnimationLock: (state, action: PayloadAction<boolean>) => {
      state.animationLock = action.payload;
    },

    setDisableChatWorkspaceInitAnimation: (state, action: PayloadAction<boolean | null>) => {
      state.disableChatWorkspaceInitAnimation = action.payload;
    },

    setDisableSidebarInitAnimation: (state, action: PayloadAction<boolean>) => {
      state.disableSidebarInitAnimation = action.payload;
    },

    // Timeline
    setTimelinePlaying: (state, action: PayloadAction<boolean>) => {
      state.isTimelinePlaying = action.payload;
    },

    toggleTimelinePlaying: (state) => {
      state.isTimelinePlaying = !state.isTimelinePlaying;
    },

    // VNC/Remote Desktop
    setVncDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.vncDialogVisible = action.payload;
    },

    setInitialComputerPosition: (state, action: PayloadAction<ComputerPosition>) => {
      state.initialComputerPosition = action.payload;
    },

    setChatComputerDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.chatComputerDialogVisible = action.payload;
    },

    // Chat search
    setChatReplySearchMetadata: (state, action: PayloadAction<ChatReplySearchMetadata | null>) => {
      state.chatReplySearchMetadata = action.payload;
    },

    setChatReplySearchResults: (state, action: PayloadAction<{ sessionId: string; results: string[] }>) => {
      state.chatReplySearchResults[action.payload.sessionId] = action.payload.results;
    },

    clearChatReplySearch: (state) => {
      state.chatReplySearchMetadata = null;
      state.chatReplySearchResults = {};
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

    // Session switching
    setSessionSwitchKeyword: (state, action: PayloadAction<string>) => {
      state.sessionSwitchKeyword = action.payload;
    },

    setSessionSwitchSessions: (state, action: PayloadAction<string[]>) => {
      state.sessionSwitchSessions = action.payload;
    },

    clearSessionSwitch: (state) => {
      state.sessionSwitchKeyword = "";
      state.sessionSwitchSessions = [];
    },

    // Reset workspace state
    resetWorkspace: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setSidebarType,
  closeSidebar,
  toggleSidebarFullscreen,
  setSidebarFullscreen,
  setSidebarVisibleInMobile,
  setAnimationLock,
  setDisableChatWorkspaceInitAnimation,
  setDisableSidebarInitAnimation,
  setTimelinePlaying,
  toggleTimelinePlaying,
  setVncDialogVisible,
  setInitialComputerPosition,
  setChatComputerDialogVisible,
  setChatReplySearchMetadata,
  setChatReplySearchResults,
  clearChatReplySearch,
  setIsPlannerExpanded,
  togglePlannerExpanded,
  setFileHistoryVisible,
  setSessionSwitchKeyword,
  setSessionSwitchSessions,
  clearSessionSwitch,
  resetWorkspace,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
