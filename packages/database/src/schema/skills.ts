import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";

/**
 * Skills Schema
 * AI capability definitions that can be enabled/disabled per user.
 * User enable/disable state lives in users.preferences.enabledSkills JSONB.
 */

// Skill Definitions - available skills in the platform
export const skillDefinitions = pgTable("skill_definitions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  type: text("type").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category", {
    enum: ["research", "development", "productivity", "creative", "analysis"],
  }).notNull(),
  icon: text("icon"), // lucide icon name string (e.g. "globe", "code")
  isPremium: boolean("is_premium").default(false).notNull(),
  defaultEnabled: boolean("default_enabled").default(true).notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(), // admin can disable globally
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// Export types
export type SkillDefinition = typeof skillDefinitions.$inferSelect;
export type NewSkillDefinition = typeof skillDefinitions.$inferInsert;
