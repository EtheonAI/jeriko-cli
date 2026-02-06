"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setSessions,
  setSessionsError,
  setSessionsLoading,
  type AgentSession,
} from "@/lib/store/slices/sessions.slice";
import {
  setNotifications,
  setNotificationsError,
  setLoading as setNotificationsLoading,
  setUnreadCounts,
  type Notification,
} from "@/lib/store/slices/notifications.slice";
import { setUser, type User } from "@/lib/store/slices/auth.slice";
import { useSession } from "@repo/auth/client";
import { getTrpcClient } from "@/lib/trpc/vanilla";

export function ReduxDataLoader() {
  const dispatch = useAppDispatch();
  const existingSessions = useAppSelector((state) => state.sessions.sessions);
  const existingSessionsRef = useRef(existingSessions);
  const hasLoadedSessionsRef = useRef(false);
  const hasLoadedNotificationsRef = useRef(false);
  const hasInitializedAuthRef = useRef(false);

  // Sync better-auth session into Redux auth slice
  const { data: session, isPending } = useSession();

  useEffect(() => {
    if (isPending || hasInitializedAuthRef.current) return;
    if (!session?.user) return;
    hasInitializedAuthRef.current = true;

    const user: User = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name || null,
      image: session.user.image || null,
      role: "user",
      emailVerified: session.user.emailVerified,
      createdAt: session.user.createdAt?.toISOString(),
    };
    dispatch(setUser(user));
  }, [session, isPending, dispatch]);

  useEffect(() => {
    existingSessionsRef.current = existingSessions;
  }, [existingSessions]);

  // Load sessions
  useEffect(() => {
    if (hasLoadedSessionsRef.current) return;
    hasLoadedSessionsRef.current = true;

    let cancelled = false;
    dispatch(setSessionsLoading(true));

    getTrpcClient()
      .sessions.list.query()
      .then((sessions) => {
        if (cancelled) return;

        const normalized: AgentSession[] = sessions.map((s: any) => ({
          ...s,
          createdAt:
            typeof s.createdAt === "string" ? s.createdAt : new Date(s.createdAt).toISOString(),
          updatedAt:
            typeof s.updatedAt === "string" ? s.updatedAt : new Date(s.updatedAt).toISOString(),
          mode: s.mode ?? "chat",
          isShared: s.isShared ?? false,
          status: s.status ?? "active",
        }));

        // Merge with any sessions created before fetch resolved (e.g. optimistic adds)
        const existing = existingSessionsRef.current ?? [];
        const existingIds = new Set(normalized.map((s) => s.id));
        const merged = [...normalized, ...existing.filter((s) => !existingIds.has(s.id))].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        dispatch(
          setSessions({
            sessions: merged,
            hasMore: false,
            cursor: null,
            totalCount: merged.length,
          })
        );
      })
      .catch((error: any) => {
        if (cancelled) return;
        hasLoadedSessionsRef.current = false; // Allow retry on failure
        dispatch(setSessionsError(error?.message || "Failed to load sessions"));
      })
      .finally(() => {
        if (cancelled) return;
        dispatch(setSessionsLoading(false));
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Load notifications
  useEffect(() => {
    if (hasLoadedNotificationsRef.current) return;
    hasLoadedNotificationsRef.current = true;

    let cancelled = false;
    dispatch(setNotificationsLoading(true));

    const client = getTrpcClient();
    Promise.all([
      client.notifications.list.query({ limit: 50, offset: 0, unreadOnly: false }),
      client.notifications.getUnreadCountsByType.query(),
    ])
      .then(([list, unreadByType]) => {
        if (cancelled) return;

        const normalized: Notification[] = (list.items ?? []).map((n: any) => ({
          ...n,
          isArchived: n.isArchived ?? false,
          isRead: n.isRead ?? false,
          priority: n.priority ?? "normal",
          createdAt:
            typeof n.createdAt === "string" ? n.createdAt : new Date(n.createdAt).toISOString(),
        }));
        dispatch(
          setNotifications({
            notifications: normalized,
            hasMore: list.hasMore ?? false,
            cursor: null,
          })
        );
        if (unreadByType) {
          const total = Object.values(unreadByType).reduce(
            (sum, value) => sum + (value as number),
            0
          );
          dispatch(setUnreadCounts({ total, byType: unreadByType as any }));
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        hasLoadedNotificationsRef.current = false; // Allow retry on failure
        dispatch(setNotificationsError(error?.message || "Failed to load notifications"));
      })
      .finally(() => {
        if (cancelled) return;
        dispatch(setNotificationsLoading(false));
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  return null;
}
