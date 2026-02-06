# Redux State Management - Complete Audit Report

**Date**: February 6, 2026
**Scope**: All 46 slices, store config, middleware, hooks, dispatches, WebSocket real-time
**Files Audited**: 80+ files across `apps/app/lib/store/`, hooks, components, middleware

---

## SEVERITY LEGEND

- **CRITICAL** - Will cause bugs, data loss, or security issues in production
- **HIGH** - Causes silent failures, race conditions, or performance degradation
- **MEDIUM** - Code quality, type safety, or maintainability issues
- **LOW** - Style, optimization, or minor improvements

---

## CRITICAL ISSUES (Fix Immediately)

### 1. leaveRoom Never Sends Server Message

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` lines 163-169
**Bug**: `WS_LEAVE_ROOM` dispatches `leaveRoom()` to Redux state but **never sends an unsubscribe message to the server**. Compare with `WS_JOIN_ROOM` (line 156) which correctly sends `socket.send(JSON.stringify({ type: "subscribe", ... }))`.
**Impact**: Server still broadcasts messages to "left" rooms. Messages for old sessions leak to client. Server-side subscription resources never cleaned up.
**Fix**: Add `socket.send(JSON.stringify({ type: "unsubscribe", data: { channel: roomId } }))` before the dispatch.

### 2. Two Conflicting WebSocket Implementations

**Files**:

- `apps/app/lib/store/middleware/websocket.middleware.ts` (native WebSocket to `/v1/stream`)
- `apps/app/lib/socket/client.ts` (Socket.io to `/api/socket`)
- `apps/app/lib/socket/events.ts` (168 lines of Socket.io event definitions)
  **Bug**: Complete Socket.io implementation exists alongside native WebSocket Redux middleware. Different endpoints, different event schemas, different reconnect logic. Socket.io code is **never called** but creates confusion.
  **Impact**: Dead code, maintenance burden, type conflicts between two event schemas.
  **Fix**: Delete `apps/app/lib/socket/client.ts` and `apps/app/lib/socket/events.ts` entirely. Keep only the Redux WebSocket middleware approach.

### 3. WebSocket Middleware Type Safety - 70+ `any` Casts

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` lines 186-359
**Bug**: `handleWebSocketMessage(dispatch: any, event: WebSocketEvent)` where `WebSocketEvent.data` is typed as `any`. Every dispatch uses `as any` casts:

```typescript
dispatch(addTask(event.data?.task as any)); // line 200
dispatch(addNotification(event.data as any)); // line 270
dispatch(addMessage(event.data as any)); // line 282
dispatch(addScheduledTask(event.data?.task as any)); // line 312
```

**Impact**: Runtime type mismatches go undetected. Corrupted server data dispatched directly into Redux store. No compile-time protection.
**Fix**: Define discriminated union types for `WebSocketEvent` using the types already defined in `useWebSocket.ts` (lines 27-49). Add runtime validation before dispatch.

### 4. No Runtime Validation of WebSocket Messages

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` line 125
**Bug**: `JSON.parse(event.data)` result is cast to `WebSocketEvent` without validation. Malformed or unexpected data goes straight into Redux.
**Impact**: Server bugs, protocol changes, or malicious data corrupt client state silently.
**Fix**: Add Zod or manual validation for each event type before dispatching.

---

## HIGH ISSUES (Fix Soon)

### 5. hasFetchedRef Set Before Async Completes

**Files**:

- `apps/app/lib/store/hooks/useAgentsData.ts` line 84
- `apps/app/lib/store/hooks/useDevicesData.ts` line 33
- `apps/app/lib/store/hooks/useScheduledTasksData.ts` line 68
  **Bug**: `hasFetchedRef.current[sessionId] = true` (or `= true`) is set BEFORE the fetch promise resolves. If fetch fails, the ref prevents retry.
  **Impact**: If initial data load fails (network hiccup, server error), user sees empty state with no way to recover without full page reload.
  **Fix**: Move `hasFetchedRef.current = true` into the `.then()` block, after successful dispatch.

### 6. No AbortController in Data Loading Effects

**File**: `apps/app/app/(authenticated)/redux-data-loader.tsx` lines 38-69, 79-112
**Bug**: `useEffect` fires async fetch operations (sessions, notifications) with no AbortController. If component unmounts during fetch, stale dispatches fire.
**Impact**: "Can't perform state update on unmounted component" warnings. Stale data from old navigation written to store.
**Fix**: Add AbortController to each useEffect, pass signal to fetch, check `aborted` before dispatching.

### 7. No Message Queue for Offline State

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` lines 171-177
**Bug**: `WS_SEND` checks `socket.readyState === WebSocket.OPEN` and silently drops message if not open. No queue, no retry, no error callback.
**Impact**: Messages sent during brief disconnects are permanently lost. User actions (typing indicators, room joins) silently fail.
**Fix**: Add a message queue that drains on reconnect, or dispatch an error action so UI can show feedback.

### 8. Token Expires Without Refresh Mechanism

