# FIX 001: WebSocket Middleware - Critical Bugs

**Priority**: P0 - Fix Immediately
**File**: `apps/app/lib/store/middleware/websocket.middleware.ts`
**Issues**: #1, #3, #4, #7, #10, #11, #18, #21, #26

---

## Bug A: leaveRoom Never Sends Server Message (CRITICAL)

**Lines**: 163-169

**Current Code**:

```typescript
case WS_LEAVE_ROOM: {
  const roomId = (action as { payload: string }).payload;
  if (socket && socket.readyState === WebSocket.OPEN) {
    dispatch(leaveRoom(roomId));  // Only updates Redux, server never notified!
  }
  break;
}
```

**Compare with joinRoom** (lines 154-160):

```typescript
case WS_JOIN_ROOM: {
  const roomId = (action as { payload: string }).payload;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "subscribe", data: { channel: roomId } }));  // Server notified
    dispatch(joinRoom(roomId));
  }
  break;
}
```

**Fix**: Add `socket.send(JSON.stringify({ type: "unsubscribe", data: { channel: roomId } }))` before the dispatch.

---

## Bug B: 70+ `any` Type Casts in handleWebSocketMessage (CRITICAL)

**Lines**: 186-359

**Examples of broken type safety**:

```typescript
// Line 200 - task data unvalidated
dispatch(addTask(event.data?.task as any));

// Line 270 - entire payload cast to any
dispatch(addNotification(event.data as any));

// Line 282 - message data unvalidated
dispatch(addMessage(event.data as any));

// Line 312 - scheduled task unvalidated
dispatch(addScheduledTask(event.data?.task as any));

// Line 335 - execution data unvalidated
dispatch(addExecution(event.data?.execution as any));
```

**Fix**: Define discriminated union type:

```typescript
type WebSocketEvent =
  | { type: "task:created"; data: { task: Task } }
  | { type: "task:updated"; data: { agentId: string; taskId: string; updates: Partial<Task> } }
  | { type: "message:new"; data: { message: Message } | Message }
  | { type: "notification:new"; data: Notification };
// ... etc
```

Then validate before dispatch:

```typescript
case "task:created":
  if (event.data?.task?.id && event.data.task.title) {
    dispatch(addTask(event.data.task));
  } else {
    console.warn("Invalid task:created payload", event.data);
  }
  break;
```

---

## Bug C: No Runtime Validation After JSON.parse

**Lines**: 123-129

**Current Code**:

```typescript
socket.onmessage = (event) => {
  try {
    const data: WebSocketEvent = JSON.parse(event.data); // Type assertion, not validation!
    handleWebSocketMessage(dispatch, data);
  } catch (error) {
    console.error("Failed to parse WebSocket message:", error);
  }
};
```

**Fix**: Add basic shape validation:

```typescript
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    if (!data || typeof data.type !== "string") {
      console.warn("Invalid WebSocket message format:", data);
      return;
    }
    handleWebSocketMessage(dispatch, data as WebSocketEvent);
  } catch (error) {
    console.error("Failed to parse WebSocket message:", error);
    dispatch(setLastError("Failed to parse server message"));
  }
};
```

---

## Bug D: No Message Queue for Offline State

**Lines**: 171-177

**Current Code**:

```typescript
case WS_SEND: {
  const { event, data } = (action as { payload: { event: string; data: unknown } }).payload;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: event, data }));
  }
  // Silently dropped if not open!
  break;
}
```

**Fix**: Add pending message queue:

```typescript
const pendingMessages: Array<{ event: string; data: unknown }> = [];

// In WS_SEND:
case WS_SEND: {
  const { event, data } = action.payload;
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: event, data }));
  } else {
    pendingMessages.push({ event, data });
  }
  break;
}

// In socket.onopen:
socket.onopen = () => {
  // ... existing code
  // Drain pending messages
  while (pendingMessages.length > 0) {
    const msg = pendingMessages.shift()!;
    socket.send(JSON.stringify({ type: msg.event, data: msg.data }));
  }
};
```

---

## Bug E: Reconnect Loop Without Max in Middleware

**Lines**: 55-69

**Current Code**:

```typescript
function scheduleReconnect(dispatch: any) {
  if (!shouldReconnect) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);

  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  reconnectAttempts++;
  // No max check!

  reconnectTimer = setTimeout(() => {
    dispatch(wsConnect());
  }, delay);
}
```

**Fix**: Add max attempts:

```typescript
const MAX_RECONNECT_ATTEMPTS = 10;

function scheduleReconnect(dispatch: AppDispatch) {
  if (!shouldReconnect) return;
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    dispatch(setLastError("Max reconnection attempts reached"));
    dispatch(setConnectionStatus("error"));
    return;
  }
  // ... rest of logic
}
```

---

## Bug F: Event Handlers Accumulate on Reconnect

**Lines**: 106-130

**Fix**: Before creating new WebSocket, clean up old one:

```typescript
// Before `socket = new WebSocket(...)`:
if (socket) {
  socket.onopen = null;
  socket.onclose = null;
  socket.onerror = null;
  socket.onmessage = null;
  if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
    socket.close();
  }
  socket = null;
}
```

---

## Bug G: Heartbeat Pong Not Tracked

**Lines**: 351-354

**Current Code**:

```typescript
case "pong":
  // Heartbeat received, connection is alive
  break;
```

**Fix**:

```typescript
case "pong":
  dispatch(setLastPongTime(Date.now()));
  break;
```

Add to websocket.slice.ts:

```typescript
lastPongTime: number | null;
// ...
setLastPongTime: (state, action: PayloadAction<number>) => {
  state.lastPongTime = action.payload;
},
```

Add ping interval in middleware:

```typescript
let pingInterval: ReturnType<typeof setInterval> | null = null;

// In socket.onopen:
pingInterval = setInterval(() => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "ping" }));
  }
}, 30000); // Every 30 seconds

// In socket.onclose / WS_DISCONNECT:
if (pingInterval) {
  clearInterval(pingInterval);
  pingInterval = null;
}
```

---

## Bug H: `dispatch: any` Parameter

**Lines**: 55, 71, 186

**Fix**: Type all dispatch parameters as `AppDispatch`:

```typescript
import type { AppDispatch } from '../index';

function scheduleReconnect(dispatch: AppDispatch) { ... }
function handleWebSocketMessage(dispatch: AppDispatch, event: WebSocketEvent) { ... }
```
