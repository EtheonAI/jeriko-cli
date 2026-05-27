/**
 * User Secrets — Fetches and decrypts user secrets from DB for sandbox injection.
 *
 * Manus pattern: User secrets from Settings → Secrets are injected into
 * ~/.user_env at sandbox creation, making them available to every shell session.
 *
 * This module lazy-loads @repo/database to avoid import errors when DB is not configured.
 * Uses the same AES-256-GCM encryption as the tRPC router in apps/app.
 */

import crypto from "node:crypto";

// Lazy-loaded database module
let _db: any = null;
let _schema: any = null;
let _eq: any = null;

async function getDb() {
  if (!_db) {
    try {
      const mod = await import("@repo/database/service-index");
      // ESM default export workaround
      const resolved = (mod as any).default ?? mod;
      _db = resolved.db;
      _schema = resolved;
      _eq = resolved.eq;
    } catch (err) {
      console.warn("[user-secrets] Failed to load @repo/database:", err);
      return null;
    }
  }
  return { db: _db, schema: _schema, eq: _eq };
}

function getEncryptionKey(): Buffer {
  const envKey = process.env.SECRETS_ENCRYPTION_KEY;
  if (envKey) {
    return Buffer.from(envKey, "hex");
  }
  // Fallback for dev: derive from DATABASE_URL (must match apps/app)
  const dbUrl = process.env.DATABASE_URL || "jeriko-dev-fallback-key";
  return crypto.createHash("sha256").update(dbUrl).digest();
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

/**
 * Fetch and decrypt all secrets for a user.
 * Returns a Record<string, string> of env var key → plaintext value.
 * Returns empty object if DB not configured or no secrets exist.
 */
export async function getUserSecrets(userId: string): Promise<Record<string, string>> {
  try {
    const dbModule = await getDb();
    if (!dbModule) return {};

    const { db, schema, eq } = dbModule;
    const { userSecrets } = schema;

    if (!userSecrets) {
      // Table not in schema yet (migration not run)
      return {};
    }

    const secrets = await db
      .select({
        key: userSecrets.key,
        encryptedValue: userSecrets.encryptedValue,
        iv: userSecrets.iv,
        authTag: userSecrets.authTag,
      })
      .from(userSecrets)
      .where(eq(userSecrets.userId, userId));

    const result: Record<string, string> = {};
    for (const s of secrets) {
      try {
        result[s.key] = decrypt(s.encryptedValue, s.iv, s.authTag);
      } catch {
        // Skip secrets that fail to decrypt
        console.warn(`[user-secrets] Failed to decrypt secret ${s.key} for user ${userId}`);
      }
    }

    return result;
  } catch (err) {
    console.warn("[user-secrets] Failed to fetch secrets:", err);
    return {};
  }
}