**File**: `apps/app/app/api/gateway-token/route.ts` line 31
**Bug**: Gateway JWT expires in 7 days (`.setExpirationTime("7d")`). Token fetched once on WebSocket connect (middleware line 91). No refresh during long-lived connections.
**Impact**: After 7 days, server rejects messages. Connection appears alive but is functionally dead.
**Fix**: Either refresh token periodically (e.g., every 6 hours) or handle server token-expired errors by re-fetching token and reconnecting.

### 9. Race Condition in Sequential Dispatches

**File**: `apps/app/app/(authenticated)/components/chat-section.tsx` lines 52-53
**Bug**: Two dispatches that should be atomic:

```typescript
dispatch(addSession(normalized)); // line 52
dispatch(setCurrentSession(normalized.id)); // line 53
```

Between these two dispatches, React can re-render. Components reading `currentSessionId` may try to find a session that doesn't exist yet.
**Impact**: Brief flash of "session not found" state. Could trigger error boundaries in strict components.
**Fix**: Create a single combined action `createAndSelectSession` that does both in one reducer.

### 10. Reconnect Loop Without Middleware-Level Max

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` lines 55-69
**Bug**: `scheduleReconnect()` dispatches `wsConnect()` which can trigger `scheduleReconnect()` again. While `useWebSocket.ts` has a max attempts check (line 83), the middleware itself has no limit.
**Impact**: If hook is unmounted but middleware still active, infinite reconnect loop hammering server.
**Fix**: Add `MAX_RECONNECT_ATTEMPTS` constant in middleware, check before scheduling.

### 11. WebSocket Event Handlers Accumulate on Reconnect

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` lines 106-130
**Bug**: Each `new WebSocket()` assigns `socket.onopen`, `socket.onclose`, `socket.onerror`, `socket.onmessage`. If old socket reference is replaced before `onclose` fires, old handlers hold closure references to `dispatch`.
**Impact**: Memory leak. Old handlers fire on lingering socket connections.
**Fix**: Before creating new WebSocket, explicitly set `socket.onopen = null; socket.onclose = null; ...` on old socket, then `socket.close()`.

### 12. Session Switch Room Race Condition

**File**: `apps/app/app/(authenticated)/chat/[id]/chat-page-client.tsx` lines 348-357
**Bug**: When switching sessions, cleanup effect `leaveRoom(oldSessionId)` and new effect `joinRoom(newSessionId)` fire asynchronously. If connection drops during switch, neither message reaches server.
**Impact**: Client in wrong room, receiving messages for old session. Especially bad combined with bug #1 (leaveRoom never sends to server).
**Fix**: Fix bug #1 first. Then add a guard in joinRoom to leave previous room atomically.

---

## MEDIUM ISSUES (Improve When Possible)

### 13. Selector Memoization Missing in Hooks

**File**: `apps/app/lib/store/hooks.ts` lines 42-90
**Bug**: Inline selectors create new function references on every call:

```typescript
export const useCurrentSession = () =>
  useAppSelector((state) => {
    const { sessions, currentSessionId } = state.sessions;
    return currentSessionId ? sessions.find(...) : null;
  });
```

**Impact**: `sessions.find()` runs on every render even if sessions haven't changed. With 1000+ sessions, causes noticeable lag.
**Fix**: Use `createSelector` from reselect for computed selectors.

### 14. Filter/Sort Not Memoized in useSessions

**File**: `apps/app/lib/store/hooks/useSessions.ts` lines 360-410
**Bug**: `filteredSessions.filter(...)` and `[...filteredSessions].sort(...)` recalculate on every render without `useMemo`.
**Impact**: Performance degradation with large session lists.
**Fix**: Wrap in `useMemo` with proper dependencies.

### 15. Duplicate State: Agent Email Info

**Files**:

- `apps/app/lib/store/slices/configs.slice.ts` (agentEmailInfo field)
- `apps/app/lib/store/slices/mailAgent.slice.ts` (agentEmailInfo field)
  **Bug**: Same data stored in two separate slices. Updates to one don't propagate to the other.
  **Impact**: UI components reading from different slices see different data.
  **Fix**: Consolidate into one slice. Other slice should select from the canonical source.

### 16. Duplicate State: User Subscription

**Files**:

- `apps/app/lib/store/slices/auth.slice.ts` (User.subscription)
- `apps/app/lib/store/slices/billing.slice.ts` (subscription field)
  **Bug**: Subscription info duplicated across auth and billing slices.
  **Impact**: If billing updates subscription but auth doesn't sync, subscription status checks return stale data.
  **Fix**: Single source of truth in billing.slice. Auth references it via selector.

### 17. Typing Timeout Memory Leak in useChat

**File**: `apps/app/lib/store/hooks/useChat.ts` lines 64-65, 174
**Bug**: `typingTimeoutRef` created in hook but no cleanup in useEffect return. If component unmounts while timeout pending, it fires on unmounted component.
**Impact**: Console warning, potential stale dispatch.
**Fix**: Add useEffect cleanup that clears `typingTimeoutRef.current`.

