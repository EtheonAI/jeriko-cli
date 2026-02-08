import { createService, typedRoute, createId } from "@repo/service-utils";
import { NotFoundError } from "@repo/service-utils/errors";
import { z } from "zod";
import { eq, desc, count, sql } from "drizzle-orm";
import { extractText, extractFromUrl } from "./lib/extract.js";
import { chunkText } from "./lib/chunk.js";
import { generateEmbeddings, generateEmbedding, EMBEDDING_MODEL } from "./lib/embed.js";

// Dynamic import to work around ESM + pnpm workspace resolution issues
let db: any;
let knowledgeGroups: any;
let knowledgeItems: any;
let knowledgeChunks: any;

async function initDb() {
  const rawDatabase = await import("@repo/database/service-index");
  const database = (rawDatabase as any).default ?? rawDatabase;
  db = database.db;
  knowledgeGroups = database.knowledgeGroups;
  knowledgeItems = database.knowledgeItems;
  knowledgeChunks = database.knowledgeChunks;
}

// --- Zod Schemas ---

const UserIdParams = z.object({
  userId: z.string().min(1),
});

const IdParams = z.object({
  id: z.string().min(1),
});

const GroupIdParams = z.object({
  groupId: z.string().min(1),
});

const CreateGroupBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  userId: z.string().min(1),
  projectId: z.string().optional(),
});

const AddItemBody = z.object({
  type: z.enum(["text", "file", "url"]),
  title: z.string().min(1),
  content: z.string().optional(),
  sourceUrl: z.string().optional(),
  fileId: z.string().optional(),
});

const QueryBody = z.object({
  query: z.string().min(1),
  groupIds: z.array(z.string()).optional(),
  userId: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
});

async function main() {
  await initDb();

  const { app, logger, start } = await createService({
    name: "knowledge",
  });

  // List knowledge groups
  app.get(
    "/users/:userId/groups",
    typedRoute({ params: UserIdParams }, async (request, reply) => {
      const { userId } = request.params;
      const groups = await db
        .select()
        .from(knowledgeGroups)
        .where(eq(knowledgeGroups.userId, userId))
        .orderBy(knowledgeGroups.sortOrder);
      return reply.success({ groups });
    })
  );

  // Create knowledge group
  app.post(
    "/groups",
    typedRoute({ body: CreateGroupBody }, async (request, reply) => {
      const { name, description, userId, projectId: _projectId } = request.body;

      const [group] = await db
        .insert(knowledgeGroups)
        .values({
          id: createId(),
          name,
          description,
          userId,
        })
        .returning();

      return reply.success({
        id: group!.id,
        name: group!.name,
        description: group!.description,
        itemCount: 0,
      });
    })
  );

  // Get knowledge group
  app.get(
    "/groups/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const [group] = await db
        .select()
        .from(knowledgeGroups)
        .where(eq(knowledgeGroups.id, id))
        .limit(1);

      if (!group) {
        throw new NotFoundError("Group");
      }

      const [itemCount] = await db
        .select({ count: count() })
        .from(knowledgeItems)
        .where(eq(knowledgeItems.groupId, id));

      return reply.success({ ...group, itemCount: itemCount?.count || 0 });
    })
  );

  // Delete knowledge group
  app.delete(
    "/groups/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const [deleted] = await db
        .delete(knowledgeGroups)
        .where(eq(knowledgeGroups.id, id))
        .returning();

      if (!deleted) {
        throw new NotFoundError("Group");
      }

      return reply.success({ deleted: true });
    })
  );

  // Add item to knowledge group — with full processing pipeline
  app.post(
    "/groups/:groupId/items",
    typedRoute({ params: GroupIdParams, body: AddItemBody }, async (request, reply) => {
      const { groupId } = request.params;
      const { type, title, content, sourceUrl, fileId: _fileId } = request.body;
      const userId = request.userId || "";

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

      return reply.success({ id: item!.id, groupId, type, title, status: "processing" });
    })
  );

  // Get knowledge item
  app.get(
    "/items/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const [item] = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .limit(1);

      if (!item) {
        throw new NotFoundError("Item");
      }

      return reply.success(item);
    })
  );

  // List items for a group
  app.get(
    "/groups/:groupId/items",
    typedRoute({ params: GroupIdParams }, async (request, reply) => {
      const { groupId } = request.params;

      const items = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.groupId, groupId))
        .orderBy(desc(knowledgeItems.createdAt));

      return reply.success({ items });
    })
  );

  // Delete knowledge item (chunks cascade via FK)
  app.delete(
    "/items/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const [deleted] = await db
        .delete(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .returning();

      if (!deleted) {
        throw new NotFoundError("Item");
      }

      return reply.success({ deleted: true });
    })
  );

  // Query knowledge base (vector semantic search)
  app.post(
    "/query",
    typedRoute({ body: QueryBody }, async (request, reply) => {
      const { query, groupIds, userId, limit } = request.body;

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

      return reply.success({ results: results.rows, query });
    })
  );

  // Get chunks for an item
  app.get(
    "/items/:id/chunks",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const chunks = await db
        .select()
        .from(knowledgeChunks)
        .where(eq(knowledgeChunks.itemId, id))
        .orderBy(knowledgeChunks.chunkIndex);

      return reply.success({ chunks });
    })
  );

  // Process a knowledge item (called by tRPC after creating an item in DB)
  app.post(
    "/items/:id/process",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const [item] = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .limit(1);

      if (!item) {
        throw new NotFoundError("Item");
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

      return reply.success({ id, status: "processing" });
    })
  );

  // Reprocess knowledge item — delete old chunks, re-extract, re-chunk, re-embed
  app.post(
    "/items/:id/reprocess",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const [item] = await db
        .select()
        .from(knowledgeItems)
        .where(eq(knowledgeItems.id, id))
        .limit(1);

      if (!item) {
        throw new NotFoundError("Item");
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

      return reply.success({ id, status: "processing" });
    })
  );

  await start();

  // -------------------------------------------------------
  // Background processing function (defined outside routes)
  // -------------------------------------------------------

  /**
   * Process a knowledge item: extract text -> chunk -> embed -> store chunks
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
}

main();
