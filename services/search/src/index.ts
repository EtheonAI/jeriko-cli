import Typesense from "typesense";
import { createService, typedRoute, getEnv } from "@repo/service-utils";
import { AuthorizationError } from "@repo/service-utils/errors";
import { z } from "zod";
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
  initDb,
} from "./lib/db.js";

// Collection names (mirroring @repo/search types)
const COLLECTION_NAMES = {
  FILES: "files",
  SESSIONS: "sessions",
  TASKS: "tasks",
  PROJECTS: "projects",
  ACTIONS: "actions",
} as const;

// Create Typesense client directly (can't use @repo/search due to server-only/Next.js deps)
function createTypesenseClient(): Typesense.Client {
  return new Typesense.Client({
    nodes: [
      {
        host: getEnv("TYPESENSE_HOST", "localhost"),
        port: parseInt(getEnv("TYPESENSE_PORT", "8108"), 10),
        protocol: getEnv("TYPESENSE_PROTOCOL", "http"),
      },
    ],
    apiKey: getEnv("TYPESENSE_API_KEY", ""),
    connectionTimeoutSeconds: 5,
    retryIntervalSeconds: 0.1,
    numRetries: 3,
  });
}

let typesenseClient: Typesense.Client | null = null;

function getClient(): Typesense.Client {
  if (!typesenseClient) {
    typesenseClient = createTypesenseClient();
  }
  return typesenseClient;
}

async function isTypesenseAvailable(): Promise<boolean> {
  try {
    const client = getClient();
    const health = await client.health.retrieve();
    return health.ok === true;
  } catch {
    return false;
  }
}

// Typesense search helper
interface TypesenseSearchParams {
  collection: string;
  query: string;
  queryBy: string;
  filterBy?: string;
  limit?: number;
  offset?: number;
}

async function typesenseSearch<T extends Record<string, unknown> = Record<string, unknown>>(
  params: TypesenseSearchParams
) {
  const client = getClient();
  return client
    .collections<T>(params.collection)
    .documents()
    .search({
      q: params.query,
      query_by: params.queryBy,
      filter_by: params.filterBy,
      per_page: params.limit || 20,
      page: Math.floor((params.offset || 0) / (params.limit || 20)) + 1,
      highlight_full_fields: params.queryBy,
    });
}

// Map Typesense hits to result format
function mapHits<T extends Record<string, unknown>>(
  hits: Array<{ document: T; highlights?: Array<{ field: string; snippet?: string }> }> | undefined,
  type: string,
  titleField: keyof T,
  previewField?: keyof T
) {
  return (hits || []).map((hit) => {
    const doc = hit.document;
    const highlightSnippet = hit.highlights?.[0]?.snippet;
    return {
      type,
      id: doc.id as string,
      title: (doc[titleField] as string) || "Untitled",
      preview: previewField ? (doc[previewField] as string | null) : highlightSnippet || null,
      score: 1,
    };
  });
}

// --- Zod Schemas ---

const SearchTypesEnum = z.enum(["projects", "sessions", "files", "knowledge", "messages"]);

