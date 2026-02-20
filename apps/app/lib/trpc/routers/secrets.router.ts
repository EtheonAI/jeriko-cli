import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, userSecrets, eq, and } from "@repo/database";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";

// ============================================================
// Encryption — AES-256-GCM for secrets at rest
// Key derived from SECRETS_ENCRYPTION_KEY env var (32 bytes hex)
// or falls back to a deterministic key derived from DATABASE_URL.
// In production, SECRETS_ENCRYPTION_KEY MUST be set.
// ============================================================

function getEncryptionKey(): Buffer {
  const envKey = process.env.SECRETS_ENCRYPTION_KEY;
  if (envKey) {
    // Expect 64 hex chars = 32 bytes
    return Buffer.from(envKey, "hex");
  }
  // Fallback for dev: derive from DATABASE_URL (NOT safe for production)
  const dbUrl = process.env.DATABASE_URL || "rubic-dev-fallback-key";
  return crypto.createHash("sha256").update(dbUrl).digest();
}

function encrypt(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return { encrypted, iv: iv.toString("hex"), authTag };
}

function decrypt(encrypted: string, ivHex: string, authTagHex: string): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/** Max secrets per user (Manus has no documented limit, we set 50) */
const MAX_SECRETS_PER_USER = 50;

export const secretsRouter = createTRPCRouter({
  /** List all secrets for the current user (values are MASKED) */
  list: protectedProcedure.query(async ({ ctx }) => {
    const secrets = await db
      .select({
        id: userSecrets.id,
        key: userSecrets.key,
        description: userSecrets.description,
        createdAt: userSecrets.createdAt,
        updatedAt: userSecrets.updatedAt,
      })
      .from(userSecrets)
      .where(eq(userSecrets.userId, ctx.user.id))
      .orderBy(userSecrets.key);

    // Return with masked values (show first 4 chars + "****")
    return secrets.map((s) => ({ ...s, maskedValue: "****" }));
  }),

  /** Create or update a secret (upsert by key) */
  upsert: protectedProcedure
    .input(
      z.object({
        key: z
          .string()
          .min(1)
          .max(255)
          .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "Must be a valid env var name"),
        value: z.string().min(1).max(10000),
        description: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if secret with this key already exists for user
      const [existing] = await db
        .select({ id: userSecrets.id })
        .from(userSecrets)
        .where(and(eq(userSecrets.userId, ctx.user.id), eq(userSecrets.key, input.key)))
        .limit(1);

      const { encrypted, iv, authTag } = encrypt(input.value);

      if (existing) {
        // Update existing
        await db
          .update(userSecrets)
          .set({
            encryptedValue: encrypted,
            iv,
            authTag,
            description: input.description,
            updatedAt: new Date(),
          })
          .where(eq(userSecrets.id, existing.id));

        return { id: existing.id, key: input.key, updated: true };
      }

      // Check limit
      const count = await db
        .select({ id: userSecrets.id })
        .from(userSecrets)
        .where(eq(userSecrets.userId, ctx.user.id));

      if (count.length >= MAX_SECRETS_PER_USER) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `Maximum ${MAX_SECRETS_PER_USER} secrets per user. Delete an existing secret first.`,
        });
      }

      // Insert new
      const [created] = await db
        .insert(userSecrets)
        .values({
          userId: ctx.user.id,
          key: input.key,
          encryptedValue: encrypted,
          iv,
          authTag,
          description: input.description,
        })
        .returning({ id: userSecrets.id, key: userSecrets.key });

      return { ...created, updated: false };
    }),

  /** Delete a secret */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [secret] = await db
        .select({ id: userSecrets.id, userId: userSecrets.userId })
        .from(userSecrets)
        .where(eq(userSecrets.id, input.id))
        .limit(1);

      if (!secret) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Secret not found" });
      }

      if (secret.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not your secret" });
      }

      await db.delete(userSecrets).where(eq(userSecrets.id, input.id));
      return { success: true };
    }),

  /** Bulk delete secrets */
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1).max(50) }))
    .mutation(async ({ ctx, input }) => {
      let deleted = 0;
      for (const id of input.ids) {
        const [secret] = await db
          .select({ id: userSecrets.id, userId: userSecrets.userId })
          .from(userSecrets)
          .where(eq(userSecrets.id, id))
          .limit(1);

        if (secret && secret.userId === ctx.user.id) {
          await db.delete(userSecrets).where(eq(userSecrets.id, id));
          deleted++;
        }
      }
      return { deleted };
    }),

  /**
   * Get all decrypted secrets for a user (INTERNAL — only for sandbox injection).
   * This is called server-side by the orchestrator proxy, never exposed to the client.
   */
  getDecrypted: protectedProcedure.query(async ({ ctx }) => {
    const secrets = await db
      .select({
        key: userSecrets.key,
        encryptedValue: userSecrets.encryptedValue,
        iv: userSecrets.iv,
        authTag: userSecrets.authTag,
      })
      .from(userSecrets)
      .where(eq(userSecrets.userId, ctx.user.id));

    const decrypted: Record<string, string> = {};
    for (const s of secrets) {
      try {
        decrypted[s.key] = decrypt(s.encryptedValue, s.iv, s.authTag);
      } catch {
        // Skip secrets that fail to decrypt (key rotation edge case)
      }
    }
    return decrypted;
  }),
});
