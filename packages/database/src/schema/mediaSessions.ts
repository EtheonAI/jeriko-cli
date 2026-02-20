import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

export const mediaSessions = pgTable("media_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  sessionId: text("session_id").notNull(),
  sandboxId: text("sandbox_id"),
  userId: text("user_id").notNull(),
  e2bSandboxId: text("e2b_sandbox_id"),
  nekoHost: text("neko_host"),
  nekoPassword: text("neko_password"),
  provider: text("provider").$type<"neko" | "novnc">().default("neko"),
  status: text("status")
    .$type<"pending" | "active" | "expired">()
    .default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const mediaSessionsRelations = relations(mediaSessions, ({ one }) => ({
  user: one(users, {
    fields: [mediaSessions.userId],
    references: [users.id],
  }),
}));

export type MediaSession = typeof mediaSessions.$inferSelect;
export type NewMediaSession = typeof mediaSessions.$inferInsert;
