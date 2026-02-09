import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, agentSessions, eq, desc } from "@repo/database";
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
});
