import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";
import { agentSessions } from "./sessions";

// Sandbox status enum values
export const sandboxStatuses = ["creating", "running", "paused", "stopped", "error", "terminated"] as const;
export type SandboxStatus = (typeof sandboxStatuses)[number];

// Sandbox type enum values
export const sandboxTypes = ["code", "browser", "desktop", "custom"] as const;
export type SandboxType = (typeof sandboxTypes)[number];

// Sandboxes table - E2B sandbox instances
export const sandboxes = pgTable("sandboxes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id"),
  projectId: text("project_id"),
  agentSessionId: text("agent_session_id")
    .references(() => agentSessions.id, { onDelete: "set null" }),

  // E2B sandbox details
  e2bSandboxId: text("e2b_sandbox_id"), // External E2B sandbox ID
  templateId: text("template_id"), // E2B template used

  name: text("name").notNull(),
  type: text("type").$type<SandboxType>().notNull().default("code"),
  status: text("status").$type<SandboxStatus>().notNull().default("creating"),

  // Sandbox configuration
  config: jsonb("config").$type<{
    timeout?: number;
    memory?: number;
    cpu?: number;
    env?: Record<string, string>;
    ports?: number[];
  }>().default({}),

  // Runtime info
  hostname: text("hostname"),
  ports: jsonb("ports").$type<Array<{ internal: number; external: number }>>().default([]),

  // File system
  workingDirectory: text("working_directory").default("/home/user"),

  // Session timing
  startedAt: timestamp("started_at"),
  lastActivityAt: timestamp("last_activity_at"),
  expiresAt: timestamp("expires_at"),

  // Resource usage
  cpuUsage: integer("cpu_usage"), // Percentage
  memoryUsage: integer("memory_usage"), // MB

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sandboxesRelations = relations(sandboxes, ({ one, many }) => ({
  user: one(users, {
    fields: [sandboxes.userId],
    references: [users.id],
  }),
  agentSession: one(agentSessions, {
    fields: [sandboxes.agentSessionId],
    references: [agentSessions.id],
  }),
  executions: many(sandboxExecutions),
  files: many(sandboxFiles),
}));

// Sandbox executions - code/command executions in sandbox
export const sandboxExecutions = pgTable("sandbox_executions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sandboxId: text("sandbox_id").notNull(),

  // Execution details
  type: text("type").$type<"code" | "command" | "script">().notNull(),
  language: text("language"), // python, javascript, bash, etc.
  code: text("code").notNull(),

  // Execution status
  status: text("status").$type<"pending" | "running" | "completed" | "failed" | "timeout">().notNull().default("pending"),

  // Results
  stdout: text("stdout"),
  stderr: text("stderr"),
  exitCode: integer("exit_code"),
  result: jsonb("result").$type<unknown>(), // Structured result if applicable
  error: text("error"),

  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  executionTimeMs: integer("execution_time_ms"),

  // Resource limits
  timeoutMs: integer("timeout_ms").default(30000),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sandboxExecutionsRelations = relations(sandboxExecutions, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [sandboxExecutions.sandboxId],
    references: [sandboxes.id],
  }),
}));

// Sandbox files - files in sandbox filesystem
export const sandboxFiles = pgTable("sandbox_files", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sandboxId: text("sandbox_id").notNull(),

  path: text("path").notNull(),
  name: text("name").notNull(),
  isDirectory: boolean("is_directory").notNull().default(false),

  // Content (for small files, otherwise use storage reference)
  content: text("content"),
  storageUrl: text("storage_url"), // For large files

  // File info
  size: integer("size"),
  mimeType: text("mime_type"),

  // Versioning
  version: integer("version").notNull().default(1),
  checksum: text("checksum"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sandboxFilesRelations = relations(sandboxFiles, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [sandboxFiles.sandboxId],
    references: [sandboxes.id],
  }),
}));

// Type exports
export type Sandbox = typeof sandboxes.$inferSelect;
export type NewSandbox = typeof sandboxes.$inferInsert;
export type SandboxExecution = typeof sandboxExecutions.$inferSelect;
export type NewSandboxExecution = typeof sandboxExecutions.$inferInsert;
export type SandboxFile = typeof sandboxFiles.$inferSelect;
export type NewSandboxFile = typeof sandboxFiles.$inferInsert;
