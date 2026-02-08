import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Session Switch Slice
 * Quick session switcher (Cmd+K style within sidebar):
 * - Fuzzy search sessions by title
 * - Recent sessions prioritized
 * - Keyboard navigation
 */

export interface SessionSwitchItem {
  id: string;
  title: string | null;
  status: string;
  mode: string;
  lastActivityAt?: string;
  updatedAt: string;
  preview?: string;
}

export interface SessionSwitchState {
  // Search
  keyword: string;

  // Filtered sessions
  sessions: SessionSwitchItem[];

  // UI
  isOpen: boolean;
  selectedIndex: number;
  isLoading: boolean;
}

const initialState: SessionSwitchState = {
  keyword: "",
  sessions: [],
  isOpen: false,
  selectedIndex: 0,
  isLoading: false,
};

const sessionSwitchSlice = createSlice({
  name: "sessionSwitch",
  initialState,
  reducers: {
    // Open/close
    openSessionSwitch: (state) => {
      state.isOpen = true;
      state.keyword = "";
      state.selectedIndex = 0;
    },

    closeSessionSwitch: (state) => {
      state.isOpen = false;
      state.keyword = "";
      state.sessions = [];
      state.selectedIndex = 0;
    },

    toggleSessionSwitch: (state) => {
      if (state.isOpen) {
        state.isOpen = false;
        state.keyword = "";
        state.sessions = [];
        state.selectedIndex = 0;
      } else {
        state.isOpen = true;
        state.keyword = "";
        state.selectedIndex = 0;
      }
    },

    // Search
    setKeyword: (state, action: PayloadAction<string>) => {
      state.keyword = action.payload;
      state.selectedIndex = 0;
    },

    // Sessions
    setSwitchSessions: (state, action: PayloadAction<SessionSwitchItem[]>) => {
      state.sessions = action.payload;
      state.isLoading = false;
      state.selectedIndex = 0;
    },

    // Navigation
    setSwitchSelectedIndex: (state, action: PayloadAction<number>) => {
      state.selectedIndex = action.payload;
    },

    moveSwitchSelectionUp: (state) => {
      if (state.sessions.length > 0) {
        state.selectedIndex = Math.max(0, state.selectedIndex - 1);
      }
    },

    moveSwitchSelectionDown: (state) => {
      if (state.sessions.length > 0) {
        state.selectedIndex = Math.min(
          state.sessions.length - 1,
          state.selectedIndex + 1
        );
      }
    },

    // Loading
    setSessionSwitchLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const {
  openSessionSwitch,
  closeSessionSwitch,
  toggleSessionSwitch,
  setKeyword,
  setSwitchSessions,
  setSwitchSelectedIndex,
  moveSwitchSelectionUp,
  moveSwitchSelectionDown,
  setSessionSwitchLoading,
} = sessionSwitchSlice.actions;

export default sessionSwitchSlice.reducer;
