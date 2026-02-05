import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, projects, agentSessions, files, scheduledTasks, eq } from "@repo/database";
import {
  search,
  quickSearch,
  initializeCollections,
  getAllCollectionStats,
  checkTypesenseHealth,
  syncAllFilesToSearch,
  syncAllSessionsToSearch,
  syncAllTasksToSearch,
  syncAllProjectsToSearch,
  COLLECTION_NAMES,
  type SearchOptions,
  type CollectionName,
} from "@repo/search";

// Define search result types for response schema
const searchResultItemSchema = z.object({
  id: z.string(),
  type: z.enum(["file", "session", "task", "project", "action"]),
  title: z.string(),
  subtitle: z.string().optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  timestamp: z.number(),
  url: z.string().optional(),
  highlights: z
    .array(
      z.object({
        field: z.string(),
        snippet: z.string(),
      })
    )
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const searchRouter = createTRPCRouter({
  // Global search across all collections
  global: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(500),
        collections: z
          .array(z.enum(["files", "sessions", "tasks", "projects", "actions"]))
          .optional(),
        filters: z
          .object({
            type: z.array(z.enum(["file", "session", "task", "project", "action"])).optional(),
            status: z.array(z.string()).optional(),
            dateFrom: z.date().optional(),
            dateTo: z.date().optional(),
          })
          .optional(),
        limit: z.number().min(1).max(50).default(5),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const searchOptions: SearchOptions = {
        query: input.query,
        userId: ctx.user.id,
        collections: input.collections as CollectionName[] | undefined,
        filters: input.filters,
        limit: input.limit,
        offset: input.offset,
        highlightFields: true,
      };

      try {
        const results = await search(searchOptions);
        return results;
      } catch (error) {
        // If Typesense is unavailable, return empty results
        console.error("Search error:", error);
        return {
          query: input.query,
          totalFound: 0,
          results: [],
          facets: { type: {} },
          processingTimeMs: 0,
        };
      }
    }),

  // Quick search for autocomplete (faster, limited results)
  quick: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(200),
        limit: z.number().min(1).max(20).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const results = await quickSearch(input.query, ctx.user.id, input.limit);
        return results;
      } catch (error) {
        console.error("Quick search error:", error);
        return [];
      }
    }),

  // Get search health status
  health: protectedProcedure.query(async () => {
    try {
      const isHealthy = await checkTypesenseHealth();
      const stats = isHealthy ? await getAllCollectionStats() : null;

      return {
        healthy: isHealthy,
        stats,
      };
    } catch (error) {
      return {
        healthy: false,
        stats: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),

  // Initialize search collections (admin only, typically run once)
  initialize: protectedProcedure.mutation(async () => {
    try {
      await initializeCollections();
      return { success: true };
    } catch (error) {
      console.error("Failed to initialize collections:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),

  // Get collection statistics
  stats: protectedProcedure.query(async () => {
    try {
      const stats = await getAllCollectionStats();
      return stats;
    } catch (error) {
      console.error("Failed to get stats:", error);
      return null;
    }
  }),

  // Get recent searches (stored client-side, this is a placeholder for future server-side history)
  getRecentSearches: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      // TODO: Implement server-side search history
      // For now, return empty array (client manages recent searches in localStorage)
      return [];
    }),

  // Reindex all data from DB into Typesense
  reindex: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const results: Record<string, { success: number; failed: number }> = {};

    try {
      // Fetch and sync projects
      const allProjects = await db.select().from(projects).where(eq(projects.userId, userId));
      results.projects = await syncAllProjectsToSearch(allProjects);

      // Fetch and sync sessions
      const allSessions = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.userId, userId));
      results.sessions = await syncAllSessionsToSearch(allSessions);

      // Fetch and sync files
      const allFiles = await db.select().from(files).where(eq(files.userId, userId));
      results.files = await syncAllFilesToSearch(allFiles);

      // Fetch and sync scheduled tasks
      const allTasks = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.userId, userId));
      results.tasks = await syncAllTasksToSearch(allTasks);

      return {
        success: true,
        results,
        totalIndexed: Object.values(results).reduce((sum, r) => sum + r.success, 0),
        totalFailed: Object.values(results).reduce((sum, r) => sum + r.failed, 0),
      };
    } catch (error) {
      console.error("Reindex failed:", error);
      return {
        success: false,
        results,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),
});
