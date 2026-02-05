import Fastify from "fastify";
import { createLogger, getEnv, createId } from "@repo/service-utils";
import {
  db,
  knowledgeGroups,
  knowledgeItems,
  knowledgeChunks,
  eq,
  and,
  desc,
  inArray,
  count,
} from "@repo/database";

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
    try {
      const groups = await db
        .select()
        .from(knowledgeGroups)
        .where(eq(knowledgeGroups.userId, userId))
        .orderBy(knowledgeGroups.sortOrder);
      return { groups };
    } catch (error) {
      logger.error(error, "Failed to fetch knowledge groups");
      return reply.status(500).send({ error: "Failed to fetch groups" });
    }
  });

  // Create knowledge group
  app.post("/groups", async (request, reply) => {
    const { name, description, userId, projectId } = request.body as {
      name: string;
      description?: string;
      userId: string;
      projectId?: string;
    };

    try {
      const [group] = await db
        .insert(knowledgeGroups)
        .values({
          id: createId(),
          name,
          description,
          userId,
        })
        .returning();

      return { id: group!.id, name: group!.name, description: group!.description, itemCount: 0 };
    } catch (error) {
      logger.error(error, "Failed to create knowledge group");
      return reply.status(500).send({ error: "Failed to create group" });
    }
  });

  // Get knowledge group
  app.get("/groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [group] = await db
        .select()
        .from(knowledgeGroups)
        .where(eq(knowledgeGroups.id, id))
        .limit(1);
      if (!group) {
        return reply.status(404).send({ error: "Group not found" });
      }

      const [itemCount] = await db
        .select({ count: count() })
        .from(knowledgeItems)
        .where(eq(knowledgeItems.groupId, id));

      return { ...group, itemCount: itemCount?.count || 0 };
    } catch (error) {
      logger.error(error, "Failed to fetch knowledge group");
      return reply.status(500).send({ error: "Failed to fetch group" });
    }
  });

  // Delete knowledge group
  app.delete("/groups/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [deleted] = await db
        .delete(knowledgeGroups)
        .where(eq(knowledgeGroups.id, id))
        .returning();
      if (!deleted) {
        return reply.status(404).send({ error: "Group not found" });
      }
      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to delete knowledge group");
      return reply.status(500).send({ error: "Failed to delete group" });
    }
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

    try {
      const userId = (request.headers["x-user-id"] as string) || "";

      const typeMap: Record<string, string> = {
        text: "note",
        file: "file",
        url: "webpage",
      };

      const [item] = await db
        .insert(knowledgeItems)
        .values({
          id: createId(),
          groupId,
          userId,
          type: (typeMap[type] || type) as any,
          name: title,
          content,
          sourceUrl,
          status: "processing",
        })
        .returning();

      // TODO: Generate embeddings asynchronously
      logger.info({ groupId, itemId: item!.id, type }, "Knowledge item added");

      return { id: item!.id, groupId, type, title, status: "processing" };
    } catch (error) {
      logger.error(error, "Failed to add knowledge item");
      return reply.status(500).send({ error: "Failed to add item" });
    }
  });

  // Get knowledge item
  app.get("/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [item] = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .limit(1);
      if (!item) {
        return reply.status(404).send({ error: "Item not found" });
      }
      return item;
    } catch (error) {
      logger.error(error, "Failed to fetch knowledge item");
      return reply.status(500).send({ error: "Failed to fetch item" });
    }
  });

  // Delete knowledge item
  app.delete("/items/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [deleted] = await db
        .delete(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .returning();
      if (!deleted) {
        return reply.status(404).send({ error: "Item not found" });
      }
      // TODO: Delete from vector store
      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to delete knowledge item");
      return reply.status(500).send({ error: "Failed to delete item" });
    }
  });

  // Query knowledge base (semantic search)
  app.post("/query", async (request, reply) => {
    const { query, groupIds, userId, limit } = request.body as {
      query: string;
      groupIds?: string[];
      userId: string;
      limit?: number;
    };

    try {
      // TODO: Generate query embedding and search vector store
      // For now, do basic text search as fallback
      const conditions = [
        eq(knowledgeItems.userId, userId),
        eq(knowledgeItems.status, "ready" as any),
      ];
      if (groupIds && groupIds.length > 0) {
        conditions.push(inArray(knowledgeItems.groupId, groupIds));
      }

      const results = await db
        .select()
        .from(knowledgeItems)
        .where(and(...conditions))
        .limit(limit || 10);

      return { results, query };
    } catch (error) {
      logger.error(error, "Failed to query knowledge base");
      return reply.status(500).send({ error: "Failed to query" });
    }
  });

  // Get chunks for an item
  app.get("/items/:id/chunks", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const chunks = await db
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.itemId, id))
        .orderBy(knowledgeChunks.chunkIndex);
      return { chunks };
    } catch (error) {
      logger.error(error, "Failed to fetch chunks");
      return reply.status(500).send({ error: "Failed to fetch chunks" });
    }
  });

  // Reprocess knowledge item
  app.post("/items/:id/reprocess", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const [updated] = await db
        .update(knowledgeItems)
        .set({ status: "processing" })
        .where(eq(knowledgeItems.id, id))
        .returning();
      if (!updated) {
        return reply.status(404).send({ error: "Item not found" });
      }
      // TODO: Queue reprocessing for embeddings
      return { id: updated.id, status: "reprocessing" };
    } catch (error) {
      logger.error(error, "Failed to reprocess item");
      return reply.status(500).send({ error: "Failed to reprocess item" });
    }
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
