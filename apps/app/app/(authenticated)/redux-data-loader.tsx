"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch } from "@/lib/store/hooks";
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

  // Sessions are fetched by the sidebar via tRPC useQuery — no need to duplicate here.

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
