import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, messages, agentSessions, eq, asc } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

export const messagesRouter = createTRPCRouter({
  // List messages for a session
  list: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify session ownership
      const [session] = await db
        .select()
        .from(agentSessions)
        .where(eq(agentSessions.id, input.sessionId))
        .limit(1);

      if (!session || session.userId !== ctx.user.id) {
        throw new Error("Session not found");
      }

      const sessionMessages = await db
        .select()
        .from(messages)
        .where(eq(messages.sessionId, input.sessionId))
        .orderBy(asc(messages.createdAt));

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
        metadata: z.record(z.unknown()).optional(),
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
          metadata: input.metadata,
        })
        .returning();

      return message;
    }),
});
