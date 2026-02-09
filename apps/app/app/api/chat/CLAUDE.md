# api/chat — Testing Rules

## What This Is
Chat API route: POST for new messages, GET for resume. The bridge between frontend and agent service.

## route.ts Behavior

### POST (New Message)
1. Validate auth (Better-Auth session)
2. Extract body (messages, sessionId, etc.)
3. Save user message to DB with parts
4. Proxy to agent service via `agentProxy()`
5. Transform SSE events via `SSEProcessor`
6. Wrap in `consumeSseStream` for resumability
7. Return SSE response
8. In finally: save assistant message with parts, clear activeStreamId

### GET (Resume Stream)
1. Extract chatId from query params
2. Look up activeStreamId in DB
3. Resume via `resumeExistingStream` from Redis
4. Return SSE response

## Critical Test Rules
1. **MUST NOT send system_prompt to agent service** — agent has its own 400+ line prompt
2. **User message saved BEFORE streaming** — so it persists even if stream fails
3. **Assistant message saved in finally block** — catches all exit paths
4. **Parts column** contains full message parts (text, tool invocations, results)
5. **activeStreamId** set on stream start, cleared on stream end
6. **Auth required** — unauthenticated → 401
7. **GET resume** — only works if activeStreamId exists and Redis has the stream

## What to Test
1. POST with valid body → 200 SSE response
2. POST without auth → 401
3. POST without sessionId → 400
4. POST with system_prompt → body forwarded WITHOUT system_prompt
5. GET with valid chatId → resumed stream
6. GET with no active stream → 404 or empty
7. Stream error → error event sent, assistant message still saved
8. Stream cleanup → activeStreamId cleared in DB
