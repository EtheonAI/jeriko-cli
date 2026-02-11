# Supplement E: Complete State Change Flows

## E.1 Overview

This document traces every state change that occurs in the Manus system, from the moment a user interacts with the UI through Redux state updates, WebSocket events, orchestration state changes, and sandbox state changes. Every trigger, every dispatch, every re-render is documented.

---

## E.2 Redux Store Architecture

### E.2.1 All 41 Redux Slices

The Manus frontend maintains 41 Redux slices organized into 6 categories:

**Core UI (4 slices):**

| Slice | Keys | Purpose |
|-------|------|---------|
| `ui` | 6 keys | Global layout state: `isMobile`, `windowWidth`, `chatSidebarPercentage`, `showAppDownloadMask`, `isShowMaxModeIntroduce`, `navTasksFolded` |
| `chat` | 24 keys | Chat input state: `inputValue`, `files`, `taskMode`, `inputMode`, `microphonePermission`, `debugModelOverride`, `recommendedPlaybooks`, `slideTemplateList`, etc. |
| `timeline` | 3 keys | Message timeline: `segmentEventsMap`, `segmentEventsLoadingMap`, `percentage` |
| `notification` | 12 keys | Notification system: `connectStatus`, `categoryNotifications`, `hasNew`, `notificationTab`, etc. |

**Canvas (2 slices):**

| Slice | Keys | Purpose |
|-------|------|---------|
| `aiCanvas` | 2 keys | Canvas data: `allAiCanvas`, `ocrCache` |
| `aiCanvasEditor` | 17 keys | Canvas editor: `shapes`, `camera`, `selectedShapeIds`, `interaction`, `brushing`, `marking`, `contextMenu`, `screenshots`, `editTextMode`, `settings`, `commentHistory`, etc. |

**Sessions (3 slices):**

| Slice | Keys | Purpose |
|-------|------|---------|
| `sessions` | 16 keys | Session management: `sessions` (normalized), `currentSessionId`, `groupedSessionState`, `segmentEndpoints`, `searchValue`, etc. |
| `sessionSwitch` | varies | Session switching state |
| `websocket` | varies | WebSocket connection state |

**Features (9 slices):**

| Slice | Keys | Purpose |
|-------|------|---------|
| `webDev` | 31 keys | Webdev projects: `activeTab`, `mountedTabs`, `project`, `database`, `preview`, `storage`, `setting`, `gitRepoCreation`, etc. |
| `codeViewer` | 9 keys | Code editor: `rootDirectory`, `directoryList`, `fileDataSource`, `fileTabList`, `activeTabId`, etc. |
| `connectors` | 8 keys | External integrations: `connectors`, `githubRepositories`, `searchQuery`, `multipleEmailConfirmedInfo`, etc. |
| `mapReduce` | 2 keys | Parallel processing: `isFullscreen`, `startLoading` |
| `fileConnector` | varies | File connector state |
| `fileManagement` | varies | File operations |
| `filePreviewer` | varies | File preview state |
| `fileShare` | varies | File sharing |
| `webDevUsage` | varies | Webdev usage tracking |

**Other (23 slices):**

| Slice | Purpose |
|-------|---------|
| `_persist` | Redux Persist configuration |
| `agentWorkspace` | Agent workspace state |
| `api` | API state management |
| `auth` | Authentication state |
| `biz` | Business logic |
| `community` | Community features |
| `configs` | Configuration |
| `example` | Examples/templates |
| `experiment` | Experimental features |
| `guestPage` | Guest mode |
| `knowledge` | Knowledge base |
| `library` | Library/templates |
| `login` | Login state |
| `mailManus` | Email features |
| `myBrowser` | Browser state |
| `navbar` | Navigation bar |
| `onboarding` | Onboarding flow |
| `products` | Products |
| `project` | Project management |
| `scheduledTask` | Scheduled tasks |
| `slideEditor` | Slide editor |
| `team` | Team features |
| `webdevAuth` | Webdev-specific auth |

---

## E.3 Flow 1: User Sends a Message

This is the most common flow. Every user message triggers this sequence.

### E.3.1 User Types in Input Field

