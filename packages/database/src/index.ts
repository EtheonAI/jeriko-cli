export { db, schema, type Database } from "./client";

// Re-export all schema types and tables
export * from "./schema";

// Re-export drizzle helpers
export { eq, and, or, not, inArray, notInArray, isNull, isNotNull, asc, desc, sql } from "drizzle-orm";
