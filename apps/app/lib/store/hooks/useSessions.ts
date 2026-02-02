"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setSessions,
  appendSessions,
  addSession,
  updateSession,
  removeSession,
  archiveSession,
  restoreSession,
  setCurrentSession,
  toggleSessionPinned,
  toggleSessionFavorite,
  setSessionSharing,
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
  type AgentSession,
  type SessionStatus,
  type SessionMode,
  type SessionsState,
} from "../slices/sessions.slice";
import {
  useGetSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useDeleteSessionMutation,
} from "../api/api.slice";
import { wsJoinRoom, wsLeaveRoom } from "../middleware/websocket.middleware";

/**
 * Sessions Hook - Integrates RTK Query and WebSocket with sessions slice
 *
 * Action Triggers:
 * - fetchSessions: API Call (RTK Query)
 * - createSession: API Call (RTK Query) + WebSocket join
 * - updateSession: API Call (RTK Query)
 * - deleteSession: API Call (RTK Query) + WebSocket leave
 * - setCurrentSession: State + WebSocket join/leave
 * - archiveSession: API Call (RTK Query)
 * - setSearchQuery/setFilter*: State only
 * - selectSession/toggleSelection: State only
 *
 * Real-time events (WebSocket):
 * - session:new -> addSession
 * - session:update -> updateSession
 */
