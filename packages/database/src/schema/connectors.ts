import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

/**
 * Connectors Schema
 * Third-party integrations (Gmail, Slack, GitHub, etc.)
 */

export type ConnectorType =
  | "gmail"
  | "google_drive"
  | "google_calendar"
  | "slack"
  | "github"
  | "notion"
  | "linear"
  | "jira"
  | "confluence"
  | "dropbox"
  | "onedrive"
  | "sharepoint"
  | "salesforce"
  | "hubspot"
  | "zapier"
  | "custom";

export type ConnectorStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "pending"
  | "syncing";

// Connector Definitions - available connectors in marketplace
export const connectorDefinitions = pgTable("connector_definitions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  type: text("type").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  icon: text("icon"),
  category: text("category", {
    enum: [
      "communication",
      "storage",
      "productivity",
      "development",
      "crm",
      "analytics",
      "other",
    ],
  }).notNull(),
  authType: text("auth_type", {
    enum: ["oauth2", "api_key", "basic", "custom"],
  }).notNull(),
  oauthConfig: jsonb("oauth_config").$type<{
    authUrl: string;
    tokenUrl: string;
    scopes: string[];
    clientId?: string;
    composioAuthConfigId?: string;
  }>(),
  capabilities: jsonb("capabilities").$type<string[]>(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  isPremium: boolean("is_premium").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

// User Connectors - installed connectors for users
export const userConnectors = pgTable("user_connectors", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  connectorDefinitionId: text("connector_definition_id")
    .notNull()
    .references(() => connectorDefinitions.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  status: text("status", {
    enum: ["connected", "disconnected", "error", "pending", "syncing"],
  })
    .default("pending")
    .notNull(),
  // OAuth tokens (encrypted)
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at", { mode: "date" }),
  // API Key auth
  apiKey: text("api_key"),
  // Additional credentials
  credentials: jsonb("credentials").$type<Record<string, unknown>>(),
  // Sync settings
  syncEnabled: boolean("sync_enabled").default(true).notNull(),
  syncInterval: integer("sync_interval").default(3600), // seconds
  lastSyncAt: timestamp("last_sync_at", { mode: "date" }),
  lastSyncStatus: text("last_sync_status", {
    enum: ["success", "failed", "partial"],
  }),
  lastSyncError: text("last_sync_error"),
  // Configuration
  config: jsonb("config").$type<{
    selectedFolders?: string[];
    selectedChannels?: string[];
    selectedRepos?: string[];
    syncDirection?: "one_way" | "two_way";
    [key: string]: unknown;
  }>(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const userConnectorsRelations = relations(userConnectors, ({ one }) => ({
  user: one(users, {
    fields: [userConnectors.userId],
    references: [users.id],
  }),
  connectorDefinition: one(connectorDefinitions, {
    fields: [userConnectors.connectorDefinitionId],
    references: [connectorDefinitions.id],
  }),
  organization: one(organizations, {
    fields: [userConnectors.organizationId],
    references: [organizations.id],
  }),
}));

// Connector Sync Logs
export const connectorSyncLogs = pgTable("connector_sync_logs", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userConnectorId: text("user_connector_id")
    .notNull()
    .references(() => userConnectors.id, { onDelete: "cascade" }),
  status: text("status", {
    enum: ["started", "success", "failed", "partial"],
  }).notNull(),
  itemsSynced: integer("items_synced").default(0),
  itemsFailed: integer("items_failed").default(0),
  errorMessage: text("error_message"),
  details: jsonb("details").$type<Record<string, unknown>>(),
  startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { mode: "date" }),
});

export const connectorSyncLogsRelations = relations(
  connectorSyncLogs,
  ({ one }) => ({
    userConnector: one(userConnectors, {
      fields: [connectorSyncLogs.userConnectorId],
      references: [userConnectors.id],
    }),
  })
);

// Export types
export type ConnectorDefinition = typeof connectorDefinitions.$inferSelect;
export type NewConnectorDefinition = typeof connectorDefinitions.$inferInsert;
export type UserConnector = typeof userConnectors.$inferSelect;
export type NewUserConnector = typeof userConnectors.$inferInsert;
export type ConnectorSyncLog = typeof connectorSyncLogs.$inferSelect;
export type NewConnectorSyncLog = typeof connectorSyncLogs.$inferInsert;
