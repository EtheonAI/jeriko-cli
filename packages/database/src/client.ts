import "server-only";

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { keys } from "../keys";
import * as schema from "./schema";

const env = keys();

// Create the Neon SQL client
const sql = neon(env.DATABASE_URL);

// Create the Drizzle client with all schemas
export const db = drizzle(sql, {
  schema,
  logger: process.env.NODE_ENV === "development",
});

// Export the db type for type inference
export type Database = typeof db;

// Re-export schema for convenience
export { schema };
