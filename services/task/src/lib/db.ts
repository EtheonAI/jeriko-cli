// Typed database and schema references - populated by initDb()
// Uses dynamic import to work around ESM + pnpm named-export issue.
type DatabaseModule = typeof import("@repo/database");

// Direct references to the DB instance and tables
export let db: DatabaseModule["db"];
export let scheduledTasks: DatabaseModule["scheduledTasks"];
export let taskExecutions: DatabaseModule["taskExecutions"];
export let agentSessions: DatabaseModule["agentSessions"];
export let agents: DatabaseModule["agents"];
export let agentTasks: DatabaseModule["agentTasks"];

// Drizzle helpers
export let eq: DatabaseModule["eq"];
export let and: DatabaseModule["and"];
export let or: DatabaseModule["or"];
export let desc: DatabaseModule["desc"];
export let asc: DatabaseModule["asc"];
export let sql: DatabaseModule["sql"];
export let lte: DatabaseModule["lte"];
export let gte: DatabaseModule["gte"];
export let inArray: DatabaseModule["inArray"];

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  scheduledTasks = resolved.scheduledTasks;
  taskExecutions = resolved.taskExecutions;
  agentSessions = resolved.agentSessions;
  agents = resolved.agents;
  agentTasks = resolved.agentTasks;
  eq = resolved.eq;
  and = resolved.and;
  or = resolved.or;
  desc = resolved.desc;
  asc = resolved.asc;
  sql = resolved.sql;
  lte = resolved.lte;
  gte = resolved.gte;
  inArray = resolved.inArray;
}

export type {
  ScheduledTask,
  NewScheduledTask,
  TaskExecution,
  NewTaskExecution,
} from "@repo/database";
