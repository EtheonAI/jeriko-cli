import { pgTable, text, timestamp, jsonb, integer, primaryKey, index } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";

// Agent Sessions - AI agent work sessions (not auth sessions)
export const agentSessions = pgTable("agent_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  status: text("status", {
    enum: ["active", "paused", "completed", "failed"],
  }).default("active"),
  /** Active resumable stream ID — tracks in-flight SSE stream for reconnection */
  activeStreamId: text("active_stream_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// Messages in agent sessions
export const messages = pgTable(
  "messages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    sessionId: text("session_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    role: text("role", {
      enum: ["user", "assistant", "system", "tool"],
    }).notNull(),
    content: text("content").notNull(),
    /** Full AI SDK UIMessage parts array — preserves tool calls, plans, step-starts for historical replay */
    parts: jsonb("parts").$type<Record<string, unknown>[]>(),
    metadata: jsonb("metadata").$type<{
      toolName?: string;
      toolCallId?: string;
      model?: string;
      tokens?: { input: number; output: number };
      [key: string]: unknown;
    }>(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [index("idx_messages_session_created").on(table.sessionId, table.createdAt)]
);

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(agentSessions, {
    fields: [messages.sessionId],
    references: [agentSessions.id],
  }),
}));

// Votes — user feedback (1-5 star rating) on assistant messages
// NOTE: messageId is NOT an FK to messages.id because the client uses AI SDK-
// generated message IDs that don't match the server-generated DB IDs. The
// chatId FK still cascades deletes when a session is removed.
export const votes = pgTable(
  "votes",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => agentSessions.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    rating: integer("rating").notNull(), // 1-5 stars
  },
  (table) => [primaryKey({ columns: [table.chatId, table.messageId] })]
);

export const votesRelations = relations(votes, ({ one }) => ({
  chat: one(agentSessions, {
    fields: [votes.chatId],
    references: [agentSessions.id],
  }),
}));

export type Vote = typeof votes.$inferSelect;
export type NewVote = typeof votes.$inferInsert;

// Documents — inline artifacts/editable content created within chat
export const documents = pgTable("documents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  chatId: text("chat_id")
    .notNull()
    .references(() => agentSessions.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  kind: text("kind", {
    enum: ["text", "code", "image", "sheet", "html"],
  })
    .notNull()
    .default("text"),
  content: text("content"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const documentsRelations = relations(documents, ({ one }) => ({
  chat: one(agentSessions, {
    fields: [documents.chatId],
    references: [agentSessions.id],
  }),
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
}));

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentKind = "text" | "code" | "image" | "sheet" | "html";
