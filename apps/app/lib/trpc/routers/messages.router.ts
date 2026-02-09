import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, messages, agentSessions, votes, documents, eq, and, asc, desc } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

export const messagesRouter = createTRPCRouter({
  // List messages for a session
  list: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Run ownership check + messages query in parallel
      const [[session], sessionMessages] = await Promise.all([
        db
          .select()
          .from(agentSessions)
          .where(and(eq(agentSessions.id, input.sessionId), eq(agentSessions.userId, ctx.user.id)))
          .limit(1),
        db
          .select()
          .from(messages)
          .where(eq(messages.sessionId, input.sessionId))
          .orderBy(asc(messages.createdAt)),
      ]);

      if (!session) {
        throw new Error("Session not found");
      }

      return sessionMessages;
    }),

  // Send a message (creates user message)
  send: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Session not found");
      }

      const id = createId();
      const [message] = await db
        .insert(messages)
        .values({
          id,
          sessionId: input.sessionId,
          role: "user",
          content: input.content,
        })
        .returning();

      // TODO: Publish message:new event via gateway/backend service

      // TODO: Trigger AI response via agent orchestrator

      return message;
    }),

  // Add a message (for internal use - assistant/system messages)
  add: protectedProcedure
    .input(
      z.object({
        sessionId: z.string(),
        role: z.enum(["user", "assistant", "system", "tool"]),
        content: z.string(),
        parts: z.array(z.record(z.string(), z.unknown())).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Session not found");
      }

      const id = createId();
      const [message] = await db
        .insert(messages)
        .values({
          id,
          sessionId: input.sessionId,
          role: input.role,
          content: input.content,
          parts: input.parts ?? null,
          metadata: input.metadata,
        })
        .returning();

      // TODO: Publish message:new event via gateway/backend service

      return message;
    }),

  // ================================================================
  // Votes — user feedback on assistant messages
  // ================================================================

  // Get all votes for a chat session
  getVotes: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(and(eq(agentSessions.id, input.chatId), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      if (!session) {
        throw new Error("Session not found");
      }

      return db
        .select()
        .from(votes)
        .where(eq(votes.chatId, input.chatId));
    }),

  // Save or update a vote (upsert) — 1-5 star rating
  vote: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
        rating: z.number().int().min(1).max(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify session ownership
        const [session] = await db
          .select()
          .from(agentSessions)
          .where(and(eq(agentSessions.id, input.chatId), eq(agentSessions.userId, ctx.user.id)))
          .limit(1);

        if (!session) {
          throw new Error("Session not found");
        }

        // Use PostgreSQL UPSERT (INSERT ... ON CONFLICT ... DO UPDATE)
        // This is atomic and prevents duplicate key errors
        const [vote] = await db
          .insert(votes)
          .values({
            chatId: input.chatId,
            messageId: input.messageId,
            rating: input.rating,
          })
          .onConflictDoUpdate({
            target: [votes.chatId, votes.messageId],
            set: { rating: input.rating },
          })
          .returning();

        return { success: true, vote };
      } catch (error) {
        console.error("[messages.vote] Error:", error);
        throw error;
      }
    }),

  // Remove a vote (toggle off)
  removeVote: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        messageId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(and(eq(agentSessions.id, input.chatId), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      if (!session) {
        throw new Error("Session not found");
      }

      await db
        .delete(votes)
        .where(and(eq(votes.chatId, input.chatId), eq(votes.messageId, input.messageId)));

      return { success: true };
    }),

  // ================================================================
  // Documents — inline artifacts/editable content within chat
  // ================================================================

  // Get a document by ID
  getDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [doc] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.id), eq(documents.userId, ctx.user.id)))
        .limit(1);

      return doc ?? null;
    }),

  // List documents for a chat session
  listDocuments: protectedProcedure
    .input(z.object({ chatId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(and(eq(agentSessions.id, input.chatId), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      if (!session) {
        throw new Error("Session not found");
      }

      return db
        .select()
        .from(documents)
        .where(eq(documents.chatId, input.chatId))
        .orderBy(desc(documents.createdAt));
    }),

  // Create a document
  createDocument: protectedProcedure
    .input(
      z.object({
        chatId: z.string(),
        title: z.string(),
        kind: z.enum(["text", "code", "image", "sheet", "html"]).default("text"),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(and(eq(agentSessions.id, input.chatId), eq(agentSessions.userId, ctx.user.id)))
        .limit(1);

      if (!session) {
        throw new Error("Session not found");
      }

      const [doc] = await db
        .insert(documents)
        .values({
          chatId: input.chatId,
          title: input.title,
          kind: input.kind,
          content: input.content ?? null,
          userId: ctx.user.id,
        })
        .returning();

      return doc;
    }),

  // Update a document
  updateDocument: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.id), eq(documents.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Document not found");
      }

      const [doc] = await db
        .update(documents)
        .set({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.content !== undefined && { content: input.content }),
        })
        .where(eq(documents.id, input.id))
        .returning();

      return doc;
    }),

  // Delete a document
  deleteDocument: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(documents)
        .where(and(eq(documents.id, input.id), eq(documents.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new Error("Document not found");
      }

      await db.delete(documents).where(eq(documents.id, input.id));
      return { success: true };
    }),
});
