import Fastify from "fastify";
import { createLogger, getEnv, createId } from "@repo/service-utils";
import { eq, and, desc, inArray, count, sql } from "drizzle-orm";
import { extractText, extractFromPdf, extractFromUrl } from "./lib/extract.js";
import { chunkText } from "./lib/chunk.js";
import { generateEmbeddings, generateEmbedding, EMBEDDING_MODEL } from "./lib/embed.js";

// Dynamic import to work around ESM + pnpm workspace resolution issues
let db: any;
let knowledgeGroups: any;
let knowledgeItems: any;
let knowledgeChunks: any;

async function initDb() {
  const database = await import("@repo/database/service-index");
  db = database.db;
  knowledgeGroups = database.knowledgeGroups;
  knowledgeItems = database.knowledgeItems;
  knowledgeChunks = database.knowledgeChunks;
}

const logger = createLogger({ service: "knowledge" });

async function main() {
  await initDb();

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

  // Add item to knowledge group — with full processing pipeline
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

      // Process in the background (non-blocking)
      processItem(item!.id, type, content, sourceUrl).catch((err) => {
        logger.error(err, "Background processing failed for item %s", item!.id);
      });

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

  // List items for a group
  app.get("/groups/:groupId/items", async (request, reply) => {
    const { groupId } = request.params as { groupId: string };
    try {
      const items = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.groupId, groupId))
        .orderBy(desc(knowledgeItems.createdAt));
      return { items };
    } catch (error) {
      logger.error(error, "Failed to fetch items for group");
      return reply.status(500).send({ error: "Failed to fetch items" });
    }
  });

  // Delete knowledge item (chunks cascade via FK)
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
      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to delete knowledge item");
      return reply.status(500).send({ error: "Failed to delete item" });
    }
  });

  // Query knowledge base (vector semantic search)
  app.post("/query", async (request, reply) => {
    const { query, groupIds, userId, limit } = request.body as {
      query: string;
      groupIds?: string[];
      userId: string;
      limit?: number;
    };

    try {
      // Generate embedding for the query
      const queryEmbedding = await generateEmbedding(query);
      const queryVector = `[${queryEmbedding.join(",")}]`;
      const resultLimit = limit || 5;

      // Build conditions for filtering
      let groupFilter = sql`true`;
      if (groupIds && groupIds.length > 0) {
        groupFilter = sql`ki.group_id IN (${sql.join(
          groupIds.map((id) => sql`${id}`),
          sql`, `
        )})`;
      }

      // Vector cosine similarity search via raw SQL
      const results = await db.execute(sql`
        SELECT
          kc.id as chunk_id,
          kc.content as chunk_content,
          kc.chunk_index,
          ki.id as item_id,
          ki.name as item_name,
          ki.type as item_type,
          1 - (kc.embedding <=> ${queryVector}::vector) as similarity
        FROM knowledge_chunks kc
        JOIN knowledge_items ki ON kc.item_id = ki.id
        WHERE ki.user_id = ${userId}
          AND ki.status = 'ready'
          AND kc.embedding IS NOT NULL
          AND ${groupFilter}
        ORDER BY kc.embedding <=> ${queryVector}::vector
        LIMIT ${resultLimit}
      `);

      return { results: results.rows, query };
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

  // Process a knowledge item (called by tRPC after creating an item in DB)
  app.post("/items/:id/process", async (request, reply) => {
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

      const typeToProcessType: Record<string, string> = {
        note: "text",
        document: "text",
        file: "file",
        webpage: "url",
        bookmark: "url",
      };
      const processType = typeToProcessType[item.type] || "text";

      // Process in the background
      processItem(id, processType, item.content ?? undefined, item.sourceUrl ?? undefined).catch(
        (err) => {
          logger.error(err, "Process failed for item %s", id);
        }
      );

      return { id, status: "processing" };
    } catch (error) {
      logger.error(error, "Failed to start processing item");
      return reply.status(500).send({ error: "Failed to process item" });
    }
  });

  // Reprocess knowledge item — delete old chunks, re-extract, re-chunk, re-embed
  app.post("/items/:id/reprocess", async (request, reply) => {
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

      // Set status to processing
      await db
        .update(knowledgeItems)
        .set({ status: "processing", processingError: null })
        .where(eq(knowledgeItems.id, id));

      // Delete existing chunks
      await db.delete(knowledgeChunks).where(eq(knowledgeChunks.itemId, id));

      // Determine type for processing
      const typeToProcessType: Record<string, string> = {
        note: "text",
        document: "text",
        file: "file",
        webpage: "url",
        bookmark: "url",
      };
      const processType = typeToProcessType[item.type] || "text";

      // Re-process in the background
      processItem(id, processType, item.content ?? undefined, item.sourceUrl ?? undefined).catch(
        (err) => {
          logger.error(err, "Reprocess failed for item %s", id);
        }
      );

      return { id, status: "processing" };
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

/**
 * Process a knowledge item: extract text → chunk → embed → store chunks
 */
async function processItem(
  itemId: string,
  type: string,
  content?: string,
  sourceUrl?: string
): Promise<void> {
  try {
    // 1. Extract text
    let text: string;
    if (type === "url" && sourceUrl) {
      text = await extractFromUrl(sourceUrl);
    } else if (content) {
      text = await extractText(content, "text/plain");
    } else {
      throw new Error("No content or sourceUrl provided");
    }

    if (!text || text.trim().length === 0) {
      throw new Error("Extracted text is empty");
    }

    // Update item content if extracted from URL
    if (type === "url") {
      await db
        .update(knowledgeItems)
        .set({
          content: text,
          contentPreview: text.slice(0, 500),
        })
        .where(eq(knowledgeItems.id, itemId));
    }

    // 2. Chunk the text
    const chunks = chunkText(text);
    if (chunks.length === 0) {
      throw new Error("No chunks produced from text");
    }

    logger.info({ itemId, chunkCount: chunks.length }, "Text chunked");

    // 3. Generate embeddings for all chunks
    const chunkTexts = chunks.map((c: { content: string }) => c.content);
    const embeddings = await generateEmbeddings(chunkTexts);

    logger.info({ itemId, embeddingCount: embeddings.length }, "Embeddings generated");

    // 4. Insert chunks with embeddings
    const chunkValues = chunks.map(
      (
        chunk: { content: string; chunkIndex: number; startOffset: number; endOffset: number },
        i: number
      ) => ({
        id: createId(),
        itemId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        embedding: embeddings[i]!,
        embeddingModel: EMBEDDING_MODEL,
      })
    );

    await db.insert(knowledgeChunks).values(chunkValues);

    // 5. Update item status to ready
    await db
      .update(knowledgeItems)
      .set({
        status: "ready",
        embeddingModel: EMBEDDING_MODEL,
        metadata: {
          wordCount: text.split(/\s+/).length,
          chunkCount: chunks.length,
        },
      })
      .where(eq(knowledgeItems.id, itemId));

    logger.info({ itemId }, "Item processing complete");
  } catch (error) {
    logger.error(error, "Failed to process item %s", itemId);
    // Mark item as failed
    await db
      .update(knowledgeItems)
      .set({
        status: "failed",
        processingError: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(knowledgeItems.id, itemId));
  }
}

main();
