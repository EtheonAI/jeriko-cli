import type { Database } from "@repo/database";

type DatabaseModule = typeof import("@repo/database");

export let db: Database;
export let projects: DatabaseModule["projects"];
export let projectMembers: DatabaseModule["projectMembers"];
export let projectSessions: DatabaseModule["projectSessions"];
export let files: DatabaseModule["files"];

export async function initDb() {
  const mod = await import("@repo/database");
  db = mod.db;
  projects = mod.projects;
  projectMembers = mod.projectMembers;
  projectSessions = mod.projectSessions;
  files = mod.files;
}

export { eq, and, desc, sql } from "@repo/database";
