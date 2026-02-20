import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import type { AgentSession } from "../slices/sessions.slice";
import type { FileItem } from "../slices/library.slice";
import type { Connector, InstalledConnector } from "../slices/connectors.slice";
import type { Notification, NotificationPreferences } from "../slices/notifications.slice";
import type { ScheduledTask, ScheduledTaskExecution } from "../slices/scheduledTasks.slice";
import type { Project } from "../slices/projects.slice";
import type {
  CreditBreakdown,
  CreditPackage,
  MembershipTier,
  Subscription,
  PlanLimits,
} from "../slices/billing.slice";
import type { ClientConfig } from "../slices/configs.slice";
import { getRawTrpcClient } from "@/lib/trpc/vanilla";

// ─── Helpers ────────────────────────────────────────────────────────

/** Serialize any Date objects in an object tree to ISO strings.
 * Redux requires all state to be serializable. */
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

/** Wrap a tRPC call in a try/catch for RTK Query queryFn format.
 *  Returns `any` intentionally — the endpoint's builder.query<T, Arg>
 *  declaration provides full type safety on the consumer side.
 *  tRPC returns raw types (Date objects, narrow unions); serializeDates
 *  converts them for Redux serialization compliance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function trpcQuery(fn: () => Promise<any>): Promise<any> {
  try {
    const data = await fn();
    return { data: serializeDates(data) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: { status: 500, data: message } };
  }
}

// ─── RTK Query API Slice ────────────────────────────────────────────
// Manus architecture: all API calls go through createApi, components
// consume via auto-generated hooks, WebSocket events trigger
// invalidateTags for automatic refetches.

export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fakeBaseQuery(), // We use queryFn per endpoint
  keepUnusedDataFor: 300, // 5 min cache
  refetchOnReconnect: true,
  refetchOnFocus: false,
  tagTypes: [
    "Session",
    "Message",
    "File",
    "Connector",
    "Notification",
    "ScheduledTask",
    "Project",
    "Billing",
    "User",
    "Config",
    "Webhook",
    "Search",
    "Skill",
    "Mail",
    "Knowledge",
    "Experiment",
    "Secret",
  ],
  endpoints: (builder) => ({
    // ================== SESSIONS ==================
    getSessions: builder.query<AgentSession[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().sessions.list.query()),
      providesTags: ["Session"],
    }),
    getSession: builder.query<AgentSession | null, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().sessions.get.query({ id })),
      providesTags: (_r, _e, id) => [{ type: "Session", id }],
    }),
    createSession: builder.mutation<AgentSession, { title?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().sessions.create.mutate(args)),
      invalidatesTags: ["Session"],
    }),
    updateSession: builder.mutation<AgentSession, { id: string; title?: string; status?: string; metadata?: Record<string, unknown> }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().sessions.update.mutate(args as any)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Session", id }, "Session"],
    }),
    deleteSession: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().sessions.delete.mutate({ id })),
      invalidatesTags: ["Session"],
    }),

    // ================== FILES ==================
    getFiles: builder.query<FileItem[], { sessionId?: string } | void>({
      queryFn: (params) =>
        trpcQuery(() => getRawTrpcClient().files.list.query(params ?? {})),
      providesTags: ["File"],
    }),
    getFilesBySession: builder.query<
      Array<{ sessionId: string; sessionTitle: string | null; sessionCreatedAt: string; files: FileItem[] }>,
      { docType?: string; favoritesOnly?: boolean } | void
    >({
      queryFn: (params) =>
        trpcQuery(() => getRawTrpcClient().files.listBySession.query((params ?? {}) as any)),
      providesTags: ["File"],
    }),
    getFile: builder.query<FileItem | null, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().files.get.query({ id })),
      providesTags: (_r, _e, id) => [{ type: "File", id }],
    }),
    getFileContent: builder.query<{ content: string; url: string; mimeType: string }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().files.getContent.query({ id })),
      providesTags: (_r, _e, id) => [{ type: "File", id }],
    }),
    getFileVersions: builder.query<unknown[], string>({
      queryFn: (fileId) => trpcQuery(() => getRawTrpcClient().files.versions.query({ fileId })),
      providesTags: (_r, _e, fileId) => [{ type: "File", id: fileId }],
    }),
    getFileShare: builder.query<unknown, string>({
      queryFn: (fileId) => trpcQuery(() => getRawTrpcClient().files.getShare.query({ fileId })),
      providesTags: (_r, _e, fileId) => [{ type: "File", id: fileId }],
    }),
    deleteFile: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().files.delete.mutate({ id })),
      invalidatesTags: ["File"],
    }),
    bulkDeleteFiles: builder.mutation<{ success: boolean; count: number }, string[]>({
      queryFn: (ids) => trpcQuery(() => getRawTrpcClient().files.bulkDelete.mutate({ ids })),
      invalidatesTags: ["File"],
    }),
    toggleFavorite: builder.mutation<{ favorite: boolean; file: FileItem }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().files.toggleFavorite.mutate({ id })),
      invalidatesTags: ["File"],
    }),
    createFileShare: builder.mutation<unknown, { fileId: string; accessLevel?: "viewer" | "editor"; expiresInDays?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().files.createShare.mutate(args)),
      invalidatesTags: (_r, _e, { fileId }) => [{ type: "File", id: fileId }],
    }),
    revokeFileShare: builder.mutation<{ success: boolean }, string>({
      queryFn: (fileId) => trpcQuery(() => getRawTrpcClient().files.revokeShare.mutate({ fileId })),
      invalidatesTags: (_r, _e, fileId) => [{ type: "File", id: fileId }],
    }),
    getFileDownloadUrl: builder.query<{ url: string }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().files.getDownloadUrl.query({ id })),
    }),

    // ================== CONNECTORS ==================
    getConnectorDefinitions: builder.query<unknown[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().connectors.listDefinitions.query()),
      providesTags: ["Connector"],
    }),
    getInstalledConnectors: builder.query<unknown[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().connectors.list.query()),
      providesTags: ["Connector"],
    }),
    getConnector: builder.query<unknown, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().connectors.get.query({ id })),
      providesTags: (_r, _e, id) => [{ type: "Connector", id }],
    }),
    getConnectorTools: builder.query<unknown[], string>({
      queryFn: (integrationId) => trpcQuery(() => getRawTrpcClient().connectors.getTools.query({ integrationId })),
    }),
    installConnector: builder.mutation<unknown, { connectorDefinitionId: string; organizationId?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().connectors.install.mutate(args)),
      invalidatesTags: ["Connector"],
    }),
    saveConnectorTokens: builder.mutation<unknown, { id: string; accessToken: string; refreshToken?: string; tokenExpiresAt?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().connectors.saveTokens.mutate(args as any)),
      invalidatesTags: ["Connector"],
    }),
    disconnectConnector: builder.mutation<unknown, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().connectors.disconnect.mutate({ id })),
      invalidatesTags: ["Connector"],
    }),
    uninstallConnector: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().connectors.uninstall.mutate({ id })),
      invalidatesTags: ["Connector"],
    }),
    syncConnector: builder.mutation<{ syncLogId: string }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().connectors.sync.mutate({ id })),
      invalidatesTags: ["Connector"],
    }),
    initializeOAuth: builder.mutation<{ authUrl: string; connectorId: string }, { type: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().connectors.initializeOAuth.mutate(args)),
    }),
    connectWithApiKey: builder.mutation<unknown, { type: string; apiKey: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().connectors.connectWithApiKey.mutate(args)),
      invalidatesTags: ["Connector"],
    }),
    checkConnection: builder.mutation<{ status: string }, { type: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().connectors.checkConnection.mutate(args)),
    }),
    getConnectorSyncHistory: builder.query<unknown[], { connectorId: string; limit?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().connectors.getSyncHistory.query(args)),
      providesTags: ["Connector"],
    }),

    // ================== NOTIFICATIONS ==================
    getNotifications: builder.query<
      { items: Notification[]; total: number; hasMore: boolean },
      { limit?: number; offset?: number; unreadOnly?: boolean; type?: string } | void
    >({
      queryFn: (params) =>
        trpcQuery(() =>
          getRawTrpcClient().notifications.list.query((params ?? { limit: 50, offset: 0, unreadOnly: false }) as any)
        ),
      providesTags: ["Notification"],
    }),
    getUnreadCount: builder.query<{ count: number }, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().notifications.getUnreadCount.query()),
      providesTags: ["Notification"],
    }),
    getUnreadCountsByType: builder.query<Record<string, number>, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().notifications.getUnreadCountsByType.query()),
      providesTags: ["Notification"],
    }),
    markNotificationAsRead: builder.mutation<Notification, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().notifications.markAsRead.mutate({ id })),
      invalidatesTags: ["Notification"],
    }),
    markAllNotificationsAsRead: builder.mutation<{ success: boolean }, { type?: string } | void>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().notifications.markAllAsRead.mutate((args ?? {}) as any)),
      invalidatesTags: ["Notification"],
    }),
    dismissNotification: builder.mutation<Notification, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().notifications.dismiss.mutate({ id })),
      invalidatesTags: ["Notification"],
    }),
    getNotificationPreferences: builder.query<NotificationPreferences, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().notifications.getPreferences.query()),
      providesTags: ["Notification"],
    }),
    updateNotificationPreferences: builder.mutation<NotificationPreferences, Partial<NotificationPreferences>>({
      queryFn: (prefs) => trpcQuery(() => getRawTrpcClient().notifications.updatePreferences.mutate(prefs as any)),
      invalidatesTags: ["Notification"],
    }),

    // ================== SCHEDULED TASKS ==================
    getScheduledTasks: builder.query<ScheduledTask[], { status?: string; taskType?: string; limit?: number; offset?: number } | void>({
      queryFn: (params) =>
        trpcQuery(() => getRawTrpcClient().scheduledTasks.list.query((params ?? {}) as any)),
      providesTags: ["ScheduledTask"],
    }),
    getScheduledTask: builder.query<ScheduledTask, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().scheduledTasks.get.query({ id })),
      providesTags: (_r, _e, id) => [{ type: "ScheduledTask", id }],
    }),
    createScheduledTask: builder.mutation<ScheduledTask, Record<string, unknown>>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().scheduledTasks.create.mutate(args as any)),
      invalidatesTags: ["ScheduledTask"],
    }),
    updateScheduledTask: builder.mutation<ScheduledTask, { id: string } & Record<string, unknown>>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().scheduledTasks.update.mutate(args as any)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "ScheduledTask", id }, "ScheduledTask"],
    }),
    pauseScheduledTask: builder.mutation<ScheduledTask, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().scheduledTasks.pause.mutate({ id })),
      invalidatesTags: ["ScheduledTask"],
    }),
    resumeScheduledTask: builder.mutation<ScheduledTask, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().scheduledTasks.resume.mutate({ id })),
      invalidatesTags: ["ScheduledTask"],
    }),
    deleteScheduledTask: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().scheduledTasks.delete.mutate({ id })),
      invalidatesTags: ["ScheduledTask"],
    }),
    runScheduledTaskNow: builder.mutation<{ executionId: string }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().scheduledTasks.runNow.mutate({ id })),
      invalidatesTags: ["ScheduledTask"],
    }),
    getTaskExecutions: builder.query<ScheduledTaskExecution[], { taskId: string; limit?: number; offset?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().scheduledTasks.getExecutions.query(args)),
      providesTags: (_r, _e, { taskId }) => [{ type: "ScheduledTask", id: taskId }],
    }),
    getScheduledTaskTriggerTypes: builder.query<{ triggers: unknown[] }, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().scheduledTasks.listTriggerTypes.query()),
    }),
    getScheduledTaskTriggerConfig: builder.query<unknown, string>({
      queryFn: (slug) => trpcQuery(() => getRawTrpcClient().scheduledTasks.getTriggerTypeConfig.query({ slug })),
    }),

    // ================== PROJECTS ==================
    getProjects: builder.query<Project[], { status?: string; search?: string; limit?: number; offset?: number; includeShared?: boolean } | void>({
      queryFn: (params) =>
        trpcQuery(() => getRawTrpcClient().projects.list.query((params ?? { status: "active", limit: 100, offset: 0, includeShared: true }) as any)),
      providesTags: ["Project"],
    }),
    getProject: builder.query<Project, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().projects.get.query({ id })),
      providesTags: (_r, _e, id) => [{ type: "Project", id }],
    }),
    createProject: builder.mutation<Project, Record<string, unknown>>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().projects.create.mutate(args as any)),
      invalidatesTags: ["Project"],
    }),
    updateProject: builder.mutation<Project, { id: string } & Record<string, unknown>>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().projects.update.mutate(args as any)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Project", id }, "Project"],
    }),
    deleteProject: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().projects.delete.mutate({ id })),
      invalidatesTags: ["Project"],
    }),
    getProjectSessions: builder.query<unknown[], { projectId: string; limit?: number; offset?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().projects.listSessions.query(args)),
      providesTags: (_r, _e, { projectId }) => [{ type: "Project", id: projectId }],
    }),
    addSessionToProject: builder.mutation<unknown, { projectId: string; sessionId: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().projects.addSession.mutate(args)),
      invalidatesTags: ["Project", "Session"],
    }),
    removeSessionFromProject: builder.mutation<{ success: boolean }, { projectId: string; sessionId: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().projects.removeSession.mutate(args)),
      invalidatesTags: ["Project"],
    }),

    // ================== BILLING ==================
    getCreditBalance: builder.query<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.getCreditBalance.query()),
      providesTags: ["Billing"],
    }),
    getCreditBreakdown: builder.query<CreditBreakdown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.getCreditBreakdown.query()),
      providesTags: ["Billing"],
    }),
    getSubscription: builder.query<{ subscription: unknown; plan: unknown } | null, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.getSubscription.query()),
      providesTags: ["Billing"],
    }),
    getPlans: builder.query<MembershipTier[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.listPlans.query()),
      providesTags: ["Billing"],
    }),
    getPlanLimits: builder.query<PlanLimits, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.getPlanLimits.query()),
      providesTags: ["Billing"],
    }),
    getCreditPackages: builder.query<CreditPackage[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.listCreditPackages.query()),
      providesTags: ["Billing"],
    }),
    getPaymentMethods: builder.query<unknown[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.listPaymentMethods.query()),
      providesTags: ["Billing"],
    }),
    getInvoices: builder.query<unknown[], { limit?: number; offset?: number; status?: string } | void>({
      queryFn: (params) =>
        trpcQuery(() => getRawTrpcClient().billing.listInvoices.query((params ?? {}) as any)),
      providesTags: ["Billing"],
    }),
    getUsageSummary: builder.query<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.getUsageSummary.query()),
      providesTags: ["Billing"],
    }),
    getUsageRecords: builder.query<unknown[], { limit?: number; offset?: number; type?: string; startDate?: string; endDate?: string } | void>({
      queryFn: (params) =>
        trpcQuery(() => getRawTrpcClient().billing.getUsageRecords.query((params ?? {}) as any)),
      providesTags: ["Billing"],
    }),
    getCreditTransactions: builder.query<unknown[], { limit?: number; offset?: number; type?: string } | void>({
      queryFn: (params) =>
        trpcQuery(() => getRawTrpcClient().billing.getCreditTransactions.query((params ?? {}) as any)),
      providesTags: ["Billing"],
    }),
    createSubscriptionCheckout: builder.mutation<
      { checkoutUrl: string; sessionId: string },
      { planId: string; interval: "monthly" | "yearly"; successUrl: string; cancelUrl: string }
    >({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().billing.createSubscriptionCheckout.mutate(args)),
    }),
    createCreditPurchaseCheckout: builder.mutation<
      { checkoutUrl: string; sessionId: string },
      { packageId: string; successUrl: string; cancelUrl: string }
    >({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().billing.createCreditPurchaseCheckout.mutate(args)),
    }),
    cancelSubscription: builder.mutation<unknown, { cancelAtPeriodEnd?: boolean; reason?: string } | void>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().billing.cancelSubscription.mutate(args ?? {})),
      invalidatesTags: ["Billing"],
    }),
    reactivateSubscription: builder.mutation<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().billing.reactivateSubscription.mutate()),
      invalidatesTags: ["Billing"],
    }),
    setDefaultPaymentMethod: builder.mutation<unknown, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().billing.setDefaultPaymentMethod.mutate({ id })),
      invalidatesTags: ["Billing"],
    }),
    deletePaymentMethod: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().billing.deletePaymentMethod.mutate({ id })),
      invalidatesTags: ["Billing"],
    }),
    updateAutoTopup: builder.mutation<unknown, { enabled: boolean; threshold?: number; packageId?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().billing.updateAutoTopup.mutate(args)),
      invalidatesTags: ["Billing"],
    }),
    getBillingPortalUrl: builder.mutation<{ url: string }, { returnUrl: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().billing.getBillingPortalUrl.mutate(args)),
    }),

    // ================== USER ==================
    getUserProfile: builder.query<{ id: string; email: string; name: string | null; image: string | null }, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.getProfile.query()),
      providesTags: ["User"],
    }),
    getUserPreferences: builder.query<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.getPreferences.query()),
      providesTags: ["User"],
    }),
    getUserSessions: builder.query<unknown[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.getSessions.query()),
      providesTags: ["User"],
    }),
    getConnectedAccounts: builder.query<unknown[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.getConnectedAccounts.query()),
      providesTags: ["User"],
    }),
    updateProfile: builder.mutation<unknown, { name?: string; image?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().user.updateProfile.mutate(args)),
      invalidatesTags: ["User"],
    }),
    updatePreferences: builder.mutation<unknown, Record<string, unknown>>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().user.updatePreferences.mutate(args as any)),
      invalidatesTags: ["User", "Config"],
    }),
    changePassword: builder.mutation<{ success: boolean }, { currentPassword: string; newPassword: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().user.changePassword.mutate(args)),
    }),
    deleteAccount: builder.mutation<{ success: boolean }, { confirmation: "DELETE"; password?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().user.deleteAccount.mutate(args)),
    }),
    revokeUserSession: builder.mutation<{ success: boolean }, string>({
      queryFn: (sessionId) => trpcQuery(() => getRawTrpcClient().user.revokeSession.mutate({ sessionId })),
      invalidatesTags: ["User"],
    }),
    revokeAllUserSessions: builder.mutation<{ success: boolean }, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.revokeAllSessions.mutate()),
      invalidatesTags: ["User"],
    }),
    disconnectAccount: builder.mutation<{ success: boolean }, string>({
      queryFn: (accountId) => trpcQuery(() => getRawTrpcClient().user.disconnectAccount.mutate({ accountId })),
      invalidatesTags: ["User"],
    }),
    exportUserData: builder.mutation<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.exportData.mutate()),
    }),
    clearChatHistory: builder.mutation<{ success: boolean }, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.clearChatHistory.mutate()),
      invalidatesTags: ["Session", "Message"],
    }),
    clearFiles: builder.mutation<{ success: boolean }, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().user.clearFiles.mutate()),
      invalidatesTags: ["File"],
    }),

    // ================== WEBHOOKS ==================
    getWebhooks: builder.query<unknown[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().webhooks.list.query()),
      providesTags: ["Webhook"],
    }),
    getWebhook: builder.query<unknown, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().webhooks.get.query({ id })),
      providesTags: (_r, _e, id) => [{ type: "Webhook", id }],
    }),
    createWebhook: builder.mutation<unknown, { name: string; description?: string; url: string; events: string[]; headers?: Record<string, string> }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().webhooks.create.mutate(args as any)),
      invalidatesTags: ["Webhook"],
    }),
    updateWebhook: builder.mutation<unknown, { id: string; name?: string; description?: string; url?: string; events?: string[]; headers?: Record<string, string>; status?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().webhooks.update.mutate(args as any)),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Webhook", id }, "Webhook"],
    }),
    deleteWebhook: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().webhooks.delete.mutate({ id })),
      invalidatesTags: ["Webhook"],
    }),
    regenerateWebhookSecret: builder.mutation<unknown, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().webhooks.regenerateSecret.mutate({ id })),
      invalidatesTags: ["Webhook"],
    }),
    testWebhook: builder.mutation<{ success: boolean; status: number; statusText: string; error?: string }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().webhooks.test.mutate({ id })),
    }),
    getWebhookDeliveries: builder.query<unknown[], { webhookId: string; limit?: number; offset?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().webhooks.getDeliveries.query(args)),
      providesTags: ["Webhook"],
    }),
    getWebhookEventTypes: builder.query<Array<{ value: string; label: string; category: string }>, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().webhooks.getEventTypes.query()),
    }),

    // ================== SEARCH ==================
    search: builder.query<unknown, { query: string; collections?: string[]; filters?: Record<string, unknown>; limit?: number; offset?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().search.global.query(args as any)),
      providesTags: ["Search"],
    }),
    quickSearch: builder.query<unknown[], { query: string; limit?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().search.quick.query(args)),
      providesTags: ["Search"],
    }),

    // ================== MAIL ==================
    getMailbox: builder.query<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().mail.getMailbox.query()),
      providesTags: ["Mail"],
    }),
    getOrCreateMailbox: builder.query<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().mail.getOrCreateMailbox.query()),
      providesTags: ["Mail"],
    }),
    getMailMessages: builder.query<unknown, { limit?: number; pageToken?: string } | undefined>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().mail.listMessages.query(args)),
      providesTags: ["Mail"],
    }),
    getMailThreads: builder.query<unknown, { limit?: number; pageToken?: string } | undefined>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().mail.listThreads.query(args)),
      providesTags: ["Mail"],
    }),
    sendMailMessage: builder.mutation<unknown, { to: string; subject: string; text: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().mail.sendMessage.mutate(args)),
      invalidatesTags: ["Mail"],
    }),
    updateMailbox: builder.mutation<unknown, { displayName: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().mail.updateMailbox.mutate(args)),
      invalidatesTags: ["Mail"],
    }),
    deleteMailbox: builder.mutation<unknown, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().mail.deleteMailbox.mutate()),
      invalidatesTags: ["Mail"],
    }),

    // ================== API KEYS ==================
    getApiKeys: builder.query<unknown[], void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().apiKeys.list.query()),
      providesTags: ["Config"],
    }),
    createApiKey: builder.mutation<unknown, { name: string; expiresInDays?: number }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().apiKeys.create.mutate(args)),
      invalidatesTags: ["Config"],
    }),
    revokeApiKey: builder.mutation<{ success: boolean }, string>({
      queryFn: (id) => trpcQuery(() => getRawTrpcClient().apiKeys.revoke.mutate({ id })),
      invalidatesTags: ["Config"],
    }),

    // ================== MESSAGES ==================
    getMessages: builder.query<unknown[], { sessionId: string; limit?: number; cursor?: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().messages.list.query(args)),
      providesTags: (_r, _e, { sessionId }) => [{ type: "Message", id: sessionId }],
    }),
    voteMessage: builder.mutation<unknown, { messageId: string; vote: "up" | "down" }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().messages.vote.mutate(args as any)),
    }),
    getMessageVotes: builder.query<unknown[], { chatId: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().messages.getVotes.query(args)),
      providesTags: (_r, _e, { chatId }) => [{ type: "Message", id: `votes-${chatId}` }],
    }),
    removeMessageVote: builder.mutation<unknown, { chatId: string; messageId: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().messages.removeVote.mutate(args)),
      invalidatesTags: (_r, _e, { chatId }) => [{ type: "Message", id: `votes-${chatId}` }],
    }),

    // ================== FILES (additional) ==================
    getStorageUsage: builder.query<{ totalSize: number; totalCount: number }, void>({
      queryFn: () => trpcQuery(() => getRawTrpcClient().files.getStorageUsage.query()),
      providesTags: ["File"],
    }),

    // ================== CONNECTORS (additional) ==================
    updateConnectorConfig: builder.mutation<unknown, { id: string; config: Record<string, unknown> }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().connectors.updateConfig.mutate(args as any)),
      invalidatesTags: ["Connector"],
    }),
    getProjectConnectors: builder.query<unknown[], { projectId: string }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().connectors.listForProject.query(args)),
      providesTags: (_r, _e, { projectId }) => [{ type: "Connector", id: `project-${projectId}` }],
    }),
    initializeProjectOAuth: builder.mutation<{ authUrl: string }, { type: string; projectId: string }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().connectors.initializeProjectOAuth.mutate(args)),
    }),
    checkProjectConnection: builder.mutation<{ status: string }, { type: string; projectId: string }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().connectors.checkProjectConnection.mutate(args)),
      invalidatesTags: (_r, _e, { projectId }) => [{ type: "Connector", id: `project-${projectId}` }],
    }),

    // ================== WEBHOOKS (additional) ==================
    getWebhookDeliveryDetails: builder.query<unknown, { deliveryId: string; webhookId: string }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().webhooks.getDeliveryDetails.query(args)),
    }),
    retryWebhookDelivery: builder.mutation<unknown, { deliveryId: string; webhookId: string }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().webhooks.retryDelivery.mutate(args)),
    }),

    // ================== API KEYS (additional) ==================
    deleteApiKey: builder.mutation<unknown, { id: string }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().apiKeys.delete.mutate(args)),
      invalidatesTags: ["Config"],
    }),
    renameApiKey: builder.mutation<unknown, { id: string; name: string }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().apiKeys.rename.mutate(args)),
      invalidatesTags: ["Config"],
    }),

    // ================== SKILLS ==================
    getSkillDefinitions: builder.query<
      Array<{
        id: string;
        type: string;
        name: string;
        description: string | null;
        category: string;
        icon: string | null;
        isPremium: boolean;
        defaultEnabled: boolean;
        isEnabled: boolean;
        createdAt: string;
        updatedAt: string;
      }>,
      void
    >({
      queryFn: () => trpcQuery(() => getRawTrpcClient().skills.list.query()),
      providesTags: ["Skill"],
    }),

    // ================== CONNECTORS (file sources) ==================
    getConnectorsByCategory: builder.query<unknown[], { categories: ("communication" | "storage" | "productivity" | "development" | "crm" | "analytics" | "other")[] }>({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().connectors.listByCategory.query(args)),
      providesTags: ["Connector"],
    }),
    executeConnectorTool: builder.mutation<
      Record<string, unknown>,
      { toolName: string; arguments?: Record<string, unknown> }
    >({
      queryFn: (args) =>
        trpcQuery(() => getRawTrpcClient().connectors.executeTool.mutate(args)),
    }),

    // ================== SECRETS ==================
    getSecrets: builder.query<
      Array<{ id: string; key: string; maskedValue: string; description: string | null; createdAt: string; updatedAt: string }>,
      void
    >({
      queryFn: () => trpcQuery(() => getRawTrpcClient().secrets.list.query()),
      providesTags: ["Secret"],
    }),
    upsertSecret: builder.mutation<
      { id: string; key: string; updated: boolean },
      { key: string; value: string; description?: string }
    >({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().secrets.upsert.mutate(args)),
      invalidatesTags: ["Secret"],
    }),
    deleteSecret: builder.mutation<{ success: boolean }, { id: string }>({
      queryFn: (args) => trpcQuery(() => getRawTrpcClient().secrets.delete.mutate(args)),
      invalidatesTags: ["Secret"],
    }),
  }),
});

// ─── Export hooks ────────────────────────────────────────────────────

export const {
  // Sessions
  useGetSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useDeleteSessionMutation,
  // Files
  useGetFilesQuery,
  useGetFilesBySessionQuery,
  useGetFileQuery,
  useGetFileContentQuery,
  useGetFileVersionsQuery,
  useGetFileShareQuery,
  useDeleteFileMutation,
  useBulkDeleteFilesMutation,
  useToggleFavoriteMutation,
  useCreateFileShareMutation,
  useRevokeFileShareMutation,
  useGetFileDownloadUrlQuery,
  // Connectors
  useGetConnectorDefinitionsQuery,
  useGetInstalledConnectorsQuery,
  useGetConnectorQuery,
  useGetConnectorToolsQuery,
  useInstallConnectorMutation,
  useSaveConnectorTokensMutation,
  useDisconnectConnectorMutation,
  useUninstallConnectorMutation,
  useSyncConnectorMutation,
  useInitializeOAuthMutation,
  useConnectWithApiKeyMutation,
  useCheckConnectionMutation,
  useGetConnectorSyncHistoryQuery,
  // Notifications
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useGetUnreadCountsByTypeQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useDismissNotificationMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  // Scheduled Tasks
  useGetScheduledTasksQuery,
  useGetScheduledTaskQuery,
  useCreateScheduledTaskMutation,
  useUpdateScheduledTaskMutation,
  usePauseScheduledTaskMutation,
  useResumeScheduledTaskMutation,
  useDeleteScheduledTaskMutation,
  useRunScheduledTaskNowMutation,
  useGetTaskExecutionsQuery,
  useGetScheduledTaskTriggerTypesQuery,
  useGetScheduledTaskTriggerConfigQuery,
  // Projects
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectSessionsQuery,
  useAddSessionToProjectMutation,
  useRemoveSessionFromProjectMutation,
  // Billing
  useGetCreditBalanceQuery,
  useGetCreditBreakdownQuery,
  useGetSubscriptionQuery,
  useGetPlansQuery,
  useGetPlanLimitsQuery,
  useGetCreditPackagesQuery,
  useGetPaymentMethodsQuery,
  useGetInvoicesQuery,
  useGetUsageSummaryQuery,
  useGetUsageRecordsQuery,
  useGetCreditTransactionsQuery,
  useCreateSubscriptionCheckoutMutation,
  useCreateCreditPurchaseCheckoutMutation,
  useCancelSubscriptionMutation,
  useReactivateSubscriptionMutation,
  useSetDefaultPaymentMethodMutation,
  useDeletePaymentMethodMutation,
  useUpdateAutoTopupMutation,
  useGetBillingPortalUrlMutation,
  // User
  useGetUserProfileQuery,
  useGetUserPreferencesQuery,
  useGetUserSessionsQuery,
  useGetConnectedAccountsQuery,
  useUpdateProfileMutation,
  useUpdatePreferencesMutation,
  useChangePasswordMutation,
  useDeleteAccountMutation,
  useRevokeUserSessionMutation,
  useRevokeAllUserSessionsMutation,
  useDisconnectAccountMutation,
  useExportUserDataMutation,
  useClearChatHistoryMutation,
  useClearFilesMutation,
  // Webhooks
  useGetWebhooksQuery,
  useGetWebhookQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useRegenerateWebhookSecretMutation,
  useTestWebhookMutation,
  useGetWebhookDeliveriesQuery,
  useGetWebhookEventTypesQuery,
  // Search
  useSearchQuery,
  useQuickSearchQuery,
  // Mail
  useGetMailboxQuery,
  useGetOrCreateMailboxQuery,
  useGetMailMessagesQuery,
  useGetMailThreadsQuery,
  useSendMailMessageMutation,
  useUpdateMailboxMutation,
  useDeleteMailboxMutation,
  // API Keys
  useGetApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  // Messages
  useGetMessagesQuery,
  useVoteMessageMutation,
  useGetMessageVotesQuery,
  useRemoveMessageVoteMutation,
  // Files (additional)
  useGetStorageUsageQuery,
  // Connectors (additional)
  useUpdateConnectorConfigMutation,
  useGetProjectConnectorsQuery,
  useInitializeProjectOAuthMutation,
  useCheckProjectConnectionMutation,
  // Webhooks (additional)
  useGetWebhookDeliveryDetailsQuery,
  useRetryWebhookDeliveryMutation,
  // API Keys (additional)
  useDeleteApiKeyMutation,
  useRenameApiKeyMutation,
  // Skills
  useGetSkillDefinitionsQuery,
  // Connectors (file sources)
  useGetConnectorsByCategoryQuery,
  useExecuteConnectorToolMutation,
  // Secrets
  useGetSecretsQuery,
  useUpsertSecretMutation,
  useDeleteSecretMutation,
} = apiSlice;
