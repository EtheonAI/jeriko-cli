/**
 * Test database helper — provides isolated test database setup/teardown.
 *
 * Usage:
 *   import { createTestDb, teardownTestDb } from "@repo/testing/db";
 *
 *   let db: TestDb;
 *   beforeAll(async () => { db = await createTestDb(); });
 *   afterAll(async () => { await teardownTestDb(db); });
 */
import { vi } from "vitest";

export interface TestDb {
  /** Mock database object — use for assertions */
  db: MockDb;
  /** Reset all mock call history */
  reset: () => void;
}

export interface MockDb {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

/**
 * Create a mock database with chainable query builder methods.
 * Returns mock objects that simulate Drizzle ORM's query builder pattern.
 */
export function createTestDb(): TestDb {
  const chainable = () => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = [
      "from",
      "where",
      "limit",
      "offset",
      "orderBy",
      "returning",
      "values",
      "set",
      "leftJoin",
      "innerJoin",
      "groupBy",
      "having",
    ];

    for (const method of methods) {
      chain[method] = vi.fn().mockReturnThis();
    }

    // Terminal methods that resolve
    chain.execute = vi.fn().mockResolvedValue([]);
    chain.then = vi.fn().mockResolvedValue([]);

    return new Proxy(chain, {
      get(target, prop) {
        if (prop in target) return target[prop as string];
        // Return self for unknown chains
        return vi.fn().mockReturnValue(chain);
      },
    });
  };

  const db: MockDb = {
    select: vi.fn().mockReturnValue(chainable()),
    insert: vi.fn().mockReturnValue(chainable()),
    update: vi.fn().mockReturnValue(chainable()),
    delete: vi.fn().mockReturnValue(chainable()),
    transaction: vi.fn().mockImplementation(async (fn) => fn(db)),
    execute: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockReturnValue(chainable()),
  };

  return {
    db,
    reset() {
      for (const fn of Object.values(db)) {
        if (typeof fn === "function" && "mockClear" in fn) {
          (fn as ReturnType<typeof vi.fn>).mockClear();
        }
      }
    },
  };
}

/**
 * Teardown test database. For mock DBs this is a no-op.
 * For integration tests with real DBs, override to clean up.
 */
export async function teardownTestDb(_testDb: TestDb): Promise<void> {
  // No-op for mock databases
}