export function useSessionsIntegration() {
  const dispatch = useAppDispatch();
  const sessionsState = useAppSelector((state) => state.sessions);
  const { status: wsStatus } = useAppSelector((state) => state.websocket);

  // RTK Query hooks
  const {
    data: sessionsData,
    isLoading: isFetchingSessions,
    refetch: refetchSessions,
  } = useGetSessionsQuery();

  const [createSessionMutation, { isLoading: isCreating }] = useCreateSessionMutation();
  const [updateSessionMutation, { isLoading: isUpdating }] = useUpdateSessionMutation();
  const [deleteSessionMutation, { isLoading: isDeleting }] = useDeleteSessionMutation();

  // Sync sessions from RTK Query to Redux state
  useEffect(() => {
    if (sessionsData) {
      dispatch(
        setSessions({
          sessions: sessionsData,
          hasMore: false, // Pagination can be added later
          cursor: null,
          totalCount: sessionsData.length,
        })
      );
    }
  }, [sessionsData, dispatch]);

  // Sync loading state
  useEffect(() => {
    dispatch(setSessionsLoading(isFetchingSessions));
  }, [isFetchingSessions, dispatch]);

  // Join current session room when it changes
  useEffect(() => {
    if (sessionsState.currentSessionId && wsStatus === "connected") {
      dispatch(wsJoinRoom(`session:${sessionsState.currentSessionId}`));

      return () => {
        dispatch(wsLeaveRoom(`session:${sessionsState.currentSessionId}`));
      };
    }
  }, [sessionsState.currentSessionId, wsStatus, dispatch]);

  /**
   * Create a new session
   * Trigger: API Call + WebSocket join
   */
  const createSession = useCallback(
    async (title?: string) => {
      try {
        const result = await createSessionMutation({ title }).unwrap();
        // Join the new session room
        if (wsStatus === "connected") {
          dispatch(wsJoinRoom(`session:${result.id}`));
        }
        dispatch(setCurrentSession(result.id));
        return { success: true, session: result };
      } catch (error: any) {
        dispatch(setSessionsError(error?.message || "Failed to create session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, createSessionMutation, wsStatus]
  );

  /**
   * Update an existing session
   * Trigger: API Call
   */
  const updateSessionHandler = useCallback(
    async (sessionId: string, updates: Partial<AgentSession>) => {
      // Optimistic update
      dispatch(updateSession({ id: sessionId, updates }));

      try {
        await updateSessionMutation({ id: sessionId, updates }).unwrap();
        return { success: true };
      } catch (error: any) {
        // Revert on error
        refetchSessions();
        dispatch(setSessionsError(error?.message || "Failed to update session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, updateSessionMutation, refetchSessions]
  );

  /**
   * Delete a session
   * Trigger: API Call + WebSocket leave
   */
  const deleteSessionHandler = useCallback(
    async (sessionId: string) => {
      // Leave room first
      if (wsStatus === "connected") {
        dispatch(wsLeaveRoom(`session:${sessionId}`));
      }

      // Optimistic update
      dispatch(removeSession(sessionId));

      try {
        await deleteSessionMutation(sessionId).unwrap();
        return { success: true };
      } catch (error: any) {
        // Revert on error
        refetchSessions();
        dispatch(setSessionsError(error?.message || "Failed to delete session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, deleteSessionMutation, refetchSessions, wsStatus]
  );

  /**
   * Archive a session
   * Trigger: API Call
   */
  const archiveSessionHandler = useCallback(
    async (sessionId: string) => {
      // Optimistic update
      dispatch(archiveSession(sessionId));

      try {
        await updateSessionMutation({
          id: sessionId,
          updates: { status: "archived" as SessionStatus },
        }).unwrap();
        return { success: true };
      } catch (error: any) {
        // Revert on error
        refetchSessions();
        dispatch(setSessionsError(error?.message || "Failed to archive session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, updateSessionMutation, refetchSessions]
  );

  /**
   * Restore an archived session
   * Trigger: API Call
   */
  const restoreSessionHandler = useCallback(
    async (sessionId: string) => {
      // Optimistic update
      dispatch(restoreSession(sessionId));

      try {
        await updateSessionMutation({
          id: sessionId,
          updates: { status: "active" as SessionStatus },
        }).unwrap();
        return { success: true };
      } catch (error: any) {
        // Revert on error
        refetchSessions();
        dispatch(setSessionsError(error?.message || "Failed to restore session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, updateSessionMutation, refetchSessions]
  );

  /**
   * Set current session
   * Trigger: State + WebSocket room management
   */
  const selectSession = useCallback(
    (sessionId: string | null) => {
      dispatch(setCurrentSession(sessionId));
    },
    [dispatch]
  );

  /**
   * Toggle session pinned status
   * Trigger: API Call + State
   */
  const togglePinned = useCallback(
    async (sessionId: string) => {
      const session = sessionsState.sessions.find((s: AgentSession) => s.id === sessionId);
      if (!session) return { success: false };

      // Optimistic update
      dispatch(toggleSessionPinned(sessionId));

      try {
        await updateSessionMutation({
          id: sessionId,
          updates: { isPinned: !session.isPinned },
        }).unwrap();
        return { success: true };
      } catch (error: any) {
        // Revert on error
        dispatch(toggleSessionPinned(sessionId));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, updateSessionMutation, sessionsState.sessions]
  );

  /**
   * Toggle session favorite status
   * Trigger: API Call + State
   */
  const toggleFavorite = useCallback(
    async (sessionId: string) => {
      const session = sessionsState.sessions.find((s: AgentSession) => s.id === sessionId);
      if (!session) return { success: false };

      // Optimistic update
      dispatch(toggleSessionFavorite(sessionId));

      try {
        await updateSessionMutation({
          id: sessionId,
          updates: { isFavorite: !session.isFavorite },
        }).unwrap();
        return { success: true };
      } catch (error: any) {
        // Revert on error
        dispatch(toggleSessionFavorite(sessionId));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, updateSessionMutation, sessionsState.sessions]
  );

  /**
   * Filter and sort setters
   * Trigger: State only
   */
  const setSearch = useCallback(
    (query: string) => {
      dispatch(setSearchQuery(query));
    },
    [dispatch]
  );

  const setStatusFilter = useCallback(
    (status: SessionStatus | "all") => {
      dispatch(setFilterStatus(status));
    },
    [dispatch]
  );

  const setModeFilter = useCallback(
    (mode: SessionMode | "all") => {
      dispatch(setFilterMode(mode));
    },
    [dispatch]
  );

  const setSorting = useCallback(
    (sortBy: SessionsState["sortBy"], sortOrder: "asc" | "desc") => {
      dispatch(setSortBy(sortBy));
      dispatch(setSortOrder(sortOrder));
    },
    [dispatch]
  );

  const toggleShowArchived = useCallback(
    (show: boolean) => {
      dispatch(setShowArchived(show));
    },
    [dispatch]
  );

  /**
   * Selection actions
   * Trigger: State only
   */
  const toggleSelection = useCallback(
    (sessionId: string) => {
      dispatch(toggleSessionSelection(sessionId));
    },
    [dispatch]
  );

  const selectAll = useCallback(() => {
    dispatch(selectAllSessions());
  }, [dispatch]);

  const clearSelection = useCallback(() => {
    dispatch(clearSessionSelection());
  }, [dispatch]);

  /**
   * Refresh sessions from server
   * Trigger: API Call
   */
  const refresh = useCallback(() => {
    refetchSessions();
  }, [refetchSessions]);

  // Filter sessions based on current filters
  const filteredSessions = sessionsState.sessions.filter((session: AgentSession) => {
    // Search filter
    if (
      sessionsState.searchQuery &&
      !session.title?.toLowerCase().includes(sessionsState.searchQuery.toLowerCase())
    ) {
      return false;
    }

    // Status filter
    if (sessionsState.filterStatus !== "all" && session.status !== sessionsState.filterStatus) {
      return false;
    }

    // Mode filter
    if (sessionsState.filterMode !== "all" && session.mode !== sessionsState.filterMode) {
      return false;
    }

    // Archived filter
    if (!sessionsState.showArchived && session.status === "archived") {
      return false;
    }

    return true;
  });

  // Sort sessions
  const sortedSessions = [...filteredSessions].sort((a, b) => {
    const { sortBy, sortOrder } = sessionsState;
    let comparison = 0;

    switch (sortBy) {
      case "title":
        comparison = (a.title || "").localeCompare(b.title || "");
        break;
      case "createdAt":
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case "updatedAt":
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
      case "lastActivityAt":
        comparison =
          new Date(a.lastActivityAt || a.updatedAt).getTime() -
          new Date(b.lastActivityAt || b.updatedAt).getTime();
        break;
    }

    return sortOrder === "desc" ? -comparison : comparison;
  });

  // Get current session
  const currentSession = sessionsState.currentSessionId
    ? sessionsState.sessions.find((s: AgentSession) => s.id === sessionsState.currentSessionId) || null
    : null;

  return {
    // State
    sessions: sortedSessions,
    allSessions: sessionsState.sessions,
    currentSession,
    currentSessionId: sessionsState.currentSessionId,
    recentSessionIds: sessionsState.recentSessionIds,
    selectedSessionIds: sessionsState.selectedSessionIds,
    groups: sessionsState.groups,
    hasMore: sessionsState.hasMore,
    totalCount: sessionsState.totalCount,
    isLoading: sessionsState.isLoading || isCreating || isUpdating || isDeleting,
    error: sessionsState.error,
    isConnected: wsStatus === "connected",

    // Filter state
    searchQuery: sessionsState.searchQuery,
    filterStatus: sessionsState.filterStatus,
    filterMode: sessionsState.filterMode,
    sortBy: sessionsState.sortBy,
    sortOrder: sessionsState.sortOrder,
    showArchived: sessionsState.showArchived,

    // Actions
    createSession,
    updateSession: updateSessionHandler,
    deleteSession: deleteSessionHandler,
    archiveSession: archiveSessionHandler,
    restoreSession: restoreSessionHandler,
    selectSession,
    togglePinned,
    toggleFavorite,
    setSearch,
    setStatusFilter,
    setModeFilter,
    setSorting,
    toggleShowArchived,
    toggleSelection,
    selectAll,
    clearSelection,
    refresh,
  };
}

export default useSessionsIntegration;
