import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, eq, desc, and } from "@repo/database";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  publish,
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
function getUserId(request: { headers: { "x-user-id"?: string } }): string {
  const userId = request.headers["x-user-id"];
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

    const id = createId();
    const now = new Date();

    // For now, we'll use a simple in-memory approach
    // In production, this would use the database schema
    const task = {
      id,
      userId,
      sessionId: input.sessionId,
      title: input.title || null,
      prompt: input.prompt,
      status: "pending" as const,
      priority: input.priority,
      targetDeviceId: input.targetDeviceId || null,
      targetPlatform: input.targetPlatform || null,
      requiredCapabilities: input.requiredCapabilities,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    // TODO: Insert into database when schema is ready
    // await db.insert(tasks).values(task);

    // Publish task created event
    await publish(`user:${userId}`, {
      type: "task:created",
      data: task,
    });

    logger.info({ taskId: id, userId }, "Task created");

    return reply.status(201).send(successResponse(task, request.id));
  });

  // List tasks
  fastify.get("/tasks", async (request, reply) => {
    const userId = getUserId(request);
    const query = ListTasksSchema.parse(request.query);

    // TODO: Query database when schema is ready
    // For now, return empty array
    const tasks: unknown[] = [];

    return reply.send(
      successResponse(
        {
          items: tasks,
          total: 0,
          hasMore: false,
        },
        request.id
      )
    );
  });

  // Get task by ID
  fastify.get("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    // TODO: Query database when schema is ready
    // For now, return not found
    return reply.status(404).send(
      errorResponse(
        { code: ErrorCodes.NOT_FOUND, message: "Task not found" },
        request.id
      )
    );
  });

  // Update task
  fastify.put("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const input = UpdateTaskSchema.parse(request.body);

    // TODO: Update database when schema is ready
    // For now, return not found
    return reply.status(404).send(
      errorResponse(
        { code: ErrorCodes.NOT_FOUND, message: "Task not found" },
        request.id
      )
    );
  });

  // Delete task
  fastify.delete("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    // TODO: Delete from database when schema is ready
    // For now, return not found
    return reply.status(404).send(
      errorResponse(
        { code: ErrorCodes.NOT_FOUND, message: "Task not found" },
        request.id
      )
    );
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

    // Publish cancel event
    await publish(`user:${userId}`, {
      type: "task:cancelled",
      data: { taskId: id },
    });

    logger.info({ taskId: id, userId }, "Task cancelled");

    return reply.send(successResponse({ taskId: id, status: "cancelled" }, request.id));
  });
};
