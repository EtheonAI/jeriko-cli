import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Theme = "light" | "dark" | "system";
export type SidebarState = "expanded" | "collapsed" | "hidden";

export interface Toast {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message?: string;
  duration?: number;
}

export interface Modal {
  id: string;
  component: string;
  props?: Record<string, unknown>;
}

// P6.15: Panel layout configuration for deterministic UI state
export interface PanelLayoutConfig {
  id: string;
  type: "left" | "right" | "top" | "bottom" | "center" | "floating";
  position: { x: number; y: number };
  size: { width: number; height: number };
  isVisible: boolean;
  isMinimized: boolean;
  zIndex: number;
  isDocked: boolean;
}

export interface UIState {
  theme: Theme;
  sidebarState: SidebarState;
  isMobile: boolean;
  toasts: Toast[];
  modals: Modal[];
  isCommandPaletteOpen: boolean;
  isSearchOpen: boolean;
  breadcrumbs: { label: string; href?: string }[];
  // Manus-aligned keys
  chatSidebarPercentage: number | null;
  chatSidebarWidth: number;
  windowWidth: number;
  showAppDownloadMask: boolean;
  isShowMaxModeIntroduce: boolean;
  isWebDevSidebarFullscreen: boolean;
  // P6.15: Deterministic panel layout
  panelLayout: {
    panels: Record<string, PanelLayoutConfig>;
    activePanel: string | null;
    panelOrder: string[]; // Z-order from back to front
    layoutMode: "grid" | "floating" | "tabbed" | "split";
    gridConfig?: {
      rows: number;
      cols: number;
      gaps: number;
    };
  };
}

