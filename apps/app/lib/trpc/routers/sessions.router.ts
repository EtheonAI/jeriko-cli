import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import { db, agentSessions, messages, users, eq, desc, asc, sql } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { syncSessionToSearch, removeSessionFromSearch } from "@repo/search";

export const sessionsRouter = createTRPCRouter({
  // List all sessions for the current user
  list: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.userId, ctx.user.id))
      .orderBy(desc(agentSessions.createdAt));

    return sessions;
  }),

  // Get a single session by ID
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [session] = await db
      .select()
      .from(agentSessions)
      .where(eq(agentSessions.id, input.id))
      .limit(1);

    if (!session || session.userId !== ctx.user.id) {
      return null;
    }

    return session;
  }),

  // Create a new session
  create: protectedProcedure
    .input(
      z.object({
        title: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();
      const [session] = await db
        .insert(agentSessions)
        .values({
          id,
          userId: ctx.user.id,
          title: input.title || null,
          status: "active",
        })
        .returning();

      // Sync to search index (non-blocking)
      syncSessionToSearch(session!).catch(() => {});
      // TODO: Publish session:new event via gateway/backend service (not from Next.js)

      return session;
    }),

  // Update a session
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        status: z.enum(["active", "paused", "completed", "failed"]).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, metadata: newMeta, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, id))
        .limit(1);

      if (!existing || existing.userId !== ctx.user.id) {
        throw new Error("Session not found");
      }

      // Merge metadata if provided (shallow merge with existing)
      const mergedMeta = newMeta
        ? { ...(existing.metadata as Record<string, unknown> ?? {}), ...newMeta }
        : undefined;

      const setValues: Record<string, unknown> = { ...updates };
      if (mergedMeta) setValues.metadata = mergedMeta;

      const [session] = await db
        .update(agentSessions)
        .set(setValues)
        .where(eq(agentSessions.id, id))
        .returning();

      // Sync to search index (non-blocking)
      syncSessionToSearch(session!).catch(() => {});
      // TODO: Publish session:update event via gateway/backend service

      return session;
    }),

  // Delete a session
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.id))
        .limit(1);

      if (!existing || existing.userId !== ctx.user.id) {
        throw new Error("Session not found");
      }

      await db.delete(agentSessions).where(eq(agentSessions.id, input.id));

      // Remove from search index (non-blocking)
      removeSessionFromSearch(input.id).catch(() => {});
      // TODO: Publish session:deleted event via gateway/backend service

      return { success: true };
    }),

  // ================================================================
  // Session Sharing
  // ================================================================

  // Share a session publicly
  shareSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Merge isShared into metadata
      const currentMeta = (existing.metadata as Record<string, unknown>) ?? {};
      const mergedMeta = { ...currentMeta, isShared: true };

      const [session] = await db
        .update(agentSessions)
        .set({ metadata: mergedMeta })
        .where(eq(agentSessions.id, input.sessionId))
        .returning();

      // The share URL uses the session ID directly
      const shareUrl = `/share/${input.sessionId}`;

      return { session, shareUrl };
    }),

  // Unshare a session
  unshareSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!existing || existing.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Merge isShared=false into metadata
      const currentMeta = (existing.metadata as Record<string, unknown>) ?? {};
      const mergedMeta = { ...currentMeta, isShared: false };

      const [session] = await db
        .update(agentSessions)
        .set({ metadata: mergedMeta })
        .where(eq(agentSessions.id, input.sessionId))
        .returning();

      return { session };
    }),

  // Get a shared session (PUBLIC - no auth required)
  getSharedSession: publicProcedure
    .input(z.object({ shareId: z.string() }))
    .query(async ({ input }) => {
      // Load session
      const [session] = await db
        .select({
          id: agentSessions.id,
          title: agentSessions.title,
          status: agentSessions.status,
          metadata: agentSessions.metadata,
          createdAt: agentSessions.createdAt,
          updatedAt: agentSessions.updatedAt,
          userId: agentSessions.userId,
        })
        .from(agentSessions)
        .where(eq(agentSessions.id, input.shareId))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Check if session is shared
      const meta = (session.metadata as Record<string, unknown>) ?? {};
      if (!meta.isShared) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      // Load the session author info
      const [author] = await db
        .select({ id: users.id, name: users.name, image: users.image })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      // Load messages for the session
      const sessionMessages = await db
        .select({
          id: messages.id,
          role: messages.role,
          content: messages.content,
          parts: messages.parts,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(eq(messages.sessionId, input.shareId))
        .orderBy(asc(messages.createdAt));

      // Increment view count in metadata (non-blocking)
      const viewCount = ((meta.viewCount as number) ?? 0) + 1;
      db.update(agentSessions)
        .set({ metadata: { ...meta, viewCount } })
        .where(eq(agentSessions.id, input.shareId))
        .then(() => {})
        .catch(() => {});

      return {
        session: {
          id: session.id,
          title: session.title,
          status: session.status,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          metadata: session.metadata,
        },
        author: author ?? { id: session.userId, name: "Unknown", image: null },
        messages: sessionMessages,
      };
    }),
});
