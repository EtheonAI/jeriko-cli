# Part 4: Frontend and Redux State Management

## 4.1 Overview

Manus's frontend is a **React** application using **Redux** for state management. The UI consists of two main panels: the **Chatbox** (left) and the **Management UI** (right, collapsible). Communication with the backend uses a combination of HTTP REST APIs and WebSocket for real-time updates.

---

## 4.2 Complete Redux Store (41 Slices)

### Core UI Slices

#### `ui` — Global UI State
```typescript
{
  sidebarOpen: boolean;           // Left sidebar visibility
  windowSize: { width, height };  // Responsive breakpoints
  isMobile: boolean;              // Mobile detection
  theme: "light" | "dark";       // Current theme
  locale: string;                 // Language setting
}
```
**Triggers:** Window resize, sidebar toggle, theme switch

#### `chat` — Chat Interface State
```typescript
{
  inputValue: string;             // Current text input
  files: File[];                  // Attached files
  isComposing: boolean;           // IME composition state
  taskMode: string;               // Task mode selector
  sharePopoverOpen: boolean;      // Share dialog
  voiceInputActive: boolean;      // Microphone state
}
```
**Triggers:** User typing, file upload, send message, voice input

#### `timeline` — Message Timeline
```typescript
{
  items: TimelineEvent[];         // All events in order
  segments: Segment[];            // Grouped event segments
  loadingSegments: {              // Per-segment loading state
    [segmentId]: boolean
  };
  percentage: number;             // Progress bar (0-100)
  isStreaming: boolean;           // LLM streaming response
}

// TimelineEvent types:
type TimelineEvent = 
  | { type: "user_message", content: string, files: [] }
  | { type: "assistant_message", content: string }
  | { type: "tool_call", tool: string, status: string, input: {}, output: {} }
  | { type: "plan_update", goal: string, phases: Phase[] }
  | { type: "plan_advance", current_phase: number }
  | { type: "thinking", status: "started" | "completed" }
  | { type: "error", message: string }
```
**Triggers:** WebSocket events from orchestration

#### `notification` — Notification System
```typescript
{
  hasNew: boolean;                // Badge indicator
  items: Notification[];          // Notification list
  categories: string[];           // Filter categories
  panelOpen: boolean;             // Dropdown visibility
}
```
**Triggers:** WebSocket notification events, user interaction

---

### Session Management Slices

#### `sessions` — Normalized Session Entities
```typescript
{
  ids: string[];                  // Ordered session IDs
  entities: {
    [uid: string]: {
      uid: string;
      title: string;
      status: "active" | "completed" | "failed";
      createdAt: string;
      updatedAt: string;
      costedCredits: number;
      taskMode: string;
    }
  };
  activeSessionId: string | null; // Current session
  loading: boolean;
  error: string | null;
}
```
**Pattern:** Redux Toolkit `createEntityAdapter` (normalized state)
**Triggers:** Session CRUD operations, WebSocket updates

#### `sessionSwitch` — Session Switching
```typescript
{
  isTransitioning: boolean;       // Animation state
  previousSessionId: string;      // For transition
  targetSessionId: string;        // Destination
}
```
**Triggers:** User clicks different session in sidebar

#### `websocket` — WebSocket Connection
```typescript
{
  connected: boolean;             // Connection status
  reconnecting: boolean;          // Auto-reconnect state
  lastPing: number;               // Heartbeat timestamp
  error: string | null;
}
```
**Triggers:** Connection events, heartbeat, disconnect

---

### Canvas Slices

#### `aiCanvas` — Canvas Data Storage
```typescript
{
  documents: {
    [id: string]: {
      shapes: Shape[];
      bindings: Binding[];
    }
  };
  currentDocumentId: string;
}
```
**Triggers:** Shape creation, modification, deletion

#### `aiCanvasEditor` — Canvas Editor State
```typescript
{
  activeTool: "select" | "brush" | "mark";
  camera: { x: number, y: number, z: number }; // z = zoom (e.g., 0.24)
  selectedShapeIds: string[];
  isEditing: boolean;             // Text editing mode
  contextMenuOpen: boolean;       // Right-click menu
  gridVisible: boolean;           // Grid overlay
  screenshotMode: boolean;        // Screenshot annotation
}
```
**Triggers:** Tool selection, zoom/pan, shape selection, right-click

---

### Feature Slices

