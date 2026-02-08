# ADR-001: Canvas Triggers & Resumable Streams

**Status:** Accepted
**Date:** 2026-02-08
**Author:** Rubic Engineering
**Deciders:** @khaleelmusleh

---

## Context

Rubic's chat pipeline streams agent tool calls to the frontend, which reactively renders both inline tool UI (in the chat stream) and a full canvas panel (browser, terminal, code IDE). Two decisions need architectural resolution:

1. **Which tools trigger which canvas views** — the `TOOL_VIEW_MAP` mapping
2. **Resumable streams** — using AI SDK v6's `resume` + `resumable-stream` package for resilient agent sessions

## Decision 1: Tool-to-Canvas View Mapping

### Status: VERIFIED — Current implementation is correct

The `TOOL_VIEW_MAP` in `packages/ai/components/canvas/use-canvas.ts` has been audited against:
- The Manus tool behavior documentation
- The agent service's 32-tool surface
- The Rubic chat definitive guide

### Complete Mapping

| Canvas View | Tools | Count |
|---|---|---|
| **browser** | `browser_navigate`, `browser_view`, `browser_click`, `browser_input`, `browser_scroll`, `browser_scroll_up`, `browser_scroll_down`, `browser_move_mouse`, `browser_key_press`, `browser_press_key`, `browser_select_option`, `browser_console_exec`, `browser_console_view`, `browser_screenshot`, `browser_restart`, `info_search_web`, `web_search`, `search_web`, `deploy_expose_port`, `deploy_apply_deployment`, `make_manus_page` | 21 |
| **terminal** | `shell_exec`, `shell_view`, `shell_wait`, `shell_write_to_process`, `shell_kill_process`, `code_execute` | 6 |
| **code** | `file_read`, `file_write`, `file_str_replace`, `file_find_in_content`, `file_find_by_name` | 5 |
| **No canvas** (inline only) | `show_plan`, `message_notify_user`, `message_ask_user`, `generate_image`, `schedule_task`, `track_analytics` | 6 |

### Architecture: Reactive Canvas System

```
AI Backend Stream
    → useChat (messages array — source of truth)
    → useCanvas (scans messages backwards, maps via TOOL_VIEW_MAP)
    → useCanvasPanel (auto-opens panel when isVisible + isStreaming)
    → AgentCanvas (renders BrowserView / TerminalView / CodeIDEView)
```

**Key properties:**
- Canvas is **read-only reactive** — driven by message state, not clicks
- Canvas auto-opens when streaming + canvas-mapped tool detected
- User can manually switch between available views (view tabs)
- State is **persistent**: terminal output accumulates, file contents accumulate, browser state (URL, screenshot) persists across tool calls
- Each view populates data even when not active (for view switching)

### Search vs Browser Navigation

| Feature | `web_search` / `info_search_web` | `browser_navigate` |
|---|---|---|
| Canvas View | **browser** (shows search results) | **browser** (shows page screenshot) |
| Data Flow | Output → `extractSearchResults()` → `browserSearchResults` state | Output → `extractScreenshot()` + `extractBrowserUrl()` → screenshot + URL state |
| BrowserView Display | Search results cards (when no screenshot) | Screenshot image + URL bar |

**Decision**: Both map to `"browser"` because the BrowserView component handles both cases — search results display and screenshot display. The `BrowserView` automatically chooses the right rendering based on available data.

---

## Decision 2: Resumable Streams

### Context

When a user closes their browser tab during an agent session, the agent continues running in the Python FastAPI service, but the SSE connection is lost. When the user returns:
- **Without resumable streams**: Messages are loaded from DB (text + parts), but mid-stream progress is lost
- **With resumable streams**: The UI seamlessly reconnects to the active stream via Redis

### Decision: Implement AI SDK v6 Resumable Streams with Graceful Degradation

### Architecture

```
┌──────────────┐     POST /api/chat        ┌───────────────────┐
│  useChat      │──────────────────────────▶│  route.ts POST    │
│  (client)     │                           │                   │
│  experimental │     GET /api/chat         │  route.ts GET     │
│  _resume:true │──────────────────────────▶│  (resume handler) │
└──────────────┘                           └─────────┬─────────┘
                                                      │
                                           ┌──────────▼──────────┐
                                           │  Agent Proxy Stream  │
                                           │  (TransformStream)   │
                                           │                      │
                                           │  consumeSseStream()  │──────▶ Redis
                                           │  writes to Redis     │        Stream
                                           │  + pipes to client   │
                                           └──────────────────────┘
                                                                      │
                                           ┌──────────────────────┐   │
                                           │  GET handler          │   │
                                           │  resumeExistingStream │◀──┘
                                           │  reads from Redis     │
                                           └──────────────────────┘
```

### Technology Stack

