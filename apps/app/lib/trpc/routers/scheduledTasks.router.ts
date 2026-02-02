import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  scheduledTasks,
  taskExecutions,
  eq,
  and,
  desc,
  gte,
  lte,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";

export const scheduledTasksRouter = createTRPCRouter({
  // List scheduled tasks
  list: protectedProcedure
    .input(
      z.object({
        status: z
          .enum(["pending", "running", "completed", "failed", "cancelled", "paused"])
          .optional(),
        taskType: z
          .enum(["agent_run", "report", "sync", "backup", "custom"])
          .optional(),
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
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.id, input.id),
            eq(scheduledTasks.userId, ctx.user.id)
          )
        )
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
        scheduleType: z.enum(["once", "recurring", "cron"]),
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
        payload: z.record(z.unknown()).optional(),
        // Retry config
        maxRetries: z.number().min(0).max(10).default(3),
        retryDelaySeconds: z.number().min(0).default(60),
        // End conditions
        endDate: z.date().optional(),
        maxRuns: z.number().min(1).optional(),
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

      const id = createId();

      // Calculate next run time
      let nextRunAt: Date | undefined;
      if (input.scheduleType === "once") {
        nextRunAt = input.scheduledAt;
      } else {
        // TODO: Calculate next run time based on schedule
        nextRunAt = new Date();
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
        })
        .returning();

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
        payload: z.record(z.unknown()).optional(),
        maxRetries: z.number().min(0).max(10).optional(),
        retryDelaySeconds: z.number().min(0).optional(),
        endDate: z.date().optional(),
        maxRuns: z.number().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, ctx.user.id))
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const [task] = await db
        .update(scheduledTasks)
        .set(updates)
        .where(eq(scheduledTasks.id, id))
        .returning();

      return task;
    }),

  // Pause a task
  pause: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.id, input.id),
            eq(scheduledTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const [task] = await db
        .update(scheduledTasks)
        .set({ status: "paused", isEnabled: false })
        .where(eq(scheduledTasks.id, input.id))
        .returning();

      return task;
    }),

  // Resume a task
  resume: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.id, input.id),
            eq(scheduledTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const [task] = await db
        .update(scheduledTasks)
        .set({ status: "pending", isEnabled: true })
        .where(eq(scheduledTasks.id, input.id))
        .returning();

      return task;
    }),

  // Cancel a task
  cancel: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.id, input.id),
            eq(scheduledTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const [task] = await db
        .update(scheduledTasks)
        .set({ status: "cancelled", isEnabled: false })
        .where(eq(scheduledTasks.id, input.id))
        .returning();

      return task;
    }),

  // Delete a task
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.id, input.id),
            eq(scheduledTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      await db.delete(scheduledTasks).where(eq(scheduledTasks.id, input.id));

      return { success: true };
    }),

  // Run a task now
  runNow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.id, input.id),
            eq(scheduledTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      // Create execution record
      const executionId = createId();
      await db.insert(taskExecutions).values({
        id: executionId,
        scheduledTaskId: input.id,
        status: "pending",
      });

      // Update task status
      await db
        .update(scheduledTasks)
        .set({ status: "running" })
        .where(eq(scheduledTasks.id, input.id));

      // TODO: Trigger actual task execution via queue/worker

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
      // Verify ownership
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.id, input.taskId),
            eq(scheduledTasks.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!task) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      }

      const executions = await db
        .select()
        .from(taskExecutions)
        .where(eq(taskExecutions.scheduledTaskId, input.taskId))
        .orderBy(desc(taskExecutions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return executions;
    }),
});