```
USER ACTION: Types "Hello" in chat input
    ↓
EVENT: onChange on input field
    ↓
DISPATCH: chatActions.setInputValue("Hello")
    ↓
REDUX UPDATE:
    chat.inputValue: "" → "Hello"
    ↓
RE-RENDER: Input field shows "Hello"
```

### E.3.2 User Clicks Send

```
USER ACTION: Clicks Send button (or presses Enter)
    ↓
EVENT: onClick / onKeyDown
    ↓
DISPATCH SEQUENCE:
    1. chatActions.setInputValue("")           // Clear input
    2. chatActions.setFiles([])                // Clear attachments
    3. timelineActions.addUserMessage({        // Add to timeline
         content: "Hello",
         timestamp: "2026-02-09T14:00:00Z"
       })
    ↓
REDUX UPDATES:
    chat.inputValue: "Hello" → ""
    chat.files: [...] → []
    timeline.segmentEventsMap: { ...existing, "seg_123": [..., userMessage] }
    ↓
WEBSOCKET SEND:
    Frontend → Orchestration:
    { "type": "user_message", "content": "Hello", "session_id": "session_abc123" }
    ↓
RE-RENDER:
    - Input field clears
    - Timeline shows user message bubble
    - Typing indicator appears (thinking state)
```

### E.3.3 Orchestration Processes Message

```
WEBSOCKET RECEIVE (from orchestration):
    { "type": "thinking" }
    ↓
DISPATCH: timelineActions.setThinking(true)
    ↓
REDUX UPDATE:
    timeline.segmentEventsLoadingMap: { "seg_123": true }
    ↓
RE-RENDER: Thinking indicator (●●●) appears in timeline
```

### E.3.4 LLM Returns Tool Call

```
WEBSOCKET RECEIVE:
    {
      "type": "tool_call_start",
      "id": "tc_001",
      "tool": "shell",
      "parameters": { "action": "exec", "command": "ls", "session": "default" }
    }
    ↓
DISPATCH: timelineActions.addToolCall({
    id: "tc_001",
    tool: "shell",
    status: "executing",
    parameters: { action: "exec", command: "ls", session: "default" }
})
    ↓
REDUX UPDATE:
    timeline.segmentEventsMap: {
      "seg_123": [
        ...existing,
        { type: "tool_call", id: "tc_001", tool: "shell", status: "executing" }
      ]
    }
    ↓
RE-RENDER:
    - Tool call card appears in timeline
    - Shows: "shell_exec" badge + loading spinner
    - Parameters collapsed by default
```

### E.3.5 Tool Execution Completes

```
WEBSOCKET RECEIVE:
    {
      "type": "tool_call_end",
      "id": "tc_001",
      "result": { "output": "file1.txt\nfile2.txt\n", "exit_code": 0 }
    }
    ↓
DISPATCH: timelineActions.updateToolCall({
    id: "tc_001",
    status: "complete",
    result: { output: "file1.txt\nfile2.txt\n", exit_code: 0 }
})
    ↓
REDUX UPDATE:
    timeline.segmentEventsMap: {
      "seg_123": [
        ...existing,
        { type: "tool_call", id: "tc_001", tool: "shell", status: "complete", result: {...} }
      ]
    }
    ↓
RE-RENDER:
    - Spinner replaced with checkmark
    - Result preview shown (expandable)
```

### E.3.6 LLM Returns Final Message

```
WEBSOCKET RECEIVE:
    {
      "type": "message_complete",
      "content": "Here are the files in your home directory:\n- file1.txt\n- file2.txt",
      "attachments": []
    }
    ↓
DISPATCH SEQUENCE:
    1. timelineActions.addAssistantMessage({
         content: "Here are the files...",
         attachments: []
       })
    2. timelineActions.setThinking(false)
    ↓
REDUX UPDATES:
    timeline.segmentEventsMap: {
      "seg_123": [
        ...existing,
        { type: "assistant_message", content: "Here are the files...", attachments: [] }
      ]
    }
    timeline.segmentEventsLoadingMap: { "seg_123": false }
    ↓
RE-RENDER:
    - Thinking indicator disappears
    - Assistant message bubble appears (markdown rendered)
    - Copy button, regenerate button available
```

