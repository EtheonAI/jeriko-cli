import { db } from '@repo/database';
export * from '@repo/database';
export { and, asc, db, desc, eq, or, sql } from '@repo/database';
export { createId } from '@paralleldrive/cuid2';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
declare function withTransaction<T>(callback: (tx: Transaction) => Promise<T>): Promise<T>;

export { type Transaction, withTransaction };
