import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type SessionStatus = "active" | "paused" | "completed" | "failed" | "archived";
export type SessionMode = "chat" | "adaptive" | "agent";

export interface SessionSettings {
  agentProfile?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  connectorIds?: string[];
  knowledgeBaseIds?: string[];
}

export interface SessionStats {
  messageCount: number;
  tokenCount: number;
  toolCallCount: number;
  duration?: number; // in seconds
}

export interface AgentSession {
  id: string;
  userId: string;
  projectId?: string | null;
  teamId?: string | null;
  // Basic info
  title: string | null;
  description?: string | null;
  status: SessionStatus;
  mode: SessionMode;
  // Settings
  settings?: SessionSettings;
  // Stats
  stats?: SessionStats;
  // Sharing
  isShared: boolean;
  shareId?: string | null;
  sharedWith?: string[];
  // Metadata
  tags?: string[];
  isPinned?: boolean;
  isFavorite?: boolean;
  metadata?: Record<string, unknown>;
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  completedAt?: string | null;
}

export interface SessionGroup {
  id: string;
  name: string;
  sessionIds: string[];
  color?: string;
  icon?: string;
}

export interface SegmentEndpoint {
  top: string | null;
  bottom: string | null;
}

export interface SwapSessionDetail {
  sessionId: string;
  title: string;
  preview: string;
  timestamp: string;
}

export interface SessionsState {
  sessions: AgentSession[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  allCollaborators: string[];
  // Session groups/folders
  groups: SessionGroup[];
  // Filtering and sorting (Manus: searchValue -> searchQuery)
  searchQuery: string;
  filterStatus: SessionStatus | "all";
  filterMode: SessionMode | "all";
  sortBy: "createdAt" | "updatedAt" | "lastActivityAt" | "title";
  sortOrder: "asc" | "desc";
  showArchived: boolean;
  // Pagination
  hasMore: boolean;
  cursor: string | null;
  totalCount: number;
  // Selection for bulk actions
  selectedSessionIds: string[];
  // Recent sessions
  recentSessionIds: string[];
  // Manus-specific state
  isSearchMode: boolean;
  isShareMode: boolean;
  isShareFileMode: boolean;
  loadSessionLoading: boolean;
  loadSessionDetailLoading: boolean;
  swapSessionDetailMap: Record<string, SwapSessionDetail>;
  loadTopSegmentsLoading: boolean;
  loadBottomSegmentsLoading: boolean;
  segmentEndpoints: Record<string, SegmentEndpoint>;
  scheduledTaskSessions: string[];
  sharingSessionUid: string | null;
}

const initialState: SessionsState = {
  sessions: [],
  currentSessionId: null,
  isLoading: false,
  error: null,
  allCollaborators: [],
  groups: [],
  searchQuery: "",
  filterStatus: "all",
  filterMode: "all",
  sortBy: "updatedAt",
  sortOrder: "desc",
  showArchived: false,
  hasMore: false,
  cursor: null,
  totalCount: 0,
  selectedSessionIds: [],
  recentSessionIds: [],
  // Manus-specific
  isSearchMode: false,
  isShareMode: false,
  isShareFileMode: false,
  loadSessionLoading: false,
  loadSessionDetailLoading: false,
  swapSessionDetailMap: {},
  loadTopSegmentsLoading: false,
  loadBottomSegmentsLoading: false,
  segmentEndpoints: {},
  scheduledTaskSessions: [],
  sharingSessionUid: null,
};

export const sessionsSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    setSessions: (
      state,
      action: PayloadAction<{
        sessions: AgentSession[];
        hasMore?: boolean;
        cursor?: string | null;
        totalCount?: number;
      }>
    ) => {
      state.sessions = action.payload.sessions;
      if (action.payload.hasMore !== undefined) {
        state.hasMore = action.payload.hasMore;
      }
      if (action.payload.cursor !== undefined) {
        state.cursor = action.payload.cursor;
      }
      if (action.payload.totalCount !== undefined) {
        state.totalCount = action.payload.totalCount;
      }
      state.isLoading = false;
      state.error = null;
    },

    appendSessions: (
      state,
      action: PayloadAction<{
        sessions: AgentSession[];
        hasMore: boolean;
        cursor: string | null;
      }>
    ) => {
      state.sessions = [...state.sessions, ...action.payload.sessions];
      state.hasMore = action.payload.hasMore;
      state.cursor = action.payload.cursor;
    },

    addSession: (state, action: PayloadAction<AgentSession>) => {
      // Prevent duplicate sessions
      if (state.sessions.some((s) => s.id === action.payload.id)) return;
      state.sessions.unshift(action.payload);
      state.totalCount += 1;
      // Add to recent sessions
      state.recentSessionIds = [
        action.payload.id,
        ...state.recentSessionIds.filter((id) => id !== action.payload.id),
      ].slice(0, 10);
    },

