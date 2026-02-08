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
    setBreadcrumbs: (
      state,
      action: PayloadAction<{ label: string; href?: string }[]>
    ) => {
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
} = uiSlice.actions;

export default uiSlice.reducer;
