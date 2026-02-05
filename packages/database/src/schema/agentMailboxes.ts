import { pgTable, text, timestamp, boolean as pgBoolean, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const agentMailboxes = pgTable("agent_mailboxes", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  inboxId: text("inbox_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  isActive: pgBoolean("is_active").default(true).notNull(),
  webhookId: text("webhook_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const agentMailboxesRelations = relations(agentMailboxes, ({ one }) => ({
  user: one(users, {
    fields: [agentMailboxes.userId],
    references: [users.id],
  }),
}));

export type AgentMailbox = typeof agentMailboxes.$inferSelect;
export type NewAgentMailbox = typeof agentMailboxes.$inferInsert;
