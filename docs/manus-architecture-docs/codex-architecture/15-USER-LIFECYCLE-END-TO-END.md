# User Lifecycle End-to-End (Signup -> Chat -> Completion)

## Scope
This document defines the full product workflow from first unauthenticated visit through authenticated chat execution, tool streaming, persistence, and recovery.

## Canonical source anchors
1. `apps/app/proxy.ts`
2. `apps/app/app/(unauthenticated)/login/page.tsx`
3. `apps/app/app/api/auth/check-email/route.ts`
4. `apps/app/app/api/auth/[...all]/route.ts`
5. `apps/app/app/(authenticated)/layout.tsx`
6. `apps/app/app/(authenticated)/redux-data-loader.tsx`
7. `apps/app/app/(authenticated)/chat/[id]/page.tsx`
8. `apps/app/app/(authenticated)/chat/[id]/hooks/use-chat-session.ts`
9. `apps/app/app/api/chat/route.ts`
10. `apps/app/lib/chat/agent-proxy.ts`
11. `apps/app/app/api/chat/[id]/stream/route.ts`
12. `apps/app/lib/store/middleware/websocket.middleware.ts`
13. `apps/app/app/api/gateway-token/route.ts`

## Phase A: Entry and auth gate
1. User requests any app route.
2. `proxy.ts` classifies route:
- Public: `/login`, `/verify-email`, `/forgot-password`, `/reset-password`, `/register`.
- Auth pages: `/login`, `/register`.
3. Proxy checks `better-auth.session_token` cookie presence.
4. If unauthenticated and route is protected, redirect to `/login?callbackUrl=...`.
5. If authenticated and route is auth page, redirect to `/`.

## Phase B: Signup/signin
1. Login UI starts at `step=email`.
2. User submits email.
3. Client calls `POST /api/auth/check-email`.
4. Server does:
- IP-based rate limit.
- constant-time response padding.
- user existence lookup.
5. Client transitions:
- existing email -> sign-in password flow.
- new email -> sign-up password flow.
6. Sign-in and sign-up calls go through better-auth client SDK, backed by `app/api/auth/[...all]/route.ts`.
7. On success, better-auth session cookie is set.
8. If signup path requires verification, user transitions through verification UI (`/verify-email`).

## Phase C: Authenticated app bootstrap
1. User lands in authenticated route.
2. Server layout `app/(authenticated)/layout.tsx` calls `getSession`.
3. If no user, server redirect to `/login` (safety net beyond proxy).
4. Providers mount in this order:
- Redux store provider.
- TRPC provider.
- ReduxDataLoader.
- Socket provider.
5. `ReduxDataLoader` syncs better-auth session user into Redux `auth` slice.
6. `ReduxDataLoader` preloads notifications and unread counts.

## Phase D: Chat page bootstrap
1. User navigates to `/chat/[id]`.
2. Server page loads session user and message history from DB for `sessionId`.
3. Deduplication rules apply:
- drop legacy `role=tool` messages.
- dedupe assistant duplicates, preferring records with `parts`.
- dedupe repeated user text.
4. `ChatClient` mounts with initial messages.
5. `useChatSession` normalizes/migrates message parts for AI SDK UIMessage compatibility.

## Phase E: Live messaging
1. User submits prompt via `ChatPrompt`.
2. `useChatSession` sends via `DefaultChatTransport` to `POST /api/chat` with `chatId` in body.
3. Chat route authenticates via better-auth.
4. Chat route resolves/creates `agentSessions` row if session id not found.
5. Chat route extracts latest user text and parts.
6. Chat route optionally loads user API key from DB.
7. Chat route calls Rubic provider client (`rubic.stream`) to `services/agent /v1/complete`.
8. If agent stream available:
- stream is transformed by `createAgentProxySseStream`.
- SSEProcessor converts agent events to AI SDK UI stream format.
- keepalive pings are emitted.
- quota detection may trigger inline fallback stream.
9. Stream end server-side actions:
- persist user message and assistant message with parts.
- auto-title session.
- clear active resumable stream id.
10. If agent unavailable, fallback provider streaming path runs.

## Phase F: Resumable stream
1. Client reconnect/resume path calls `GET /api/chat/[id]/stream`.
2. Server validates auth.
3. Server resolves active stream id and redis stream context.
4. If resumable stream exists, stream resumes with SSE headers.
5. If absent/expired/completed, returns 204 and clears active id.

## Phase G: WebSocket real-time channel
1. Client middleware calls `wsConnect` after auth sync.
2. Middleware fetches `GET /api/gateway-token`.
3. Authenticated route signs JWT (7d) from session user.
4. Client opens gateway WS with token via subprotocol.
5. Middleware handles ping/pong, reconnect with exponential backoff, and bounded offline queue.
6. Incoming WS events are reduced into slices (`sessions`, `chat`, `notifications`, `devices`, `scheduledTasks`, `agents`).

## Phase H: Files and sandbox side flows
1. File uploads route through `POST /api/files/upload`.
2. Route forwards multipart to file service with `x-user-id` and optional `x-path`.
3. Sandbox stream proxy routes:
- `GET /api/sandbox/[id]/browser/stream`
- `GET /api/sandbox/[id]/terminal/stream`
4. Browser action proxy:
- `POST /api/sandbox/browser`

## Phase I: Completion and persistence guarantees
1. Final assistant response is persisted with complete parts.
2. Timeline replay is possible from DB message history and event stream.
3. Session metadata (`updatedAt`, title) is refreshed.
4. On next open, server page rehydrates from DB and normalized parts.

## Failure branches covered
1. Unauthenticated access -> proxy redirect + server-layout redirect fallback.
2. Agent service down -> fallback provider stream.
3. Redis unavailable -> direct non-resumable SSE response.
4. WS token fetch failure -> reconnect scheduling and error state.
5. Upload service non-200 -> error passthrough with status code.

## Implementation mandates for new orchestrator
1. Keep this lifecycle order stable.
2. Preserve auth double-guard (proxy + server checks).
3. Keep server-side persistence on stream-finalization.
4. Keep resumable and non-resumable SSE paths with identical event shape.
5. Keep WS reconnect and idempotent event reduction rules.
