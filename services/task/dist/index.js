// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { createLogger as createLogger3, getEnv } from "@repo/service-utils";

// src/routes/tasks.ts
import { z } from "zod";
import {
  createId,
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  publish,
  TaskStatusSchema,
  TaskPrioritySchema
} from "@repo/service-utils";
var logger = createLogger({ service: "task-routes" });
var CreateTaskSchema = z.object({
  sessionId: z.string(),
  title: z.string().optional(),
  prompt: z.string().min(1),
  priority: TaskPrioritySchema.optional().default("normal"),
  targetDeviceId: z.string().optional(),
  targetPlatform: z.string().optional(),
  requiredCapabilities: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({})
});
var UpdateTaskSchema = z.object({
  title: z.string().optional(),
  status: TaskStatusSchema.optional(),
  priority: TaskPrioritySchema.optional(),
  metadata: z.record(z.unknown()).optional()
});
var ListTasksSchema = z.object({
  sessionId: z.string().optional(),
  status: TaskStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  cursor: z.string().optional()
});
function getUserId(request) {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.code = ErrorCodes.UNAUTHORIZED;
    throw error;
  }
  return userId;
}
var taskRoutes = async (fastify) => {
  fastify.post("/tasks", async (request, reply) => {
    const userId = getUserId(request);
    const input = CreateTaskSchema.parse(request.body);
    const id = createId();
    const now = /* @__PURE__ */ new Date();
    const task = {
      id,
      userId,
      sessionId: input.sessionId,
      title: input.title || null,
      prompt: input.prompt,
      status: "pending",
      priority: input.priority,
      targetDeviceId: input.targetDeviceId || null,
      targetPlatform: input.targetPlatform || null,
      requiredCapabilities: input.requiredCapabilities,
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    await publish(`user:${userId}`, {
      type: "task:created",
      data: task
    });
    logger.info({ taskId: id, userId }, "Task created");
    return reply.status(201).send(successResponse(task, request.id));
  });
  fastify.get("/tasks", async (request, reply) => {
    const userId = getUserId(request);
    const query = ListTasksSchema.parse(request.query);
    const tasks = [];
    return reply.send(
      successResponse(
        {
          items: tasks,
          total: 0,
          hasMore: false
        },
        request.id
      )
    );
  });
  fastify.get("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    return reply.status(404).send(
      errorResponse(
        { code: ErrorCodes.NOT_FOUND, message: "Task not found" },
        request.id
      )
    );
  });
  fastify.put("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const input = UpdateTaskSchema.parse(request.body);
    return reply.status(404).send(
      errorResponse(
        { code: ErrorCodes.NOT_FOUND, message: "Task not found" },
        request.id
      )
    );
  });
  fastify.delete("/tasks/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    return reply.status(404).send(
      errorResponse(
        { code: ErrorCodes.NOT_FOUND, message: "Task not found" },
        request.id
      )
    );
  });
  fastify.post("/tasks/:id/continue", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    const body = request.body;
    await publish(`user:${userId}`, {
      type: "task:continue",
      data: { taskId: id, message: body.message }
    });
    logger.info({ taskId: id, userId }, "Task continue requested");
    return reply.send(successResponse({ taskId: id, status: "continuing" }, request.id));
  });
  fastify.post("/tasks/:id/cancel", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params;
    await publish(`user:${userId}`, {
      type: "task:cancelled",
      data: { taskId: id }
    });
    logger.info({ taskId: id, userId }, "Task cancelled");
    return reply.send(successResponse({ taskId: id, status: "cancelled" }, request.id));
  });
};

