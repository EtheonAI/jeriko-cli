"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  setUnreadCounts,
  setPreferences,
  updatePreference,
  setLoading,
  setUpdatingPreferences,
  setHasNewNotifications,
  setNotificationsError,
  setFilter,
  clearNotifications,
  type Notification,
  type NotificationPreferences,
  type NotificationType,
} from "../slices/notifications.slice";
import { getTrpcClient } from "@/lib/trpc/vanilla";

/**
 * Notifications Hook - Integrates WebSocket (real-time) and vanilla tRPC (API) with notifications slice
 *
 * Real-time events (WebSocket middleware):
 * - notification:new -> addNotification (already handled in websocket.middleware.ts)
 * - notification:read -> markAsRead (already handled in websocket.middleware.ts)
 */
export function useNotificationsIntegration() {
  const dispatch = useAppDispatch();
  const notificationsState = useAppSelector((state) => state.notifications);
  const wsStatus = useAppSelector((state) => state.websocket.status);
  const hasFetchedRef = useRef(false);

  // Fetch notifications on mount (if not already loaded by ReduxDataLoader)
  const fetchNotifications = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      const [list, unreadByType] = await Promise.all([
        getTrpcClient().notifications.list.query({ limit: 50, offset: 0, unreadOnly: false }),
        getTrpcClient().notifications.getUnreadCountsByType.query(),
      ]);
      const normalized: Notification[] = ((list as any).items ?? []).map((n: any) => ({
        ...n,
        isArchived: n.isArchived ?? false,
        isRead: n.isRead ?? false,
        priority: n.priority ?? "normal",
        createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date(n.createdAt).toISOString(),
      }));
      dispatch(
        setNotifications({
          notifications: normalized,
          hasMore: (list as any).hasMore ?? false,
          cursor: null,
        })
      );
      if (unreadByType) {
        const total = Object.values(unreadByType).reduce((sum, v) => sum + (v as number), 0);
        dispatch(setUnreadCounts({ total, byType: unreadByType as any }));
      }
      hasFetchedRef.current = true;
    } catch (err: any) {
      dispatch(setNotificationsError(err?.message || "Failed to load notifications"));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch]);

  // Fetch notification preferences
  const fetchPreferences = useCallback(async () => {
    try {
      const prefs = await getTrpcClient().notifications.getPreferences.query();
      if (prefs) {
        dispatch(setPreferences(prefs as any));
      }
    } catch {
      // Non-critical
    }
  }, [dispatch]);

  // Mark notification as read — optimistic + API
  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      dispatch(markAsRead(notificationId));
      try {
        await getTrpcClient().notifications.markAsRead.mutate({ id: notificationId });
      } catch (error: any) {
        await fetchNotifications();
        dispatch(setNotificationsError(error?.message || "Failed to mark as read"));
      }
    },
    [dispatch, fetchNotifications]
  );

  // Mark all as read — optimistic + API
  const markAllNotificationsAsRead = useCallback(async () => {
    dispatch(markAllAsRead());
    try {
      await getTrpcClient().notifications.markAllAsRead.mutate();
    } catch (error: any) {
      await fetchNotifications();
      dispatch(setNotificationsError(error?.message || "Failed to mark all as read"));
    }
  }, [dispatch, fetchNotifications]);

  // Archive notification — state only (no API endpoint)
  const archiveNotificationHandler = useCallback(
    (notificationId: string) => {
      dispatch(archiveNotification(notificationId));
    },
    [dispatch]
  );

  // Delete notification — optimistic + API
  const deleteNotificationHandler = useCallback(
    async (notificationId: string) => {
      dispatch(deleteNotification(notificationId));
      try {
        await getTrpcClient().notifications.delete.mutate({ id: notificationId });
      } catch (error: any) {
        await fetchNotifications();
        dispatch(setNotificationsError(error?.message || "Failed to delete notification"));
      }
    },
    [dispatch, fetchNotifications]
  );

  // Update notification preferences — optimistic + API
  const updateNotificationPreferences = useCallback(
    async (preferences: Partial<NotificationPreferences>) => {
      dispatch(setUpdatingPreferences(true));
      const prevPreferences = notificationsState.preferences;
      dispatch(updatePreference(preferences));
      try {
        await getTrpcClient().notifications.updatePreferences.mutate(preferences as any);
        dispatch(setUpdatingPreferences(false));
      } catch (error: any) {
        if (prevPreferences) dispatch(setPreferences(prevPreferences));
        dispatch(setNotificationsError(error?.message || "Failed to update preferences"));
      }
    },
    [dispatch, notificationsState.preferences]
  );

  const setNotificationFilter = useCallback(
    (filter: { type?: NotificationType | "all"; showRead?: boolean; showArchived?: boolean }) => {
      dispatch(setFilter(filter));
    },
    [dispatch]
  );

  const acknowledgeNewNotifications = useCallback(() => {
    dispatch(setHasNewNotifications(false));
  }, [dispatch]);

  const clearAllNotifications = useCallback(() => {
    dispatch(clearNotifications());
  }, [dispatch]);

  // Auto-fetch on mount if not already loaded
  useEffect(() => {
    if (hasFetchedRef.current) return;
    if (notificationsState.notifications.length > 0) {
      hasFetchedRef.current = true;
      return;
    }
    fetchNotifications();
  }, [notificationsState.notifications.length, fetchNotifications]);

  // Filter notifications
  const filteredNotifications = notificationsState.notifications.filter((n: Notification) => {
    const { type, showRead, showArchived } = notificationsState.filter;
    if (type !== "all" && n.type !== type) return false;
    if (!showRead && n.isRead) return false;
    if (!showArchived && n.isArchived) return false;
    return true;
  });

  return {
    // State
    notifications: filteredNotifications,
    allNotifications: notificationsState.notifications,
    unreadCount: notificationsState.unreadCount,
    unreadByType: notificationsState.unreadByType,
    preferences: notificationsState.preferences,
    hasMore: notificationsState.hasMore,
    hasNewNotifications: notificationsState.hasNewNotifications,
    filter: notificationsState.filter,
    isLoading: notificationsState.isLoading,
    isLoadingMore: notificationsState.isLoadingMore,
    isUpdatingPreferences: notificationsState.isUpdatingPreferences,
    error: notificationsState.error,
    isConnected: wsStatus === "connected",
    // Actions
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    archive: archiveNotificationHandler,
    delete: deleteNotificationHandler,
    updatePreferences: updateNotificationPreferences,
    setFilter: setNotificationFilter,
    acknowledgeNew: acknowledgeNewNotifications,
    clear: clearAllNotifications,
    refresh: fetchNotifications,
  };
}

export default useNotificationsIntegration;