### E.3.7 Credits Update

```
WEBSOCKET RECEIVE:
    { "type": "credits_update", "remaining": 485, "used_this_session": 15 }
    ↓
DISPATCH: userActions.updateCredits(485)
    ↓
REDUX UPDATE:
    user.credits: 500 → 485
    ↓
RE-RENDER: Credit display updates in header/sidebar
```

---

## E.4 Flow 2: Plan Creation and Advancement

### E.4.1 Plan Created

```
WEBSOCKET RECEIVE:
    {
      "type": "plan_update",
      "plan": {
        "goal": "Build a landing page",
        "phases": [
          { "id": 1, "title": "Design brainstorming", "status": "current" },
          { "id": 2, "title": "Implement layout", "status": "pending" },
          { "id": 3, "title": "Deliver to user", "status": "pending" }
        ],
        "current_phase_id": 1
      }
    }
    ↓
DISPATCH: timelineActions.addPlanEvent({
    type: "plan",
    goal: "Build a landing page",
    phases: [...],
    current_phase_id: 1
})
    ↓
RE-RENDER: Plan card appears in timeline:
    ┌─────────────────────────────────────┐
    │ Goal: Build a landing page          │
    │ → Phase 1: Design brainstorming     │
    │   Phase 2: Implement layout         │
    │   Phase 3: Deliver to user          │
    └─────────────────────────────────────┘
```

### E.4.2 Phase Advanced

```
WEBSOCKET RECEIVE:
    {
      "type": "plan_update",
      "plan": {
        "current_phase_id": 2,
        "phases": [
          { "id": 1, "title": "Design brainstorming", "status": "completed" },
          { "id": 2, "title": "Implement layout", "status": "current" },
          { "id": 3, "title": "Deliver to user", "status": "pending" }
        ]
      }
    }
    ↓
DISPATCH: timelineActions.updatePlanEvent({
    current_phase_id: 2,
    phases: [...]
})
    ↓
RE-RENDER: Plan card updates:
    ┌─────────────────────────────────────┐
    │ Goal: Build a landing page          │
    │ ✓ Phase 1: Design brainstorming     │
    │ → Phase 2: Implement layout         │
    │   Phase 3: Deliver to user          │
    └─────────────────────────────────────┘
```

---

## E.5 Flow 3: Webdev Project Lifecycle

### E.5.1 Project Initialized

```
WEBSOCKET RECEIVE:
    {
      "type": "webdev_project_created",
      "project": {
        "name": "test-webdev-trace",
        "path": "/home/ubuntu/test-webdev-trace",
        "version": "e1f2a434",
        "dev_server_url": "https://3000-{id}.us2.manus.computer",
        "port": 3000
      }
    }
    ↓
DISPATCH SEQUENCE:
    1. webDevActions.setProject({
         name: "test-webdev-trace",
         path: "/home/ubuntu/test-webdev-trace",
         version: "e1f2a434",
         devServerUrl: "https://3000-{id}.us2.manus.computer"
       })
    2. webDevActions.setProjectInited(true)
    3. webDevActions.setActiveTab("preview")
    4. webDevActions.setMountedTabs({ preview: true })
    ↓
REDUX UPDATES:
    webDev.project: null → { name: "test-webdev-trace", ... }
    webDev.projectInited: false → true
    webDev.activeTab: "preview"
    webDev.mountedTabs: { preview: true, code: false, database: false, ... }
    ↓
RE-RENDER:
    - Management UI panel appears on right side
    - Preview tab loads with live dev server iframe
    - Project card appears in chatbox
```

### E.5.2 Tab Switching

