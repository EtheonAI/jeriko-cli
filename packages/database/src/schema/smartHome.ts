import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

/**
 * Smart Home Schema
 * Home Assistant hub integration + cached entity state
 */

export type SmartHomeHubType = "home_assistant";
export type SmartHomeHubStatus = "connected" | "disconnected" | "error";
export type SmartHomeEntityDomain =
  | "light"
  | "climate"
  | "sensor"
  | "binary_sensor"
  | "switch"
  | "media_player"
  | "lock"
  | "scene"
  | "cover"
  | "fan"
  | "vacuum"
  | "camera"
  | "alarm_control_panel"
  | "humidifier"
  | "water_heater"
  | "remote"
  | "siren"
  | "automation"
  | "input_boolean";

// Smart Home Hubs — registered HA instances
export const smartHomeHubs = pgTable("smart_home_hubs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["home_assistant"],
  })
    .default("home_assistant")
    .notNull(),
  status: text("status", {
    enum: ["connected", "disconnected", "error"],
  })
    .default("disconnected")
    .notNull(),
  config: jsonb("config").$type<{
    url: string;
    accessToken: string;
  }>(),
  lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
  entityCount: integer("entity_count").default(0).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const smartHomeHubsRelations = relations(smartHomeHubs, ({ one, many }) => ({
  user: one(users, {
    fields: [smartHomeHubs.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [smartHomeHubs.organizationId],
    references: [organizations.id],
  }),
  entities: many(smartHomeEntities),
}));

// Smart Home Entities — cached HA entity state
export const smartHomeEntities = pgTable("smart_home_entities", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  hubId: text("hub_id")
    .notNull()
    .references(() => smartHomeHubs.id, { onDelete: "cascade" }),
  entityId: text("entity_id").notNull(), // e.g. "light.living_room"
  domain: text("domain", {
    enum: ["light", "climate", "sensor", "binary_sensor", "switch", "media_player", "lock", "scene", "cover", "fan", "vacuum", "camera", "alarm_control_panel", "humidifier", "water_heater", "remote", "siren", "automation", "input_boolean"],
  }).notNull(),
  name: text("name").notNull(),
  areaId: text("area_id"),
  areaName: text("area_name"),
  state: text("state"), // "on", "off", "25.3", etc.
  attributes: jsonb("attributes").$type<Record<string, unknown>>(),
  lastUpdatedAt: timestamp("last_updated_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const smartHomeEntitiesRelations = relations(smartHomeEntities, ({ one }) => ({
  hub: one(smartHomeHubs, {
    fields: [smartHomeEntities.hubId],
    references: [smartHomeHubs.id],
  }),
}));

// Export types
export type SmartHomeHub = typeof smartHomeHubs.$inferSelect;
export type NewSmartHomeHub = typeof smartHomeHubs.$inferInsert;
export type SmartHomeEntity = typeof smartHomeEntities.$inferSelect;
export type NewSmartHomeEntity = typeof smartHomeEntities.$inferInsert;
