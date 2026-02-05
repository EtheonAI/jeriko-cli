import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, eq, desc, and, agentSessions, agents, agentTasks, sql } from "@repo/database";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  publish,
  dispatchWebhookEvent,
  TaskStatusSchema,
  TaskPrioritySchema,
} from "@repo/service-utils";

const logger = createLogger({ service: "task-routes" });

// Input schemas
const CreateTaskSchema = z.object({
  sessionId: z.string(),
  title: z.string().optional(),
  prompt: z.string().min(1),
  priority: TaskPrioritySchema.optional().default("normal"),
  targetDeviceId: z.string().optional(),
  targetPlatform: z.string().optional(),
  requiredCapabilities: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
});

const UpdateTaskSchema = z.object({
  title: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

const ListTasksSchema = z.object({
  sessionId: z.string().optional(),
  status: TaskStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

// Helper to get user ID from headers
function getUserId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const userId = request.headers["x-user-id"] as string | undefined;
  if (!userId) {
    const error = new Error("Unauthorized") as Error & { statusCode: number; code: string };
    error.statusCode = 401;
    error.code = ErrorCodes.UNAUTHORIZED;
    throw error;
  }
  return userId;
}

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  // Create task
  fastify.post("/tasks", async (request, reply) => {
    const userId = getUserId(request);
    const input = CreateTaskSchema.parse(request.body);

    try {
      // First ensure we have an agent for this session
      let [agent] = await db
        .select()
        .from(agents)
        .where(eq(agents.sessionId, input.sessionId))
        .limit(1);

      if (!agent) {
        // Create a default orchestrator agent for this session
        [agent] = await db
          .insert(agents)
          .values({
            id: createId(),
            sessionId: input.sessionId,
            type: "orchestrator",
            name: "Task Agent",
            status: "idle",
          })
          .returning();
      }

      const taskId = createId();
      const now = new Date();

      const [task] = await db
        .insert(agentTasks)
        .values({
          id: taskId,
          agentId: agent!.id,
          title: input.title || input.prompt.slice(0, 100),
          description: input.prompt,
          status: "pending",
          priority: typeof input.priority === "string" ? 0 : (input.priority as number) || 0,
        })
        .returning();

      const responseTask = {
        id: task!.id,
        userId,
        sessionId: input.sessionId,
        title: task!.title,
        prompt: input.prompt,
        status: task!.status,
        priority: input.priority,
        targetDeviceId: input.targetDeviceId || null,
        targetPlatform: input.targetPlatform || null,
        requiredCapabilities: input.requiredCapabilities,
        metadata: input.metadata,
        createdAt: task!.createdAt,
        updatedAt: task!.updatedAt,
        completedAt: task!.completedAt,
      };

      // Publish task created event
      await publish(`user:${userId}`, {
        type: "task:created",
        data: responseTask,
      });

      dispatchWebhookEvent({
        eventType: "agent.task.created",
        resourceType: "task",
        resourceId: task!.id,
        payload: responseTask,
        userId,
      });

      logger.info({ taskId: task!.id, userId }, "Task created");

      return reply.status(201).send(successResponse(responseTask, request.id));
    } catch (error) {
      logger.error(error, "Failed to create task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to create task" },
            request.id
          )
        );
    }
  });

  // List tasks
  fastify.get("/tasks", async (request, reply) => {
    const userId = getUserId(request);
    const query = ListTasksSchema.parse(request.query);

    try {
      const conditions = [];
      if (query.sessionId) {
        // Get agents for this session, then get their tasks
        const sessionAgents = await db
          .select({ id: agents.id })
          .from(agents)
          .where(eq(agents.sessionId, query.sessionId));

        if (sessionAgents.length === 0) {
          return reply.send(successResponse({ items: [], total: 0, hasMore: false }, request.id));
        }

        const agentIds = sessionAgents.map((a) => a.id);
        conditions.push(
          sql`${agentTasks.agentId} IN (${sql.join(
            agentIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        );
      }
      if (query.status) {
        conditions.push(eq(agentTasks.status, query.status as any));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const tasks = await db
        .select()
        .from(agentTasks)
        .where(whereClause)
        .orderBy(desc(agentTasks.createdAt))
        .limit(query.limit + 1);

      const hasMore = tasks.length > query.limit;
      const items = hasMore ? tasks.slice(0, query.limit) : tasks;

      return reply.send(
        successResponse(
          {
            items,
            total: items.length,
            hasMore,
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to list tasks");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list tasks" },
            request.id
          )
        );
    }
  });

  // Get task by ID
  fastify.get("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [task] = await db.select().from(agentTasks).where(eq(agentTasks.id, id)).limit(1);

      if (!task) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Task not found" }, request.id)
          );
      }

      return reply.send(successResponse(task, request.id));
    } catch (error) {
      logger.error(error, "Failed to get task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get task" },
            request.id
          )
        );
    }
  });

  // Update task
  fastify.put("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const input = UpdateTaskSchema.parse(request.body);

    try {
      const updateValues: Record<string, unknown> = {};
      if (input.title) updateValues.title = input.title;
      if (input.status) updateValues.status = input.status;

      const [updated] = await db
        .update(agentTasks)
        .set(updateValues as any)
        .where(eq(agentTasks.id, id))
        .returning();

      if (!updated) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Task not found" }, request.id)
          );
      }

      if (input.status === "completed" || input.status === "failed") {
        dispatchWebhookEvent({
          eventType: input.status === "completed" ? "agent.task.completed" : "agent.task.failed",
          resourceType: "task",
          resourceId: id,
          payload: { id: updated.id, status: updated.status, title: updated.title },
          userId,
        });
      }

      return reply.send(successResponse(updated, request.id));
    } catch (error) {
      logger.error(error, "Failed to update task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to update task" },
            request.id
          )
        );
    }
  });

  // Delete task
  fastify.delete("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [deleted] = await db.delete(agentTasks).where(eq(agentTasks.id, id)).returning();

      if (!deleted) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Task not found" }, request.id)
          );
      }

      return reply.send(successResponse({ deleted: true }, request.id));
    } catch (error) {
      logger.error(error, "Failed to delete task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to delete task" },
            request.id
          )
        );
    }
  });

  // Continue multi-turn task
  fastify.post("/tasks/:id/continue", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const body = request.body as { message: string };

    // Publish continue event
    await publish(`user:${userId}`, {
      type: "task:continue",
      data: { taskId: id, message: body.message },
    });

    logger.info({ taskId: id, userId }, "Task continue requested");

    return reply.send(successResponse({ taskId: id, status: "continuing" }, request.id));
  });

  // Cancel task
  fastify.post("/tasks/:id/cancel", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      await db.update(agentTasks).set({ status: "cancelled" }).where(eq(agentTasks.id, id));

      // Publish cancel event
      await publish(`user:${userId}`, {
        type: "task:cancelled",
        data: { taskId: id },
      });

      logger.info({ taskId: id, userId }, "Task cancelled");

      return reply.send(successResponse({ taskId: id, status: "cancelled" }, request.id));
    } catch (error) {
      logger.error(error, "Failed to cancel task");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to cancel task" },
            request.id
          )
        );
    }
  });
};