### 18. Heartbeat Pong Not Tracked

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` lines 351-354
**Bug**: `case "pong"` has an empty handler with just a comment. No tracking of last heartbeat time. No timeout detection.
**Impact**: Stale connections not detected. Client thinks it's connected but server dropped it.
**Fix**: Track `lastPongTime` in websocket slice. Add interval to check if pong received within threshold. Reconnect if not.

### 19. Loose extraReducer String Types

**Files**: auth.slice.ts:305, notifications.slice.ts:375, sessions.slice.ts:469, team.slice.ts:371
**Bug**: `builder.addCase("auth/setUserInfo", (state, action: PayloadAction<any>))` uses string action types instead of imported action creators. `PayloadAction<any>` defeats TypeScript.
**Impact**: If action name changes, these handlers silently stop working. No type error.
**Fix**: Import action creators directly: `builder.addCase(setUserInfo, (state, action) => {...})`.

### 20. No Persistence Layer

**File**: `apps/app/lib/store/index.ts`
**Bug**: Store is completely ephemeral. All state lost on page refresh including current session, draft messages, UI preferences.
**Impact**: User experience - losing context on refresh.
**Fix**: Consider `redux-persist` for critical slices (sessions.currentSessionId, ui preferences, auth).

### 21. Missing 12+ Server Event Handlers

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts`
**Bug**: Socket.io events.ts defines these events that middleware doesn't handle:

- `room:joined`, `room:left`, `room:users`
- `file:new`, `file:deleted`
- `device:command:update`
- `notification:dismissed`, `notification:count`
- `message:typing`, `message:stream`, `message:stream:start`, `message:stream:end`
- `typing:start`, `typing:stop`
- `presence:online`, `presence:offline`
  **Impact**: If server sends these events, they hit the "Unknown event" warning log (line 357) and are dropped.
  **Fix**: Add handlers for all events the server can send. Remove handlers for events server never sends.

### 22. Window Access Without SSR Guard

**File**: `apps/app/lib/store/hooks/useAuth.ts` lines 189, 222
**Bug**: Direct `window.location.origin` access. File has `"use client"` but could be imported in SSR context during build.
**Impact**: Build-time errors in edge cases.
**Fix**: Guard with `typeof window !== 'undefined'`.

---

## LOW ISSUES (Nice to Have)

### 23. Array splice in sessions.slice.ts

**File**: `apps/app/lib/store/slices/sessions.slice.ts` line 363
**Detail**: `selectedSessionIds.splice(index, 1)` is less idiomatic than `filter()` in RTK. Works but inconsistent with other patterns in codebase.

### 24. Serializable Check Incomplete

**File**: `apps/app/lib/store/index.ts` lines 117-121
**Detail**: Only ignores `websocket/connect` and `websocket/send`. Missing `websocket/disconnect`, `websocket/joinRoom`, `websocket/leaveRoom`. Could cause console warnings.

### 25. Promise Chain Instead of Async/Await

**File**: `apps/app/app/(authenticated)/redux-data-loader.tsx` lines 38-69
**Detail**: Uses `.then().catch().finally()` pattern. Async/await would be more readable and easier to add AbortController support.

### 26. No Error Dispatch on WebSocket Parse Failure

**File**: `apps/app/lib/store/middleware/websocket.middleware.ts` line 125-128
**Detail**: Catch block only does `console.error`. Should dispatch error to Redux so UI can show "connection issue" indicator.

### 27. Unsafe Object.keys Type Cast

**File**: `apps/app/lib/store/slices/notifications.slice.ts` lines 252-254
**Detail**: `Object.keys(state.unreadByType).forEach((key) => { state.unreadByType[key as NotificationType] = 0 })` - cast is unsafe if keys change.

---

## STATS SUMMARY

| Category         | Count  |
| ---------------- | ------ |
| **CRITICAL**     | 4      |
| **HIGH**         | 8      |
| **MEDIUM**       | 10     |
| **LOW**          | 5      |
| **Total Issues** | **27** |

| Component            | Status                     |
| -------------------- | -------------------------- |
| Store Config         | Good (2 low issues)        |
| WebSocket Middleware | **Critical** (7 issues)    |
| 46 Redux Slices      | Good (5 medium/low issues) |
| Custom Hooks         | Medium (6 issues)          |
| Data Loaders         | High (3 issues)            |
| Socket Provider      | Good (1 low issue)         |
| Dispatch Usage       | Good (2 high issues)       |
| tRPC Provider        | Good (0 issues)            |

---

## PRIORITY FIX ORDER

1. **Bug #1** - leaveRoom server message (5 min fix, critical impact)
2. **Bug #3 + #4** - WebSocket type safety + validation (2-3 hours)
3. **Bug #5** - hasFetchedRef timing (15 min fix across 3 files)
4. **Bug #9** - Atomic session creation (15 min)
5. **Bug #2** - Delete dead Socket.io code (10 min)
6. **Bug #6** - AbortController in data loaders (30 min)
7. **Bug #7** - Message queue for offline (1 hour)
8. **Bug #10 + #11** - Reconnect safeguards (1 hour)
9. **Bug #13 + #14** - Selector memoization (1 hour)
10. **Bug #15 + #16** - Duplicate state consolidation (2 hours)
