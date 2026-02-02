import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Session Switch Slice
 * Manages session search and switching UI state
 */

export interface SessionSwitchSession {
  id: string;
  title: string;
  lastMessage?: string;
  updatedAt: string;
  status: string;
}

export interface SessionSwitchState {
  keyword: string;
  sessions: SessionSwitchSession[];
  isSearching: boolean;
  selectedIndex: number;
}

const initialState: SessionSwitchState = {
  keyword: "",
  sessions: [],
  isSearching: false,
  selectedIndex: -1,
};

export const sessionSwitchSlice = createSlice({
  name: "sessionSwitch",
  initialState,
  reducers: {
    setKeyword: (state, action: PayloadAction<string>) => {
      state.keyword = action.payload;
    },

    setSessions: (state, action: PayloadAction<SessionSwitchSession[]>) => {
      state.sessions = action.payload;
      state.isSearching = false;
    },

    setIsSearching: (state, action: PayloadAction<boolean>) => {
      state.isSearching = action.payload;
    },

    setSelectedIndex: (state, action: PayloadAction<number>) => {
      state.selectedIndex = action.payload;
    },

    moveSelectionUp: (state) => {
      if (state.selectedIndex > 0) {
        state.selectedIndex -= 1;
      }
    },

    moveSelectionDown: (state) => {
      if (state.selectedIndex < state.sessions.length - 1) {
        state.selectedIndex += 1;
      }
    },

    clearSearch: (state) => {
      state.keyword = "";
      state.sessions = [];
      state.selectedIndex = -1;
    },

    resetSessionSwitch: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setKeyword,
  setSessions,
  setIsSearching,
  setSelectedIndex,
  moveSelectionUp,
  moveSelectionDown,
  clearSearch,
  resetSessionSwitch,
} = sessionSwitchSlice.actions;

export default sessionSwitchSlice.reducer;
