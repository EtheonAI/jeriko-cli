import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";

// ============================================================
// WebDev Domains — Persistent domain management for IDE projects
// Replaces in-memory domainStore in orchestrator/webdev.ts
// ============================================================

export const domainStatuses = ["pending", "active", "error"] as const;
export type DomainStatus = (typeof domainStatuses)[number];

export const webdevDomains = pgTable("webdev_domains", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  sessionId: text("session_id"),
  sandboxId: text("sandbox_id"),

  /** The domain name (e.g., "mysite.com") */
  domain: text("domain").notNull(),
  /** Current verification status */
  status: text("status").$type<DomainStatus>().notNull().default("pending"),
  /** CNAME target for DNS verification */
  cnameTarget: text("cname_target"),
  /** Whether this domain was purchased through Rubic */
  purchasedVia: text("purchased_via"),
  /** Project path in sandbox */
  projectPath: text("project_path"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  verifiedAt: timestamp("verified_at"),
});

export const webdevDomainsRelations = relations(webdevDomains, ({ one }) => ({
  user: one(users, {
    fields: [webdevDomains.userId],
    references: [users.id],
  }),
}));

export type WebdevDomain = typeof webdevDomains.$inferSelect;
export type NewWebdevDomain = typeof webdevDomains.$inferInsert;
