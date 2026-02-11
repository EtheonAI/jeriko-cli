# Redux State Flow Analysis

**Generated:** 2026-02-10
**Phase:** P0.7 - Frontend State Transitions

## Overview

This document analyzes how Redux state flows through the Rubic application during agent sessions. It serves as a baseline for understanding state management before the refactor.

## Current State Architecture

Based on `redux-snapshot.json`, we have:

- **47 total slices** (46 Manus-aligned + 1 custom)
- **1,029 total actions** across all slices
- **13,025 lines of code** in Redux logic
- **11 slices with extraReducers** (cross-slice dependencies)

## Key State Slices for Chat Sessions

### 1. Session Management

**Slices:**
- `agentSession` - Current active session state
- `sessions` - List of all user sessions

**Key Actions:**
- `createSession` - Initialize new chat session
- `updateSession` - Update session metadata
- `deleteSession` - Remove session

**State Flow:**
1. User clicks "New Chat"
2. `sessions.createSession()` dispatched
3. Session ID generated
4. `agentSession.setCurrentSession()` called
5. UI redirects to `/chat/[id]`

### 2. Message Management

**Slices:**
- `messages` - All messages in current session
- `streaming` - Streaming message state

**Key Actions:**
- `addMessage` - Add user/assistant message
- `updateMessage` - Update message content
- `startStreaming` - Begin agent response
- `appendStreamChunk` - Add text delta
- `endStreaming` - Finalize response

**State Flow:**
1. User types message and hits Enter
2. `messages.addMessage({ role: 'user', content: ... })` dispatched
3. `streaming.startStreaming()` initiated
4. SSE events arrive → `streaming.appendStreamChunk()` repeatedly
5. On stream end → `streaming.endStreaming()` + `messages.addMessage({ role: 'assistant', ... })`

### 3. Tool Execution

**Slices:**
- `tools` - Tool registry and execution status
- `sandbox` - E2B sandbox state

**Key Actions:**
- `registerTool` - Add tool to available tools
- `startToolExecution` - Begin tool call
- `completeToolExecution` - Store tool result
- `failToolExecution` - Handle tool error

**State Flow:**
1. Agent response includes tool call
2. `tools.startToolExecution()` dispatched
3. Tool UI component renders (e.g., file editor, terminal)
4. Agent service executes tool
5. Result arrives via SSE → `tools.completeToolExecution()`
6. Tool UI updates with result

### 4. Canvas State

**Slices:**
- `canvas` - Code editor, terminal, browser states
- `files` - File system state

**Key Actions:**
- `canvas.setView` - Switch canvas view (code/terminal/browser)
- `canvas.updateContent` - Update displayed content
- `files.updateFile` - Modify file in canvas

**State Flow:**
1. Tool executes (e.g., `file_write`)
2. `canvas.setView('code')` if not already in code view
3. `files.updateFile()` adds/updates file
4. `canvas.updateContent()` displays file in editor
5. User can manually switch views via canvas tabs

## Cross-Slice Dependencies (extraReducers)

The following slices listen to actions from other slices:

1. **agentSession** listens to:
   - `messages.addMessage` - Update message count
   - `tools.completeToolExecution` - Track tool usage

2. **canvas** listens to:
   - `tools.startToolExecution` - Auto-switch to relevant view
   - `sandbox.sandboxReady` - Enable browser/terminal

3. **ui** listens to:
   - `streaming.startStreaming` - Show loading indicator
   - `streaming.endStreaming` - Hide loading indicator

## State Transitions During Typical Session

### Scenario: "Create a file and write hello world"

**Initial State:**
```json
{
  "agentSession": { "id": null },
  "messages": [],
  "streaming": { "isStreaming": false },
  "tools": { "executing": [] },
  "canvas": { "view": null, "files": [] }
}
```

**Transition 1: Create Session**
```
Action: sessions.createSession()
New State: { "agentSession": { "id": "sess_123" } }
```

**Transition 2: User Message**
```
Action: messages.addMessage({ role: "user", content: "Create hello.txt" })
New State: { "messages": [{ role: "user", ... }] }
```

**Transition 3: Start Streaming**
```
Action: streaming.startStreaming()
New State: { "streaming": { "isStreaming": true, "chunks": [] } }
```

**Transition 4: Tool Call (file_write)**
```
Action: tools.startToolExecution({ name: "file_write", input: {...} })
New State: {
  "tools": { "executing": ["file_write"] },
  "canvas": { "view": "code" }  // via extraReducers
}
```

**Transition 5: Tool Complete**
```
Action: tools.completeToolExecution({ result: {...} })
New State: {
  "tools": { "executing": [], "lastResult": {...} },
  "files": { "hello.txt": "Hello World" }
}
```

**Transition 6: End Streaming**
```
Action: streaming.endStreaming()
       + messages.addMessage({ role: "assistant", ... })
New State: {
  "streaming": { "isStreaming": false },
  "messages": [{ role: "user", ... }, { role: "assistant", ... }]
}
```

## Integration with tRPC

Redux state is synced with backend via tRPC mutations:

- **Session creation**: `tRPC.sessions.create.mutate()` → `sessions.createSession()`
- **Message persistence**: After `messages.addMessage()` → `tRPC.messages.create.mutate()`
- **Session updates**: After `agentSession.update()` → `tRPC.sessions.update.mutate()`

## WebSocket Events

Real-time updates trigger Redux actions:

- `socket.on('message.delta')` → `streaming.appendStreamChunk()`
- `socket.on('tool.start')` → `tools.startToolExecution()`
- `socket.on('tool.complete')` → `tools.completeToolExecution()`
- `socket.on('session.updated')` → `agentSession.updateFromServer()`

## Performance Considerations

- **Message list**: Can grow large (100+ messages), needs virtualization
- **Streaming chunks**: Frequent updates during agent response
- **Tool results**: Can contain large payloads (screenshots, file contents)
- **Redux DevTools**: Should disable in production (performance impact)

## Testing Strategy

For Phase 0 golden suite:

1. **Unit tests**: Test individual reducers with action payloads
2. **Integration tests**: Test action creators + middleware (tRPC, WebSocket)
3. **E2E tests**: Replay synthetic sessions, snapshot final state
4. **Visual regression**: Screenshot canvas states for each tool

## Baseline Metrics

From `redux-snapshot.json`:

- Average actions per slice: 21.9
- Largest slice: `tools` (87 actions)
- Most complex: `agentSession` (extraReducers + middleware)
- Slices with RTK Query: 0 (pure Redux, no RTK Query)

## Notes for Refactor

- **State normalization**: Messages could be normalized (id → message map)
- **Slice splitting**: `tools` slice is large, could split by tool category
- **Memoization**: Add more selectors with `createSelector` for performance
- **Immer usage**: Already using Immer via Redux Toolkit (safe mutations)

---

**Next Steps:**
- Phase 1: Build test harness to replay sessions and capture state
- Phase 2: Create visual regression baseline for canvas states
- Phase 3: Add Redux DevTools time-travel tests

This baseline will help us validate that the TypeScript refactor preserves state management behavior correctly.
