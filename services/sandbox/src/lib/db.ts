import { eq, and, desc } from "drizzle-orm";

// Database and schema references - populated by initDb()
export let db: any;
export let sandboxes: any;
export let sandboxExecutions: any;
export let sandboxFiles: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  sandboxes = resolved.sandboxes;
  sandboxExecutions = resolved.sandboxExecutions;
  sandboxFiles = resolved.sandboxFiles;
}

// Re-export drizzle helpers (direct dependency, no resolution issue)
export { eq, and, desc };