#### `codeViewer` — Code Editor
```typescript
{
  rootDirectory: string | null;   // Project root
  directoryList: DirectoryEntry[];// File tree
  fileDataSource: {               // File contents cache
    [path: string]: {
      content: string;
      language: string;
      lastModified: string;
    }
  };
  fileTabList: FileTab[];         // Open file tabs
  activeTabId: string | null;     // Currently active tab
}
```
**Triggers:** File tree navigation, file open/close, tab switch

#### `webDev` — Web Development Projects
```typescript
{
  activeTab: "preview" | "code" | "file" | "database" | "dashboard" | "settings";
  mountedTabs: {
    preview: boolean;
    code: boolean;
    file: boolean;
    database: boolean;
    settings: boolean;
    dashboard: boolean;
  };
  project: {
    name: string;
    path: string;
    version: string;
    devServerUrl: string;
    devServerStatus: "running" | "stopped" | "error";
  } | null;
  settingsSubPanel: "general" | "domains" | "notifications" | "secrets" | "github";
}
```
**Triggers:** Tab switching, project init, server status changes

#### `connectors` — External Integrations
```typescript
{
  available: Connector[];         // All available connectors (190+)
  enabled: Connector[];           // User-enabled connectors
  loading: boolean;
}
```
**Triggers:** Connector enable/disable, OAuth completion

#### `mapReduce` — Parallel Processing
```typescript
{
  jobs: {
    [jobId: string]: {
      status: "pending" | "running" | "completed" | "failed";
      totalTasks: number;
      completedTasks: number;
      results: any[];
    }
  };
}
```
**Triggers:** map tool call, subtask completion events

#### `fileManagement` — File Operations
```typescript
{
  uploads: {
    [fileId: string]: {
      name: string;
      size: number;
      progress: number;           // 0-100
      status: "uploading" | "completed" | "failed";
      url: string;                // CDN URL after upload
    }
  };
  downloads: FileDownload[];
}
```
**Triggers:** File upload/download operations

#### `scheduledTask` — Scheduled Tasks
```typescript
{
  tasks: ScheduledTask[];
  activeTask: ScheduledTask | null;
}
```
**Triggers:** Task scheduling, cron/interval execution

#### `slideEditor` — Slide Presentations
```typescript
{
  slides: Slide[];
  activeSlideIndex: number;
  editMode: boolean;
}
```
**Triggers:** Slide creation, editing, navigation

---

### Auth Slices

#### `auth` — User Authentication
```typescript
{
  user: {
    id: string;                   // "310519663278050818"
    email: string;                // "khaleelmusleh@gmail.com"
    name: string;
    avatar: string;
  } | null;
  token: string | null;
  plan: {
    tier: number;                 // 20
    type: "pro";
    interval: "monthly";
    cancelAtPeriodEnd: boolean;
    maxConcurrentSessions: number; // 20
  };
  isAuthenticated: boolean;
}
```

#### `webdevAuth` — Webdev-Specific Auth
```typescript
{
  oauthToken: string | null;
  userId: string | null;
}
```

---

### Persistence Slice

#### `_persist` — Redux Persist Configuration
```typescript
{
  version: number;
  rehydrated: boolean;
}
```
Manages state persistence to localStorage/sessionStorage.

---

## 4.3 UI Layout Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TOP BAR                                                      │
│ [≡ Sidebar] [Session Title]        [Notifications 🔔] [⚙️] │
├──────────────────────┬──────────────────────────────────────┤
│                      │                                       │
│  LEFT SIDEBAR        │  MAIN CONTENT AREA                    │
│  (collapsible)       │                                       │
│                      │  ┌─ Chat Mode ──────────────────────┐│
│  [+ New Chat]        │  │                                   ││
│                      │  │  Timeline                         ││
│  Recent Sessions:    │  │  ├─ User message                  ││
│  ├─ Session 1        │  │  ├─ Plan widget                   ││
│  ├─ Session 2        │  │  ├─ Tool call (expandable)        ││
│  └─ Session 3        │  │  ├─ Assistant message              ││
│                      │  │  └─ ...                            ││
│  Library             │  │                                   ││
│  Scheduled Tasks     │  │  Progress bar ████████░░ 75%      ││
│  Settings            │  │                                   ││
│                      │  │  ┌─────────────────────────────┐  ││
│                      │  │  │ Chat Input                  │  ││
│                      │  │  │ [📎] [🎤] [Text...] [Send]  │  ││
│                      │  │  └─────────────────────────────┘  ││
│                      │  └───────────────────────────────────┘│
│                      │                                       │
│                      │  ┌─ Management UI (collapsible) ─────┐│
│                      │  │ [Preview] [Code] [File]           ││
│                      │  │ [Database] [Dashboard] [Settings] ││
│                      │  │                                   ││
│                      │  │ ┌───────────────────────────────┐ ││
│                      │  │ │ Active Tab Content            │ ││
│                      │  │ │                               │ ││
│                      │  │ │ Preview: iframe of dev server │ ││
│                      │  │ │ Code: Monaco editor + tree    │ ││
│                      │  │ │ Database: TiDB CRUD UI        │ ││
│                      │  │ └───────────────────────────────┘ ││
│                      │  └───────────────────────────────────┘│
└──────────────────────┴──────────────────────────────────────┘
```

---

## 4.4 Component Behavior Patterns

### Planner Widget (in Timeline)

**Trigger:** Claude calls `plan` tool
**State source:** `timeline.items` (plan_update/plan_advance events)

**Rendering logic:**
```
IF timeline has plan_update event:
  Render plan widget:
    ├── Goal text
    ├── For each phase:
    │   ├── IF phase.id < current_phase_id → ✓ Completed (green)
    │   ├── IF phase.id === current_phase_id → → Current (highlighted, loading)
    │   └── IF phase.id > current_phase_id → ○ Pending (gray)
    └── Progress bar: (current_phase_id / total_phases) * 100
