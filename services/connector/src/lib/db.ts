import { eq, and, or, desc, asc, sql, count } from "drizzle-orm";
import { inArray, isNull } from "drizzle-orm";

// Database and schema references - populated by initDb()
export let db: any;
export let connectorDefinitions: any;
export let userConnectors: any;
export let connectorSyncLogs: any;
export let scheduledTasks: any;
export let triggerEvents: any;
export let taskExecutions: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  connectorDefinitions = resolved.connectorDefinitions;
  userConnectors = resolved.userConnectors;
  connectorSyncLogs = resolved.connectorSyncLogs;
  scheduledTasks = resolved.scheduledTasks;
  triggerEvents = resolved.triggerEvents;
  taskExecutions = resolved.taskExecutions;
}

// Re-export drizzle helpers (direct dependency, no resolution issue)
export { eq, and, or, desc, asc, sql, count, inArray, isNull };

// Re-export types
export type {
  ConnectorDefinition,
  NewConnectorDefinition,
  UserConnector,
  NewUserConnector,
  ConnectorSyncLog,
  NewConnectorSyncLog,
} from "@repo/database";
