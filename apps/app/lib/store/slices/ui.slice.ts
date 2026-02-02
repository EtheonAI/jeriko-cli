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
};

export const uiSlice = createSlice({
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
} = uiSlice.actions;

export default uiSlice.reducer;
