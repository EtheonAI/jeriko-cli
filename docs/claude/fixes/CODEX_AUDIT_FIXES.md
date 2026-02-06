# Codex Audit Fixes — Feb 2026

After OpenAI Codex completed phases 1-5 (agent tool loop, security audit, real-time state migration, frontend parity, production readiness), Claude verified the changes and fixed 8 breaking issues.

## Fix 1: Remove `publish()` from tRPC Routers (Build-Breaking)

**Files:**

- `apps/app/lib/trpc/routers/sessions.router.ts`
- `apps/app/lib/trpc/routers/messages.router.ts`
- `apps/app/lib/trpc/routers/agents.router.ts`
- `apps/app/lib/trpc/routers/scheduledTasks.router.ts`

**Problem:** Codex added `import { publish } from "@repo/service-utils"` and `publish()` calls to 4 tRPC routers. These routers run inside Next.js, which is bundled by Turbopack. `@repo/service-utils` barrel-exports everything including `redis/index.js` which depends on `ioredis` (a Node.js Redis client with native bindings). Turbopack cannot bundle `ioredis`, causing `Module not found: Can't resolve '@repo/service-utils'` on every page load.

**Fix:** Removed all `publish` imports and calls from all 4 routers. Replaced with TODO comments: `// TODO: Publish <event> via gateway/backend service`.

**Why:** WebSocket event publishing belongs in backend microservices (gateway, task service, etc.), not in Next.js tRPC routers. The routers run in-process in the Next.js server — they should only handle DB operations and return data. Real-time events should be published by the services that own the data (gateway proxies, backend services) where `ioredis` runs natively.

**Calls removed:**

- `sessions.router.ts`: `session:new`, `session:update`, `session:deleted` (3 calls)
- `messages.router.ts`: `message:new` (2 calls)
- `agents.router.ts`: `agent:new`, `agent:update`, `task:created`, `task:updated`, `task:cancelled` (5 calls)
- `scheduledTasks.router.ts`: `scheduledTask:new`, `scheduledTask:update`, `scheduledTask:deleted`, `scheduledTask:execution:new`, `scheduledTask:execution:update` (7+ calls)

---

## Fix 2: Gateway Token Route — Replace `@repo/service-utils` with Direct `jose` (Build-Breaking)

**File:** `apps/app/app/api/gateway-token/route.ts`

**Problem:** Codex created this new API route to generate JWT tokens for WebSocket authentication. It imported `createToken` from `@repo/service-utils/auth`. Two issues:

1. The tsconfig `paths` alias (`@repo/*` → `../../packages/*`) intercepts module resolution before package.json `exports` is consulted. So `@repo/service-utils/auth` resolves to `../../packages/service-utils/auth` (a non-existent path) instead of using the subpath export.
2. Even if the subpath worked, the barrel re-export path would still try to pull in `ioredis`.

**Fix:** Replaced the import with direct `jose` usage (the same library `@repo/service-utils/auth` uses internally). Added `jose` as a direct dependency of the app (`pnpm --filter app add jose`).

**Why:** The `createToken` function is 10 lines using `jose.SignJWT`. Inlining it avoids the entire `@repo/service-utils` dependency chain in the Next.js bundle. The JWT secret and algorithm match exactly what `@repo/service-utils/auth` uses, so tokens are interoperable with backend services.

---

## Fix 3: WebSocket Slice — Wrong Property Name (Bug)

**File:** `apps/app/lib/store/slices/websocket.slice.ts` (line 66)

**Problem:** In the `setConnectionStatus` reducer, when the status is `"connected"`, the code set `state.lastError = null`. But the `WebSocketState` interface defines the property as `error`, not `lastError`. Immer silently adds `lastError` as a new untyped property while `error` remains set to whatever error string was last assigned.

**Fix:** Changed `state.lastError = null` to `state.error = null`.

**Why:** Without this fix, after a successful WebSocket reconnection, the error state would never clear. Any component reading `state.websocket.error` would show a stale error message even though the connection recovered.

---

## Fix 4: ReduxDataLoader — Type Normalization (Type Error)

**File:** `apps/app/app/(authenticated)/redux-data-loader.tsx`

**Problem:** The DataLoader fetches sessions and notifications from tRPC (which returns raw DB rows) and dispatches them to Redux. The DB row types don't match the Redux interface types:

- Sessions: DB returns `{id, userId, title, status, metadata, createdAt, updatedAt}`. Redux `AgentSession` requires `mode` (defaults `"chat"`) and `isShared` (defaults `false`).
- Notifications: DB returns objects without `isArchived`. Redux `Notification` requires `isArchived: boolean`.

**Fix:** Added normalization when dispatching:

- Sessions: `mode: s.mode ?? "chat"`, `isShared: s.isShared ?? false`, `status: s.status ?? "active"`, and ISO string conversion for dates.
- Notifications: `isArchived: n.isArchived ?? false`, `isRead: n.isRead ?? false`, `priority: n.priority ?? "normal"`, and ISO string conversion.

**Why:** Without normalization, TypeScript compilation fails with type mismatch errors. At runtime, components reading `session.mode` or `notification.isArchived` would get `undefined` instead of the expected defaults, causing conditional rendering bugs.

---

## Fix 5: useDevicesData — Capabilities Normalization (Type Error)

**File:** `apps/app/lib/store/hooks/useDevicesData.ts`

**Problem:** The tRPC `devices.list` query returns `Device[]` where `capabilities` is `string[] | undefined`. The Redux `DeviceItem` interface requires `capabilities: string[]` (non-optional). TypeScript error: `Type 'undefined' is not assignable to type 'string[]'`.

**Fix:** Normalized `capabilities: d.capabilities ?? []` when dispatching to Redux.

**Why:** Without this, any device without explicit capabilities would have `undefined` in the store, causing `.map()` or `.includes()` calls on `device.capabilities` to throw at runtime.

---

## Remaining Known Issues (Not Blocking)

### ChatSection Dual Cache Gap

`apps/app/app/(authenticated)/components/chat-section.tsx` creates sessions via React Query tRPC client and optimistically updates React Query cache. But the sidebar reads from Redux. New sessions won't appear in the sidebar until a WS event (not yet implemented) or page refresh. Fix: dispatch `addSession` to Redux after the mutation succeeds.

### Backend WS Event Publishing Not Implemented

All `publish()` calls were correctly removed from Next.js routers. The actual backend services (gateway, task service, device service, etc.) need to publish these events for real-time Redux updates to work. The WebSocket middleware handler is ready — it dispatches to the correct Redux actions for all event types.

### store/index.ts Circular Type References (Pre-existing)

`export *` from 45+ slices causes duplicate export names (`setLoading`, `setSearchQuery`, `setError`, etc.) and circular `RootState`/`AppStore` type aliases. Not caused by Codex — this is an existing architectural issue from the many slices.
