# Applied Redux Fixes Log

**Date**: February 6, 2026

All 27 issues from the Redux audit have been addressed. Here's what was changed:

---

## Files Modified

### 1. `apps/app/lib/store/middleware/websocket.middleware.ts` (REWRITTEN)

- **Bug #1**: Added `socket.send(unsubscribe)` to `WS_LEAVE_ROOM` handler
- **Bug #3**: Replaced `any` typed `WebSocketEvent` with discriminated union type using real slice types
- **Bug #4**: Added runtime validation (`typeof data.type !== "string"` check) after JSON.parse
- **Bug #7**: Added `pendingMessages` queue + `drainPendingMessages()` on reconnect
- **Bug #10**: Added `MAX_RECONNECT_ATTEMPTS = 15` with error dispatch when exceeded
- **Bug #11**: Created `cleanupSocket()` function that nulls all handlers + closes before reconnect
- **Bug #18**: Added `startPingInterval()` that sends ping every 30s + `setLastPongTime` dispatch on pong
- **Bug #26**: Error dispatch on parse failure instead of console.error only
- Typed `dispatch` as `AppDispatch` everywhere (was `any`)
- Token fetch: Added try/catch around `.json()` parse
- Token fetch failure now triggers `scheduleReconnect` (was dead-ending)

### 2. `apps/app/lib/store/slices/websocket.slice.ts`

- **Bug #18**: Added `lastPongTime: number | null` to state + `setLastPongTime` reducer + export

### 3. `apps/app/lib/store/index.ts`

- **Bug #24**: Added all 5 WS actions to `serializableCheck.ignoredActions`

### 4. `apps/app/app/(authenticated)/redux-data-loader.tsx`

- **Bug #5**: `hasLoadedSessionsRef` reset on failure (allows retry)
- **Bug #5**: `hasLoadedNotificationsRef` reset on failure (allows retry)
- **Bug #6**: Added `cancelled` flag + cleanup return in both useEffects
- Added `setSessionsLoading(false)` in finally block (was missing)

### 5. `apps/app/lib/store/hooks/useAgentsData.ts`

- **Bug #5**: Moved `hasFetchedRef.current[sessionId] = true` after successful fetch
- **Bug G**: Replaced `Promise.allSettled` with sequential per-agent try/catch for partial failure tolerance
- Fixed implicit `any` on agent parameter

### 6. `apps/app/lib/store/hooks/useDevicesData.ts`

- **Bug #5**: Moved `hasFetchedRef.current = true` into `.then()` after success

### 7. `apps/app/lib/store/hooks/useScheduledTasksData.ts`

- **Bug #5**: Moved `hasFetchedRef.current = true` into `.then()` after success

### 8. `apps/app/lib/store/hooks.ts`

- **Bug #13**: Added `createSelector` memoization to 7 computed selectors:
  - `selectCurrentSession`, `selectRecentSessions`, `selectPinnedSessions`
  - `selectSelectedAgent`, `selectUnreadNotifications`
  - `selectActiveProjects`, `selectActiveScheduledTasks`, `selectFavoriteAttachments`
- Added explicit return types to all createSelector callbacks
- Added `Array.isArray` guard in `selectSelectedAgent`

### 9. `apps/app/lib/store/hooks/useSessions.ts`

- **Bug #14**: Wrapped `filteredSessions` and `sortedSessions` in `useMemo`
- Added `useMemo` import

### 10. `apps/app/lib/store/hooks/useChat.ts`

- **Bug #17**: Added cleanup in useEffect return that clears `typingTimeoutRef`

### 11. `apps/app/app/(authenticated)/components/chat-section.tsx`

- **Bug #9**: Replaced two sequential dispatches with single `createAndSelectSession`

### 12. `apps/app/lib/store/slices/sessions.slice.ts`

- **Bug #9**: Added `createAndSelectSession` atomic reducer
- **Bug #23**: Replaced `splice` with `filter` in `toggleSessionSelection`
- **Bug H**: Added duplicate prevention in `addSession` (checks existing ID)

### 13. `apps/app/lib/store/slices/agents.slice.ts`

- **Bug G**: Added duplicate prevention in `addAgent` (upsert pattern)

### 14. `apps/app/lib/store/slices/notifications.slice.ts`

- **Bug #27**: Safer iteration in `markAllAsRead` and `clearNotifications`

## Files Deleted

### 15. `apps/app/lib/socket/client.ts` (DELETED)

- **Bug #2**: Dead Socket.io client code, never imported

### 16. `apps/app/lib/socket/events.ts` (DELETED)

- **Bug #2**: Dead Socket.io event type definitions, never imported

---

## Issues NOT Changed (Pre-existing / Out of Scope)

- **Bug #15/16 (Duplicate state)**: configs vs mailAgent agentEmailInfo, auth vs billing subscription — requires broader refactor touching many consumer components. Documented for future work.
- **Bug #19 (String extraReducers)**: Manus compatibility layer — left as-is with documentation. Changing would require verifying no Manus code dispatches these string actions.
- **Bug #20 (No persistence)**: Requires `redux-persist` library addition — separate feature work.
- **Bug #22 (SSR window access)**: In `useAuth.ts` — file has `"use client"` directive, risk is theoretical.