// src/routes/inngest.ts
import { Inngest } from "inngest";
import { serve } from "inngest/fastify";
import { createLogger as createLogger2 } from "@repo/service-utils";
var logger2 = createLogger2({ service: "task-inngest" });
var inngest = new Inngest({
  id: "rubic-task-service",
  eventKey: process.env.INNGEST_EVENT_KEY
});
var executeTask = inngest.createFunction(
  {
    id: "execute-task",
    name: "Execute Task",
    retries: 3
  },
  { event: "task/execute" },
  async ({ event, step }) => {
    const { taskId, userId, prompt, targetDeviceId } = event.data;
    logger2.info({ taskId, userId }, "Starting task execution");
    await step.run("prepare-context", async () => {
      logger2.info({ taskId }, "Context prepared");
      return { ready: true };
    });
    const agentResult = await step.run("call-agent", async () => {
      const agentUrl = process.env.AGENT_SERVICE_URL || "http://localhost:8000";
      const response = await fetch(`${agentUrl}/v1/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
          "x-task-id": taskId
        },
        body: JSON.stringify({
          prompt,
          targetDeviceId,
          stream: false
          // For Inngest, we don't stream
        })
      });
      if (!response.ok) {
        throw new Error(`Agent service error: ${response.status}`);
      }
      return response.json();
    });
    await step.run("process-result", async () => {
      logger2.info({ taskId, result: agentResult }, "Task completed");
      return { success: true };
    });
    return { taskId, status: "completed", result: agentResult };
  }
);
var scheduledTask = inngest.createFunction(
  {
    id: "scheduled-task",
    name: "Scheduled Task"
  },
  { event: "task/scheduled" },
  async ({ event, step }) => {
    const { taskId, userId, schedule } = event.data;
    logger2.info({ taskId, userId, schedule }, "Executing scheduled task");
    await step.sendEvent("trigger-task", {
      name: "task/execute",
      data: event.data
    });
    return { taskId, triggered: true };
  }
);
var approvalWorkflow = inngest.createFunction(
  {
    id: "approval-workflow",
    name: "Approval Workflow",
    cancelOn: [
      { event: "task/cancelled", match: "data.taskId" }
    ]
  },
  { event: "task/approval-required" },
  async ({ event, step }) => {
    const { taskId, userId, action, deviceId } = event.data;
    logger2.info({ taskId, userId, action }, "Approval required");
    const approval = await step.waitForEvent("wait-for-approval", {
      event: "task/approved",
      match: "data.taskId",
      timeout: "24h"
    });
    if (!approval) {
      logger2.info({ taskId }, "Approval timed out");
      return { taskId, status: "timeout" };
    }
    if (!approval.data.approved) {
      logger2.info({ taskId }, "Action rejected");
      return { taskId, status: "rejected" };
    }
    logger2.info({ taskId, action }, "Executing approved action");
    if (deviceId) {
      const deviceUrl = process.env.DEVICE_SERVICE_URL || "http://localhost:8080";
      await fetch(`${deviceUrl}/v1/devices/${deviceId}/command`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId
        },
        body: JSON.stringify({ action, approved: true })
      });
    }
    return { taskId, status: "approved", executed: true };
  }
);
var inngestRoutes = async (fastify) => {
  fastify.route({
    method: ["GET", "POST", "PUT"],
    url: "/",
    handler: serve({
      client: inngest,
      functions: [executeTask, scheduledTask, approvalWorkflow]
    })
  });
};

// src/index.ts
var logger3 = createLogger3({ service: "task" });
async function main() {
  const port = parseInt(getEnv("PORT", "3002"), 10);
  const host = getEnv("HOST", "0.0.0.0");
  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID()
  });
  await app.register(cors, {
    origin: true,
    credentials: true
  });
  app.get("/health", async () => ({ status: "ok", service: "task" }));
  await app.register(taskRoutes);
  await app.register(inngestRoutes, { prefix: "/inngest" });
  app.addHook("onRequest", async (request) => {
    logger3.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      userId: request.headers["x-user-id"]
    }, "Incoming request");
  });
  try {
    await app.listen({ port, host });
    logger3.info({ port, host }, "Task service started");
  } catch (err) {
    logger3.error(err, "Failed to start server");
    process.exit(1);
  }
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger3.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}
main();
//# sourceMappingURL=index.js.map