```
USER ACTION: Clicks "Code" tab in Management UI
    ↓
DISPATCH SEQUENCE:
    1. webDevActions.setActiveTab("code")
    2. webDevActions.setMountedTabs({ ...existing, code: true })
    3. codeViewerActions.loadDirectory("/home/ubuntu/test-webdev-trace")
    ↓
REDUX UPDATES:
    webDev.activeTab: "preview" → "code"
    webDev.mountedTabs: { preview: true, code: true, ... }
    codeViewer.loadDirectoryLoading: false → true
    ↓
API CALL: GET /api/webdev/files?path=/home/ubuntu/test-webdev-trace
    ↓
DISPATCH: codeViewerActions.setDirectoryList([
    { name: "client/", type: "directory", children: [...] },
    { name: "package.json", type: "file" },
    ...
])
    ↓
REDUX UPDATES:
    codeViewer.directoryList: [] → [{ name: "client/", ... }, ...]
    codeViewer.loadDirectoryLoading: true → false
    ↓
RE-RENDER:
    - Code tab content appears
    - File tree renders on left
    - Editor panel empty (no file selected)
```

### E.5.3 File Opened in Code Viewer

```
USER ACTION: Clicks "App.tsx" in file tree
    ↓
DISPATCH SEQUENCE:
    1. codeViewerActions.addFileTab({ id: "client/src/App.tsx", name: "App.tsx" })
    2. codeViewerActions.setActiveTabId("client/src/App.tsx")
    3. codeViewerActions.setFileLoadingMap({ "client/src/App.tsx": true })
    ↓
API CALL: GET /api/webdev/files/client/src/App.tsx
    ↓
DISPATCH: codeViewerActions.setFileDataSource({
    "client/src/App.tsx": "import { Switch, Route } from 'wouter';\n..."
})
    ↓
REDUX UPDATES:
    codeViewer.fileTabList: [] → [{ id: "client/src/App.tsx", name: "App.tsx" }]
    codeViewer.activeTabId: null → "client/src/App.tsx"
    codeViewer.fileDataSource: {} → { "client/src/App.tsx": "import..." }
    codeViewer.fileLoadingMap: { "client/src/App.tsx": false }
    ↓
RE-RENDER:
    - File tab appears at top
    - Monaco editor renders file content
    - Syntax highlighting applied (TypeScript/JSX)
```

### E.5.4 Checkpoint Saved

```
WEBSOCKET RECEIVE:
    {
      "type": "webdev_checkpoint",
      "version_id": "abc12345",
      "description": "Implemented landing page with hero section",
      "screenshot_url": "https://cdn.manus.im/screenshots/..."
    }
    ↓
DISPATCH SEQUENCE:
    1. webDevActions.updateProject({ version: "abc12345" })
    2. timelineActions.addCheckpointEvent({
         version_id: "abc12345",
         description: "Implemented landing page...",
         screenshot_url: "..."
       })
    ↓
RE-RENDER:
    - Checkpoint card appears in chatbox
    - Screenshot thumbnail shown
    - "Dashboard" and "Publish" buttons available
```

---

## E.6 Flow 4: Browser Automation (Neko/WebRTC)

### E.6.1 User Opens "Manus Computer" View

```
USER ACTION: Clicks "Manus Computer" mini window
    ↓
DISPATCH: myBrowserActions.openBrowserView()
    ↓
COMPONENT: BrowserViewer mounts
    ↓
WebRTC Connection:
    1. Frontend → Neko signaling server (port 8333, proxied)
    2. STUN/TURN negotiation
    3. ICE candidate exchange
    4. WebRTC peer connection established
    5. Video stream starts (H.264, 1280x1029)
    ↓
RE-RENDER:
    - Right panel shows live browser view
    - Real-time video of Chromium's display
    - User can see what the browser is doing
```

### E.6.2 Browser Tool Triggers Visual Update

```
LLM calls: browser.navigate(url="https://google.com")
    ↓
Sandbox: Chromium navigates to google.com
    ↓
Neko captures display change:
    1. X11 framebuffer updated
    2. Neko detects changed regions
    3. H.264 encodes delta frame
    4. WebRTC sends to frontend
    ↓
Frontend: Video frame updates in BrowserViewer
    ↓
USER SEES: Google.com loading in real-time in the Manus Computer view
```

---

## E.7 Flow 5: Notification System

### E.7.1 New Notification Arrives

