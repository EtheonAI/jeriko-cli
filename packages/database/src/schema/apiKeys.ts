import { pgTable, text, timestamp, boolean as pgBoolean, integer } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ============================================================
// API Keys — per-user keys for authenticating with Rubic AI
// ============================================================

export const apiKeys = pgTable("api_keys", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  /** The actual key value. Format: rk_live_<random> or rk_test_<random> */
  key: text("key").notNull().unique(),
  /** First 8 chars of the key for display (e.g., "rk_live_a1b2...") */
  keyPrefix: text("key_prefix").notNull(),
  /** User-provided label (e.g., "My App", "Development") */
  name: text("name").notNull().default("Default"),
  /** Whether this key is active */
  isActive: pgBoolean("is_active").notNull().default(true),
  /** Optional expiration date */
  expiresAt: timestamp("expires_at"),
  /** Last time this key was used */
  lastUsedAt: timestamp("last_used_at"),
  /** Total number of requests made with this key */
  totalRequests: integer("total_requests").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

// ============================================================
// Types
// ============================================================

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
