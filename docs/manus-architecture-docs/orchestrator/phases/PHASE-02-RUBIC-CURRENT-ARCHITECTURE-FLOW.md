# Phase 02 - Rubic Current Architecture (As-Built)

## A) End-to-end request flow
1. Frontend POST chat request:
- `apps/app/app/api/chat/route.ts`
- Auth session validated.
- Calls Rubic AI provider (`packages/ai/lib/rubic-provider.ts`) -> `services/agent /v1/complete`.

2. Agent orchestration entry:
- `services/agent/src/routes/completion.py`
- Model routing: Claude path => tool loop, non-Claude => OpenAI pass-through.
- Session context setup caches tools + runtime per session.

3. Sandbox acquisition:
- `services/agent/src/e2b_manager.py`
- Uses direct E2B SDK (not sandbox microservice) for create/connect/reconnect.
- Maintains in-memory map and DB-persisted sandbox_id per session.

4. Tool loop:
- `services/agent/src/agent_loop.py`
- Iterative stream with Anthropic tool_use handling and 50-iteration cap.

5. Tool execution:
- `services/agent/src/tool_executor.py`
- Routes to runtime/file/shell/browser/deploy/composio/device/scheduled-task/S3 helper.

6. SSE relay and persistence:
- Stream is transformed by `apps/app/lib/chat/agent-proxy.ts` + `SSEProcessor`.
- User/assistant messages persisted with parts after stream.

## B) Runtime and sandbox model (current)
- Orchestrator service uses direct E2B SDK runtime wrappers:
  - `services/agent/src/runtime/direct_sdk.py`
  - runtime protocol in `services/agent/src/runtime/protocol.py`
- Separate sandbox microservice exists (`services/sandbox`) but agent route does not use it for main loop.
- Current `get_or_create_sandbox(... use_desktop=True)` path effectively defaults to desktop-style sandbox for agent requests.

## C) WebRTC/browser streaming model (current)
- Agent exposes `neko_url`/stream URL via SSE sandbox info events:
  - `services/agent/src/events.py`
  - `services/agent/src/e2b_manager.py`
- Frontend proxies sandbox stream endpoints:
  - `apps/app/app/api/sandbox/[id]/browser/stream/route.ts`
  - `apps/app/app/api/sandbox/[id]/terminal/stream/route.ts`
- Standalone sandbox service also resolves browser stream URL by probing ports:
  - `services/sandbox/src/index.ts`

## D) S3/file flow (current)
- File service persists metadata + versions and delegates object storage to `@repo/storage`:
  - `services/file/src/index.ts`
  - `packages/storage/index.ts`
- File download returns presigned URL metadata path.
- Agent S3 tool helper (`services/agent/src/tools/s3_sync.py`) currently uses `/files/{id}/download` then treats response as raw bytes.
  - This is a functional mismatch risk because file service endpoint returns JSON with signed URL.

## E) Connectors (Composio)
- Connector service wraps Composio SDK:
  - `services/connector/src/lib/composio.ts`
  - `services/connector/src/routes/tools.ts`
- Agent dynamically fetches user tools and executes via connector service:
  - `fetch_composio_tools`, `composio_execute` in `services/agent/src/tool_executor.py`

## F) State and websocket flow
- Gateway websocket with Redis pub/sub bridge:
  - `services/gateway/src/routes/websocket.ts`
- Frontend websocket middleware fans events into slices:
  - `apps/app/lib/store/middleware/websocket.middleware.ts`
- Store has 47 slices registered:
  - `apps/app/lib/store/index.ts`
- Example confirmed thin/empty slice:
  - `apps/app/lib/store/slices/meeting.slice.ts` has `initialState = {}`.

## G) Architecture truth summary
Rubic already has the critical skeleton:
- orchestrator loop,
- tool router,
- E2B runtime,
- Composio integration,
- websocket eventing,
- file service + S3 package,
- large Redux surface.

But it is split between overlapping paths and inconsistent contracts in some places (details in Phase 03).
