import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  db,
  eq,
  and,
  desc,
  scheduledTasks,
  taskExecutions,
} from "../lib/db.js";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  publish,
  dispatchWebhookEvent,
} from "@repo/service-utils";
import { inngest } from "../lib/inngest-client.js";
import { calculateNextRunAt } from "../lib/schedule-utils.js";

const logger = createLogger({ service: "scheduled-tasks-routes" });

// ─── Input Schemas ─────────────────────────────────────────────────

const CreateScheduledTaskSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  taskType: z.enum(["agent_run", "report", "sync", "backup", "custom"]),
  scheduleType: z.enum(["once", "recurring", "cron"]),
  scheduledAt: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  recurrencePattern: z
    .enum(["daily", "weekly", "biweekly", "monthly", "yearly", "custom"])
    .optional(),
  recurrenceInterval: z.number().min(1).optional(),
  recurrenceDaysOfWeek: z.array(z.number().min(0).max(6)).optional(),
  recurrenceDayOfMonth: z.number().min(1).max(31).optional(),
  recurrenceTime: z.string().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().default("UTC"),
  payload: z.record(z.string(), z.any()).optional(),
  maxRetries: z.number().min(0).max(10).default(3),
  retryDelaySeconds: z.number().min(0).default(60),
  endDate: z.string().optional().transform((v) => (v ? new Date(v) : undefined)),
  maxRuns: z.number().min(1).optional(),
  isEnabled: z.boolean().default(true),
});

