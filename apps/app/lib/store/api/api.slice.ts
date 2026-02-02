import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { AgentSession } from "../slices/sessions.slice";
import type { Message } from "../slices/chat.slice";
import type { Agent, AgentTask } from "../slices/agents.slice";
import type { FileItem } from "../slices/files.slice";
import type { Connector, InstalledConnector } from "../slices/connectors.slice";
import type { Notification, NotificationPreferences } from "../slices/notifications.slice";
import type { ScheduledTask, ScheduledTaskExecution } from "../slices/scheduledTasks.slice";
import type { Team, TeamMember, TeamInvitation } from "../slices/team.slice";
import type { Project, ProjectSession } from "../slices/projects.slice";
import type { Attachment, AttachmentGroup, KnowledgeBase } from "../slices/knowledge.slice";
import type { ClientConfig } from "../slices/configs.slice";

// Base API slice with RTK Query
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/trpc",
    credentials: "include",
  }),
  tagTypes: [
    "Session",
    "Message",
    "Agent",
    "Task",
    "File",
    "User",
    "Connector",
    "Notification",
    "ScheduledTask",
    "Team",
    "TeamMember",
    "Invitation",
    "Project",
    "Attachment",
    "KnowledgeBase",
    "Config",
  ],
  endpoints: (builder) => ({
    // Sessions
    getSessions: builder.query<AgentSession[], void>({
      query: () => "sessions.list",
      providesTags: ["Session"],
    }),
    getSession: builder.query<AgentSession, string>({
      query: (id) => `sessions.get?id=${id}`,
      providesTags: (result, error, id) => [{ type: "Session", id }],
    }),
    createSession: builder.mutation<AgentSession, { title?: string }>({
      query: (body) => ({
        url: "sessions.create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Session"],
    }),
    updateSession: builder.mutation<
      AgentSession,
      { id: string; updates: Partial<AgentSession> }
    >({
      query: ({ id, updates }) => ({
        url: "sessions.update",
        method: "POST",
        body: { id, ...updates },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Session", id }],
    }),
    deleteSession: builder.mutation<void, string>({
      query: (id) => ({
        url: "sessions.delete",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["Session"],
    }),

    // Messages
    getMessages: builder.query<Message[], string>({
      query: (sessionId) => `messages.list?sessionId=${sessionId}`,
      providesTags: (result, error, sessionId) => [
        { type: "Message", id: sessionId },
      ],
    }),
    sendMessage: builder.mutation<
      Message,
      { sessionId: string; content: string }
    >({
      query: (body) => ({
        url: "messages.send",
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { sessionId }) => [
        { type: "Message", id: sessionId },
      ],
    }),

    // Agents
    getAgents: builder.query<Agent[], string>({
      query: (sessionId) => `agents.list?sessionId=${sessionId}`,
      providesTags: (result, error, sessionId) => [
        { type: "Agent", id: sessionId },
      ],
    }),
    getAgentTasks: builder.query<AgentTask[], string>({
      query: (agentId) => `agents.tasks?agentId=${agentId}`,
      providesTags: (result, error, agentId) => [{ type: "Task", id: agentId }],
    }),

    // Files
    getFiles: builder.query<FileItem[], { sessionId?: string } | void>({
      query: (params) =>
        params?.sessionId ? `files.list?sessionId=${params.sessionId}` : "files.list",
      providesTags: ["File"],
    }),
    uploadFile: builder.mutation<FileItem, FormData>({
      query: (formData) => ({
        url: "files.upload",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["File"],
    }),
    deleteFile: builder.mutation<void, string>({
      query: (id) => ({
        url: "files.delete",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["File"],
    }),

    // ================== CONNECTORS ==================
    getAvailableConnectors: builder.query<Connector[], void>({
      query: () => "connectors.available",
      providesTags: ["Connector"],
    }),
    getInstalledConnectors: builder.query<InstalledConnector[], void>({
      query: () => "connectors.installed",
      providesTags: ["Connector"],
    }),
    installConnector: builder.mutation<
      InstalledConnector,
      { connectorId: string; config?: Record<string, unknown> }
    >({
      query: (body) => ({
        url: "connectors.install",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Connector"],
    }),
    uninstallConnector: builder.mutation<void, string>({
      query: (connectionId) => ({
        url: "connectors.uninstall",
        method: "POST",
        body: { connectionId },
      }),
      invalidatesTags: ["Connector"],
    }),
    syncConnector: builder.mutation<void, string>({
      query: (connectionId) => ({
        url: "connectors.sync",
        method: "POST",
        body: { connectionId },
      }),
      invalidatesTags: ["Connector"],
    }),

    // ================== NOTIFICATIONS ==================
    getNotifications: builder.query<
      { notifications: Notification[]; hasMore: boolean; cursor: string | null },
      { cursor?: string; limit?: number } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.cursor) queryParams.set("cursor", params.cursor);
        if (params?.limit) queryParams.set("limit", params.limit.toString());
        return `notifications.list?${queryParams.toString()}`;
      },
      providesTags: ["Notification"],
    }),
    markNotificationAsRead: builder.mutation<void, string>({
      query: (id) => ({
        url: "notifications.markRead",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["Notification"],
    }),
    markAllNotificationsAsRead: builder.mutation<void, void>({
      query: () => ({
        url: "notifications.markAllRead",
        method: "POST",
      }),
      invalidatesTags: ["Notification"],
    }),
    deleteNotification: builder.mutation<void, string>({
      query: (id) => ({
        url: "notifications.delete",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["Notification"],
    }),
    getNotificationPreferences: builder.query<NotificationPreferences, void>({
      query: () => "notifications.preferences",
      providesTags: ["Notification"],
    }),
    updateNotificationPreferences: builder.mutation<
      NotificationPreferences,
      Partial<NotificationPreferences>
    >({
      query: (preferences) => ({
        url: "notifications.updatePreferences",
        method: "POST",
        body: preferences,
      }),
      invalidatesTags: ["Notification"],
    }),

    // ================== SCHEDULED TASKS ==================
    getScheduledTasks: builder.query<ScheduledTask[], void>({
      query: () => "scheduledTasks.list",
      providesTags: ["ScheduledTask"],
    }),
    getScheduledTask: builder.query<ScheduledTask, string>({
      query: (id) => `scheduledTasks.get?id=${id}`,
      providesTags: (result, error, id) => [{ type: "ScheduledTask", id }],
    }),
    createScheduledTask: builder.mutation<ScheduledTask, Partial<ScheduledTask>>({
      query: (body) => ({
        url: "scheduledTasks.create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["ScheduledTask"],
    }),
    updateScheduledTask: builder.mutation<
      ScheduledTask,
      { id: string; updates: Partial<ScheduledTask> }
    >({
      query: ({ id, updates }) => ({
        url: "scheduledTasks.update",
        method: "POST",
        body: { id, ...updates },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "ScheduledTask", id }],
    }),
    deleteScheduledTask: builder.mutation<void, string>({
      query: (id) => ({
        url: "scheduledTasks.delete",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["ScheduledTask"],
    }),
    getTaskExecutions: builder.query<ScheduledTaskExecution[], string>({
      query: (taskId) => `scheduledTasks.executions?taskId=${taskId}`,
      providesTags: (result, error, taskId) => [{ type: "ScheduledTask", id: taskId }],
    }),

    // ================== TEAM ==================
    getTeams: builder.query<Team[], void>({
      query: () => "teams.list",
      providesTags: ["Team"],
    }),
    getTeam: builder.query<Team, string>({
      query: (id) => `teams.get?id=${id}`,
      providesTags: (result, error, id) => [{ type: "Team", id }],
    }),
    createTeam: builder.mutation<Team, { name: string; description?: string }>({
      query: (body) => ({
        url: "teams.create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Team"],
    }),
    updateTeam: builder.mutation<Team, { id: string; updates: Partial<Team> }>({
      query: ({ id, updates }) => ({
        url: "teams.update",
        method: "POST",
        body: { id, ...updates },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Team", id }],
    }),
    deleteTeam: builder.mutation<void, string>({
      query: (id) => ({
        url: "teams.delete",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["Team"],
    }),
    getTeamMembers: builder.query<TeamMember[], string>({
      query: (teamId) => `teams.members?teamId=${teamId}`,
      providesTags: (result, error, teamId) => [{ type: "TeamMember", id: teamId }],
    }),
    inviteTeamMember: builder.mutation<
      TeamInvitation,
      { teamId: string; email: string; role: string }
    >({
      query: (body) => ({
        url: "teams.invite",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TeamMember", "Invitation"],
    }),
    removeTeamMember: builder.mutation<void, { teamId: string; memberId: string }>({
      query: (body) => ({
        url: "teams.removeMember",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TeamMember"],
    }),
    updateMemberRole: builder.mutation<
      void,
      { teamId: string; memberId: string; role: string }
    >({
      query: (body) => ({
        url: "teams.updateMemberRole",
        method: "POST",
        body,
      }),
      invalidatesTags: ["TeamMember"],
    }),

    // ================== PROJECTS ==================
    getProjects: builder.query<Project[], void>({
      query: () => "projects.list",
      providesTags: ["Project"],
    }),
    getProject: builder.query<Project, string>({
      query: (id) => `projects.get?id=${id}`,
      providesTags: (result, error, id) => [{ type: "Project", id }],
    }),
    createProject: builder.mutation<Project, Partial<Project>>({
      query: (body) => ({
        url: "projects.create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Project"],
    }),
    updateProject: builder.mutation<Project, { id: string; updates: Partial<Project> }>({
      query: ({ id, updates }) => ({
        url: "projects.update",
        method: "POST",
        body: { id, ...updates },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Project", id }],
    }),
    deleteProject: builder.mutation<void, string>({
      query: (id) => ({
        url: "projects.delete",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["Project"],
    }),
    getProjectSessions: builder.query<
      { sessions: ProjectSession[]; total: number },
      { projectId: string; cursor?: string }
    >({
      query: ({ projectId, cursor }) => {
        const queryParams = new URLSearchParams({ projectId });
        if (cursor) queryParams.set("cursor", cursor);
        return `projects.sessions?${queryParams.toString()}`;
      },
      providesTags: (result, error, { projectId }) => [{ type: "Project", id: projectId }],
    }),

    // ================== KNOWLEDGE BASE ==================
    getAttachments: builder.query<
      { attachments: Attachment[]; total: number },
      { groupId?: string; docType?: string; cursor?: string } | void
    >({
      query: (params) => {
        const queryParams = new URLSearchParams();
        if (params?.groupId) queryParams.set("groupId", params.groupId);
        if (params?.docType) queryParams.set("docType", params.docType);
        if (params?.cursor) queryParams.set("cursor", params.cursor);
        return `knowledge.attachments?${queryParams.toString()}`;
      },
      providesTags: ["Attachment"],
    }),
    uploadAttachment: builder.mutation<Attachment, FormData>({
      query: (formData) => ({
        url: "knowledge.upload",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["Attachment"],
    }),
    deleteAttachment: builder.mutation<void, string>({
      query: (id) => ({
        url: "knowledge.deleteAttachment",
        method: "POST",
        body: { id },
      }),
      invalidatesTags: ["Attachment"],
    }),
    getAttachmentGroups: builder.query<{ groups: AttachmentGroup[]; total: number }, void>({
      query: () => "knowledge.groups",
      providesTags: ["Attachment"],
    }),
    createAttachmentGroup: builder.mutation<
      AttachmentGroup,
      { name: string; description?: string }
    >({
      query: (body) => ({
        url: "knowledge.createGroup",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Attachment"],
    }),
    getKnowledgeBases: builder.query<KnowledgeBase[], void>({
      query: () => "knowledge.bases",
      providesTags: ["KnowledgeBase"],
    }),
    createKnowledgeBase: builder.mutation<KnowledgeBase, Partial<KnowledgeBase>>({
      query: (body) => ({
        url: "knowledge.createBase",
        method: "POST",
        body,
      }),
      invalidatesTags: ["KnowledgeBase"],
    }),

    // ================== CONFIG ==================
    getClientConfig: builder.query<ClientConfig, void>({
      query: () => "config.get",
      providesTags: ["Config"],
    }),
    updateClientConfig: builder.mutation<ClientConfig, Partial<ClientConfig>>({
      query: (config) => ({
        url: "config.update",
        method: "POST",
        body: config,
      }),
      invalidatesTags: ["Config"],
    }),

    // ================== USER ==================
    getCurrentUser: builder.query<{ id: string; email: string; name: string | null }, void>({
      query: () => "user.me",
      providesTags: ["User"],
    }),
    updateUserProfile: builder.mutation<
      void,
      { name?: string; image?: string }
    >({
      query: (body) => ({
        url: "user.updateProfile",
        method: "POST",
        body,
      }),
      invalidatesTags: ["User"],
    }),
  }),
});

export const {
  // Sessions
  useGetSessionsQuery,
  useGetSessionQuery,
  useCreateSessionMutation,
  useUpdateSessionMutation,
  useDeleteSessionMutation,
  // Messages
  useGetMessagesQuery,
  useSendMessageMutation,
  // Agents
  useGetAgentsQuery,
  useGetAgentTasksQuery,
  // Files
  useGetFilesQuery,
  useUploadFileMutation,
  useDeleteFileMutation,
  // Connectors
  useGetAvailableConnectorsQuery,
  useGetInstalledConnectorsQuery,
  useInstallConnectorMutation,
  useUninstallConnectorMutation,
  useSyncConnectorMutation,
  // Notifications
  useGetNotificationsQuery,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useDeleteNotificationMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  // Scheduled Tasks
  useGetScheduledTasksQuery,
  useGetScheduledTaskQuery,
  useCreateScheduledTaskMutation,
  useUpdateScheduledTaskMutation,
  useDeleteScheduledTaskMutation,
  useGetTaskExecutionsQuery,
  // Team
  useGetTeamsQuery,
  useGetTeamQuery,
  useCreateTeamMutation,
  useUpdateTeamMutation,
  useDeleteTeamMutation,
  useGetTeamMembersQuery,
  useInviteTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useUpdateMemberRoleMutation,
  // Projects
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectSessionsQuery,
  // Knowledge Base
  useGetAttachmentsQuery,
  useUploadAttachmentMutation,
  useDeleteAttachmentMutation,
  useGetAttachmentGroupsQuery,
  useCreateAttachmentGroupMutation,
  useGetKnowledgeBasesQuery,
  useCreateKnowledgeBaseMutation,
  // Config
  useGetClientConfigQuery,
  useUpdateClientConfigMutation,
  // User
  useGetCurrentUserQuery,
  useUpdateUserProfileMutation,
} = apiSlice;
