import { eq, and, or, desc, asc, sql } from "drizzle-orm";

// Database and schema references - populated by initDb()
export let db: any;
export let websites: any;
export let websitePages: any;
export let websiteCrawlJobs: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  websites = resolved.websites;
  websitePages = resolved.websitePages;
  websiteCrawlJobs = resolved.websiteCrawlJobs;
}

// Re-export drizzle helpers (direct dependency, no resolution issue)
export { eq, and, or, desc, asc, sql };
