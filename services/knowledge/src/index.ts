import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "knowledge" });

async function main() {
  const port = parseInt(getEnv("PORT", "4011"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "knowledge" };
  });

  // List knowledge groups
  app.get("/users/:userId/groups", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // TODO: Fetch from database
    return { groups: [] };
  });

  // Create knowledge group
  app.post("/groups", async (request, reply) => {
    const { name, description, userId, projectId } = request.body as {
      name: string;
      description?: string;
      userId: string;
      projectId?: string;
    };

    const groupId = crypto.randomUUID();

    // TODO: Create in database
    return { id: groupId, name, description, itemCount: 0 };
  });

  // Get knowledge group
  app.get("/groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { id, status: "not_found" };
  });

  // Delete knowledge group
  app.delete("/groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Delete from database
    return { deleted: true };
  });

  // Add item to knowledge group
  app.post("/groups/:groupId/items", async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    const { type, title, content, sourceUrl, fileId } = request.body as {
      type: "text" | "file" | "url";
      title: string;
      content?: string;
      sourceUrl?: string;
      fileId?: string;
    };

    const itemId = crypto.randomUUID();

    // TODO: Create item and generate embeddings
    logger.info({ groupId, itemId, type }, "Knowledge item added");

    return { id: itemId, groupId, type, title, status: "processing" };
  });

  // Get knowledge item
  app.get("/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { id, status: "not_found" };
  });

  // Delete knowledge item
  app.delete("/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Delete from database and vector store
    return { deleted: true };
  });

  // Query knowledge base (semantic search)
  app.post("/query", async (request, reply) => {
    const { query, groupIds, userId, limit } = request.body as {
      query: string;
      groupIds?: string[];
      userId: string;
      limit?: number;
    };

    // TODO: Generate query embedding and search vector store
    return {
      results: [],
      query,
    };
  });

  // Get chunks for an item
  app.get("/items/:id/chunks", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { chunks: [] };
  });

  // Reprocess knowledge item
  app.post("/items/:id/reprocess", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Queue reprocessing
    return { id, status: "reprocessing" };
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
    logger.info({ port, host }, "Knowledge service started");
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
