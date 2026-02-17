import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  scheduledTasks,
  taskExecutions,
  userConnectors,
  connectorDefinitions,
  eq,
  and,
  desc,
  gte,
  lte,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { syncTaskToSearch, removeTaskFromSearch } from "@repo/search";

const CONNECTOR_SERVICE_URL =
  process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

export const scheduledTasksRouter = createTRPCRouter({
  // List scheduled tasks
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "running", "completed", "failed", "cancelled", "paused"])
          .optional(),
        taskType: z.enum(["agent_run", "report", "sync", "backup", "custom"]).optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(scheduledTasks.userId, ctx.user.id)];

      if (input.status) {
        conditions.push(eq(scheduledTasks.status, input.status));
      }

      if (input.taskType) {
        conditions.push(eq(scheduledTasks.taskType, input.taskType));
      }

      const tasks = await db
        .select()
        .from(scheduledTasks)
        .where(and(...conditions))
        .orderBy(desc(scheduledTasks.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return tasks;
    }),

  // Get a single task
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [task] = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.id, input.id), eq(scheduledTasks.userId, ctx.user.id)))
      .limit(1);

    if (!task) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }

    return task;
  }),

  // Create a scheduled task
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        taskType: z.enum(["agent_run", "report", "sync", "backup", "custom"]),
        scheduleType: z.enum(["once", "recurring", "cron", "trigger"]),
        // One-time schedule
        scheduledAt: z.date().optional(),
        // Recurring schedule
        recurrencePattern: z
          .enum(["daily", "weekly", "biweekly", "monthly", "yearly", "custom"])
          .optional(),
        recurrenceInterval: z.number().min(1).optional(),
        recurrenceDaysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        recurrenceDayOfMonth: z.number().min(1).max(31).optional(),
        recurrenceTime: z.string().optional(),
        // Cron schedule
        cronExpression: z.string().optional(),
        // Timezone
        timezone: z.string().default("UTC"),
        // Task payload
        payload: z.record(z.string(), z.unknown()).optional(),
        // Retry config
        maxRetries: z.number().min(0).max(10).default(3),
        retryDelaySeconds: z.number().min(0).default(60),
        // End conditions
        endDate: z.date().optional(),
        maxRuns: z.number().min(1).optional(),
        // Trigger fields
        triggerEnabled: z.boolean().optional(),
        triggerAppName: z.string().optional(),
        triggerEventSlug: z.string().optional(),
        triggerConfig: z.record(z.string(), z.unknown()).optional(),
        // Organization
        organizationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate schedule configuration
      if (input.scheduleType === "once" && !input.scheduledAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "scheduledAt is required for one-time tasks",
        });
      }

      if (input.scheduleType === "recurring" && !input.recurrencePattern) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "recurrencePattern is required for recurring tasks",
        });
      }

      if (input.scheduleType === "cron" && !input.cronExpression) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "cronExpression is required for cron tasks",
        });
      }

      if (
        input.scheduleType === "trigger" &&
        (!input.triggerAppName || !input.triggerEventSlug)
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "triggerAppName and triggerEventSlug are required for trigger tasks",
        });
      }

      // Pre-validate: user must have the trigger app connected
      if (input.scheduleType === "trigger" && input.triggerAppName) {
        const [connDef] = await db
          .select({ id: connectorDefinitions.id })
          .from(connectorDefinitions)
          .where(eq(connectorDefinitions.type, input.triggerAppName))
          .limit(1);

        if (!connDef) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown app "${input.triggerAppName}". Please check the app name.`,
          });
        }

        const [connection] = await db
          .select({ id: userConnectors.id })
          .from(userConnectors)
          .where(
            and(
              eq(userConnectors.userId, ctx.user.id),
              eq(userConnectors.connectorDefinitionId, connDef.id),
              eq(userConnectors.status, "connected"),
            ),
          )
          .limit(1);

        if (!connection) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: `You must connect ${input.triggerAppName} first. Go to Applications to connect it.`,
          });
        }
      }

      const id = createId();

      // Calculate next run time (trigger-only tasks have no time schedule)
      let nextRunAt: Date | undefined;
      if (input.scheduleType === "trigger") {
        nextRunAt = undefined; // No time-based schedule
      } else if (input.scheduleType === "once") {
        nextRunAt = input.scheduledAt;
      } else if (input.scheduleType === "recurring") {
        // Calculate next occurrence based on recurrence pattern
        const now = new Date();
        const next = new Date(now);
        next.setSeconds(0, 0);

        // Apply recurrence time (HH:MM)
        if (input.recurrenceTime) {
          const [h, m] = input.recurrenceTime.split(":").map(Number);
          next.setHours(h ?? 9, m ?? 0);
        } else {
          next.setHours(9, 0); // Default 9 AM
        }

        const interval = input.recurrenceInterval ?? 1;

        switch (input.recurrencePattern) {
          case "daily":
            if (next <= now) next.setDate(next.getDate() + interval);
            break;
          case "weekly": {
            const days = input.recurrenceDaysOfWeek;
            if (days && days.length > 0) {
              const sorted = [...days].sort((a, b) => a - b);
              const currentDay = now.getDay();
              let found = false;
              for (const day of sorted) {
                if (day > currentDay || (day === currentDay && next > now)) {
                  next.setDate(next.getDate() + (day - currentDay));
                  found = true;
                  break;
                }
              }
              if (!found) {
                const daysUntilFirst = 7 - currentDay + sorted[0]!;
                next.setDate(next.getDate() + daysUntilFirst + (interval - 1) * 7);
              }
            } else {
              if (next <= now) next.setDate(next.getDate() + 7 * interval);
            }
            break;
          }
          case "biweekly":
            if (next <= now) next.setDate(next.getDate() + 14);
            break;
          case "monthly":
            if (input.recurrenceDayOfMonth) next.setDate(input.recurrenceDayOfMonth);
            if (next <= now) next.setMonth(next.getMonth() + interval);
            break;
          case "yearly":
            if (next <= now) next.setFullYear(next.getFullYear() + interval);
            break;
          default:
            if (next <= now) next.setDate(next.getDate() + interval);
        }

        nextRunAt = next;
      } else if (input.scheduleType === "cron" && input.cronExpression) {
        // For cron, set nextRunAt to now — the task service cron-scheduler
        // will recalculate using cron-parser when it picks up the task.
        // We set it 1 minute in the future so it doesn't fire immediately.
        nextRunAt = new Date(Date.now() + 60_000);
      }

      const [task] = await db
        .insert(scheduledTasks)
        .values({
          id,
          userId: ctx.user.id,
          organizationId: input.organizationId,
          name: input.name,
          description: input.description,
          taskType: input.taskType,
          scheduleType: input.scheduleType,
          scheduledAt: input.scheduledAt,
          recurrencePattern: input.recurrencePattern,
          recurrenceInterval: input.recurrenceInterval,
          recurrenceDaysOfWeek: input.recurrenceDaysOfWeek,
          recurrenceDayOfMonth: input.recurrenceDayOfMonth,
          recurrenceTime: input.recurrenceTime,
          cronExpression: input.cronExpression,
          timezone: input.timezone,
          payload: input.payload,
          maxRetries: input.maxRetries,
          retryDelaySeconds: input.retryDelaySeconds,
          endDate: input.endDate,
          maxRuns: input.maxRuns,
          nextRunAt,
          status: "pending",
          isEnabled: true,
          triggerEnabled: input.triggerEnabled ?? (input.scheduleType === "trigger"),
          triggerAppName: input.triggerAppName,
          triggerEventSlug: input.triggerEventSlug,
          triggerConfig: input.triggerConfig,
        })
        .returning();

      if (task) {
        void syncTaskToSearch(task);

        // Subscribe Composio trigger for trigger-type tasks
        if (
          input.scheduleType === "trigger" &&
          input.triggerEventSlug &&
          task
        ) {
          try {
            const resp = await fetch(`${CONNECTOR_SERVICE_URL}/triggers/subscribe`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": ctx.user.id,
              },
              body: JSON.stringify({
                triggerSlug: input.triggerEventSlug,
                triggerConfig: input.triggerConfig ?? {},
                scheduledTaskId: id,
              }),
              signal: AbortSignal.timeout(15_000),
            });

            if (!resp.ok) {
              const errText = await resp.text().catch(() => "Unknown error");
              console.error(`Trigger subscribe failed: ${resp.status} - ${errText}`);
              // Clean up the task since trigger subscription failed
              await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to subscribe trigger: ${errText}. Make sure the app is connected.`,
              });
            }

            const result = (await resp.json()) as { triggerId?: string };
            if (result.triggerId) {
              await db
                .update(scheduledTasks)
                .set({ composioTriggerId: result.triggerId })
                .where(eq(scheduledTasks.id, id));

              // Return updated task with triggerId
              const [updated] = await db
                .select()
                .from(scheduledTasks)
                .where(eq(scheduledTasks.id, id))
                .limit(1);
              if (updated) return updated;
            }
          } catch (err) {
            if (err instanceof TRPCError) throw err;
            console.error("Trigger subscription error:", err);
            // Clean up the task
            await db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Failed to subscribe trigger. Please try again.",
            });
          }
        }
      }

      return task;
    }),

  // Update a scheduled task
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        isEnabled: z.boolean().optional(),
        scheduledAt: z.date().optional(),
        recurrencePattern: z
          .enum(["daily", "weekly", "biweekly", "monthly", "yearly", "custom"])
          .optional(),
        recurrenceInterval: z.number().min(1).optional(),
        recurrenceDaysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        recurrenceDayOfMonth: z.number().min(1).max(31).optional(),
        recurrenceTime: z.string().optional(),
        cronExpression: z.string().optional(),
        timezone: z.string().optional(),
        payload: z.record(z.string(), z.unknown()).optional(),
        maxRetries: z.number().min(0).max(10).optional(),
        retryDelaySeconds: z.number().min(0).optional(),
        endDate: z.date().optional(),
        maxRuns: z.number().min(1).optional(),
        triggerEnabled: z.boolean().optional(),
        triggerAppName: z.string().optional(),
        triggerEventSlug: z.string().optional(),
        triggerConfig: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const [task] = await db
        .update(scheduledTasks)
        .set(updates)
        .where(eq(scheduledTasks.id, id))
        .returning();

      if (task) {
        void syncTaskToSearch(task);
        // TODO: Publish scheduledTask:update event via gateway/backend service
      }

      return task;
    }),

  // Pause a task
  pause: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select()
      .from(scheduledTasks)
      .where(and(eq(scheduledTasks.id, input.id), eq(scheduledTasks.userId, ctx.user.id)))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
    }

    const [task] = await db
      .update(scheduledTasks)
      .set({ status: "paused", isEnabled: false })
      .where(eq(scheduledTasks.id, input.id))
      .returning();

    if (task) {
      void syncTaskToSearch(task);
      // TODO: Publish scheduledTask:update event via gateway/backend service
    }

    return task;
  }),

  // Resume a task
  resume: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, input.id), eq(scheduledTasks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const [task] = await db
        .update(scheduledTasks)
        .set({ status: "pending", isEnabled: true })
        .where(eq(scheduledTasks.id, input.id))
        .returning();

      if (task) {
        void syncTaskToSearch(task);
        // TODO: Publish scheduledTask:update event via gateway/backend service
      }

      return task;
    }),

  // Cancel a task
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, input.id), eq(scheduledTasks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Disable Composio trigger if present
      if (existing.composioTriggerId) {
        fetch(
          `${CONNECTOR_SERVICE_URL}/triggers/${existing.composioTriggerId}/disable`,
          {
            method: "PATCH",
            headers: { "x-user-id": ctx.user.id },
            signal: AbortSignal.timeout(10_000),
          },
        ).catch(() => {}); // Non-fatal
      }

      const [task] = await db
        .update(scheduledTasks)
        .set({ status: "cancelled", isEnabled: false, triggerEnabled: false })
        .where(eq(scheduledTasks.id, input.id))
        .returning();

      if (task) {
        void syncTaskToSearch(task);
      }

      return task;
    }),

  // Delete a task
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, input.id), eq(scheduledTasks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Clean up Composio trigger if present
      if (existing.composioTriggerId) {
        fetch(`${CONNECTOR_SERVICE_URL}/triggers/${existing.composioTriggerId}`, {
          method: "DELETE",
          headers: { "x-user-id": ctx.user.id },
          signal: AbortSignal.timeout(10_000),
        }).catch(() => {}); // Non-fatal
      }

      await db.delete(scheduledTasks).where(eq(scheduledTasks.id, input.id));

      void removeTaskFromSearch(input.id);

      return { success: true };
    }),

  // Run a task now
  runNow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, input.id), eq(scheduledTasks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Create execution record
      const executionId = createId();
      const [execution] = await db
        .insert(taskExecutions)
        .values({
          id: executionId,
          scheduledTaskId: input.id,
          status: "pending",
        })
        .returning();

      // Update task status
      const [task] = await db
        .update(scheduledTasks)
        .set({ status: "running" })
        .where(eq(scheduledTasks.id, input.id))
        .returning();

      if (task) {
        // Trigger execution via task service → Inngest
        const TASK_SERVICE_URL = process.env.TASK_SERVICE_URL || "http://localhost:3002";
        try {
          const resp = await fetch(`${TASK_SERVICE_URL}/scheduled-tasks/${input.id}/trigger`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": ctx.user.id,
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (!resp.ok) {
            const errText = await resp.text().catch(() => "Unknown error");
            console.warn(`Task service trigger returned ${resp.status}: ${errText}`);
          }
        } catch (err) {
          // Non-fatal — execution record already created above
          console.warn("Failed to trigger task execution via task service:", err);
        }
      }

      return { executionId };
    }),

  // Get execution history
  getExecutions: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Run ownership check + executions query in parallel
      const [[task], executions] = await Promise.all([
        db
          .select()
          .from(scheduledTasks)
          .where(and(eq(scheduledTasks.id, input.taskId), eq(scheduledTasks.userId, ctx.user.id)))
          .limit(1),
        db
          .select()
          .from(taskExecutions)
          .where(eq(taskExecutions.scheduledTaskId, input.taskId))
          .orderBy(desc(taskExecutions.createdAt))
          .limit(input.limit)
          .offset(input.offset),
      ]);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      return executions;
    }),

  // List available trigger types from connected apps
  listTriggerTypes: protectedProcedure.query(async ({ ctx }) => {
    const CONNECTOR_SERVICE_URL =
      process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";
    try {
      const resp = await fetch(`${CONNECTOR_SERVICE_URL}/triggers/types`, {
        headers: { "x-user-id": ctx.user.id },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) return { triggers: [] };
      return (await resp.json()) as {
        triggers: Array<{
          slug: string;
          appName: string;
          description: string;
          configSchema?: Record<string, unknown>;
          payloadSchema?: Record<string, unknown>;
        }>;
      };
    } catch {
      return { triggers: [] };
    }
  }),

  // Get trigger type config/payload schema
  getTriggerTypeConfig: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const CONNECTOR_SERVICE_URL =
        process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";
      try {
        const resp = await fetch(
          `${CONNECTOR_SERVICE_URL}/triggers/types/${encodeURIComponent(input.slug)}`,
          { signal: AbortSignal.timeout(10_000) },
        );
        if (!resp.ok) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Trigger type not found" });
        }
        return (await resp.json()) as {
          slug: string;
          appName: string;
          description: string;
          configSchema: Record<string, unknown>;
          payloadSchema: Record<string, unknown>;
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch trigger type config",
        });
      }
    }),
});
