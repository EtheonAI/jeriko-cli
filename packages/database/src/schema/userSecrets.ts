import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ============================================================
// User Secrets — Manus parity: per-user key-value secrets
// injected into sandbox ~/.user_env at session start.
//
// Manus pattern: Settings → Secrets stores env vars per user.
// On sandbox creation, all secrets are written to .user_env
// so every shell session inherits them automatically.
// ============================================================

export const userSecrets = pgTable("user_secrets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  /** Environment variable name (e.g., "DATABASE_URL", "STRIPE_API_KEY") */
  key: text("key").notNull(),
  /** Encrypted value — AES-256-GCM encrypted at rest, decrypted only for sandbox injection */
  encryptedValue: text("encrypted_value").notNull(),
  /** IV for AES-256-GCM decryption (hex-encoded) */
  iv: text("iv").notNull(),
  /** Auth tag for AES-256-GCM (hex-encoded) */
  authTag: text("auth_tag").notNull(),
  /** Optional description for the user's reference */
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const userSecretsRelations = relations(userSecrets, ({ one }) => ({
  user: one(users, {
    fields: [userSecrets.userId],
    references: [users.id],
  }),
}));

// ============================================================
// Types
// ============================================================

export type UserSecret = typeof userSecrets.$inferSelect;
export type NewUserSecret = typeof userSecrets.$inferInsert;
