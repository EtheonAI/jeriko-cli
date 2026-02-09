# packages/database — Testing Rules

## What This Is
Drizzle ORM layer: 50+ tables, schema definitions, query builders. Used by apps/app (tRPC) and all services.

## Schema Location
- `src/schema/` — All table definitions
- `src/client.ts` — DB client export
- `.env` — DATABASE_URL lives here

## Test Rules

### Query Testing
1. Use test transactions that rollback — never mutate the real DB
2. Test CRUD operations for each table
3. Test complex queries (joins, subqueries, aggregations)
4. Test user isolation (user A can't see user B's data)

### Schema Validation
1. Test required fields reject null/undefined
2. Test unique constraints reject duplicates
3. Test foreign key cascades (e.g., deleting hub cascades to entities)
4. Test default values are applied correctly

### Gotchas
- **Neon HTTP driver**: Does NOT support `db.transaction()` at runtime. Webhook service uses transactions — must use a different approach or Neon's serverless driver.
- **ESM import wrapping**: Always use `(mod as any).default ?? mod` when importing this package in services
- **`z.record()`**: In Zod v4, must be `z.record(z.string(), z.unknown())` — single-arg form crashes
- **Schema drift**: Some schema-defined tables may not exist in actual DB. Verify with `SELECT * FROM information_schema.tables`

### Pattern
```typescript
describe("session queries", () => {
  it("should create and retrieve", async () => {
    await db.transaction(async (tx) => {
      const [created] = await tx.insert(sessions).values({ ... }).returning();
      const found = await tx.query.sessions.findFirst({ where: eq(sessions.id, created.id) });
      expect(found.id).toBe(created.id);
      tx.rollback();
    });
  });
});
```

### API Key Schema
- Format: `rk_live_<24 bytes base64url>`
- Prefix: first 12 chars + "..."
- Max 5 per user
- Test key generation, format validation, and limit enforcement