```
WEBSOCKET RECEIVE:
    {
      "type": "notification",
      "category": 0,
      "data": {
        "title": "Task completed",
        "body": "Your scheduled report is ready",
        "timestamp": "2026-02-09T09:00:00Z"
      }
    }
    ↓
DISPATCH SEQUENCE:
    1. notificationActions.addNotification({
         category: 0,
         data: { title: "Task completed", ... }
       })
    2. notificationActions.setHasNew(true)
    ↓
REDUX UPDATES:
    notification.categoryNotifications: { "0": [..., newNotification], "1": [...], "2": [...] }
    notification.hasNew: false → true
    ↓
RE-RENDER:
    - Bell icon shows red badge
    - Badge count increments
```

### E.7.2 User Opens Notification Panel

```
USER ACTION: Clicks bell icon
    ↓
DISPATCH SEQUENCE:
    1. notificationActions.setIsNotificationListVisible(true)
    2. notificationActions.setHasNew(false)
    ↓
REDUX UPDATES:
    notification.isNotificationListVisible: false → true
    notification.hasNew: true → false
    ↓
RE-RENDER:
    - Notification dropdown panel opens
    - Red badge disappears
    - Notifications listed by category
```

---

## E.8 Flow 6: Canvas Interaction

### E.8.1 User Opens Canvas

```
USER ACTION: Clicks canvas area or screenshot annotation
    ↓
DISPATCH: aiCanvasEditorActions.initialize({
    shapes: {},
    camera: { x: 0, y: 0, z: 0.24 }
})
    ↓
RE-RENDER: Canvas viewport appears with zoom/pan controls
```

### E.8.2 User Draws on Canvas

```
USER ACTION: Selects brush tool, draws on canvas
    ↓
DISPATCH SEQUENCE (per mouse event):
    1. aiCanvasEditorActions.setActiveTool("brush")
    2. aiCanvasEditorActions.setBrushing({
         isBrushing: true,
         startPoint: { x: 100, y: 200 },
         currentPoint: { x: 150, y: 250 }
       })
    3. (On mouse up):
       aiCanvasEditorActions.addShape({
         id: "shape_001",
         type: "freehand",
         points: [{ x: 100, y: 200 }, { x: 120, y: 220 }, { x: 150, y: 250 }]
       })
       aiCanvasEditorActions.setBrushing({
         isBrushing: false,
         startPoint: null,
         currentPoint: null
       })
    ↓
REDUX UPDATES:
    aiCanvasEditor.interaction.activeTool: "select" → "brush"
    aiCanvasEditor.brushing: { isBrushing: true, startPoint: {...}, currentPoint: {...} }
    aiCanvasEditor.shapes: { "shape_001": { type: "freehand", points: [...] } }
    ↓
RE-RENDER: Freehand stroke appears on canvas
```

### E.8.3 User Marks Screenshot

```
USER ACTION: Enters mark mode on screenshot
    ↓
DISPATCH: aiCanvasEditorActions.setMarking({
    isMarking: true,
    imageShapeId: "screenshot_001"
})
    ↓
USER ACTION: Draws rectangle on screenshot
    ↓
DISPATCH: aiCanvasEditorActions.addMarkScreenshot({
    imageId: "screenshot_001",
    region: { x: 50, y: 100, width: 200, height: 150 }
})
    ↓
RE-RENDER: Red rectangle overlay on screenshot area
```

---

## E.9 Flow 7: Map/Reduce Parallel Processing

### E.9.1 Map Job Started

```
WEBSOCKET RECEIVE:
    {
      "type": "map_started",
      "job_id": "map_001",
      "title": "Research three tech companies",
      "total_subtasks": 3
    }
    ↓
DISPATCH: mapReduceActions.setStartLoading(true)
    ↓
DISPATCH: timelineActions.addMapEvent({
    job_id: "map_001",
    title: "Research three tech companies",
    total: 3,
    completed: 0,
    status: "running"
})
    ↓
RE-RENDER:
    - Map progress card appears in timeline
    - Shows: "0/3 subtasks complete"
    - Progress bar at 0%
```

### E.9.2 Subtask Completes