    // Atomic: add session + set as current in one dispatch (prevents race condition)
    createAndSelectSession: (state, action: PayloadAction<AgentSession>) => {
      if (!state.sessions.some((s) => s.id === action.payload.id)) {
        state.sessions.unshift(action.payload);
        state.totalCount += 1;
      }
      state.currentSessionId = action.payload.id;
      state.recentSessionIds = [
        action.payload.id,
        ...state.recentSessionIds.filter((id) => id !== action.payload.id),
      ].slice(0, 10);
    },

    updateSession: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<AgentSession> }>
    ) => {
      const index = state.sessions.findIndex((s) => s.id === action.payload.id);
      if (index !== -1) {
        state.sessions[index] = {
          ...state.sessions[index],
          ...action.payload.updates,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      state.totalCount = Math.max(0, state.totalCount - 1);
      state.selectedSessionIds = state.selectedSessionIds.filter((id) => id !== action.payload);
      state.recentSessionIds = state.recentSessionIds.filter((id) => id !== action.payload);
      if (state.currentSessionId === action.payload) {
        state.currentSessionId = null;
      }
    },

    archiveSession: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.status = "archived";
        session.updatedAt = new Date().toISOString();
      }
    },

    restoreSession: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.status = "active";
        session.updatedAt = new Date().toISOString();
      }
    },

    setCurrentSession: (state, action: PayloadAction<string | null>) => {
      state.currentSessionId = action.payload;
      // Add to recent sessions
      if (action.payload) {
        state.recentSessionIds = [
          action.payload,
          ...state.recentSessionIds.filter((id) => id !== action.payload),
        ].slice(0, 10);
      }
    },

    // Pinning and favorites
    toggleSessionPinned: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.isPinned = !session.isPinned;
      }
    },

    toggleSessionFavorite: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.isFavorite = !session.isFavorite;
      }
    },

    // Sharing
    setSessionSharing: (
      state,
      action: PayloadAction<{
        id: string;
        isShared: boolean;
        shareId?: string;
        sharedWith?: string[];
      }>
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) {
        session.isShared = action.payload.isShared;
        session.shareId = action.payload.shareId;
        session.sharedWith = action.payload.sharedWith;
      }
    },

    // Groups
    setGroups: (state, action: PayloadAction<SessionGroup[]>) => {
      state.groups = action.payload;
    },

    addGroup: (state, action: PayloadAction<SessionGroup>) => {
      state.groups.push(action.payload);
    },

    updateGroup: (state, action: PayloadAction<{ id: string; updates: Partial<SessionGroup> }>) => {
      const index = state.groups.findIndex((g) => g.id === action.payload.id);
      if (index !== -1) {
        state.groups[index] = { ...state.groups[index], ...action.payload.updates };
      }
    },

    removeGroup: (state, action: PayloadAction<string>) => {
      state.groups = state.groups.filter((g) => g.id !== action.payload);
    },

    addSessionToGroup: (state, action: PayloadAction<{ groupId: string; sessionId: string }>) => {
      const group = state.groups.find((g) => g.id === action.payload.groupId);
      if (group && !group.sessionIds.includes(action.payload.sessionId)) {
        group.sessionIds.push(action.payload.sessionId);
      }
    },

    removeSessionFromGroup: (
      state,
      action: PayloadAction<{ groupId: string; sessionId: string }>
    ) => {
      const group = state.groups.find((g) => g.id === action.payload.groupId);
      if (group) {
        group.sessionIds = group.sessionIds.filter((id) => id !== action.payload.sessionId);
      }
    },

    // Filtering and sorting
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },

    setFilterStatus: (state, action: PayloadAction<SessionStatus | "all">) => {
      state.filterStatus = action.payload;
    },

    setFilterMode: (state, action: PayloadAction<SessionMode | "all">) => {
      state.filterMode = action.payload;
    },

    setSortBy: (state, action: PayloadAction<SessionsState["sortBy"]>) => {
      state.sortBy = action.payload;
    },

    setSortOrder: (state, action: PayloadAction<"asc" | "desc">) => {
      state.sortOrder = action.payload;
    },

    setShowArchived: (state, action: PayloadAction<boolean>) => {
      state.showArchived = action.payload;
    },

    // Selection for bulk actions
    setSelectedSessions: (state, action: PayloadAction<string[]>) => {
      state.selectedSessionIds = action.payload;
    },

    toggleSessionSelection: (state, action: PayloadAction<string>) => {
      if (state.selectedSessionIds.includes(action.payload)) {
        state.selectedSessionIds = state.selectedSessionIds.filter((id) => id !== action.payload);
      } else {
        state.selectedSessionIds.push(action.payload);
      }
    },

    clearSessionSelection: (state) => {
      state.selectedSessionIds = [];
    },

    selectAllSessions: (state) => {
      state.selectedSessionIds = state.sessions.map((s) => s.id);
    },

    // Loading and error states
    setSessionsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setSessionsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Clear state
    clearSessionsState: (state) => {
      state.sessions = [];
      state.currentSessionId = null;
      state.groups = [];
      state.selectedSessionIds = [];
      state.hasMore = false;
      state.cursor = null;
      state.totalCount = 0;
      state.allCollaborators = [];
    },

    // Manus-specific reducers
    setIsSearchMode: (state, action: PayloadAction<boolean>) => {
      state.isSearchMode = action.payload;
    },

    setIsShareMode: (state, action: PayloadAction<boolean>) => {
      state.isShareMode = action.payload;
    },

    setIsShareFileMode: (state, action: PayloadAction<boolean>) => {
      state.isShareFileMode = action.payload;
    },

    setLoadSessionLoading: (state, action: PayloadAction<boolean>) => {
      state.loadSessionLoading = action.payload;
    },

    setLoadSessionDetailLoading: (state, action: PayloadAction<boolean>) => {
      state.loadSessionDetailLoading = action.payload;
    },

    setSwapSessionDetail: (
      state,
      action: PayloadAction<{ sessionId: string; detail: SwapSessionDetail }>
    ) => {
      state.swapSessionDetailMap[action.payload.sessionId] = action.payload.detail;
    },

    clearSwapSessionDetail: (state, action: PayloadAction<string>) => {
      delete state.swapSessionDetailMap[action.payload];
    },

    setLoadTopSegmentsLoading: (state, action: PayloadAction<boolean>) => {
      state.loadTopSegmentsLoading = action.payload;
    },

    setLoadBottomSegmentsLoading: (state, action: PayloadAction<boolean>) => {
      state.loadBottomSegmentsLoading = action.payload;
    },

    setSegmentEndpoints: (
      state,
      action: PayloadAction<{ sessionId: string; endpoints: SegmentEndpoint }>
    ) => {
      state.segmentEndpoints[action.payload.sessionId] = action.payload.endpoints;
    },

    setScheduledTaskSessions: (state, action: PayloadAction<string[]>) => {
      state.scheduledTaskSessions = action.payload;
    },

    addScheduledTaskSession: (state, action: PayloadAction<string>) => {
      if (!state.scheduledTaskSessions.includes(action.payload)) {
        state.scheduledTaskSessions.push(action.payload);
      }
    },

    removeScheduledTaskSession: (state, action: PayloadAction<string>) => {
      state.scheduledTaskSessions = state.scheduledTaskSessions.filter(
        (id) => id !== action.payload
      );
    },

    setSharingSessionUid: (state, action: PayloadAction<string | null>) => {
      state.sharingSessionUid = action.payload;
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility
    builder.addCase("sessions/fetchSessionsStart", (state) => {
      state.isLoading = true;
    });
    builder.addCase("sessions/fetchSessionsSuccess", (state, action: PayloadAction<any>) => {
      const payload = action.payload ?? {};
      const sessions = payload.sessions ?? payload ?? [];
      state.sessions = sessions;
      if (typeof payload.hasMore === "boolean") state.hasMore = payload.hasMore;
      if ("cursor" in payload) state.cursor = payload.cursor ?? null;
      if (typeof payload.totalCount === "number") state.totalCount = payload.totalCount;
      state.isLoading = false;
      state.error = null;
    });
    builder.addCase("sessions/setAllCollaborators", (state, action: PayloadAction<string[]>) => {
      state.allCollaborators = action.payload ?? [];
    });
  },
});

