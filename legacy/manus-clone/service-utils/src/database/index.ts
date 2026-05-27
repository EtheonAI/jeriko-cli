// Re-export database utilities from @repo/database
// This provides a single import point for services

export { db, eq, and, or, desc, asc, sql } from "@repo/database";

// Export all schemas
export * from "@repo/database";

// Helper for generating IDs
import { createId } from "@paralleldrive/cuid2";
export { createId };

// Transaction helper
import { db } from "@repo/database";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withTransaction<T>(
  callback: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(callback);
}