```
WEBSOCKET RECEIVE:
    {
      "type": "map_subtask_complete",
      "job_id": "map_001",
      "subtask_index": 0,
      "result": { "company_name": "Apple Inc.", "overview": "..." }
    }
    ↓
DISPATCH: timelineActions.updateMapEvent({
    job_id: "map_001",
    completed: 1
})
    ↓
RE-RENDER:
    - Progress: "1/3 subtasks complete"
    - Progress bar at 33%
```

### E.9.3 All Subtasks Complete

```
WEBSOCKET RECEIVE:
    {
      "type": "map_complete",
      "job_id": "map_001",
      "results": [
        { "company_name": "Apple Inc.", ... },
        { "company_name": "Google LLC", ... },
        { "company_name": "Microsoft Corp.", ... }
      ]
    }
    ↓
DISPATCH SEQUENCE:
    1. timelineActions.updateMapEvent({
         job_id: "map_001",
         completed: 3,
         status: "complete",
         results: [...]
       })
    2. mapReduceActions.setStartLoading(false)
    ↓
RE-RENDER:
    - Progress: "3/3 subtasks complete" ✓
    - Results table appears (expandable)
    - Each row shows one subtask result
```

---

## E.10 Flow 8: WebSocket Connection Lifecycle

### E.10.1 Connection Established

```
APP STARTUP:
    WebSocket.connect("wss://api.manus.im/ws?token=<jwt>")
    ↓
DISPATCH: websocketActions.setConnected(true)
    ↓
DISPATCH: notificationActions.setConnectStatus("connected")
    ↓
RE-RENDER: Connection indicator shows green
```

### E.10.2 Connection Lost

```
NETWORK EVENT: WebSocket disconnects
    ↓
DISPATCH SEQUENCE:
    1. websocketActions.setConnected(false)
    2. notificationActions.setConnectStatus("disconnected")
    3. notificationActions.setConnectError("Connection lost")
    ↓
RE-RENDER:
    - Connection indicator shows red
    - "Reconnecting..." banner appears
    ↓
AUTO-RECONNECT:
    Exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s (max)
    ↓
On reconnect:
    DISPATCH: websocketActions.setConnected(true)
    DISPATCH: notificationActions.setConnectStatus("connected")
```

---

## E.11 Flow 9: Responsive Layout

### E.11.1 Window Resize

```
BROWSER EVENT: window.resize
    ↓
DISPATCH: uiActions.setWindowWidth(window.innerWidth)
    ↓
DERIVED STATE:
    isMobile = windowWidth < 768
    ↓
REDUX UPDATES:
    ui.windowWidth: 1792 → 375
    ui.isMobile: false → true
    ↓
RE-RENDER:
    - Layout switches from desktop to mobile
    - Sidebar collapses
    - Management UI becomes full-screen overlay
    - Chat input moves to bottom
```

### E.11.2 Sidebar Resize

```
USER ACTION: Drags sidebar divider
    ↓
DISPATCH: uiActions.setChatSidebarPercentage(35)
    ↓
REDUX UPDATE:
    ui.chatSidebarPercentage: null → 35
    ↓
RE-RENDER:
    - Left panel: 35% width
    - Right panel: 65% width
    - Smooth CSS transition
```

---

## E.12 Flow 10: File Attachment and Download

### E.12.1 User Uploads File

```
USER ACTION: Clicks attachment button, selects file
    ↓
DISPATCH: chatActions.addFile({
    name: "data.csv",
    size: 12345,
    type: "text/csv",
    data: <File object>
})
    ↓
REDUX UPDATE:
    chat.files: [] → [{ name: "data.csv", size: 12345, ... }]
    ↓
RE-RENDER:
    - File chip appears below input field
    - Shows filename + size + remove button
```

### E.12.2 User Downloads Attachment

```
USER ACTION: Clicks download link on attachment
    ↓
BROWSER: GET https://cdn.manus.im/files/{user_id}/{session_id}/report.pdf?signature=...
    ↓
CDN validates signature
    ↓
CDN → Browser: File data
    Content-Type: application/pdf
    Content-Disposition: attachment; filename="report.pdf"
    ↓
Browser saves file to user's Downloads folder
```

---

## E.13 Flow 11: Connector (MCP) Integration

### E.13.1 User Enables Gmail Connector

