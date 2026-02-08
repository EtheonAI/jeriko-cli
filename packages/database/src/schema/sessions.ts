import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [agentSessions.userId],
    references: [users.id],
  }),
  messages: many(messages),
  agents: many(agents),
  files: many(files),
}));

// Messages in agent sessions
export const messages = pgTable("messages", {
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
  /** Structured message parts (text, tool calls, tool results with screenshots, etc.) */
  parts: jsonb("parts").$type<unknown[]>(),
  metadata: jsonb("metadata").$type<{
    toolName?: string;
    toolCallId?: string;
    model?: string;
    tokens?: { input: number; output: number };
    [key: string]: unknown;
  }>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(agentSessions, {
    fields: [messages.sessionId],
    references: [agentSessions.id],
  }),
}));

// Forward declaration
import { agents } from "./agents";
import { files } from "./files";
