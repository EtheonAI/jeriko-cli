import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, agentMailboxes, eq } from "@repo/database";
import {
  createInbox,
  updateInbox as updateAgentMailInbox,
  deleteInbox,
  listMessages as listAgentMailMessages,
  getMessage as getAgentMailMessage,
  sendMessage as sendAgentMailMessage,
  replyToMessage as replyToAgentMailMessage,
  forwardMessage as forwardAgentMailMessage,
  listThreads as listAgentMailThreads,
  getThread as getAgentMailThread,
} from "@repo/agentmail";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";

export const mailRouter = createTRPCRouter({
  // Get or auto-create a mailbox for the current user
  getOrCreateMailbox: protectedProcedure.query(async ({ ctx }) => {
    try {
      // Check for existing mailbox
      const [existing] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (existing) return existing;

      // Create a new inbox via AgentMail API
      const inbox = await createInbox({
        displayName: ctx.user.name ?? ctx.user.email,
      });

      const inboxId = inbox.inboxId;
      // inboxId is the email address (e.g., "username@agentmail.to")
      const email = inboxId.includes("@") ? inboxId : `${inboxId}@agentmail.to`;

      const [mailbox] = await db
        .insert(agentMailboxes)
        .values({
          id: createId(),
          userId: ctx.user.id,
          inboxId,
          email,
          displayName: ctx.user.name ?? null,
        })
        .onConflictDoNothing({ target: agentMailboxes.userId })
        .returning();

      // If insert was a no-op due to race condition, fetch the existing one
      if (!mailbox) {
        const [raced] = await db
          .select()
          .from(agentMailboxes)
          .where(eq(agentMailboxes.userId, ctx.user.id))
          .limit(1);
        return raced!;
      }

      return mailbox;
    } catch (error) {
      console.error("[mail.getOrCreateMailbox] Failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? `Failed to provision email inbox: ${error.message}`
            : "Failed to provision email inbox",
        cause: error,
      });
    }
  }),

  // Get existing mailbox (no auto-create)
  getMailbox: protectedProcedure.query(async ({ ctx }) => {
    const [mailbox] = await db
      .select()
      .from(agentMailboxes)
      .where(eq(agentMailboxes.userId, ctx.user.id))
      .limit(1);

    return mailbox ?? null;
  }),

  // Update mailbox display name
  updateMailbox: protectedProcedure
    .input(z.object({ displayName: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
      }

      await updateAgentMailInbox(mailbox.inboxId, {
        displayName: input.displayName,
      });

      const [updated] = await db
        .update(agentMailboxes)
        .set({ displayName: input.displayName })
        .where(eq(agentMailboxes.id, mailbox.id))
        .returning();

      return updated!;
    }),

  // Delete mailbox
  deleteMailbox: protectedProcedure.mutation(async ({ ctx }) => {
    const [mailbox] = await db
      .select()
      .from(agentMailboxes)
      .where(eq(agentMailboxes.userId, ctx.user.id))
      .limit(1);

    if (!mailbox) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
    }

    await deleteInbox(mailbox.inboxId);

    await db.delete(agentMailboxes).where(eq(agentMailboxes.id, mailbox.id));

    return { success: true };
  }),

  // List messages
  listMessages: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          pageToken: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Mailbox not found. Visit mail settings to provision one.",
        });
      }

      return listAgentMailMessages(mailbox.inboxId, {
        limit: input?.limit,
        pageToken: input?.pageToken,
      });
    }),

  // Get a single message
  getMessage: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
      }

      return getAgentMailMessage(mailbox.inboxId, input.messageId);
    }),

  // Send a message
  sendMessage: protectedProcedure
    .input(
      z.object({
        to: z.string().email(),
        subject: z.string().min(1),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
      }

      return sendAgentMailMessage(mailbox.inboxId, {
        to: input.to,
        subject: input.subject,
        text: input.text,
      });
    }),

  // Reply to a message
  replyToMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        text: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
      }

      return replyToAgentMailMessage(mailbox.inboxId, input.messageId, {
        text: input.text,
      });
    }),

  // Forward a message
  forwardMessage: protectedProcedure
    .input(
      z.object({
        messageId: z.string(),
        to: z.string().email(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
      }

      return forwardAgentMailMessage(mailbox.inboxId, input.messageId, {
        to: input.to,
      });
    }),

  // List threads
  listThreads: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          pageToken: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
      }

      return listAgentMailThreads(mailbox.inboxId, {
        limit: input?.limit,
        pageToken: input?.pageToken,
      });
    }),

  // Get a single thread
  getThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [mailbox] = await db
        .select()
        .from(agentMailboxes)
        .where(eq(agentMailboxes.userId, ctx.user.id))
        .limit(1);

      if (!mailbox) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Mailbox not found" });
      }

      return getAgentMailThread(mailbox.inboxId, input.threadId);
    }),
});
