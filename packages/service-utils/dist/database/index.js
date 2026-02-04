// src/database/index.ts
import { db, eq, and, or, desc, asc, sql } from "@repo/database";
export * from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { db as db2 } from "@repo/database";
async function withTransaction(callback) {
  return db2.transaction(callback);
}
export {
  and,
  asc,
  createId,
  db,
  desc,
  eq,
  or,
  sql,
  withTransaction
};
//# sourceMappingURL=index.js.map