import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Auto-load DATABASE_URL from package .env if not in environment
if (!process.env.DATABASE_URL) {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const envContent = readFileSync(resolve(__dirname, "../.env"), "utf-8");
    for (const line of envContent.split("\n")) {
      const match = line.match(/^DATABASE_URL\s*=\s*(.+)/);
      if (match) {
        process.env.DATABASE_URL = match[1]!.trim();
        break;
      }
    }
  } catch { /* .env not found — rely on environment */ }
}

// Service-safe database client (no server-only import)
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export type Database = typeof db;
export { schema };