const UniversalSearchBody = z.object({
  query: z.string().min(1),
  types: z.array(SearchTypesEnum).optional(),
  userId: z.string().min(1),
  organizationId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

const ProjectSearchBody = z.object({
  query: z.string().min(1),
  userId: z.string().min(1),
  filters: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const SessionSearchBody = z.object({
  query: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const MessageSearchBody = z.object({
  query: z.string().min(1),
  userId: z.string().min(1),
  sessionId: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const FileSearchBody = z.object({
  query: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().optional(),
  mimeType: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const SemanticSearchBody = z.object({
  query: z.string().min(1),
  userId: z.string().min(1),
  scope: z
    .object({
      projectIds: z.array(z.string()).optional(),
      knowledgeGroupIds: z.array(z.string()).optional(),
    })
    .optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const SuggestQuery = z.object({
  q: z.string().min(1),
  types: z.string().optional(),
  userId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const IndexBody = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

const IndexDeleteParams = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
});

async function main() {
  await initDb();

  const { app, logger, start } = await createService({
    name: "search",
    port: parseInt(process.env.PORT || "4013", 10),
  });

  // Universal search across all entities
  app.post(
    "/search",
    typedRoute({ body: UniversalSearchBody }, async (request, reply) => {
      const { query, types, userId, organizationId: _organizationId, limit, offset } = request.body;

      if (request.userId !== userId) {
        throw new AuthorizationError("Cannot search on behalf of another user");
      }

      const searchLimit = Math.min(limit || 20, 100);
      const searchOffset = offset || 0;
      const searchTypes = types || ["projects", "sessions", "files", "knowledge", "messages"];

      try {
        // Try Typesense first
        if (await isTypesenseAvailable()) {
          const results: Array<{
            type: string;
            id: string;
            title: string;
            preview?: string | null;
            score: number;
          }> = [];

          const searchPromises: Array<Promise<void>> = [];

          if (searchTypes.includes("projects")) {
            searchPromises.push(
              typesenseSearch({
                collection: COLLECTION_NAMES.PROJECTS,
                query,
                queryBy: "name,description",
                filterBy: `userId:=${userId}`,
                limit: searchLimit,
              }).then((res) => {
                results.push(...mapHits(res.hits || [], "project", "name", "description"));
              })
            );
          }

          if (searchTypes.includes("sessions")) {
            searchPromises.push(
              typesenseSearch({
                collection: COLLECTION_NAMES.SESSIONS,
                query,
                queryBy: "title",
                filterBy: `userId:=${userId}`,
                limit: searchLimit,
              }).then((res) => {
                results.push(...mapHits(res.hits || [], "session", "title"));
              })
            );
          }

          if (searchTypes.includes("files")) {
            searchPromises.push(
              typesenseSearch({
                collection: COLLECTION_NAMES.FILES,
                query,
                queryBy: "name,path",
                filterBy: `userId:=${userId}`,
                limit: searchLimit,
              }).then((res) => {
                results.push(...mapHits(res.hits || [], "file", "name", "path"));
              })
            );
          }

          await Promise.allSettled(searchPromises);

          // Knowledge and messages are not in Typesense yet - fall back to DB for those
          if (searchTypes.includes("messages")) {
            const searchPattern = `%${query}%`;
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

          if (searchTypes.includes("knowledge")) {
            const searchPattern = `%${query}%`;
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

          logger.info(
            { query, types, userId, resultCount: results.length, source: "typesense" },
            "Search executed"
          );

          return reply.success({
            query,
            results: results.slice(searchOffset, searchOffset + searchLimit),
            total: results.length,
            limit: searchLimit,
            offset: searchOffset,
          });
        }
      } catch (error) {
        logger.warn(error, "Typesense search failed, falling back to DB");
      }

      // DB ILIKE fallback
      const searchPattern = `%${query}%`;
      const results: Array<{
        type: string;
        id: string;
        title: string;
        preview?: string | null;
        score: number;
      }> = [];

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

      logger.info(
        { query, types, userId, resultCount: results.length, source: "db" },
        "Search executed"
      );

      return reply.success({
        query,
        results: results.slice(searchOffset, searchOffset + searchLimit),
        total: results.length,
        limit: searchLimit,
        offset: searchOffset,
      });
    })
  );

  // Search projects
  app.post(
    "/search/projects",
    typedRoute({ body: ProjectSearchBody }, async (request, reply) => {
      const { query, userId, filters: _filters, limit } = request.body;

      if (request.userId !== userId) {
        throw new AuthorizationError("Cannot search on behalf of another user");
      }

      try {
        if (await isTypesenseAvailable()) {
          const res = await typesenseSearch({
            collection: COLLECTION_NAMES.PROJECTS,
            query,
            queryBy: "name,description",
            filterBy: `userId:=${userId}`,
            limit: limit || 20,
          });
          const results = mapHits(res.hits || [], "project", "name", "description");
          return reply.success({ results, total: res.found });
        }
      } catch (error) {
        logger.warn(error, "Typesense project search failed, falling back to DB");
      }

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

      return reply.success({ results, total: results.length });
    })
  );

  // Search sessions
  app.post(
    "/search/sessions",
    typedRoute({ body: SessionSearchBody }, async (request, reply) => {
      const { query, userId, projectId: _projectId, limit } = request.body;

      if (request.userId !== userId) {
        throw new AuthorizationError("Cannot search on behalf of another user");
      }

      try {
        if (await isTypesenseAvailable()) {
          const res = await typesenseSearch({
            collection: COLLECTION_NAMES.SESSIONS,
            query,
            queryBy: "title",
            filterBy: `userId:=${userId}`,
            limit: limit || 20,
          });
          const results = mapHits(res.hits || [], "session", "title");
          return reply.success({ results, total: res.found });
        }
      } catch (error) {
        logger.warn(error, "Typesense session search failed, falling back to DB");
      }

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

      return reply.success({ results, total: results.length });
    })
  );

  // Search messages (no Typesense collection for messages yet - DB only)
  app.post(
    "/search/messages",
    typedRoute({ body: MessageSearchBody }, async (request, reply) => {
      const { query, userId, sessionId, limit } = request.body;

      if (request.userId !== userId) {
        throw new AuthorizationError("Cannot search on behalf of another user");
      }

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

      return reply.success({ results, total: results.length });
    })
  );

  // Search files
  app.post(
    "/search/files",
    typedRoute({ body: FileSearchBody }, async (request, reply) => {
      const { query, userId, projectId: _projectId2, mimeType, limit } = request.body;

      if (request.userId !== userId) {
        throw new AuthorizationError("Cannot search on behalf of another user");
      }

      try {
        if (await isTypesenseAvailable()) {
          let filterBy = `userId:=${userId}`;
          if (mimeType) {
            filterBy += ` && mimeType:=${mimeType}`;
          }
          const res = await typesenseSearch({
            collection: COLLECTION_NAMES.FILES,
            query,
            queryBy: "name,path",
            filterBy,
            limit: limit || 20,
          });
          const results = mapHits(res.hits || [], "file", "name", "path");
          return reply.success({ results, total: res.found });
        }
      } catch (error) {
        logger.warn(error, "Typesense file search failed, falling back to DB");
      }

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

      return reply.success({ results, total: results.length });
    })
  );

  // Semantic search (vector similarity)
  app.post(
    "/search/semantic",
    typedRoute({ body: SemanticSearchBody }, async (request, reply) => {
      const { userId } = request.body;

      if (request.userId !== userId) {
        throw new AuthorizationError("Cannot search on behalf of another user");
      }

      // TODO: Generate embedding and search vector store (Typesense)
      return reply.success({
        results: [],
        total: 0,
      });
    })
  );

  // Autocomplete/suggestions
  app.get(
    "/suggest",
    typedRoute({ query: SuggestQuery }, async (request, reply) => {
      const { q, types: _types, userId, limit } = request.query;

      if (request.userId !== userId) {
        throw new AuthorizationError("Cannot search on behalf of another user");
      }

      try {
        if (await isTypesenseAvailable()) {
          const suggestions: Array<{ type: string; id: string; title: string }> = [];

          const searchPromises: Array<Promise<void>> = [];

          searchPromises.push(
            typesenseSearch({
              collection: COLLECTION_NAMES.PROJECTS,
              query: q,
              queryBy: "name",
              filterBy: `userId:=${userId}`,
              limit: 5,
            }).then((res) => {
              for (const hit of res.hits || []) {
                const doc = hit.document as Record<string, unknown>;
                suggestions.push({
                  type: "project",
                  id: doc.id as string,
                  title: doc.name as string,
                });
              }
            })
          );

          searchPromises.push(
            typesenseSearch({
              collection: COLLECTION_NAMES.SESSIONS,
              query: q,
              queryBy: "title",
              filterBy: `userId:=${userId}`,
              limit: 5,
            }).then((res) => {
              for (const hit of res.hits || []) {
                const doc = hit.document as Record<string, unknown>;
                suggestions.push({
                  type: "session",
                  id: doc.id as string,
                  title: (doc.title as string) || "Untitled",
                });
              }
            })
          );

          searchPromises.push(
            typesenseSearch({
              collection: COLLECTION_NAMES.FILES,
              query: q,
              queryBy: "name",
              filterBy: `userId:=${userId}`,
              limit: 5,
            }).then((res) => {
              for (const hit of res.hits || []) {
                const doc = hit.document as Record<string, unknown>;
                suggestions.push({ type: "file", id: doc.id as string, title: doc.name as string });
              }
            })
          );

          await Promise.allSettled(searchPromises);

          return reply.success({ suggestions: suggestions.slice(0, limit || 10) });
        }
      } catch (error) {
        logger.warn(error, "Typesense suggest failed, falling back to DB");
      }

      const searchPattern = `%${q}%`;
      const suggestions: Array<{ type: string; id: string; title: string }> = [];

      const projectSuggestions = await db
        .select({ id: projects.id, name: projects.name })
        .from(projects)
        .where(and(eq(projects.userId, userId), ilike(projects.name, searchPattern)))
        .limit(5);

      for (const p of projectSuggestions) {
        suggestions.push({ type: "project", id: p.id, title: p.name });
      }

      return reply.success({ suggestions: suggestions.slice(0, limit || 10) });
    })
  );

  // Index entity (internal) - upserts document into Typesense
  app.post(
    "/internal/index",
    typedRoute({ body: IndexBody }, async (request, reply) => {
      const { type, id, data } = request.body;

      try {
        if (await isTypesenseAvailable()) {
          const collectionMap: Record<string, string> = {
            project: COLLECTION_NAMES.PROJECTS,
            session: COLLECTION_NAMES.SESSIONS,
            file: COLLECTION_NAMES.FILES,
            task: COLLECTION_NAMES.TASKS,
            action: COLLECTION_NAMES.ACTIONS,
          };

          const collectionName = collectionMap[type];
          if (collectionName) {
            const client = getClient();
            await client
              .collections(collectionName)
              .documents()
              .upsert({ id, ...data });
            logger.info({ type, id }, "Entity indexed in Typesense");
            return reply.success({ indexed: true });
          }
        }
      } catch (error) {
        logger.warn({ type, id, error }, "Failed to index in Typesense");
      }

      logger.info({ type, id }, "Entity indexed (no-op, Typesense unavailable)");
      return reply.success({ indexed: true });
    })
  );

  // Remove from index (internal) - deletes document from Typesense
  app.delete(
    "/internal/index/:type/:id",
    typedRoute({ params: IndexDeleteParams }, async (request, reply) => {
      const { type, id } = request.params;

      try {
        if (await isTypesenseAvailable()) {
          const collectionMap: Record<string, string> = {
            project: COLLECTION_NAMES.PROJECTS,
            session: COLLECTION_NAMES.SESSIONS,
            file: COLLECTION_NAMES.FILES,
            task: COLLECTION_NAMES.TASKS,
            action: COLLECTION_NAMES.ACTIONS,
          };

          const collectionName = collectionMap[type];
          if (collectionName) {
            const client = getClient();
            await client.collections(collectionName).documents(id).delete();
            logger.info({ type, id }, "Entity removed from Typesense");
            return reply.success({ removed: true });
          }
        }
      } catch (error) {
        logger.warn({ type, id, error }, "Failed to remove from Typesense");
      }

      return reply.success({ removed: true });
    })
  );

  await start();
}

main();
