import { eq, and, desc } from "drizzle-orm";

// Database and schema references — populated by initDb()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let db: any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let mediaSessions: any;

export async function initDb() {
  const mod = await import("@repo/database");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  mediaSessions = resolved.mediaSessions;
}

// Re-export drizzle helpers (direct dependency, no resolution issue)
export { eq, and, desc };
