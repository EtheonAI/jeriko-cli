import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { agentSessions } from "./sessions";

// Agent types available in the system
export type AgentType =
  | "orchestrator"
  | "researcher"
  | "coder"
  | "browser"
  | "file_manager"
  | "executor"
  | "analyst";

export type AgentStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "waiting"
  | "completed"
  | "failed";

// Agents - AI agents working within sessions
export const agents = pgTable("agents", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sessionId: text("session_id")
    .notNull()
    .references(() => agentSessions.id, { onDelete: "cascade" }),
  type: text("type", {
    enum: [
      "orchestrator",
      "researcher",
      "coder",
      "browser",
      "file_manager",
      "executor",
      "analyst",
    ],
  }).notNull(),
  name: text("name"),
  status: text("status", {
    enum: ["idle", "thinking", "executing", "waiting", "completed", "failed"],
  }).default("idle"),
  currentTask: text("current_task"),
  progress: integer("progress").default(0), // 0-100
  metadata: jsonb("metadata").$type<{
    model?: string;
    tools?: string[];
    capabilities?: string[];
    [key: string]: unknown;
  }>(),
  lastActivity: timestamp("last_activity", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const agentsRelations = relations(agents, ({ one, many }) => ({
  session: one(agentSessions, {
    fields: [agents.sessionId],
    references: [agentSessions.id],
  }),
  tasks: many(agentTasks),
}));

// Agent Tasks - individual tasks assigned to agents
export const agentTasks = pgTable("agent_tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  agentId: text("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  parentTaskId: text("parent_task_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", {
    enum: ["pending", "in_progress", "completed", "failed", "cancelled"],
  }).default("pending"),
  priority: integer("priority").default(0),
  result: jsonb("result").$type<{
    success: boolean;
    output?: unknown;
    error?: string;
    [key: string]: unknown;
  }>(),
  startedAt: timestamp("started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const agentTasksRelations = relations(agentTasks, ({ one, many }) => ({
  agent: one(agents, {
    fields: [agentTasks.agentId],
    references: [agents.id],
  }),
  parentTask: one(agentTasks, {
    fields: [agentTasks.parentTaskId],
    references: [agentTasks.id],
    relationName: "subtasks",
  }),
  subtasks: many(agentTasks, { relationName: "subtasks" }),
}));