const ListScheduledTasksSchema = z.object({
  status: z
    .enum(["pending", "running", "completed", "failed", "cancelled", "paused"])
    .optional(),
  taskType: z.enum(["agent_run", "report", "sync", "backup", "custom"]).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

// ─── Helper ────────────────────────────────────────────────────────

function getUserId(request: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const userId = request.headers["x-user-id"] as string | undefined;
  if (!userId) {
    const error = new Error("Unauthorized") as Error & {
      statusCode: number;
      code: string;
    };
    error.statusCode = 401;
    error.code = ErrorCodes.UNAUTHORIZED;
    throw error;
  }
  return userId;
}

// ─── Routes ─────────────────────────────────────────────────────────

export const scheduledTaskRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Create scheduled task ──
  fastify.post("/scheduled-tasks", async (request, reply) => {
    const userId = getUserId(request);
    const input = CreateScheduledTaskSchema.parse(request.body);

    // Validate schedule-specific fields
    if (input.scheduleType === "once" && !input.scheduledAt) {
      return reply.status(400).send(
        errorResponse(
          { code: ErrorCodes.VALIDATION_ERROR, message: "scheduledAt is required for one-time tasks" },
          request.id,
        ),
      );
    }
    if (input.scheduleType === "cron" && !input.cronExpression) {
      return reply.status(400).send(
        errorResponse(
          { code: ErrorCodes.VALIDATION_ERROR, message: "cronExpression is required for cron tasks" },
          request.id,
        ),
      );
    }
    if (input.scheduleType === "recurring" && !input.recurrencePattern) {
      return reply.status(400).send(
        errorResponse(
          { code: ErrorCodes.VALIDATION_ERROR, message: "recurrencePattern is required for recurring tasks" },
          request.id,
        ),
      );
    }

    try {
      const id = createId();

      const nextRunAt = calculateNextRunAt({
        scheduleType: input.scheduleType,
        scheduledAt: input.scheduledAt,
        cronExpression: input.cronExpression,
        recurrencePattern: input.recurrencePattern,
        recurrenceInterval: input.recurrenceInterval,
        recurrenceTime: input.recurrenceTime,
        recurrenceDaysOfWeek: input.recurrenceDaysOfWeek,
        recurrenceDayOfMonth: input.recurrenceDayOfMonth,
        timezone: input.timezone,
        endDate: input.endDate,
        maxRuns: input.maxRuns,
        runCount: 0,
      });

      const [task] = await db
        .insert(scheduledTasks)
        .values({
          id,
          userId,
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
          isEnabled: input.isEnabled,
        })
        .returning();

      // Publish real-time event
      await publish(`user:${userId}`, {
        type: "scheduledTask:created",
        data: task,
      });

      dispatchWebhookEvent({
        eventType: "scheduledTask.created",
        resourceType: "scheduledTask",
        resourceId: id,
        payload: task as unknown as Record<string, unknown>,
        userId,
      });

      logger.info({ taskId: id, userId, scheduleType: input.scheduleType }, "Scheduled task created");

      return reply.status(201).send(successResponse(task, request.id));
    } catch (error) {
      logger.error(error, "Failed to create scheduled task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to create scheduled task" },
            request.id,
          ),
        );
    }
  });

  // ── List scheduled tasks ──
  fastify.get("/scheduled-tasks", async (request, reply) => {
    const userId = getUserId(request);
    const query = ListScheduledTasksSchema.parse(request.query);

    try {
      const conditions = [eq(scheduledTasks.userId, userId)];

      if (query.status) {
        conditions.push(eq(scheduledTasks.status, query.status));
      }
      if (query.taskType) {
        conditions.push(eq(scheduledTasks.taskType, query.taskType));
      }

      const tasks = await db
        .select()
        .from(scheduledTasks)
        .where(and(...conditions))
        .orderBy(desc(scheduledTasks.createdAt))
        .limit(query.limit)
        .offset(query.offset);

      return reply.send(successResponse(tasks, request.id));
    } catch (error) {
      logger.error(error, "Failed to list scheduled tasks");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list scheduled tasks" },
            request.id,
          ),
        );
    }
  });

  // ── Get single scheduled task ──
  fastify.get("/scheduled-tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId)))
        .limit(1);

      if (!task) {
        return reply
          .status(404)
          .send(errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Task not found" }, request.id));
      }

      return reply.send(successResponse(task, request.id));
    } catch (error) {
      logger.error(error, "Failed to get scheduled task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get scheduled task" },
            request.id,
          ),
        );
    }
  });

  // ── Trigger a scheduled task manually ──
  fastify.post("/scheduled-tasks/:id/trigger", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      // Verify ownership
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId)))
        .limit(1);

      if (!task) {
        return reply
          .status(404)
          .send(errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Task not found" }, request.id));
      }

      // Create execution record
      const executionId = createId();
      await db.insert(taskExecutions).values({
        id: executionId,
        scheduledTaskId: id,
        status: "pending",
      });

      // Mark task as running
      await db
        .update(scheduledTasks)
        .set({ status: "running" })
        .where(eq(scheduledTasks.id, id));

      // Send Inngest event (non-fatal — execution record already created)
      try {
        await inngest.send({
          name: "task/execute",
          data: {
            taskId: id,
            executionId,
            userId,
            prompt:
              (task.payload as Record<string, unknown> | null)?.prompt ??
              task.description ??
              task.name,
            targetDeviceId:
              (task.payload as Record<string, unknown> | null)?.targetDeviceId ?? undefined,
          },
        });
      } catch (inngestErr) {
        logger.warn({ taskId: id, error: inngestErr }, "Failed to send Inngest event (non-fatal)");
      }

      // Publish real-time event
      await publish(`user:${userId}`, {
        type: "scheduledTask:triggered",
        data: { taskId: id, executionId },
      });

      logger.info({ taskId: id, executionId, userId }, "Scheduled task triggered manually");

      return reply.send(
        successResponse({ executionId, status: "triggered" }, request.id),
      );
    } catch (error) {
      logger.error(error, "Failed to trigger scheduled task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to trigger scheduled task" },
            request.id,
          ),
        );
    }
  });

  // ── Get executions for a scheduled task ──
  fastify.get("/scheduled-tasks/:id/executions", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const { limit = 20, offset = 0 } = (request.query as { limit?: number; offset?: number }) || {};

    try {
      // Verify ownership
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(and(eq(scheduledTasks.id, id), eq(scheduledTasks.userId, userId)))
        .limit(1);

      if (!task) {
        return reply
          .status(404)
          .send(errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Task not found" }, request.id));
      }

      const executions = await db
        .select()
        .from(taskExecutions)
        .where(eq(taskExecutions.scheduledTaskId, id))
        .orderBy(desc(taskExecutions.createdAt))
        .limit(Number(limit))
        .offset(Number(offset));

      return reply.send(successResponse(executions, request.id));
    } catch (error) {
      logger.error(error, "Failed to get executions");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get executions" },
            request.id,
          ),
        );
    }
  });
};
