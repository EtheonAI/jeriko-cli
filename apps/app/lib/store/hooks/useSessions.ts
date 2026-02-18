"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setSessions,
  addSession,
  updateSession,
  removeSession,
  archiveSession,
  restoreSession,
  setCurrentSession,
  toggleSessionPinned,
  toggleSessionFavorite,
  setSessionsLoading,
  setSessionsError,
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
  type AgentSession,
  type SessionStatus,
  type SessionMode,
  type SessionsState,
} from "../slices/sessions.slice";
import { wsJoinRoom, wsLeaveRoom } from "../middleware/websocket.middleware";
import { getTrpcClient } from "@/lib/trpc/vanilla";

function serializeDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(serializeDates) as unknown as T;
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = serializeDates(value);
    }
    return result as T;
  }
  return obj;
}

/**
 * Sessions Hook - Integrates vanilla tRPC and WebSocket with sessions slice
 *
 * Real-time events (WebSocket middleware):
 * - session:new -> addSession (already handled in websocket.middleware.ts)
 * - session:update -> updateSession (already handled in websocket.middleware.ts)
 */
export function useSessionsIntegration() {
  const dispatch = useAppDispatch();
  const sessionsState = useAppSelector((state) => state.sessions);
  const wsStatus = useAppSelector((state) => state.websocket.status);
  const hasFetchedRef = useRef(false);

  // Fetch sessions if not already loaded by ReduxDataLoader
  const fetchSessions = useCallback(async () => {
    dispatch(setSessionsLoading(true));
    try {
      const sessions = await getTrpcClient().sessions.list.query();
      const serialized = serializeDates(sessions);
      dispatch(
        setSessions({
          sessions: serialized as any,
          hasMore: false,
          cursor: null,
          totalCount: (serialized as any[]).length,
        })
      );
      hasFetchedRef.current = true;
    } catch (err: any) {
      dispatch(setSessionsError(err?.message || "Failed to load sessions"));
    }
  }, [dispatch]);

  // Auto-fetch on mount if not already loaded
  useEffect(() => {
    if (hasFetchedRef.current) return;
    if (sessionsState.sessions.length > 0) {
      hasFetchedRef.current = true;
      return;
    }
    fetchSessions();
  }, [sessionsState.sessions.length, fetchSessions]);

  // Join current session room when it changes
  useEffect(() => {
    if (sessionsState.currentSessionId && wsStatus === "connected") {
      dispatch(wsJoinRoom(`session:${sessionsState.currentSessionId}`));
      return () => {
        dispatch(wsLeaveRoom(`session:${sessionsState.currentSessionId}`));
      };
    }
  }, [sessionsState.currentSessionId, wsStatus, dispatch]);

  // Create session
  const createSession = useCallback(
    async (title?: string) => {
      try {
        const result = await getTrpcClient().sessions.create.mutate({ title } as any);
        if (result) {
          dispatch(addSession(serializeDates(result) as any));
          if (wsStatus === "connected") {
            dispatch(wsJoinRoom(`session:${(result as any).id}`));
          }
          dispatch(setCurrentSession((result as any).id));
        }
        return { success: true, session: result };
      } catch (error: any) {
        dispatch(setSessionsError(error?.message || "Failed to create session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, wsStatus]
  );

  // Update session — optimistic + API
  const updateSessionHandler = useCallback(
    async (sessionId: string, updates: Partial<AgentSession>) => {
      dispatch(updateSession({ id: sessionId, updates }));
      try {
        await getTrpcClient().sessions.update.mutate({ id: sessionId, ...updates } as any);
        return { success: true };
      } catch (error: any) {
        await fetchSessions();
        dispatch(setSessionsError(error?.message || "Failed to update session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, fetchSessions]
  );

  // Delete session — optimistic + API
  const deleteSessionHandler = useCallback(
    async (sessionId: string) => {
      if (wsStatus === "connected") {
        dispatch(wsLeaveRoom(`session:${sessionId}`));
      }
      dispatch(removeSession(sessionId));
      try {
        await getTrpcClient().sessions.delete.mutate({ id: sessionId });
        return { success: true };
      } catch (error: any) {
        await fetchSessions();
        dispatch(setSessionsError(error?.message || "Failed to delete session"));
        return { success: false, error: error?.message };
      }
    },
    [dispatch, fetchSessions, wsStatus]
  );

  // Archive session
  const archiveSessionHandler = useCallback(
    async (sessionId: string) => {
      dispatch(archiveSession(sessionId));
      try {
        await getTrpcClient().sessions.update.mutate({ id: sessionId, status: "archived" } as any);
        return { success: true };
      } catch (error: any) {
        await fetchSessions();
        return { success: false, error: error?.message };
      }
    },
    [dispatch, fetchSessions]
  );

  // Restore session
  const restoreSessionHandler = useCallback(
    async (sessionId: string) => {
      dispatch(restoreSession(sessionId));
      try {
        await getTrpcClient().sessions.update.mutate({ id: sessionId, status: "active" } as any);
        return { success: true };
      } catch (error: any) {
        await fetchSessions();
        return { success: false, error: error?.message };
      }
    },
    [dispatch, fetchSessions]
  );

  const selectSession = useCallback(
    (sessionId: string | null) => {
      dispatch(setCurrentSession(sessionId));
    },
    [dispatch]
  );

  const togglePinned = useCallback(
    async (sessionId: string) => {
      const session = sessionsState.sessions.find((s: AgentSession) => s.id === sessionId);
      if (!session) return { success: false };
      dispatch(toggleSessionPinned(sessionId));
      try {
        await getTrpcClient().sessions.update.mutate({
          id: sessionId,
          metadata: { isPinned: !session.isPinned },
        } as any);
        return { success: true };
      } catch {
        dispatch(toggleSessionPinned(sessionId));
        return { success: false };
      }
    },
    [dispatch, sessionsState.sessions]
  );

  const toggleFavorite = useCallback(
    async (sessionId: string) => {
      const session = sessionsState.sessions.find((s: AgentSession) => s.id === sessionId);
      if (!session) return { success: false };
      dispatch(toggleSessionFavorite(sessionId));
      try {
        await getTrpcClient().sessions.update.mutate({
          id: sessionId,
          metadata: { isFavorite: !session.isFavorite },
        } as any);
        return { success: true };
      } catch {
        dispatch(toggleSessionFavorite(sessionId));
        return { success: false };
      }
    },
    [dispatch, sessionsState.sessions]
  );

  // Filter and sort setters
  const setSearch = useCallback((query: string) => dispatch(setSearchQuery(query)), [dispatch]);
  const setStatusFilter = useCallback((status: SessionStatus | "all") => dispatch(setFilterStatus(status)), [dispatch]);
  const setModeFilter = useCallback((mode: SessionMode | "all") => dispatch(setFilterMode(mode)), [dispatch]);
  const setSorting = useCallback(
    (sortBy: SessionsState["sortBy"], sortOrder: "asc" | "desc") => {
      dispatch(setSortBy(sortBy));
      dispatch(setSortOrder(sortOrder));
    },
    [dispatch]
  );
  const toggleShowArchived = useCallback((show: boolean) => dispatch(setShowArchived(show)), [dispatch]);
  const toggleSelection = useCallback((sessionId: string) => dispatch(toggleSessionSelection(sessionId)), [dispatch]);
  const selectAll = useCallback(() => dispatch(selectAllSessions()), [dispatch]);
  const clearSelection = useCallback(() => dispatch(clearSessionSelection()), [dispatch]);

  // Filtered sessions
  const filteredSessions = useMemo(
    () =>
      sessionsState.sessions.filter((session: AgentSession) => {
        if (sessionsState.searchQuery && !session.title?.toLowerCase().includes(sessionsState.searchQuery.toLowerCase())) return false;
        if (sessionsState.filterStatus !== "all" && session.status !== sessionsState.filterStatus) return false;
        if (sessionsState.filterMode !== "all" && session.mode !== sessionsState.filterMode) return false;
        if (!sessionsState.showArchived && session.status === "archived") return false;
        return true;
      }),
    [sessionsState.sessions, sessionsState.searchQuery, sessionsState.filterStatus, sessionsState.filterMode, sessionsState.showArchived]
  );

  // Sorted sessions
  const sortedSessions = useMemo(() => {
    const { sortBy, sortOrder } = sessionsState;
    return filteredSessions.toSorted((a: AgentSession, b: AgentSession) => {
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
          comparison = new Date(a.lastActivityAt || a.updatedAt).getTime() - new Date(b.lastActivityAt || b.updatedAt).getTime();
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });
  }, [filteredSessions, sessionsState.sortBy, sessionsState.sortOrder]);

  const currentSession = sessionsState.currentSessionId
    ? sessionsState.sessions.find((s: AgentSession) => s.id === sessionsState.currentSessionId) || null
    : null;

  return {
    sessions: sortedSessions,
    allSessions: sessionsState.sessions,
    currentSession,
    currentSessionId: sessionsState.currentSessionId,
    recentSessionIds: sessionsState.recentSessionIds,
    selectedSessionIds: sessionsState.selectedSessionIds,
    groups: sessionsState.groups,
    hasMore: sessionsState.hasMore,
    totalCount: sessionsState.totalCount,
    isLoading: sessionsState.isLoading,
    error: sessionsState.error,
    isConnected: wsStatus === "connected",
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
    refresh: fetchSessions,
  };
}

export default useSessionsIntegration;