const initialState: UIState = {
  theme: "system",
  sidebarState: "expanded",
  isMobile: false,
  toasts: [],
  modals: [],
  isCommandPaletteOpen: false,
  isSearchOpen: false,
  breadcrumbs: [],
  // Manus-aligned defaults
  chatSidebarPercentage: null,
  chatSidebarWidth: 746,
  windowWidth: 1792,
  showAppDownloadMask: false,
  isShowMaxModeIntroduce: false,
  isWebDevSidebarFullscreen: false,
  // P6.15: Default panel layout
  panelLayout: {
    panels: {},
    activePanel: null,
    panelOrder: [],
    layoutMode: "grid",
    gridConfig: {
      rows: 1,
      cols: 1,
      gaps: 8,
    },
  },
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setTheme: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload;
    },
    setSidebarState: (state, action: PayloadAction<SidebarState>) => {
      state.sidebarState = action.payload;
    },
    toggleSidebar: (state) => {
      state.sidebarState = state.sidebarState === "expanded" ? "collapsed" : "expanded";
    },
    setIsMobile: (state, action: PayloadAction<boolean>) => {
      state.isMobile = action.payload;
      if (action.payload) {
        state.sidebarState = "hidden";
      }
    },
    addToast: (state, action: PayloadAction<Toast>) => {
      state.toasts.push(action.payload);
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts: (state) => {
      state.toasts = [];
    },
    openModal: (state, action: PayloadAction<Modal>) => {
      state.modals.push(action.payload);
    },
    closeModal: (state, action: PayloadAction<string>) => {
      state.modals = state.modals.filter((m) => m.id !== action.payload);
    },
    closeAllModals: (state) => {
      state.modals = [];
    },
    setCommandPaletteOpen: (state, action: PayloadAction<boolean>) => {
      state.isCommandPaletteOpen = action.payload;
    },
    setSearchOpen: (state, action: PayloadAction<boolean>) => {
      state.isSearchOpen = action.payload;
    },
    setBreadcrumbs: (state, action: PayloadAction<{ label: string; href?: string }[]>) => {
      state.breadcrumbs = action.payload;
    },

    // Manus-aligned reducers
    setChatSidebarPercentage: (state, action: PayloadAction<number | null>) => {
      state.chatSidebarPercentage = action.payload;
    },
    setChatSidebarWidth: (state, action: PayloadAction<number>) => {
      state.chatSidebarWidth = action.payload;
    },
    setWindowWidth: (state, action: PayloadAction<number>) => {
      state.windowWidth = action.payload;
    },
    setShowAppDownloadMask: (state, action: PayloadAction<boolean>) => {
      state.showAppDownloadMask = action.payload;
    },
    setIsShowMaxModeIntroduce: (state, action: PayloadAction<boolean>) => {
      state.isShowMaxModeIntroduce = action.payload;
    },
    setIsWebDevSidebarFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isWebDevSidebarFullscreen = action.payload;
    },

    // P6.15: Panel layout management
    registerPanel: (state, action: PayloadAction<PanelLayoutConfig>) => {
      const { id } = action.payload;
      state.panelLayout.panels[id] = action.payload;
      if (!state.panelLayout.panelOrder.includes(id)) {
        state.panelLayout.panelOrder.push(id);
      }
    },

    updatePanelLayout: (
      state,
      action: PayloadAction<{
        id: string;
        updates: Partial<PanelLayoutConfig>;
      }>
    ) => {
      const { id, updates } = action.payload;
      const panel = state.panelLayout.panels[id];
      if (panel) {
        state.panelLayout.panels[id] = { ...panel, ...updates };
      }
    },

    setPanelVisible: (state, action: PayloadAction<{ id: string; visible: boolean }>) => {
      const panel = state.panelLayout.panels[action.payload.id];
      if (panel) {
        panel.isVisible = action.payload.visible;
      }
    },

    setPanelMinimized: (state, action: PayloadAction<{ id: string; minimized: boolean }>) => {
      const panel = state.panelLayout.panels[action.payload.id];
      if (panel) {
        panel.isMinimized = action.payload.minimized;
      }
    },

    setActivePanel: (state, action: PayloadAction<string | null>) => {
      state.panelLayout.activePanel = action.payload;
      if (action.payload) {
        // Move to front of z-order
        const index = state.panelLayout.panelOrder.indexOf(action.payload);
        if (index !== -1) {
          state.panelLayout.panelOrder.splice(index, 1);
          state.panelLayout.panelOrder.push(action.payload);
        }
        // Update z-indices
        state.panelLayout.panelOrder.forEach((panelId, i) => {
          const panel = state.panelLayout.panels[panelId];
          if (panel) {
            panel.zIndex = i + 1;
          }
        });
      }
    },

    unregisterPanel: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.panelLayout.panels[id];
      state.panelLayout.panelOrder = state.panelLayout.panelOrder.filter((pid) => pid !== id);
      if (state.panelLayout.activePanel === id) {
        state.panelLayout.activePanel = null;
      }
    },

    setLayoutMode: (state, action: PayloadAction<"grid" | "floating" | "tabbed" | "split">) => {
      state.panelLayout.layoutMode = action.payload;
    },

    setGridConfig: (state, action: PayloadAction<{ rows: number; cols: number; gaps: number }>) => {
      state.panelLayout.gridConfig = action.payload;
    },

    resetPanelLayout: (state) => {
      state.panelLayout = initialState.panelLayout;
    },
  },
});

export const {
  setTheme,
  setSidebarState,
  toggleSidebar,
  setIsMobile,
  addToast,
  removeToast,
  clearToasts,
  openModal,
  closeModal,
  closeAllModals,
  setCommandPaletteOpen,
  setSearchOpen,
  setBreadcrumbs,
  setChatSidebarPercentage,
  setChatSidebarWidth,
  setWindowWidth,
  setShowAppDownloadMask,
  setIsShowMaxModeIntroduce,
  setIsWebDevSidebarFullscreen,
  // P6.15: Panel layout actions
  registerPanel,
  updatePanelLayout,
  setPanelVisible,
  setPanelMinimized,
  setActivePanel,
  unregisterPanel,
  setLayoutMode,
  setGridConfig,
  resetPanelLayout,
} = uiSlice.actions;

export default uiSlice.reducer;
