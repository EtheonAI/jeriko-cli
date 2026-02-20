import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

// Auto-load DATABASE_URL from package .env if not in environment.
// Searches known monorepo paths — no import.meta.url needed (CJS/ESM compatible).
if (!process.env.DATABASE_URL) {
  const candidates = [
    resolve(process.cwd(), "packages/database/.env"),      // from monorepo root
    resolve(process.cwd(), ".env"),                         // from packages/database itself
    resolve(process.cwd(), "../../packages/database/.env"), // from services/* or apps/*
  ];
  for (const envPath of candidates) {
    try {
      if (!existsSync(envPath)) continue;
      const envContent = readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const match = line.match(/^DATABASE_URL\s*=\s*(.+)/);
        if (match?.[1]) {
          process.env.DATABASE_URL = match[1].trim();
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    } catch { /* .env not found — rely on environment */ }
  }
}

// Service-safe database client (no server-only import)
const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

export type Database = typeof db;
export { schema };
