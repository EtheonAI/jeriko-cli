# FIX 002: Data Loaders & Custom Hooks - Race Conditions & Leaks

**Priority**: P1 - Fix Soon
**Files**:

- `apps/app/app/(authenticated)/redux-data-loader.tsx`
- `apps/app/lib/store/hooks/useAgentsData.ts`
- `apps/app/lib/store/hooks/useDevicesData.ts`
- `apps/app/lib/store/hooks/useScheduledTasksData.ts`
- `apps/app/lib/store/hooks/useChat.ts`
- `apps/app/lib/store/hooks/useSessions.ts`

---

## Bug A: hasFetchedRef Set Before Async Completes (3 files)

### useAgentsData.ts - Line 84

```typescript
// CURRENT (BROKEN):
hasFetchedRef.current[sessionId] = true; // Set immediately
fetchAgents(); // Async, might fail

// FIX:
fetchAgents().then(() => {
  hasFetchedRef.current[sessionId] = true; // Set after success
});
```

### useDevicesData.ts - Line 33

```typescript
// CURRENT (BROKEN):
hasFetchedRef.current = true; // Set immediately
// ... async fetch below

// FIX: Move to .then() block after successful dispatch
```

### useScheduledTasksData.ts - Line 68

```typescript
// CURRENT (BROKEN):
hasFetchedRef.current = true; // Set immediately

// FIX: Same pattern - move after successful fetch
```

**Impact of all 3**: If initial data load fails, user sees empty state permanently. No retry possible without full page reload.

---

## Bug B: No AbortController in redux-data-loader.tsx

**Lines**: 38-69 (sessions), 79-112 (notifications)

**Current Code**:

```typescript
useEffect(() => {
  dispatch(setSessionsLoading(true));
  getTrpcClient()
    .sessions.list.query()
    .then((data) => {
      // Could fire after unmount!
      dispatch(setSessions(normalized));
    })
    .catch((error) => {
      dispatch(setSessionsError(error?.message));
    })
    .finally(() => {
      dispatch(setSessionsLoading(false));
    });
}, [dispatch, isAuthenticated]);
```

**Fix**:

```typescript
useEffect(() => {
  let cancelled = false;

  dispatch(setSessionsLoading(true));

  getTrpcClient()
    .sessions.list.query()
    .then((data) => {
      if (cancelled) return;
      dispatch(setSessions(normalized));
    })
    .catch((error) => {
      if (cancelled) return;
      dispatch(setSessionsError(error?.message));
    })
    .finally(() => {
      if (cancelled) return;
      dispatch(setSessionsLoading(false));
    });

  return () => {
    cancelled = true;
  };
}, [dispatch, isAuthenticated]);
```

---

## Bug C: Race Condition in Session Merge Logic

**File**: `redux-data-loader.tsx` lines 51-56

**Current Code**:

```typescript
const existingSessions = existingSessionsRef.current;
const merged = [...fetchedSessions];
existingSessions.forEach((es) => {
  if (!merged.find((ms) => ms.id === es.id)) {
    merged.push(es);
  }
});
dispatch(setSessions(merged));
```

**Issue**: `existingSessionsRef.current` is updated asynchronously by the first useEffect (line 29). If two fetches overlap, earlier sessions could be overwritten by the merge logic of the second fetch.

**Fix**: Use functional dispatch or move merge logic into the reducer:

```typescript
// In sessions.slice.ts:
mergeSessions: (state, action: PayloadAction<AgentSession[]>) => {
  const incoming = action.payload;
  const existingIds = new Set(state.sessions.map(s => s.id));
  const newSessions = incoming.filter(s => !existingIds.has(s.id));
  state.sessions = [...state.sessions, ...newSessions];
},
```

---

## Bug D: Typing Timeout Memory Leak in useChat

**File**: `apps/app/lib/store/hooks/useChat.ts` lines 64-65, 174

**Current Code**:

```typescript
const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
// ... used in sendTypingIndicator (line 174)
// No cleanup!
```

**Fix**: Add cleanup useEffect:

```typescript
useEffect(() => {
  return () => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };
}, []);
```

---

## Bug E: Filter/Sort Not Memoized in useSessions

**File**: `apps/app/lib/store/hooks/useSessions.ts` lines 360-410

**Current Code**:

```typescript
// Runs on EVERY render
const filteredSessions = sessionsState.sessions.filter((session) => {
  // ... complex filtering
});
const sortedSessions = [...filteredSessions].sort((a, b) => {
  // ... complex sorting
});
```

**Fix**:

```typescript
const filteredSessions = useMemo(
  () =>
    sessionsState.sessions.filter((session) => {
      // ... complex filtering
    }),
  [sessionsState.sessions /* filter criteria deps */]
);

const sortedSessions = useMemo(
  () =>
    [...filteredSessions].sort((a, b) => {
      // ... complex sorting
    }),
  [filteredSessions /* sort criteria deps */]
);
```

---

## Bug F: Selector Memoization Missing in hooks.ts

**File**: `apps/app/lib/store/hooks.ts` lines 42-90

**Current Code**:

```typescript
export const useCurrentSession = () =>
  useAppSelector((state) => {
    const { sessions, currentSessionId } = state.sessions;
    return currentSessionId ? sessions.find((s) => s.id === currentSessionId) : null;
  });
```

**Issue**: `sessions.find()` creates a new reference every time. Causes unnecessary re-renders.

**Fix**: Use `createSelector`:

```typescript
import { createSelector } from "@reduxjs/toolkit";

const selectCurrentSession = createSelector(
  [
    (state: RootState) => state.sessions.sessions,
    (state: RootState) => state.sessions.currentSessionId,
  ],
  (sessions, currentSessionId) =>
    currentSessionId ? (sessions.find((s) => s.id === currentSessionId) ?? null) : null
);

export const useCurrentSession = () => useAppSelector(selectCurrentSession);
```

Apply same pattern to:

- `usePinnedSessions` (line 60)
- `useRecentSessions` (line 66)
- `useSelectedAgent` (line 77)
- All hooks doing array `.filter()` or `.find()` in selectors

---

## Bug G: Promise.allSettled Incomplete Error Handling

**File**: `apps/app/lib/store/hooks/useAgentsData.ts` lines 61-72

**Current Code**:

```typescript
const results = await Promise.allSettled(
  normalizedAgents.map(async (agent) => {
    const tasks = await getTrpcClient().agents.tasks.query({ agentId: agent.id });
    dispatch(setTasks({ agentId: agent.id, tasks: normalizedTasks }));
  })
);

const failed = results.find((result) => result.status === "rejected");
if (failed) {
  dispatch(setAgentsError("Failed to load agent tasks"));
}
```

**Issue**: If 3 out of 5 agents succeed and 2 fail, error is set but the 3 successful dispatches are kept. Error message is generic.

**Fix**: Either handle partial success explicitly or use Promise.all with per-item try/catch:

```typescript
for (const agent of normalizedAgents) {
  try {
    const tasks = await getTrpcClient().agents.tasks.query({ agentId: agent.id });
    dispatch(setTasks({ agentId: agent.id, tasks: normalizedTasks }));
  } catch (error) {
    console.warn(`Failed to load tasks for agent ${agent.id}:`, error);
    // Don't set global error for partial failures
  }
}
```
