import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  users,
  accounts,
  authSessions,
  agentSessions,
  messages,
  files,
  eq,
  ne,
  and,
  inArray,
  type UserPreferences,
} from "@repo/database";
import { TRPCError } from "@trpc/server";
import { auth } from "@repo/auth/server";

const preferencesSchema = z.object({
  communicationStyle: z.enum(["concise", "balanced", "detailed"]).optional(),
  expertiseLevel: z.enum(["beginner", "intermediate", "expert"]).optional(),
  customInstructions: z.string().max(2000).optional(),
  defaultModel: z.string().optional(),
  bio: z.string().max(500).optional(),
  fontSize: z.enum(["small", "medium", "large"]).optional(),
  chatDensity: z.enum(["compact", "comfortable", "spacious"]).optional(),
  saveHistory: z.boolean().optional(),
  analyticsEnabled: z.boolean().optional(),
  crashReports: z.boolean().optional(),
  personalizedExperience: z.boolean().optional(),
  conversationRetention: z.enum(["30d", "90d", "1y", "never"]).optional(),
  fileRetention: z.enum(["30d", "90d", "1y", "never"]).optional(),
  activityLogRetention: z.enum(["30d", "90d", "1y", "never"]).optional(),
  enabledSkills: z.record(z.string(), z.boolean()).optional(),
  autoSummarizeEmails: z.boolean().optional(),
  autoCategorizeEmails: z.boolean().optional(),
});

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
        image: z.string().url().max(2048).refine(
          (v) => v.startsWith("https://") || v.startsWith("http://"),
          "Only HTTP(S) URLs allowed — data URIs are not accepted",
        ).optional().nullable(),
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
        id: updated!.id,
        name: updated!.name,
        email: updated!.email,
        image: updated!.image,
      };
    }),

  // Change password (uses better-auth's built-in API for proper hash handling)
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(12).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify user has a credential account
      const [account] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, ctx.user.id), eq(accounts.providerId, "credential")))
        .limit(1);

      if (!account) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password authentication not enabled for this account",
        });
      }

      // Use better-auth's changePassword API which handles verification + hashing
      const result = await auth.api.changePassword({
        body: {
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
        },
        headers: new Headers({
          // Pass user context via cookie so better-auth identifies the session
          cookie: `better-auth.session_token=${ctx.session.session?.token ?? ""}`,
        }),
      });

      if (!result) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Current password is incorrect",
        });
      }

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
      // Check if user has a credential (password) account
      const [account] = await db
        .select({ id: accounts.id, password: accounts.password })
        .from(accounts)
        .where(and(eq(accounts.userId, ctx.user.id), eq(accounts.providerId, "credential")))
        .limit(1);

      // Require password verification for credential accounts
      if (account?.password) {
        if (!input.password) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Password is required to delete your account",
          });
        }

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
        .where(and(eq(authSessions.id, input.sessionId), eq(authSessions.userId, ctx.user.id)))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found" });
      }

      await db.delete(authSessions).where(eq(authSessions.id, input.sessionId));

      return { success: true };
    }),

  // Revoke all sessions except current
  revokeAllSessions: protectedProcedure.mutation(async ({ ctx }) => {
    const currentSessionToken = ctx.session.session?.token;

    if (currentSessionToken) {
      // Delete all sessions except the current one
      await db.delete(authSessions).where(
        and(
          eq(authSessions.userId, ctx.user.id),
          ne(authSessions.token, currentSessionToken)
        )
      );
    } else {
      // Fallback: delete all sessions (shouldn't happen since user is authenticated)
      await db.delete(authSessions).where(eq(authSessions.userId, ctx.user.id));
    }

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
      const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, ctx.user.id));

      if (userAccounts.length <= 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot disconnect the only login method",
        });
      }

      await db
        .delete(accounts)
        .where(and(eq(accounts.id, input.accountId), eq(accounts.userId, ctx.user.id)));

      return { success: true };
    }),

  // Get user preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await db
      .select({ preferences: users.preferences })
      .from(users)
      .where(eq(users.id, ctx.user.id))
      .limit(1);

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    return (user.preferences ?? {}) as UserPreferences;
  }),

  // Update user preferences (deep merge)
  updatePreferences: protectedProcedure
    .input(preferencesSchema)
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select({ preferences: users.preferences })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const existing = (user.preferences ?? {}) as UserPreferences;
      const merged: UserPreferences = {
        ...existing,
        ...input,
        // Deep merge enabledSkills
        ...(input.enabledSkills
          ? { enabledSkills: { ...existing.enabledSkills, ...input.enabledSkills } }
          : {}),
      };

      const [updated] = await db
        .update(users)
        .set({ preferences: merged })
        .where(eq(users.id, ctx.user.id))
        .returning({ preferences: users.preferences });

      return (updated!.preferences ?? {}) as UserPreferences;
    }),

  // Export user data as JSON
  exportData: protectedProcedure.mutation(async ({ ctx }) => {
    // Fetch user, sessions, and files in parallel (all independent)
    const [[user], sessions, userFiles] = await Promise.all([
      db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1),
      db.select().from(agentSessions).where(eq(agentSessions.userId, ctx.user.id)),
      db.select().from(files).where(eq(files.userId, ctx.user.id)),
    ]);

    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
    }

    // Messages depend on session IDs, so they must run after sessions
    const sessionIds = sessions.map((s) => s.id);
    let allMessages: (typeof messages.$inferSelect)[] = [];
    if (sessionIds.length > 0) {
      allMessages = await db.select().from(messages).where(inArray(messages.sessionId, sessionIds));
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        preferences: user.preferences,
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
        createdAt: s.createdAt,
      })),
      messages: allMessages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      files: userFiles.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        createdAt: f.createdAt,
      })),
      exportedAt: new Date().toISOString(),
    };
  }),

  // Clear chat history (delete all agent sessions — messages cascade)
  clearChatHistory: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(agentSessions).where(eq(agentSessions.userId, ctx.user.id));

    return { success: true };
  }),

  // Clear all user files
  clearFiles: protectedProcedure.mutation(async ({ ctx }) => {
    await db.delete(files).where(eq(files.userId, ctx.user.id));

    return { success: true };
  }),
});
