# chat components — Testing Rules

## What This Is
Message list rendering, streaming indicators, message grouping.

## What to Test

### MessageList (P0)
1. Empty messages → empty state shown
2. User + assistant messages → correct order and role attribution
3. Streaming message → shows streaming indicator
4. 100+ messages → renders in < 200ms (performance)
5. Unchanged messages don't re-render (memoization)
6. Tool role messages filtered out (page.tsx filter)

### Message Deduplication
1. Duplicate messages (same ID) → rendered once
2. Duplicate user + assistant pairs → deduplicated

### Streaming State
1. isLoading=true → streaming indicator visible
2. isLoading=false → no indicator
3. Stream abort → indicator removed immediately

## Existing Tests
- `__tests__/message-list-streaming.test.tsx`
