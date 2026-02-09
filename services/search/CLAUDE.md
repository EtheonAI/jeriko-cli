# services/search — Testing Rules

## What This Is
Search service: Typesense full-text search + DB ILIKE fallback. 775 LOC.

## What to Test

### Typesense Search (P0)
1. Query returns ranked results
2. Empty query → empty results
3. Fuzzy matching works (typos)
4. Pagination (offset + limit)
5. Filters (by type, by date range)

### DB ILIKE Fallback (P0)
1. Typesense down → falls back to DB ILIKE
2. ILIKE results have same shape as Typesense results
3. Fallback is transparent to caller

### Index Sync (P1)
1. New record → indexed in Typesense
2. Updated record → re-indexed
3. Deleted record → removed from index

### Security
1. Users only see their own data in search results
2. SQL injection via search query → prevented (parameterized)

## Pattern
```typescript
it("should fallback to DB when Typesense is down", async () => {
  vi.spyOn(typesenseClient, "search").mockRejectedValue(new Error("connection refused"));
  const results = await searchService.search("query");
  expect(results).toBeInstanceOf(Array); // Still works
});
```
