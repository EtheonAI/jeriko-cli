import { eq, and, desc, ilike, or } from "drizzle-orm";

export let db: any;
export let projects: any;
export let agentSessions: any;
export let messages: any;
export let files: any;
export let knowledgeItems: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  projects = resolved.projects;
  agentSessions = resolved.agentSessions;
  messages = resolved.messages;
  files = resolved.files;
  knowledgeItems = resolved.knowledgeItems;
}

export { eq, and, desc, ilike, or };
