"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "../hooks";
import {
  setNotifications,
  appendNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  deleteNotification,
  setUnreadCounts,
  setPreferences,
  updatePreference,
  setLoading,
  setLoadingMore,
  setUpdatingPreferences,
  setHasNewNotifications,
  setNotificationsError,
  setFilter,
  clearNotifications,
  type Notification,
  type NotificationPreferences,
  type NotificationType,
} from "../slices/notifications.slice";
import {
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useDeleteNotificationMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
} from "../api/api.slice";
import { wsSend } from "../middleware/websocket.middleware";

/**
 * Notifications Hook - Integrates WebSocket (real-time) and RTK Query (API) with notifications slice
 *
 * Action Triggers:
 * - fetchNotifications: API Call (RTK Query)
 * - fetchMore: API Call (RTK Query)
 * - markAsRead: API Call (RTK Query) + State
 * - markAllAsRead: API Call (RTK Query) + State
 * - deleteNotification: API Call (RTK Query) + State
 * - updatePreferences: API Call (RTK Query) + State
 * - addNotification: State only (from WebSocket)
 * - setFilter: State only
 *
 * Real-time events (WebSocket):
 * - notification:new -> addNotification
 * - notification:read -> markAsRead
 */
export function useNotificationsIntegration() {
  const dispatch = useAppDispatch();
  const notificationsState = useAppSelector((state) => state.notifications);
  const { status: wsStatus } = useAppSelector((state) => state.websocket);

  // RTK Query hooks
  const {
    data: notificationsData,
    isLoading: isFetchingNotifications,
    refetch: refetchNotifications,
  } = useGetNotificationsQuery();

  const {
    data: preferencesData,
    isLoading: isFetchingPreferences,
  } = useGetNotificationPreferencesQuery();

  const [markReadMutation] = useMarkNotificationAsReadMutation();
  const [markAllReadMutation] = useMarkAllNotificationsAsReadMutation();
  const [deleteNotificationMutation] = useDeleteNotificationMutation();
  const [updatePreferencesMutation] = useUpdateNotificationPreferencesMutation();

  // Sync RTK Query data with Redux state
  useEffect(() => {
    if (notificationsData) {
      dispatch(
        setNotifications({
          notifications: notificationsData.notifications,
          hasMore: notificationsData.hasMore,
          cursor: notificationsData.cursor,
        })
      );
    }
  }, [notificationsData, dispatch]);

  // Sync preferences
  useEffect(() => {
    if (preferencesData) {
      dispatch(setPreferences(preferencesData));
    }
  }, [preferencesData, dispatch]);

  // Sync loading state
  useEffect(() => {
    dispatch(setLoading(isFetchingNotifications));
  }, [isFetchingNotifications, dispatch]);

  /**
   * Mark notification as read
   * Trigger: API Call + State
   */
  const markNotificationAsRead = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      dispatch(markAsRead(notificationId));

      try {
        await markReadMutation(notificationId).unwrap();
      } catch (error: any) {
        // Revert on error - refetch to get accurate state
        refetchNotifications();
        dispatch(setNotificationsError(error?.message || "Failed to mark as read"));
      }
    },
    [dispatch, markReadMutation, refetchNotifications]
  );

  /**
   * Mark all notifications as read
   * Trigger: API Call + State
   */
  const markAllNotificationsAsRead = useCallback(async () => {
    // Optimistic update
    dispatch(markAllAsRead());

    try {
      await markAllReadMutation().unwrap();
    } catch (error: any) {
      // Revert on error - refetch to get accurate state
      refetchNotifications();
      dispatch(setNotificationsError(error?.message || "Failed to mark all as read"));
    }
  }, [dispatch, markAllReadMutation, refetchNotifications]);

  /**
   * Archive notification
   * Trigger: State only (no API endpoint currently)
   */
  const archiveNotificationHandler = useCallback(
    (notificationId: string) => {
      dispatch(archiveNotification(notificationId));
    },
    [dispatch]
  );

  /**
   * Delete notification
   * Trigger: API Call + State
   */
  const deleteNotificationHandler = useCallback(
    async (notificationId: string) => {
      // Optimistic update
      dispatch(deleteNotification(notificationId));

      try {
        await deleteNotificationMutation(notificationId).unwrap();
      } catch (error: any) {
        // Revert on error - refetch to get accurate state
        refetchNotifications();
        dispatch(setNotificationsError(error?.message || "Failed to delete notification"));
      }
    },
    [dispatch, deleteNotificationMutation, refetchNotifications]
  );

  /**
   * Update notification preferences
   * Trigger: API Call + State
   */
  const updateNotificationPreferences = useCallback(
    async (preferences: Partial<NotificationPreferences>) => {
      dispatch(setUpdatingPreferences(true));

      // Optimistic update
      dispatch(updatePreference(preferences));

      try {
        await updatePreferencesMutation(preferences).unwrap();
        dispatch(setUpdatingPreferences(false));
      } catch (error: any) {
        // Revert on error
        if (preferencesData) {
          dispatch(setPreferences(preferencesData));
        }
        dispatch(setNotificationsError(error?.message || "Failed to update preferences"));
      }
    },
    [dispatch, updatePreferencesMutation, preferencesData]
  );

  /**
   * Set notification filter
   * Trigger: State only
   */
  const setNotificationFilter = useCallback(
    (filter: {
      type?: NotificationType | "all";
      showRead?: boolean;
      showArchived?: boolean;
    }) => {
      dispatch(setFilter(filter));
    },
    [dispatch]
  );

  /**
   * Acknowledge new notifications (clear the "new" indicator)
   * Trigger: State only
   */
  const acknowledgeNewNotifications = useCallback(() => {
    dispatch(setHasNewNotifications(false));
  }, [dispatch]);

  /**
   * Clear all notifications from state
   * Trigger: State only
   */
  const clearAllNotifications = useCallback(() => {
    dispatch(clearNotifications());
  }, [dispatch]);

  /**
   * Refresh notifications from server
   * Trigger: API Call
   */
  const refresh = useCallback(() => {
    refetchNotifications();
  }, [refetchNotifications]);

  // Filter notifications based on current filter
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
    refresh,
  };
}

export default useNotificationsIntegration;
