import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, apiKeys, eq, and } from "@repo/database";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";

/** Generate a secure Rubic AI API key: rk_live_<32 random hex chars> */
function generateApiKey(): { key: string; prefix: string } {
  const random = crypto.randomBytes(24).toString("base64url");
  const key = `rk_live_${random}`;
  const prefix = key.slice(0, 12) + "...";
  return { key, prefix };
}

export const apiKeysRouter = createTRPCRouter({
  /** List all API keys for the current user (keys are masked) */
  list: protectedProcedure.query(async ({ ctx }) => {
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        totalRequests: apiKeys.totalRequests,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.userId, ctx.user.id))
      .orderBy(apiKeys.createdAt);

    return keys;
  }),

  /** Create a new API key. Returns the FULL key (only shown once). */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).default("Default"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Limit to 5 active keys per user
      const existingCount = await db
        .select({ id: apiKeys.id })
        .from(apiKeys)
        .where(and(eq(apiKeys.userId, ctx.user.id), eq(apiKeys.isActive, true)));

      if (existingCount.length >= 5) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Maximum 5 active API keys per user. Revoke an existing key first.",
        });
      }

      const { key, prefix } = generateApiKey();

      const [created] = await db
        .insert(apiKeys)
        .values({
          userId: ctx.user.id,
          key,
          keyPrefix: prefix,
          name: input.name,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
        });

      // Return the full key — this is the only time it's visible
      return { ...created, key };
    }),

  /** Revoke (deactivate) an API key */
  revoke: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [key] = await db
        .select({ id: apiKeys.id, userId: apiKeys.userId })
        .from(apiKeys)
        .where(eq(apiKeys.id, input.id))
        .limit(1);

      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }

      if (key.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your API key" });
      }

      await db
        .update(apiKeys)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(apiKeys.id, input.id));

      return { success: true };
    }),

  /** Delete an API key permanently */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [key] = await db
        .select({ id: apiKeys.id, userId: apiKeys.userId })
        .from(apiKeys)
        .where(eq(apiKeys.id, input.id))
        .limit(1);

      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }

      if (key.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your API key" });
      }

      await db.delete(apiKeys).where(eq(apiKeys.id, input.id));
      return { success: true };
    }),

  /** Rename an API key */
  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [key] = await db
        .select({ id: apiKeys.id, userId: apiKeys.userId })
        .from(apiKeys)
        .where(eq(apiKeys.id, input.id))
        .limit(1);

      if (!key) {
        throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });
      }

      if (key.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your API key" });
      }

      await db
        .update(apiKeys)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(apiKeys.id, input.id));

      return { success: true };
    }),
});
