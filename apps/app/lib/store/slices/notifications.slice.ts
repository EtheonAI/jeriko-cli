import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type NotificationType =
  | "system"
  | "session"
  | "agent"
  | "team"
  | "billing"
  | "connector"
  | "task"
  | "mention"
  | "share"
  | "comment"
  | "task_complete"
  | "task_failed"
  | "agent_update"
  | "session_update"
  | "team_invite"
  | "connector_sync"
  | "scheduled_task";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface NotificationAction {
  label: string;
  action: string;
  data?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  isRead: boolean;
  isArchived: boolean;
  // Related entity references
  sessionId?: string;
  agentId?: string;
  taskId?: string;
  connectorId?: string;
  // Rich content
  metadata?: {
    icon?: string;
    imageUrl?: string;
    actions?: NotificationAction[];
    [key: string]: unknown;
  };
  // Timestamps
  createdAt: string;
  readAt?: string;
  expiresAt?: string;
}

export interface NotificationPreferences {
  // Push notification settings
  pushEnabled: boolean;
  pushTaskComplete: boolean;
  pushTaskFailed: boolean;
  pushAgentUpdate: boolean;
  pushTeamInvite: boolean;
  pushScheduledTask: boolean;
  // Email notification settings
  emailEnabled: boolean;
  emailDigest: "none" | "instant" | "hourly" | "daily" | "weekly" | "never";
  emailTaskComplete: boolean;
  emailTaskFailed: boolean;
  // In-app settings
  soundEnabled: boolean;
  desktopEnabled: boolean;
  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
}

export interface NotificationsState {
  // Notifications list
  notifications: Notification[];
  // Unread counts by type
  unreadCount: number;
  unreadByType: Record<NotificationType, number>;
  // User preferences
  preferences: NotificationPreferences;
  // Pagination
  hasMore: boolean;
  cursor: string | null;
  // Loading states
  isLoading: boolean;
  isLoadingMore: boolean;
  isUpdatingPreferences: boolean;
  // Filter state
  filter: {
    type: NotificationType | "all";
    showRead: boolean;
    showArchived: boolean;
  };
  // Real-time updates
  hasNewNotifications: boolean;
  lastFetchedAt: string | null;
  // Manus compatibility fields
  connectStatus: "default" | "connecting" | "connected" | "error";
  connectError: string | null;
  categoryNotifications: Record<string, Notification[]>;
  categoryHasMore: Record<string, boolean>;
  notificationTab: number;
  fetchNotificationLoading: boolean;
  // Error state
  error: string | null;
}

const defaultPreferences: NotificationPreferences = {
  pushEnabled: true,
  pushTaskComplete: true,
  pushTaskFailed: true,
  pushAgentUpdate: true,
  pushTeamInvite: true,
  pushScheduledTask: true,
  emailEnabled: true,
  emailDigest: "daily",
  emailTaskComplete: false,
  emailTaskFailed: true,
  soundEnabled: true,
  desktopEnabled: true,
  quietHoursEnabled: false,
  quietHoursStart: undefined,
  quietHoursEnd: undefined,
};

