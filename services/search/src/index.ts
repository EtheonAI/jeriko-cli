import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";
import {
  db,
  projects,
  agentSessions,
  messages,
  files,
  knowledgeItems,
  eq,
  and,
  desc,
  ilike,
  or,
  sql,
} from "@repo/database";

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

    try {
      // TODO: Typesense integration for full-text search
      // For now, use DB ILIKE as fallback
      const searchLimit = Math.min(limit || 20, 100);
      const searchOffset = offset || 0;
      const searchPattern = `%${query}%`;
      const results: Array<{
        type: string;
        id: string;
        title: string;
        preview?: string | null;
        score: number;
      }> = [];

      const searchTypes = types || ["projects", "sessions", "files", "knowledge", "messages"];

      if (searchTypes.includes("projects")) {
        const projectResults = await db
          .select()
          .from(projects)
          .where(
            and(
              eq(projects.userId, userId),
              or(ilike(projects.name, searchPattern), ilike(projects.description, searchPattern))
            )
          )
          .limit(searchLimit);
        for (const p of projectResults) {
          results.push({
            type: "project",
            id: p.id,
            title: p.name,
            preview: p.description,
            score: 1,
          });
        }
      }

      if (searchTypes.includes("sessions")) {
        const sessionResults = await db
          .select()
          .from(agentSessions)
          .where(and(eq(agentSessions.userId, userId), ilike(agentSessions.title, searchPattern)))
          .limit(searchLimit);
        for (const s of sessionResults) {
          results.push({
            type: "session",
            id: s.id,
            title: s.title || "Untitled",
            preview: null,
            score: 1,
          });
        }
      }

      if (searchTypes.includes("messages")) {
        const messageResults = await db
          .select()
          .from(messages)
          .where(ilike(messages.content, searchPattern))
          .limit(searchLimit);
        for (const m of messageResults) {
          results.push({
            type: "message",
            id: m.id,
            title: m.content.slice(0, 100),
            preview: m.content.slice(0, 200),
            score: 1,
          });
        }
      }

      if (searchTypes.includes("files")) {
        const fileResults = await db
          .select()
          .from(files)
          .where(and(eq(files.userId, userId), ilike(files.name, searchPattern)))
          .limit(searchLimit);
        for (const f of fileResults) {
          results.push({ type: "file", id: f.id, title: f.name, preview: f.path, score: 1 });
        }
      }

      if (searchTypes.includes("knowledge")) {
        const knowledgeResults = await db
          .select()
          .from(knowledgeItems)
          .where(
            and(
              eq(knowledgeItems.userId, userId),
              or(
                ilike(knowledgeItems.name, searchPattern),
                ilike(knowledgeItems.content, searchPattern)
              )
            )
          )
          .limit(searchLimit);
        for (const k of knowledgeResults) {
          results.push({
            type: "knowledge",
            id: k.id,
            title: k.name,
            preview: k.contentPreview,
            score: 1,
          });
        }
      }

      logger.info({ query, types, userId, resultCount: results.length }, "Search executed");

      return {
        query,
        results: results.slice(searchOffset, searchOffset + searchLimit),
        total: results.length,
        limit: searchLimit,
        offset: searchOffset,
      };
    } catch (error) {
      logger.error(error, "Failed to execute search");
      return reply.status(500).send({ error: "Failed to execute search" });
    }
  });

  // Search projects
  app.post("/search/projects", async (request, reply) => {
    const { query, userId, filters, limit } = request.body as {
      query: string;
      userId: string;
      filters?: Record<string, unknown>;
      limit?: number;
    };

    try {
      const searchPattern = `%${query}%`;
      const results = await db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.userId, userId),
            or(ilike(projects.name, searchPattern), ilike(projects.description, searchPattern))
          )
        )
        .orderBy(desc(projects.updatedAt))
        .limit(limit || 20);
      return { results, total: results.length };
    } catch (error) {
      logger.error(error, "Failed to search projects");
      return reply.status(500).send({ error: "Failed to search projects" });
    }
  });

  // Search sessions
  app.post("/search/sessions", async (request, reply) => {
    const { query, userId, projectId, limit } = request.body as {
      query: string;
      userId: string;
      projectId?: string;
      limit?: number;
    };

    try {
      const searchPattern = `%${query}%`;
      const conditions = [
        eq(agentSessions.userId, userId),
        ilike(agentSessions.title, searchPattern),
      ];

      const results = await db
        .select()
        .from(agentSessions)
        .where(and(...conditions))
        .orderBy(desc(agentSessions.updatedAt))
        .limit(limit || 20);
      return { results, total: results.length };
    } catch (error) {
      logger.error(error, "Failed to search sessions");
      return reply.status(500).send({ error: "Failed to search sessions" });
    }
  });

  // Search messages
  app.post("/search/messages", async (request, reply) => {
    const { query, userId, sessionId, limit } = request.body as {
      query: string;
      userId: string;
      sessionId?: string;
      limit?: number;
    };

    try {
      const searchPattern = `%${query}%`;
      const conditions = [ilike(messages.content, searchPattern)];
      if (sessionId) {
        conditions.push(eq(messages.sessionId, sessionId));
      }

      const results = await db
        .select()
        .from(messages)
        .where(and(...conditions))
        .orderBy(desc(messages.createdAt))
        .limit(limit || 20);
      return { results, total: results.length };
    } catch (error) {
      logger.error(error, "Failed to search messages");
      return reply.status(500).send({ error: "Failed to search messages" });
    }
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

    try {
      const searchPattern = `%${query}%`;
      const conditions = [eq(files.userId, userId), ilike(files.name, searchPattern)];
      if (mimeType) {
        conditions.push(eq(files.mimeType, mimeType));
      }

      const results = await db
        .select()
        .from(files)
        .where(and(...conditions))
        .orderBy(desc(files.updatedAt))
        .limit(limit || 20);
      return { results, total: results.length };
    } catch (error) {
      logger.error(error, "Failed to search files");
      return reply.status(500).send({ error: "Failed to search files" });
    }
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

    // TODO: Generate embedding and search vector store (Typesense)
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

    try {
      const searchPattern = `%${q}%`;
      const suggestions: Array<{ type: string; id: string; title: string }> = [];

      // Quick project name suggestions
      const projectSuggestions = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.userId, userId), ilike(projects.name, searchPattern)))
        .limit(5);

      for (const p of projectSuggestions) {
        suggestions.push({ type: "project", id: p.id, title: p.name });
      }

      return { suggestions: suggestions.slice(0, limit || 10) };
    } catch (error) {
      logger.error(error, "Failed to generate suggestions");
      return reply.status(500).send({ error: "Failed to generate suggestions" });
    }
  });

  // Index entity (internal) - TODO: Typesense integration
  app.post("/internal/index", async (request, reply) => {
    const { type, id, data } = request.body as {
      type: string;
      id: string;
      data: Record<string, unknown>;
    };

    // TODO: Add to Typesense search index
    logger.info({ type, id }, "Entity indexed");
    return { indexed: true };
  });

  // Remove from index (internal) - TODO: Typesense integration
  app.delete("/internal/index/:type/:id", async (request, reply) => {
    const { type, id } = request.params as { type: string; id: string };
    // TODO: Remove from Typesense search index
    return { removed: true };
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
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