| Component | Package | Purpose |
|---|---|---|
| Stream pub/sub | `resumable-stream` | Wraps SSE stream → Redis, resumes from Redis |
| Redis client | `ioredis` | Connection to Redis for stream storage |
| Client hook | `@ai-sdk/react` useChat | `resume: true` auto-sends GET on mount |
| Transport | `ai` DefaultChatTransport | Handles both POST (send) and GET (resume) |
| DB tracking | Drizzle `agentSessions.activeStreamId` | Tracks which stream is active per session |

### Implementation Components

#### 1. DB Schema Addition
```sql
ALTER TABLE agent_sessions ADD COLUMN active_stream_id TEXT;
```

#### 2. Resumable Stream Helper (`lib/chat/resumable-stream.ts`)
- `getStreamContext()` — singleton stream context backed by Redis
- `getActiveStreamId(sessionId)` — DB lookup
- `setActiveStreamId(sessionId, streamId)` — DB update
- `clearActiveStreamId(sessionId)` — DB clear on stream end
- **Graceful degradation**: If REDIS_URL is not set, all functions return null/no-op

#### 3. POST Handler Modification
```typescript
// Existing: createAgentProxyResponse returns Response
// New: extract readable, wrap with consumeSseStream, return new Response
const proxyResponse = createAgentProxyResponse(agentBody, opts);
const ctx = getStreamContext();
if (ctx && sessionId) {
  const streamId = generateId();
  await setActiveStreamId(sessionId, streamId);
  return new Response(
    consumeSseStream({ streamContext: ctx, streamId, getStream: () => proxyResponse.body }),
    { headers: proxyResponse.headers }
  );
}
return proxyResponse; // Fallback: no Redis
```

#### 4. GET Handler (new)
```typescript
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const chatId = searchParams.get("chatId");
  if (!chatId) return new Response(null, { status: 204 });

  const streamId = await getActiveStreamId(chatId);
  const ctx = getStreamContext();
  if (!streamId || !ctx) return new Response(null, { status: 204 });

  const stream = await ctx.resumeExistingStream(streamId);
  if (!stream) return new Response(null, { status: 204 });

  return new Response(stream, { headers: SSE_HEADERS });
}
```

#### 5. Client Hook
```typescript
useChat({
  id: sessionId,
  transport: transportRef.current,
  resume: true, // Auto-GET on mount for active streams
});
```

### Trade-offs

| Aspect | Benefit | Cost |
|---|---|---|
| **User Experience** | Seamless reconnection after tab close | Requires Redis infrastructure |
| **Reliability** | Agent work is never lost | ~10ms latency per chunk for Redis write |
| **Abort** | N/A — `resume` is NOT compatible with abort | Must disable `stop()` when resume is active |
| **Complexity** | One helper module + minor route changes | Redis dependency for full functionality |
| **Degradation** | Falls back to current behavior without Redis | Two code paths to maintain |

### Constraints & Limitations

1. **`resume` is NOT compatible with `stop()`** — When resume is enabled, the stop button cannot be used to abort the stream. This is an AI SDK limitation.
2. **Redis required for full functionality** — Without Redis, streams are not resumable (graceful fallback)
3. **Stream TTL** — Redis streams should have a TTL (e.g., 1 hour) to prevent unbounded growth
4. **Single active stream per session** — Only one `activeStreamId` per session; new messages overwrite

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **No resumable streams** | Loses mid-stream progress on disconnect — poor UX for long agent tasks |
| **Inngest background + Redis** (full decoupling) | Over-engineered for current needs; agent service already runs independently |
| **WebSocket-based resume** | We already have Socket.io, but SSE is the AI SDK standard; mixing protocols adds complexity |
| **Server-Sent Events keepalive only** | Doesn't survive tab close — the TCP connection drops |

---

## Consequences

### Positive
- Users can close tabs and return to find their agent's work in progress
- Canvas automatically reflects agent's state upon reconnection
- PlannerBar resumes showing plan progress
- Zero-config for development (graceful fallback without Redis)
- Minimal code changes — mostly additive

### Negative
- Redis becomes a production dependency for full functionality
- `stop()` button is disabled when resume is active
- Slightly increased latency due to Redis pub/sub

### Risks
- AI SDK's `resume` API may change (it's experimental)
- Redis connection failures could affect streaming (mitigated by graceful fallback)

---

## References

- [AI SDK v6 — Chatbot Resume Streams](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-resume-streams)
- [resumable-stream npm package](https://www.npmjs.com/package/resumable-stream)
- Rubic Chat Definitive Guide: `docs/frontend/chat/RUBIC_CHAT_DEFINITIVE_GUIDE.md`
- Manus Tool Behavior Deep Dive: `docs/frontend/chat/flow/Manus Tool Behavior_ The Definitive Deep Dive.md`
- Canvas Triggers Guide: `docs/frontend/chat/flow/Definitive Guide_ Canvas Triggers & Resumable E2B Sessions.md`