export const {
  setSessions,
  appendSessions,
  addSession,
  createAndSelectSession,
  updateSession,
  removeSession,
  archiveSession,
  restoreSession,
  setCurrentSession,
  toggleSessionPinned,
  toggleSessionFavorite,
  setSessionSharing,
  setGroups,
  addGroup,
  updateGroup,
  removeGroup,
  addSessionToGroup,
  removeSessionFromGroup,
  setSearchQuery,
  setFilterStatus,
  setFilterMode,
  setSortBy,
  setSortOrder,
  setShowArchived,
  setSelectedSessions,
  toggleSessionSelection,
  clearSessionSelection,
  selectAllSessions,
  setSessionsLoading,
  setSessionsError,
  clearSessionsState,
  // Manus-specific
  setIsSearchMode,
  setIsShareMode,
  setIsShareFileMode,
  setLoadSessionLoading,
  setLoadSessionDetailLoading,
  setSwapSessionDetail,
  clearSwapSessionDetail,
  setLoadTopSegmentsLoading,
  setLoadBottomSegmentsLoading,
  setSegmentEndpoints,
  setScheduledTaskSessions,
  addScheduledTaskSession,
  removeScheduledTaskSession,
  setSharingSessionUid,
} = sessionsSlice.actions;

export default sessionsSlice.reducer;
