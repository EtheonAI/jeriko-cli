# FIX 004: Dead Code & Cleanup

**Priority**: P2 - Cleanup
**Scope**: Unused code, conflicting implementations

---

## Item A: Delete Dead Socket.io Implementation

**Files to DELETE**:

- `apps/app/lib/socket/client.ts` (68 lines) - Socket.io client, never imported by any component
- `apps/app/lib/socket/events.ts` (168 lines) - Socket.io event type definitions, never used

**Why**: Native WebSocket via Redux middleware (`lib/store/middleware/websocket.middleware.ts`) is the actual implementation. Socket.io files create confusion and have different:

- Endpoints (`/api/socket` vs `/v1/stream`)
- Event schemas (different type names)
- Reconnect logic (Socket.io auto vs manual exponential backoff)

**Keep**: `apps/app/lib/socket/provider.tsx` - This wraps the Redux WebSocket and is actively used.

---

## Item B: Serializable Check Warnings

**File**: `apps/app/lib/store/index.ts` lines 117-121

**Current Code**:

```typescript
serializableCheck: {
  ignoredActions: ["websocket/connect", "websocket/send"],
},
```

**Fix**: Add all WebSocket actions:

```typescript
serializableCheck: {
  ignoredActions: [
    "websocket/connect",
    "websocket/disconnect",
    "websocket/send",
    "websocket/joinRoom",
    "websocket/leaveRoom",
  ],
},
```

---

## Item C: String Action Types in extraReducers

**Affected Slices** (all using string-based addCase instead of action creator imports):

- `auth.slice.ts` line 305
- `notifications.slice.ts` line 375
- `sessions.slice.ts` line 469
- `team.slice.ts` line 371
- `chat.slice.ts` line 433
- `connectors.slice.ts` line 300
- `experiment.slice.ts` line 222

**These are Manus compatibility layers**. Document them with a comment if keeping:

```typescript
// Legacy Manus compatibility - these action types match the Manus event format
builder.addCase("auth/setUserInfo", ...);
```

Or better: refactor to use imported action creators.

---

## Item D: Unused extraReducers for Deprecated Actions

**File**: `apps/app/lib/store/slices/chat.slice.ts` lines 433-453

Check if these action types are still dispatched anywhere:

- Grep for each string action type across the codebase
- If not dispatched, remove the extraReducer handlers (dead code)

---

## Item E: Window Access SSR Guards

**File**: `apps/app/lib/store/hooks/useAuth.ts` lines 189, 222

**Current Code**:

```typescript
window.location.origin; // Direct access
```

**Fix**: Guard with:

```typescript
typeof window !== "undefined" ? window.location.origin : "";
```

Even though files have `"use client"`, build tools may evaluate during SSR phase.
