import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface AgentSession {
  id: string;
  title: string | null;
  status: "active" | "paused" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface SessionsState {
  sessions: AgentSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SessionsState = {
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,
};

export const sessionsSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    setSessions: (state, action: PayloadAction<AgentSession[]>) => {
      state.sessions = action.payload;
      state.isLoading = false;
      state.error = null;
    },
    addSession: (state, action: PayloadAction<AgentSession>) => {
      state.sessions.unshift(action.payload);
    },
    updateSession: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<AgentSession> }>
    ) => {
      const index = state.sessions.findIndex((s) => s.id === action.payload.id);
      if (index !== -1) {
        state.sessions[index] = { ...state.sessions[index], ...action.payload.updates };
      }
    },
    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.currentSessionId === action.payload) {
        state.currentSessionId = null;
      }
    },
    setCurrentSession: (state, action: PayloadAction<string | null>) => {
      state.currentSessionId = action.payload;
    },
    setSessionsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setSessionsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
});

export const {
  setSessions,
  addSession,
  updateSession,
  removeSession,
  setCurrentSession,
  setSessionsLoading,
  setSessionsError,
} = sessionsSlice.actions;

export default sessionsSlice.reducer;
