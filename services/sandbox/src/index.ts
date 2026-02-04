import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "sandbox" });

async function main() {
  const port = parseInt(getEnv("PORT", "4012"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "sandbox" };
  });

  // Create sandbox
  app.post("/sandboxes", async (request, reply) => {
    const { userId, projectId, template, config } = request.body as {
      userId: string;
      projectId?: string;
      template?: string;
      config?: {
        timeout?: number;
        memory?: number;
        env?: Record<string, string>;
      };
    };

    const sandboxId = crypto.randomUUID();

    // TODO: Create E2B sandbox
    logger.info({ sandboxId, userId, template }, "Sandbox created");

    return {
      id: sandboxId,
      status: "creating",
      template: template || "default",
    };
  });

  // Get sandbox
  app.get("/sandboxes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { id, status: "not_found" };
  });

  // List user sandboxes
  app.get("/users/:userId/sandboxes", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // TODO: Fetch from database
    return { sandboxes: [] };
  });

  // Execute code in sandbox
  app.post("/sandboxes/:id/execute", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { code, language, timeout } = request.body as {
      code: string;
      language?: string;
      timeout?: number;
    };

    const executionId = crypto.randomUUID();

    // TODO: Execute in E2B sandbox
    logger.info({ sandboxId: id, executionId, language }, "Execution started");

    return {
      id: executionId,
      status: "running",
    };
  });

  // Get execution result
  app.get("/executions/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return {
      id,
      status: "completed",
      stdout: "",
      stderr: "",
      exitCode: 0,
    };
  });

  // Run shell command in sandbox
  app.post("/sandboxes/:id/shell", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { command, timeout } = request.body as {
      command: string;
      timeout?: number;
    };

    // TODO: Run command in E2B sandbox
    return {
      stdout: "",
      stderr: "",
      exitCode: 0,
    };
  });

  // Upload file to sandbox
  app.post("/sandboxes/:id/files", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path, content } = request.body as {
      path: string;
      content: string;
    };

    // TODO: Write file to E2B sandbox
    return { path, written: true };
  });

  // Read file from sandbox
  app.get("/sandboxes/:id/files", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path } = request.query as { path: string };

    // TODO: Read file from E2B sandbox
    return { path, content: "" };
  });

  // List files in sandbox
  app.get("/sandboxes/:id/files/list", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { path } = request.query as { path?: string };

    // TODO: List files in E2B sandbox
    return { files: [] };
  });

  // Stop sandbox
  app.post("/sandboxes/:id/stop", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Stop E2B sandbox
    logger.info({ sandboxId: id }, "Sandbox stopped");
    return { id, status: "stopped" };
  });

  // Delete sandbox
  app.delete("/sandboxes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Delete E2B sandbox and database record
    return { deleted: true };
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
    }, "Incoming request");
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info({
      requestId: request.id,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, "Request completed");
  });

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Sandbox service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

main();
