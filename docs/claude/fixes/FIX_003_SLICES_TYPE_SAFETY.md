# FIX 003: Slice Type Safety & Duplicate State

**Priority**: P2 - Fix When Possible
**Scope**: Cross-slice issues, type safety, duplicate state

---

## Bug A: Duplicate State - Agent Email Info

**Files**:

- `apps/app/lib/store/slices/configs.slice.ts` - has `agentEmailInfo` field
- `apps/app/lib/store/slices/mailAgent.slice.ts` - has `agentEmailInfo` field

**Problem**: Same data in two places. If one updates, the other is stale.

**Fix**: Choose one canonical source (mailAgent.slice.ts makes semantic sense). Remove from configs.slice.ts. Components currently reading from configs should read from mailAgent instead.

---

## Bug B: Duplicate State - User Subscription

**Files**:

- `apps/app/lib/store/slices/auth.slice.ts` - `User.subscription`
- `apps/app/lib/store/slices/billing.slice.ts` - `subscription` field

**Problem**: Subscription info exists in both auth and billing slices.

**Fix**: Keep canonical source in billing.slice.ts. auth.slice should not store subscription. Create selector:

```typescript
const selectSubscription = (state: RootState) => state.billing.subscription;
```

---

## Bug C: Loose extraReducer String Types (4 files)

### auth.slice.ts - Line 305

```typescript
// CURRENT:
builder.addCase("auth/setUserInfo", (state, action: PayloadAction<any>) => {

// FIX:
import { setUserInfo } from './auth.slice';
builder.addCase(setUserInfo, (state, action) => {
```

### notifications.slice.ts - Line 375

```typescript
// Same pattern - replace string with imported action creator
```

### sessions.slice.ts - Line 469

```typescript
// CURRENT:
builder.addCase("sessions/fetchSessionsSuccess", (state, action: PayloadAction<any>) => {
  const payload = action.payload ?? {};
  const sessions = payload.sessions ?? payload ?? [];  // Confusing fallback chain

// FIX: Define proper type for the payload
type FetchSessionsPayload = { sessions: AgentSession[] } | AgentSession[];
builder.addCase(fetchSessionsSuccess, (state, action: PayloadAction<FetchSessionsPayload>) => {
```

### team.slice.ts - Line 371

```typescript
// Same pattern - replace string with imported action creator, remove `any`
```

---

## Bug D: Unsafe Type Cast in notifications.slice.ts

**Line**: 252-254

**Current Code**:

```typescript
Object.keys(state.unreadByType).forEach((key) => {
  state.unreadByType[key as NotificationType] = 0;
});
```

**Fix**: Use typed keys:

```typescript
const notificationTypes: NotificationType[] = ["info", "warning", "error", "success"];
notificationTypes.forEach((type) => {
  state.unreadByType[type] = 0;
});
```

---

## Bug E: Type Assertions Hiding Bugs in hooks.ts

**Lines**: 78, 109, 126, 131

**Current Code**:

```typescript
for (const sessionAgents of Object.values(agents) as Agent[][]) {
```

**Fix**: Use proper type narrowing:

```typescript
for (const sessionAgents of Object.values(agents)) {
  if (!Array.isArray(sessionAgents)) continue;
  // TypeScript now knows it's an array
```

---

## Bug F: Non-Atomic Session Creation

**File**: `apps/app/app/(authenticated)/components/chat-section.tsx` lines 52-53

**Current Code**:

```typescript
dispatch(addSession(normalized));
dispatch(setCurrentSession(normalized.id));
```

**Fix**: Create combined action in sessions.slice.ts:

```typescript
createAndSelectSession: (state, action: PayloadAction<AgentSession>) => {
  state.sessions.unshift(action.payload);
  state.currentSessionId = action.payload.id;
},
```

Then in component:

```typescript
dispatch(createAndSelectSession(normalized));
```

---

## Bug G: No Duplicate Prevention in addAgent

**File**: `apps/app/lib/store/slices/agents.slice.ts` lines 83-89

**Current Code**:

```typescript
addAgent: (state, action: PayloadAction<...>) => {
  // No check if agent already exists!
  state.agents[sessionId].push(agent);
}
```

**Fix**:

```typescript
addAgent: (state, action: PayloadAction<...>) => {
  const existingIndex = state.agents[sessionId]?.findIndex(a => a.id === agent.id);
  if (existingIndex !== undefined && existingIndex >= 0) {
    state.agents[sessionId][existingIndex] = agent; // Update existing
  } else {
    if (!state.agents[sessionId]) state.agents[sessionId] = [];
    state.agents[sessionId].push(agent);
  }
}
```

---

## Bug H: No Duplicate Prevention in addSession

**File**: `apps/app/lib/store/slices/sessions.slice.ts`

**Same pattern as Bug G**: `addSession` doesn't check if session with same ID already exists. Could end up with duplicates in the array.

**Fix**: Check for existing ID before pushing.

---

## Bug I: appendToMessage No Length Limit

**File**: `apps/app/lib/store/slices/chat.slice.ts` lines 224-240

**Current Code**:

```typescript
message.content += content; // No limit
```

**Issue**: During long streaming responses, content string grows unbounded in memory.

**Fix**: Add a reasonable max length:

```typescript
const MAX_MESSAGE_LENGTH = 500_000; // ~500KB
if (message.content.length + content.length > MAX_MESSAGE_LENGTH) {
  message.content += "\n[Message truncated - exceeded maximum length]";
  return;
}
message.content += content;
```