```

**States:**
- `creating` - Plan being generated (spinner)
- `active` - Plan executing (current phase highlighted)
- `completed` - All phases done (all checkmarks)

### Tool Call Widget (in Timeline)

**Trigger:** WebSocket `tool_call` event
**State source:** `timeline.items` (tool_call events)

**Rendering logic:**
```
Collapsed view (default):
  [🔧 tool_name] [status badge] [▼ expand]

Expanded view (on click):
  [🔧 tool_name] [status badge] [▲ collapse]
  ├── Input: { path: "...", text: "..." }
  └── Output: { success: true, ... }
```

**Status badges:**
- `executing` → Spinner + "Running..."
- `completed` → ✓ Green checkmark
- `failed` → ✗ Red X + error message
- `timeout` → ⏱ Yellow clock

### Manus Computer Window (Browser View)

**Trigger:** User clicks "Manus Computer" button in chat
**State source:** Neko WebRTC connection

**Rendering logic:**
```
Mini window (in chat):
  ┌─────────────────────┐
  │ 🖥 Manus Computer   │
  │ ┌─────────────────┐ │
  │ │ Neko thumbnail  │ │ ← Low-res WebRTC preview
  │ └─────────────────┘ │
  │ [Click to expand]   │
  └─────────────────────┘

Full canvas (Management UI right panel):
  ┌─────────────────────────────┐
  │ 🖥 Manus Computer    [✕]   │
  │ ┌─────────────────────────┐ │
  │ │                         │ │
  │ │  Full Neko WebRTC       │ │ ← Full-res H.264 stream
  │ │  Browser Stream         │ │
  │ │  (1280x1029)            │ │
  │ │                         │ │
  │ └─────────────────────────┘ │
  └─────────────────────────────┘
```

### Message Rendering

**User message:**
```
┌─ User ──────────────────────────┐
│ Message text                     │
│ [📎 attachment1.pdf]            │
└──────────────────────────────────┘
```

**Assistant message:**
```
┌─ Manus ─────────────────────────┐
│ Markdown rendered content        │
│ **Bold**, `code`, lists, etc.    │
│                                  │
│ [📎 attachment1.md] [📎 img.png]│
└──────────────────────────────────┘
```

**Thinking indicator:**
```
┌─ Manus ─────────────────────────┐
│ ● ● ● Thinking...               │
└──────────────────────────────────┘
```

### Progress Bar

**State source:** `timeline.percentage`
**Rendering:**
```
Progress: ████████████░░░░░░░░ 60%

0%   = Just started
25%  = Planning phase
50%  = Executing tools
75%  = Processing results
100% = Complete
```

### Email Display (Gmail Connector)

**Trigger:** Gmail connector returns results
**Rendered in:** Timeline as tool result

```
┌─ Email ─────────────────────────┐
│ From: sender@example.com         │
│ Subject: Meeting Tomorrow        │
│ Date: Feb 10, 2026               │
│ ─────────────────────────────── │
│ Email body preview...            │
│                                  │
│ [📎 attachment.pdf]             │
│ [View Full Thread]              │
└──────────────────────────────────┘
```

---

## 4.5 State Update Flow

### WebSocket → Redux Flow:

```
WebSocket message received
    ↓
