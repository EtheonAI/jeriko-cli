# lib/chat — Testing Rules

## What This Is
The chat pipeline: SSE processing, agent proxy, provider fallback, message persistence, error detection, resumable streams. This is the most critical path in the entire app.

## Files & What to Test

| File | Test Focus | Priority |
|------|-----------|----------|
| `sse-processor.ts` | Every SSE event type transforms correctly (content→text-delta, tool_start→tool-input-start, sandbox_info→metadata, browser_frame→metadata). Malformed data doesn't crash. | P0 |
| `agent-proxy.ts` | Forwards to agent service, includes auth headers (x-user-id, x-session-id), does NOT send system_prompt, cleans up activeStreamId on stream end | P0 |
| `provider-fallback.ts` | Primary success, primary quota error → fallback, both fail → throw | P0 |
| `persistence.ts` | User message saves with text parts, assistant message saves with tool parts, no duplicates on retry | P0 |
| `error-detection.ts` | Detects rate_limit, auth, context_length, overloaded, connection, timeout errors. Unknown → "unknown" | P1 |

## Resumable Streams
- `consumeSseStream` wraps POST response body → Redis pub/sub
- `resumeExistingStream` reads from Redis stream → replay + live-follow
- Test: create → resume → fallback (no Redis) → cleanup
- Always test `activeStreamId` column lifecycle (set on create, clear on end)

## Rules
1. SSEProcessor tests must cover ALL event types — if a new event is added, add a test FIRST
2. agent-proxy MUST NOT forward `system_prompt` — the agent has its own 400+ line system prompt
3. Test malformed SSE data (invalid JSON, missing fields, empty data)
4. Test stream cleanup in finally blocks (activeStreamId, Redis cleanup)
5. provider-fallback must test BOTH providers failing, not just the happy path

## Existing Tests
- `__tests__/sse-processor.test.ts`
- `__tests__/error-detection.test.ts`
- `__tests__/resumable-stream.test.ts`
- `__tests__/e2b-sse-canvas-pipeline.test.ts`
- `__tests__/mock-stream-flows.test.ts`
