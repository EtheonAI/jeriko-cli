import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

/**
 * Scheduled Tasks Schema
 * Recurring and scheduled task management
 */

export type TaskScheduleType = "once" | "recurring" | "cron" | "trigger";
export type TaskStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "paused";
export type RecurrencePattern =
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly"
  | "yearly"
  | "custom";

// Scheduled Tasks
export const scheduledTasks = pgTable("scheduled_tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  // Task details
  name: text("name").notNull(),
  description: text("description"),
  taskType: text("task_type", {
    enum: ["agent_run", "report", "sync", "backup", "custom"],
  }).notNull(),
  // Schedule configuration
  scheduleType: text("schedule_type", {
    enum: ["once", "recurring", "cron", "trigger"],
  }).notNull(),
  // For one-time tasks
  scheduledAt: timestamp("scheduled_at", { mode: "date" }),
  // For recurring tasks
  recurrencePattern: text("recurrence_pattern", {
    enum: ["daily", "weekly", "biweekly", "monthly", "yearly", "custom"],
  }),
  recurrenceInterval: integer("recurrence_interval").default(1),
  recurrenceDaysOfWeek: jsonb("recurrence_days_of_week").$type<number[]>(), // 0-6
  recurrenceDayOfMonth: integer("recurrence_day_of_month"),
  recurrenceTime: text("recurrence_time"), // HH:MM format
  // For cron tasks
  cronExpression: text("cron_expression"),
  // Timezone
  timezone: text("timezone").default("UTC").notNull(),
  // Status
  status: text("status", {
    enum: ["pending", "running", "completed", "failed", "cancelled", "paused"],
  })
    .default("pending")
    .notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  // Execution tracking
  lastRunAt: timestamp("last_run_at", { mode: "date" }),
  lastRunStatus: text("last_run_status", {
    enum: ["success", "failed", "partial"],
  }),
  lastRunError: text("last_run_error"),
  nextRunAt: timestamp("next_run_at", { mode: "date" }),
  runCount: integer("run_count").default(0).notNull(),
  // Retry configuration
  maxRetries: integer("max_retries").default(3),
  retryDelaySeconds: integer("retry_delay_seconds").default(60),
  currentRetryCount: integer("current_retry_count").default(0),
  // Task payload (what to execute)
  payload: jsonb("payload").$type<{
    agentId?: string;
    sessionId?: string;
    prompt?: string;
    parameters?: Record<string, unknown>;
    webhookUrl?: string;
    [key: string]: unknown;
  }>(),
  // Trigger configuration (Composio event-driven execution)
  triggerEnabled: boolean("trigger_enabled").default(false).notNull(),
  triggerAppName: text("trigger_app_name"), // e.g., "gmail", "github"
  triggerEventSlug: text("trigger_event_slug"), // e.g., "GMAIL_NEW_GMAIL_MESSAGE"
  triggerConfig: jsonb("trigger_config").$type<Record<string, unknown>>(), // trigger-specific config
  composioTriggerId: text("composio_trigger_id"), // Composio trigger instance ID (ti_xxx)
  lastTriggerAt: timestamp("last_trigger_at", { mode: "date" }),
  lastTriggerEventId: text("last_trigger_event_id"), // dedup key
  // Linked chat session — one session per scheduled task, reused across all executions
  sessionId: text("session_id"),
  // End conditions
  endDate: timestamp("end_date", { mode: "date" }),
  maxRuns: integer("max_runs"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const scheduledTasksRelations = relations(
  scheduledTasks,
  ({ one, many }) => ({
    user: one(users, {
      fields: [scheduledTasks.userId],
      references: [users.id],
    }),
    organization: one(organizations, {
      fields: [scheduledTasks.organizationId],
      references: [organizations.id],
    }),
    executions: many(taskExecutions),
  })
);

// Task Executions - history of task runs
export const taskExecutions = pgTable("task_executions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  scheduledTaskId: text("scheduled_task_id")
    .notNull()
    .references(() => scheduledTasks.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["pending", "running", "success", "failed", "cancelled"],
  }).notNull(),
  // Execution details
  startedAt: timestamp("started_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
  durationMs: integer("duration_ms"),
  // Results
  output: jsonb("output").$type<Record<string, unknown>>(),
  error: text("error"),
  errorStack: text("error_stack"),
  // Retry info
  retryNumber: integer("retry_number").default(0),
  // Related session if agent run
  sessionId: text("session_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const taskExecutionsRelations = relations(taskExecutions, ({ one }) => ({
  scheduledTask: one(scheduledTasks, {
    fields: [taskExecutions.scheduledTaskId],
    references: [scheduledTasks.id],
  }),
}));

// Trigger Events - audit log for Composio trigger firings
export const triggerEvents = pgTable("trigger_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  scheduledTaskId: text("scheduled_task_id")
    .notNull()
    .references(() => scheduledTasks.id, { onDelete: "cascade" }),
  composioTriggerId: text("composio_trigger_id").notNull(),
  eventSlug: text("event_slug").notNull(), // e.g., "GMAIL_NEW_GMAIL_MESSAGE"
  externalEventId: text("external_event_id"), // Composio event ID (for dedup)
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  processed: boolean("processed").default(false).notNull(),
  processedAt: timestamp("processed_at", { mode: "date" }),
  executionId: text("execution_id"), // links to task_executions
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const triggerEventsRelations = relations(triggerEvents, ({ one }) => ({
  scheduledTask: one(scheduledTasks, {
    fields: [triggerEvents.scheduledTaskId],
    references: [scheduledTasks.id],
  }),
}));

// Export types
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type NewScheduledTask = typeof scheduledTasks.$inferInsert;
export type TaskExecution = typeof taskExecutions.$inferSelect;
export type NewTaskExecution = typeof taskExecutions.$inferInsert;
export type TriggerEvent = typeof triggerEvents.$inferSelect;
export type NewTriggerEvent = typeof triggerEvents.$inferInsert;
