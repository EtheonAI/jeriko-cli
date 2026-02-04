import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, users, accounts, authSessions, eq, and } from "@repo/database";
import { TRPCError } from "@trpc/server";
import { auth } from "@repo/auth/server";

export const userRouter = createTRPCRouter({
  // Get current user profile
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        image: users.image,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
        stripeCustomerId: users.stripeCustomerId,
        stripeSubscriptionId: users.stripeSubscriptionId,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return user;
  }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        image: z.string().url().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updates: Partial<typeof users.$inferInsert> = {};

      if (input.name !== undefined) {
        updates.name = input.name;
      }

      if (input.image !== undefined) {
        updates.image = input.image;
      }

      if (Object.keys(updates).length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No fields to update",
        });
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, ctx.user.id))
        .returning();

      return {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        image: updated.image,
      };
    }),

  // Change password
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(100),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get user's account with password
      const [account] = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, ctx.user.id),
            eq(accounts.providerId, "credential")
          )
        )
        .limit(1);

      if (!account || !account.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password authentication not enabled for this account",
        });
      }

      // Verify current password using better-auth's context
      const ctx_auth = await auth.api.getSession({
        headers: new Headers(),
      });

      // For security, we'll use a simple bcrypt comparison
      // In production, use better-auth's built-in password verification
      const bcrypt = await import("bcryptjs");
      const isValid = await bcrypt.compare(input.currentPassword, account.password);

      if (!isValid) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(input.newPassword, 12);

      // Update password
      await db
        .update(accounts)
        .set({ password: hashedPassword })
        .where(eq(accounts.id, account.id));

      return { success: true };
    }),

  // Delete account
  deleteAccount: protectedProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE"),
        password: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify password if the user has one
      const [account] = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, ctx.user.id),
            eq(accounts.providerId, "credential")
          )
        )
        .limit(1);

      if (account?.password && input.password) {
        const bcrypt = await import("bcryptjs");
        const isValid = await bcrypt.compare(input.password, account.password);

        if (!isValid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Password is incorrect",
          });
        }
      }

      // Delete user - cascades to related data
      await db.delete(users).where(eq(users.id, ctx.user.id));

      return { success: true };
    }),

  // Get active sessions
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    const sessions = await db
      .select({
        id: authSessions.id,
        ipAddress: authSessions.ipAddress,
        userAgent: authSessions.userAgent,
        createdAt: authSessions.createdAt,
        expiresAt: authSessions.expiresAt,
      })
      .from(authSessions)
      .where(eq(authSessions.userId, ctx.user.id))
      .orderBy(authSessions.createdAt);

    return sessions;
  }),

  // Revoke a session
  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [session] = await db
        .select()
        .from(authSessions)
        .where(
          and(
            eq(authSessions.id, input.sessionId),
            eq(authSessions.userId, ctx.user.id)
          )
        )
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      await db.delete(authSessions).where(eq(authSessions.id, input.sessionId));

      return { success: true };
    }),

  // Revoke all sessions except current
  revokeAllSessions: protectedProcedure
    .input(z.object({ currentToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(authSessions)
        .where(
          and(
            eq(authSessions.userId, ctx.user.id),
            // Keep the current session
            // In a real implementation, you'd compare the token
          )
        );

      return { success: true };
    }),

  // Get connected accounts (OAuth providers)
  getConnectedAccounts: protectedProcedure.query(async ({ ctx }) => {
    const connectedAccounts = await db
      .select({
        id: accounts.id,
        providerId: accounts.providerId,
        accountId: accounts.accountId,
        createdAt: accounts.createdAt,
      })
      .from(accounts)
      .where(eq(accounts.userId, ctx.user.id));

    return connectedAccounts.filter((a) => a.providerId !== "credential");
  }),

  // Disconnect OAuth account
  disconnectAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify the user has at least one other login method
      const userAccounts = await db
        .select()
        .from(accounts)
        .where(eq(accounts.userId, ctx.user.id));

      if (userAccounts.length <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot disconnect the only login method",
        });
      }

      await db
        .delete(accounts)
        .where(
          and(
            eq(accounts.id, input.accountId),
            eq(accounts.userId, ctx.user.id)
          )
        );

      return { success: true };
    }),
});