WebSocket middleware intercepts
    ↓
Dispatches appropriate Redux action:
    ├── "message" → timeline.addMessage()
    ├── "tool_call" → timeline.addToolCall()
    ├── "tool_result" → timeline.updateToolCall()
    ├── "plan_update" → timeline.addPlanUpdate()
    ├── "plan_advance" → timeline.updatePlanAdvance()
    ├── "thinking" → timeline.setThinking()
    ├── "credits_update" → auth.updateCredits()
    ├── "notification" → notification.addNotification()
    ├── "session_update" → sessions.updateSession()
    └── "error" → timeline.addError()
    ↓
React components re-render via useSelector()
```

### User Action → State Flow:

```
User types in chat input
    ↓
onChange → dispatch(chat.setInputValue(text))
    ↓
User clicks Send
    ↓
dispatch(chat.clearInput())
dispatch(timeline.addUserMessage(text))
    ↓
HTTP: POST /v1/sessions/:id/messages
    ↓
WebSocket events start flowing (see above)
```

---

## 4.6 Management UI Tabs

### Preview Tab
- **Content:** iframe pointing to dev server URL
- **URL:** `https://{port}-{id}.us2.manus.computer`
- **Features:** Live reload, visual editor overlay
- **State:** `webDev.project.devServerUrl`

### Code Tab
- **Content:** Custom code viewer (NOT code-server)
- **Components:** File tree (left) + Monaco editor (right) + tabs (top)
- **State:** `codeViewer.directoryList`, `codeViewer.fileDataSource`, `codeViewer.fileTabList`
- **Data source:** Files loaded from E2B sandbox via API

### File Tab
- **Content:** File management interface
- **Features:** Upload, download, browse
- **State:** `fileManagement`

### Database Tab
- **Content:** TiDB CRUD interface
- **Features:** Table browser, query editor, data viewer
- **Connection:** Via Manus API proxy to TiDB

### Dashboard Tab
- **Content:** Analytics and status
- **Features:** UV/PV charts, uptime, visibility controls
- **State:** `webDev.project`

### Settings Tab
- **Sub-panels:** General, Domains, Notifications, Secrets, GitHub
- **State:** `webDev.settingsSubPanel`
- **Features:**
  - General: Name, favicon, visibility
  - Domains: Custom domain binding, manus.space prefix
  - Notifications: Push notification config
  - Secrets: Environment variable management
  - GitHub: Export to repository

---

## 4.7 Chatbox Cards

Special cards appear in the chat timeline:

### Project Card (after `webdev_init_project`)
```
┌─ Project: test-webdev-trace ────┐
│ Status: Running                  │
│ URL: https://3000-...            │
│ [View] → Opens Preview panel     │
└──────────────────────────────────┘
```

### Checkpoint Card (after `webdev_save_checkpoint`)
```
┌─ Checkpoint: e1f2a434 ─────────┐
│ 📸 Screenshot thumbnail         │
│ Description: "Initial setup"    │
│ [Dashboard] → Opens Dashboard   │
│ [Publish] or [Rollback]        │
└──────────────────────────────────┘
```

### Attachment Card
```
┌─ Attachments ───────────────────┐
│ [📄 report.md] [🖼 image.png]  │
│ Click to download               │
└──────────────────────────────────┘
```

---

## 4.8 Loading States

| Component | Loading State | Visual |
|-----------|--------------|--------|
| Timeline segment | `loadingSegments[id] = true` | Spinner on segment |
| Progress bar | `percentage: 0-100` | Animated progress bar |
| Tool call | `status: "executing"` | Spinner + "Running..." |
| Plan phase | `current_phase` | Pulsing highlight |
| File upload | `progress: 0-100` | Upload progress bar |
| Session list | `sessions.loading` | Skeleton cards |
| Code viewer | File loading | Skeleton editor |
| Thinking | `isStreaming: true` | Animated dots |

---

## 4.9 Responsive Design

```typescript
// Breakpoints (inferred from ui slice)
const breakpoints = {
  mobile: 0,      // < 768px: Single column, no sidebar
  tablet: 768,    // 768-1024px: Collapsible sidebar
  desktop: 1024,  // > 1024px: Full layout with sidebar
};

// Layout behavior:
// Mobile: Chat only, Management UI as overlay
// Tablet: Chat + collapsible Management UI
// Desktop: Chat + persistent Management UI (resizable)
```
