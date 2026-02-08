import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Agent Workspace Slice
 * Controls the workspace layout when an agent is running:
 * - Computer view (live sandbox preview)
 * - Planner panel
 * - Sidebar panels (agents, sources, files, computer)
 * - File history
 * - Chat reply search
 */

export type WorkspaceSidebarType =
  | "agents"
  | "sources"
  | "files"
  | "computer"
  | null;

export interface ComputerPosition {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface ChatReplySearchMetadata {
  query: string;
  totalMatches: number;
  currentMatch: number;
}

export interface AgentWorkspaceState {
  // Computer view (live sandbox preview)
  chatComputerDialogVisible: boolean;
  vncDialogVisible: boolean;
  initialComputerPosition: ComputerPosition;

  // Planner
  isPlannerExpanded: boolean;
  isTimelinePlaying: boolean;

  // Sidebar
  sidebarType: WorkspaceSidebarType;
  isSidebarVisibleInMobile: boolean;
  isSidebarPreviewFullscreen: boolean;
  prevAutoOpenedSidebarType: WorkspaceSidebarType;

  // File history
  fileHistoryVisible: boolean;

  // Animations
  animationLock: boolean;
  disableChatWorkspaceInitAnimation: boolean | null;
  disableSidebarInitAnimation: boolean;

  // Chat reply search
  chatReplySearchResults: Record<string, unknown>;
  chatReplySearchMetadata: ChatReplySearchMetadata | null;
}

const initialState: AgentWorkspaceState = {
  chatComputerDialogVisible: false,
  vncDialogVisible: false,
  initialComputerPosition: {
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  },

  isPlannerExpanded: false,
  isTimelinePlaying: false,

  sidebarType: null,
  isSidebarVisibleInMobile: false,
  isSidebarPreviewFullscreen: false,
  prevAutoOpenedSidebarType: null,

  fileHistoryVisible: false,

  animationLock: false,
  disableChatWorkspaceInitAnimation: null,
  disableSidebarInitAnimation: false,

  chatReplySearchResults: {},
  chatReplySearchMetadata: null,
};

const agentWorkspaceSlice = createSlice({
  name: "agentWorkspace",
  initialState,
  reducers: {
    // Computer view
    setChatComputerDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.chatComputerDialogVisible = action.payload;
    },

    setVncDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.vncDialogVisible = action.payload;
    },

    setInitialComputerPosition: (
      state,
      action: PayloadAction<Partial<ComputerPosition>>
    ) => {
      state.initialComputerPosition = {
        ...state.initialComputerPosition,
        ...action.payload,
      };
    },

    // Planner
    setIsPlannerExpanded: (state, action: PayloadAction<boolean>) => {
      state.isPlannerExpanded = action.payload;
    },

    togglePlannerExpanded: (state) => {
      state.isPlannerExpanded = !state.isPlannerExpanded;
    },

    setIsTimelinePlaying: (state, action: PayloadAction<boolean>) => {
      state.isTimelinePlaying = action.payload;
    },

    // Sidebar
    setWorkspaceSidebarType: (state, action: PayloadAction<WorkspaceSidebarType>) => {
      state.prevAutoOpenedSidebarType = state.sidebarType;
      state.sidebarType = action.payload;
    },

    setIsSidebarVisibleInMobile: (state, action: PayloadAction<boolean>) => {
      state.isSidebarVisibleInMobile = action.payload;
    },

    setIsSidebarPreviewFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isSidebarPreviewFullscreen = action.payload;
    },

    toggleWorkspaceSidebar: (state, action: PayloadAction<WorkspaceSidebarType>) => {
      if (state.sidebarType === action.payload) {
        state.prevAutoOpenedSidebarType = state.sidebarType;
        state.sidebarType = null;
      } else {
        state.prevAutoOpenedSidebarType = state.sidebarType;
        state.sidebarType = action.payload;
      }
    },

    // File history
    setFileHistoryVisible: (state, action: PayloadAction<boolean>) => {
      state.fileHistoryVisible = action.payload;
    },

    toggleFileHistory: (state) => {
      state.fileHistoryVisible = !state.fileHistoryVisible;
    },

    // Animation
    setAnimationLock: (state, action: PayloadAction<boolean>) => {
      state.animationLock = action.payload;
    },

    setDisableChatWorkspaceInitAnimation: (state, action: PayloadAction<boolean | null>) => {
      state.disableChatWorkspaceInitAnimation = action.payload;
    },

    setDisableSidebarInitAnimation: (state, action: PayloadAction<boolean>) => {
      state.disableSidebarInitAnimation = action.payload;
    },

    // Chat reply search
    setChatReplySearchResults: (state, action: PayloadAction<Record<string, unknown>>) => {
      state.chatReplySearchResults = action.payload;
    },

    setChatReplySearchMetadata: (
      state,
      action: PayloadAction<ChatReplySearchMetadata | null>
    ) => {
      state.chatReplySearchMetadata = action.payload;
    },

    clearChatReplySearch: (state) => {
      state.chatReplySearchResults = {};
      state.chatReplySearchMetadata = null;
    },

    // Reset
    resetAgentWorkspace: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setChatComputerDialogVisible,
  setVncDialogVisible,
  setInitialComputerPosition,
  setIsPlannerExpanded,
  togglePlannerExpanded,
  setIsTimelinePlaying,
  setWorkspaceSidebarType,
  setIsSidebarVisibleInMobile,
  setIsSidebarPreviewFullscreen,
  toggleWorkspaceSidebar,
  setFileHistoryVisible,
  toggleFileHistory,
  setAnimationLock,
  setDisableChatWorkspaceInitAnimation,
  setDisableSidebarInitAnimation,
  setChatReplySearchResults,
  setChatReplySearchMetadata,
  clearChatReplySearch,
  resetAgentWorkspace,
} = agentWorkspaceSlice.actions;

export default agentWorkspaceSlice.reducer;