```
USER ACTION: Goes to Settings → Connectors → Enable Gmail
    ↓
DISPATCH: connectorsActions.addConnector({
    name: "gmail",
    status: "authenticating"
})
    ↓
OAuth Flow:
    1. Frontend opens popup: https://mcp.manus.im/gmail/oauth
    2. User authenticates with Google
    3. OAuth callback received
    4. Token stored server-side
    ↓
DISPATCH: connectorsActions.updateConnector({
    name: "gmail",
    status: "connected"
})
    ↓
RE-RENDER: Gmail connector shows green "Connected" status
```

### E.13.2 Gmail Tool Used in Conversation

```
LLM decides to use Gmail:
    shell.exec(command="manus-mcp-cli tool call search_emails --server gmail --input '...'")
    ↓
Sandbox: manus-mcp-cli → MCP server (port 8350) → Gmail API
    ↓
Results returned to LLM
    ↓
LLM formats email results for user
    ↓
WEBSOCKET → Frontend: Email content rendered in timeline
```

---

## E.14 State Persistence

### E.14.1 Redux Persist Configuration

```typescript
// Persisted slices (survive page refresh):
whitelist: ['auth', 'ui', 'sessions', 'aiCanvas', 'configs']

// NOT persisted (reloaded from server):
blacklist: ['websocket', 'timeline', 'notification', 'chat']
```

### E.14.2 What Persists vs. What Reloads

| State | Persisted? | Reason |
|-------|-----------|--------|
| `auth` (JWT token) | Yes | User stays logged in |
| `ui` (layout preferences) | Yes | Remember sidebar width, mobile state |
| `sessions` (session list) | Yes | Show conversation list immediately |
| `timeline` (messages) | No | Reloaded from server on session open |
| `websocket` (connection) | No | Must reconnect on page load |
| `notification` (notifications) | No | Fetched fresh from server |
| `chat` (input state) | No | Start fresh each time |
| `webDev` (project state) | Partial | Project info persisted, live state reloaded |

---

## E.15 Complete State Machine: Session Lifecycle

```
SESSION STATES:

    ┌──────────┐
    │  CREATED │ ← User clicks "New Chat"
    └────┬─────┘
         │ User sends first message
         ↓
    ┌──────────┐
    │  ACTIVE  │ ← Agent loop running
    └────┬─────┘
         │
         ├── Tool calls executing
         ├── LLM processing
         ├── Streaming responses
         │
         ├── message(type="result") called
         │   ↓
         │ ┌──────────────┐
         │ │  COMPLETED   │ ← Task finished successfully
         │ └──────────────┘
         │
         ├── Error limit reached
         │   ↓
         │ ┌──────────────┐
         │ │   FAILED     │ ← Task failed
         │ └──────────────┘
         │
         └── User sends new message
             ↓
         ┌──────────┐
         │  ACTIVE  │ ← Agent loop restarts
         └──────────┘
```

### Redux State Transitions:

```
sessions.entities["session_abc123"].status:
    null → "active" → "completed"
                    → "failed"
    "completed" → "active" (user sends new message)
```

---

## E.16 Sandbox State Machine

```
SANDBOX STATES:

    ┌──────────────┐
    │   CREATING   │ ← E2B API called
    └──────┬───────┘
           │ ~150ms
           ↓
    ┌──────────────┐
    │   RUNNING    │ ← All services up, WebSocket connected
    └──────┬───────┘
           │
           ├── Tool calls executing
           ├── Files being written
           ├── Browser navigating
           │
           ├── No activity for X minutes
           │   ↓
           │ ┌──────────────┐
           │ │ HIBERNATING  │ ← VM state saved, resources freed
           │ └──────┬───────┘
           │        │ User sends message
           │        ↓
           │ ┌──────────────┐
           │ │  RESUMING    │ ← VM state restored (~150ms)
           │ └──────┬───────┘
           │        │
           │        ↓
           │ ┌──────────────┐
           │ │   RUNNING    │ ← Back to normal
           │ └──────────────┘
           │
           └── Timeout (14 days) or explicit destroy
               ↓
           ┌──────────────┐
           │  DESTROYED   │ ← All data lost
           └──────────────┘
```
