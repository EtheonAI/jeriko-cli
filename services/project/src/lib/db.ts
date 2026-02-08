import { eq, and, desc, sql } from "drizzle-orm";

export let db: any;
export let projects: any;
export let projectMembers: any;
export let projectSessions: any;
export let files: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  projects = resolved.projects;
  projectMembers = resolved.projectMembers;
  projectSessions = resolved.projectSessions;
  files = resolved.files;
}

export { eq, and, desc, sql };