const initialState: NotificationsState = {
  notifications: [],
  unreadCount: 0,
  unreadByType: {
    system: 0,
    session: 0,
    agent: 0,
    team: 0,
    billing: 0,
    connector: 0,
    task: 0,
    comment: 0,
    task_complete: 0,
    task_failed: 0,
    agent_update: 0,
    session_update: 0,
    team_invite: 0,
    connector_sync: 0,
    scheduled_task: 0,
    mention: 0,
    share: 0,
  },
  preferences: defaultPreferences,
  hasMore: false,
  cursor: null,
  isLoading: false,
  isLoadingMore: false,
  isUpdatingPreferences: false,
  filter: {
    type: "all",
    showRead: true,
    showArchived: false,
  },
  hasNewNotifications: false,
  lastFetchedAt: null,
  connectStatus: "default",
  connectError: null,
  categoryNotifications: { "0": [], "1": [], "2": [] },
  categoryHasMore: { "0": true, "1": true, "2": true },
  notificationTab: 0,
  fetchNotificationLoading: false,
  error: null,
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    // Set notifications list
    setNotifications: (
      state,
      action: PayloadAction<{
        notifications: Notification[];
        hasMore: boolean;
        cursor: string | null;
      }>
    ) => {
      state.notifications = action.payload.notifications;
      state.hasMore = action.payload.hasMore;
      state.cursor = action.payload.cursor;
      state.isLoading = false;
      state.lastFetchedAt = new Date().toISOString();
      state.hasNewNotifications = false;
    },

    // Append more notifications (pagination)
    appendNotifications: (
      state,
      action: PayloadAction<{
        notifications: Notification[];
        hasMore: boolean;
        cursor: string | null;
      }>
    ) => {
      state.notifications = [...state.notifications, ...action.payload.notifications];
      state.hasMore = action.payload.hasMore;
      state.cursor = action.payload.cursor;
      state.isLoadingMore = false;
    },

    // Add a new notification (real-time)
    addNotification: (state, action: PayloadAction<Notification>) => {
      // Add to beginning of list
      state.notifications.unshift(action.payload);
      // Update unread counts
      if (!action.payload.isRead) {
        state.unreadCount += 1;
        state.unreadByType[action.payload.type] += 1;
      }
      state.hasNewNotifications = true;
    },

    // Mark notification as read
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        notification.readAt = new Date().toISOString();
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.unreadByType[notification.type] = Math.max(
          0,
          state.unreadByType[notification.type] - 1
        );
      }
    },

    // Mark all notifications as read
    markAllAsRead: (state) => {
      const now = new Date().toISOString();
      state.notifications.forEach((n) => {
        if (!n.isRead) {
          n.isRead = true;
          n.readAt = now;
        }
      });
      state.unreadCount = 0;
      // Reset all known notification types
      for (const key of Object.keys(state.unreadByType)) {
        if (key in state.unreadByType) {
          state.unreadByType[key as NotificationType] = 0;
        }
      }
    },

    // Archive notification
    archiveNotification: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification) {
        notification.isArchived = true;
        if (!notification.isRead) {
          notification.isRead = true;
          notification.readAt = new Date().toISOString();
          state.unreadCount = Math.max(0, state.unreadCount - 1);
          state.unreadByType[notification.type] = Math.max(
            0,
            state.unreadByType[notification.type] - 1
          );
        }
      }
    },

    // Delete notification
    deleteNotification: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find((n) => n.id === action.payload);
      if (notification && !notification.isRead) {
        state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.unreadByType[notification.type] = Math.max(
          0,
          state.unreadByType[notification.type] - 1
        );
      }
      state.notifications = state.notifications.filter((n) => n.id !== action.payload);
    },

    // Set unread counts
    setUnreadCounts: (
      state,
      action: PayloadAction<{
        total: number;
        byType: Record<NotificationType, number>;
      }>
    ) => {
      state.unreadCount = action.payload.total;
      state.unreadByType = {
        ...state.unreadByType,
        ...action.payload.byType,
      };
    },

    // Set preferences
    setPreferences: (state, action: PayloadAction<NotificationPreferences>) => {
      state.preferences = action.payload;
      state.isUpdatingPreferences = false;
    },

    // Update single preference
    updatePreference: (state, action: PayloadAction<Partial<NotificationPreferences>>) => {
      state.preferences = { ...state.preferences, ...action.payload };
    },

    // Filter management
    setFilter: (
      state,
      action: PayloadAction<{
        type?: NotificationType | "all";
        showRead?: boolean;
        showArchived?: boolean;
      }>
    ) => {
      state.filter = { ...state.filter, ...action.payload };
    },

    // Loading states
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setLoadingMore: (state, action: PayloadAction<boolean>) => {
      state.isLoadingMore = action.payload;
    },

    setUpdatingPreferences: (state, action: PayloadAction<boolean>) => {
      state.isUpdatingPreferences = action.payload;
    },

    // New notifications flag
    setHasNewNotifications: (state, action: PayloadAction<boolean>) => {
      state.hasNewNotifications = action.payload;
    },

    // Error handling
    setNotificationsError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.isLoadingMore = false;
    },

    // Clear all notifications
    clearNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
      for (const key of Object.keys(state.unreadByType)) {
        if (key in state.unreadByType) {
          state.unreadByType[key as NotificationType] = 0;
        }
      }
      state.hasMore = false;
      state.cursor = null;
    },
  },
  extraReducers: (builder) => {
    // Manus compatibility (notification slice name)
    builder.addCase("notification/setConnectStatus", (state, action) => {
      state.connectStatus = (action as any).payload;
    });
    builder.addCase("notification/setFetchNotificationListLoading", (state, action) => {
      state.fetchNotificationLoading = (action as any).payload;
    });
    builder.addCase("notification/setHasMoreNotification", (state, action) => {
      state.categoryHasMore = (action as any).payload ?? state.categoryHasMore;
    });
    builder.addCase("notification/setCategoryNotificationList", (state, action) => {
      state.categoryNotifications = (action as any).payload ?? state.categoryNotifications;
    });
  },
});

export const {
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
  setFilter,
  setLoading,
  setLoadingMore,
  setUpdatingPreferences,
  setHasNewNotifications,
  setNotificationsError,
  clearNotifications,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;
