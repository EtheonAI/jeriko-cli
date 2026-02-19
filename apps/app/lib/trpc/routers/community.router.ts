import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, agentSessions, users, eq, desc, sql } from "@repo/database";

export const communityRouter = createTRPCRouter({
  // List publicly shared sessions with pagination
  listPublicSessions: protectedProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(20),
        sortBy: z.enum(["recent", "popular"]).default("recent"),
      })
    )
    .query(async ({ input }) => {
      const { page, pageSize, sortBy } = input;
      const offset = (page - 1) * pageSize;

      // Filter: metadata->>'isShared' = 'true'
      const sharedFilter = sql`${agentSessions.metadata}->>'isShared' = 'true'`;

      // Count total shared sessions
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentSessions)
        .where(sharedFilter);

      const totalItems = countResult?.count ?? 0;

      // Build order clause
      const orderClause =
        sortBy === "popular"
          ? desc(sql`COALESCE((${agentSessions.metadata}->>'likeCount')::int, 0)`)
          : desc(agentSessions.createdAt);

      // Fetch shared sessions with author info
      const rows = await db
        .select({
          id: agentSessions.id,
          title: agentSessions.title,
          status: agentSessions.status,
          metadata: agentSessions.metadata,
          createdAt: agentSessions.createdAt,
          updatedAt: agentSessions.updatedAt,
          authorId: users.id,
          authorName: users.name,
          authorImage: users.image,
        })
        .from(agentSessions)
        .innerJoin(users, eq(users.id, agentSessions.userId))
        .where(sharedFilter)
        .orderBy(orderClause)
        .limit(pageSize)
        .offset(offset);

      const sessions = rows.map((row) => {
        const meta = (row.metadata as Record<string, unknown>) ?? {};
        return {
          id: row.id,
          title: row.title ?? "Untitled",
          status: row.status,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          likeCount: (meta.likeCount as number) ?? 0,
          viewCount: (meta.viewCount as number) ?? 0,
          author: {
            id: row.authorId,
            name: row.authorName ?? "Unknown",
            image: row.authorImage,
          },
        };
      });

      return {
        sessions,
        totalItems,
        hasMore: offset + pageSize < totalItems,
      };
    }),

  // Like/unlike a shared session (toggles)
  likeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Load the session
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Verify the session is shared
      const meta = (session.metadata as Record<string, unknown>) ?? {};
      if (!meta.isShared) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Track which users have liked (store as array of user IDs)
      const likedBy = (meta.likedBy as string[]) ?? [];
      const alreadyLiked = likedBy.includes(ctx.user.id);

      let updatedLikedBy: string[];
      let likeCount: number;

      if (alreadyLiked) {
        // Unlike
        updatedLikedBy = likedBy.filter((id) => id !== ctx.user.id);
        likeCount = Math.max(0, ((meta.likeCount as number) ?? 0) - 1);
      } else {
        // Like
        updatedLikedBy = [...likedBy, ctx.user.id];
        likeCount = ((meta.likeCount as number) ?? 0) + 1;
      }

      const updatedMeta = {
        ...meta,
        likedBy: updatedLikedBy,
        likeCount,
      };

      await db
        .update(agentSessions)
        .set({ metadata: updatedMeta })
        .where(eq(agentSessions.id, input.sessionId));

      return { liked: !alreadyLiked, likeCount };
    }),
});
