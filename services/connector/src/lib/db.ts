import { eq, and, or, desc, asc, inArray, isNull, sql, count } from "drizzle-orm";

// Database and schema references - populated by initDb()
export let db: any;
export let connectorDefinitions: any;
export let userConnectors: any;
export let connectorSyncLogs: any;
export let schema: any;

export async function initDb() {
  const mod = await import("@repo/database");
  db = mod.db;
  schema = mod.schema;
  connectorDefinitions = mod.connectorDefinitions;
  userConnectors = mod.userConnectors;
  connectorSyncLogs = mod.connectorSyncLogs;
}

// Re-export drizzle helpers (direct dependency, no resolution issue)
export { eq, and, or, desc, asc, inArray, isNull, sql, count };

// Re-export types
export type {
  ConnectorDefinition,
  NewConnectorDefinition,
  UserConnector,
  NewUserConnector,
  ConnectorSyncLog,
  NewConnectorSyncLog,
} from "@repo/database";
