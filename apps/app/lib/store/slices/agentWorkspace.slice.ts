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

export type WorkspaceSidebarType = "agents" | "sources" | "files" | "computer" | "planner" | "browser" | "webdev" | null;

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

  // P6.10: Aggregate state for deterministic workspace layout
  workspaceLayout: {
    // Aggregated visibility state
    isAnyPanelOpen: boolean;
    isComputerVisible: boolean;
    isPlannerVisible: boolean;
    isSidebarVisible: boolean;
    isFileHistoryVisible: boolean;
    // Computed layout mode
    layoutMode: "compact" | "expanded" | "fullscreen" | "split";
    // Panel stack for navigation
    panelStack: Array<"computer" | "planner" | "sidebar" | "fileHistory">;
  };
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

  workspaceLayout: {
    isAnyPanelOpen: false,
    isComputerVisible: false,
    isPlannerVisible: false,
    isSidebarVisible: false,
    isFileHistoryVisible: false,
    layoutMode: "compact",
    panelStack: [],
  },
};

// P6.10: Helper to recompute aggregate workspace layout state
function recomputeWorkspaceLayout(state: AgentWorkspaceState) {
  const isComputerVisible = state.chatComputerDialogVisible || state.vncDialogVisible;
  const isPlannerVisible = state.isPlannerExpanded;
  const isSidebarVisible = state.sidebarType !== null;
  const isFileHistoryVisible = state.fileHistoryVisible;

  state.workspaceLayout.isComputerVisible = isComputerVisible;
  state.workspaceLayout.isPlannerVisible = isPlannerVisible;
  state.workspaceLayout.isSidebarVisible = isSidebarVisible;
  state.workspaceLayout.isFileHistoryVisible = isFileHistoryVisible;

  const openPanelCount = [
    isComputerVisible,
    isPlannerVisible,
    isSidebarVisible,
    isFileHistoryVisible,
  ].filter(Boolean).length;

  state.workspaceLayout.isAnyPanelOpen = openPanelCount > 0;

  // Determine layout mode
  if (state.isSidebarPreviewFullscreen) {
    state.workspaceLayout.layoutMode = "fullscreen";
  } else if (openPanelCount === 0) {
    state.workspaceLayout.layoutMode = "compact";
  } else if (openPanelCount >= 2) {
    state.workspaceLayout.layoutMode = "split";
  } else {
    state.workspaceLayout.layoutMode = "expanded";
  }

  // Update panel stack (for navigation/history)
  const newStack: Array<"computer" | "planner" | "sidebar" | "fileHistory"> = [];
  if (isComputerVisible) newStack.push("computer");
  if (isPlannerVisible) newStack.push("planner");
  if (isSidebarVisible) newStack.push("sidebar");
  if (isFileHistoryVisible) newStack.push("fileHistory");
  state.workspaceLayout.panelStack = newStack;
}

const agentWorkspaceSlice = createSlice({
  name: "agentWorkspace",
  initialState,
  reducers: {
    // Computer view
    setChatComputerDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.chatComputerDialogVisible = action.payload;
      recomputeWorkspaceLayout(state);
    },

    setVncDialogVisible: (state, action: PayloadAction<boolean>) => {
      state.vncDialogVisible = action.payload;
      recomputeWorkspaceLayout(state);
    },

    setInitialComputerPosition: (state, action: PayloadAction<Partial<ComputerPosition>>) => {
      state.initialComputerPosition = {
        ...state.initialComputerPosition,
        ...action.payload,
      };
    },

    // Planner
    setIsPlannerExpanded: (state, action: PayloadAction<boolean>) => {
      state.isPlannerExpanded = action.payload;
      recomputeWorkspaceLayout(state);
    },

    togglePlannerExpanded: (state) => {
      state.isPlannerExpanded = !state.isPlannerExpanded;
      recomputeWorkspaceLayout(state);
    },

    setIsTimelinePlaying: (state, action: PayloadAction<boolean>) => {
      state.isTimelinePlaying = action.payload;
    },

    // Sidebar
    setWorkspaceSidebarType: (state, action: PayloadAction<WorkspaceSidebarType>) => {
      state.prevAutoOpenedSidebarType = state.sidebarType;
      state.sidebarType = action.payload;
      recomputeWorkspaceLayout(state);
    },

    setIsSidebarVisibleInMobile: (state, action: PayloadAction<boolean>) => {
      state.isSidebarVisibleInMobile = action.payload;
    },

    setIsSidebarPreviewFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isSidebarPreviewFullscreen = action.payload;
      recomputeWorkspaceLayout(state);
    },

    toggleWorkspaceSidebar: (state, action: PayloadAction<WorkspaceSidebarType>) => {
      if (state.sidebarType === action.payload) {
        state.prevAutoOpenedSidebarType = state.sidebarType;
        state.sidebarType = null;
      } else {
        state.prevAutoOpenedSidebarType = state.sidebarType;
        state.sidebarType = action.payload;
      }
      recomputeWorkspaceLayout(state);
    },

    // File history
    setFileHistoryVisible: (state, action: PayloadAction<boolean>) => {
      state.fileHistoryVisible = action.payload;
      recomputeWorkspaceLayout(state);
    },

    toggleFileHistory: (state) => {
      state.fileHistoryVisible = !state.fileHistoryVisible;
      recomputeWorkspaceLayout(state);
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

    setChatReplySearchMetadata: (state, action: PayloadAction<ChatReplySearchMetadata | null>) => {
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
  // P6.7: Plan-related event mappings from websocket
  extraReducers: (builder) => {
    builder
      .addCase("websocket/plan:expanded", (state) => {
        state.isPlannerExpanded = true;
        recomputeWorkspaceLayout(state);
      })
      .addCase("websocket/plan:collapsed", (state) => {
        state.isPlannerExpanded = false;
        recomputeWorkspaceLayout(state);
      })
      .addCase("websocket/plan:toggle", (state) => {
        state.isPlannerExpanded = !state.isPlannerExpanded;
        recomputeWorkspaceLayout(state);
      })
      .addCase("websocket/timeline:play", (state) => {
        state.isTimelinePlaying = true;
      })
      .addCase("websocket/timeline:pause", (state) => {
        state.isTimelinePlaying = false;
      })
      .addCase("websocket/timeline:toggle", (state) => {
        state.isTimelinePlaying = !state.isTimelinePlaying;
      })
      .addCase("websocket/workspace:sidebar:open", (state, action) => {
        const sidebarType = (action as any).payload?.type || null;
        state.prevAutoOpenedSidebarType = state.sidebarType;
        state.sidebarType = sidebarType;
        recomputeWorkspaceLayout(state);
      })
      .addCase("websocket/workspace:sidebar:close", (state) => {
        state.prevAutoOpenedSidebarType = state.sidebarType;
        state.sidebarType = null;
        recomputeWorkspaceLayout(state);
      })
      .addCase("websocket/workspace:fileHistory:open", (state) => {
        state.fileHistoryVisible = true;
        recomputeWorkspaceLayout(state);
      })
      .addCase("websocket/workspace:fileHistory:close", (state) => {
        state.fileHistoryVisible = false;
        recomputeWorkspaceLayout(state);
      });
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
