import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "project" });

async function main() {
  const port = parseInt(getEnv("PORT", "4010"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "project" };
  });

  // List user's projects
  app.get("/users/:userId/projects", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { cursor, limit } = request.query as { cursor?: string; limit?: number };

    // TODO: Fetch from database
    return { projects: [], cursor: null };
  });

  // Create project
  app.post("/projects", async (request, reply) => {
    const { name, description, userId, organizationId, visibility } = request.body as {
      name: string;
      description?: string;
      userId: string;
      organizationId?: string;
      visibility?: "private" | "team" | "public";
    };

    const projectId = crypto.randomUUID();

    // TODO: Create in database
    logger.info({ projectId, userId }, "Project created");

    return {
      id: projectId,
      name,
      description,
      visibility: visibility || "private",
      status: "active",
      createdAt: new Date().toISOString(),
    };
  });

  // Get project
  app.get("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { id, status: "not_found" };
  });

  // Update project
  app.patch("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Record<string, unknown>;
    // TODO: Update in database
    return { id, ...updates, updated: true };
  });

  // Delete project
  app.delete("/projects/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Delete from database
    return { deleted: true };
  });

  // Get project members
  app.get("/projects/:id/members", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { members: [] };
  });

  // Add project member
  app.post("/projects/:id/members", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { userId, role } = request.body as { userId: string; role: string };
    // TODO: Add to database
    return { projectId: id, userId, role, added: true };
  });

  // Remove project member
  app.delete("/projects/:id/members/:userId", async (request, reply) => {
    const { id, userId } = request.params as { id: string; userId: string };
    // TODO: Remove from database
    return { removed: true };
  });

  // Get project sessions
  app.get("/projects/:id/sessions", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { sessions: [] };
  });

  // Get project files
  app.get("/projects/:id/files", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { files: [] };
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
    logger.info({ port, host }, "Project service started");
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
