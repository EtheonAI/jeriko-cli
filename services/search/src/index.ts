import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "search" });

async function main() {
  const port = parseInt(getEnv("PORT", "4013"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "search" };
  });

  // Universal search across all entities
  app.post("/search", async (request, reply) => {
    const { query, types, userId, organizationId, limit, offset } = request.body as {
      query: string;
      types?: Array<"projects" | "sessions" | "files" | "knowledge" | "messages">;
      userId: string;
      organizationId?: string;
      limit?: number;
      offset?: number;
    };

    // TODO: Search across multiple indices
    logger.info({ query, types, userId }, "Search executed");

    return {
      query,
      results: [],
      total: 0,
      limit: limit || 20,
      offset: offset || 0,
    };
  });

  // Search projects
  app.post("/search/projects", async (request, reply) => {
    const { query, userId, filters, limit } = request.body as {
      query: string;
      userId: string;
      filters?: Record<string, unknown>;
      limit?: number;
    };

    // TODO: Search projects
    return { results: [], total: 0 };
  });

  // Search sessions
  app.post("/search/sessions", async (request, reply) => {
    const { query, userId, projectId, limit } = request.body as {
      query: string;
      userId: string;
      projectId?: string;
      limit?: number;
    };

    // TODO: Search sessions
    return { results: [], total: 0 };
  });

  // Search messages
  app.post("/search/messages", async (request, reply) => {
    const { query, userId, sessionId, limit } = request.body as {
      query: string;
      userId: string;
      sessionId?: string;
      limit?: number;
    };

    // TODO: Search messages (full-text)
    return { results: [], total: 0 };
  });

  // Search files
  app.post("/search/files", async (request, reply) => {
    const { query, userId, projectId, mimeType, limit } = request.body as {
      query: string;
      userId: string;
      projectId?: string;
      mimeType?: string;
      limit?: number;
    };

    // TODO: Search files
    return { results: [], total: 0 };
  });

  // Semantic search (vector similarity)
  app.post("/search/semantic", async (request, reply) => {
    const { query, userId, scope, limit } = request.body as {
      query: string;
      userId: string;
      scope?: {
        projectIds?: string[];
        knowledgeGroupIds?: string[];
      };
      limit?: number;
    };

    // TODO: Generate embedding and search vector store
    return {
      results: [],
      total: 0,
    };
  });

  // Autocomplete/suggestions
  app.get("/suggest", async (request, reply) => {
    const { q, types, userId, limit } = request.query as {
      q: string;
      types?: string;
      userId: string;
      limit?: number;
    };

    // TODO: Generate suggestions
    return { suggestions: [] };
  });

  // Index entity (internal)
  app.post("/internal/index", async (request, reply) => {
    const { type, id, data } = request.body as {
      type: string;
      id: string;
      data: Record<string, unknown>;
    };

    // TODO: Add to search index
    logger.info({ type, id }, "Entity indexed");

    return { indexed: true };
  });

  // Remove from index (internal)
  app.delete("/internal/index/:type/:id", async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string };
    // TODO: Remove from search index
    return { removed: true };
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
    logger.info({ port, host }, "Search service started");
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
