import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { AgentSession } from "../slices/sessions.slice";
import type { Message } from "../slices/chat.slice";
import type { Agent, AgentTask } from "../slices/agents.slice";
import type { FileItem } from "../slices/files.slice";

// Base API slice with RTK Query
export const apiSlice = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api/trpc",
    credentials: "include",
  }),
  tagTypes: ["Session", "Message", "Agent", "Task", "File", "User"],
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
} = apiSlice;
