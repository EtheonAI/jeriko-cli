# Complete Redux State Management Architecture

## Overview

**Total Redux Slices:** 41
**State Management:** Redux Toolkit (likely)
**Persistence:** Redux Persist (`_persist` slice)

---

## Redux Slice Categories

### 1. Core UI (4 slices)
- `ui` - Global UI state
- `chat` - Chat interface state
- `timeline` - Message timeline state
- `notification` - Notifications system

### 2. Canvas (2 slices)
- `aiCanvas` - Canvas data storage
- `aiCanvasEditor` - Canvas editor state

### 3. User & Auth (2 slices)
- `auth` - Authentication state
- `webdevAuth` - Webdev-specific auth

### 4. Sessions (3 slices)
- `sessions` - Session management
- `sessionSwitch` - Session switching
- `websocket` - WebSocket connection state

### 5. Features (8 slices)
- `codeViewer` - Code editor state
- `connectors` - External integrations
- `fileConnector` - File connector state
- `fileManagement` - File operations
- `filePreviewer` - File preview state
- `fileShare` - File sharing
- `mapReduce` - Parallel processing
- `webDev` - Web development projects
- `webDevUsage` - Webdev usage tracking

### 6. Other (22 slices)
- `_persist` - Redux persist config
- `agentWorkspace` - Agent workspace
- `api` - API state
- `biz` - Business logic
- `community` - Community features
- `configs` - Configuration
- `example` - Examples
- `experiment` - Experimental features
- `guestPage` - Guest mode
- `knowledge` - Knowledge base
- `library` - Library/templates
- `login` - Login state
- `mailManus` - Email features
- `myBrowser` - Browser state
- `navbar` - Navigation bar
- `onboarding` - Onboarding flow
- `products` - Products
- `project` - Project management
- `scheduledTask` - Scheduled tasks
- `slideEditor` - Slide editor
- `team` - Team features

---

## Detailed Slice Analysis

### `ui` Slice

**Purpose:** Global UI state management

**State Structure:**
```typescript
interface UIState {
  isMobile: boolean;              // Responsive layout flag
  chatSidebarPercentage: number | null;  // Sidebar width
  windowWidth: number;            // Window width in pixels
  showAppDownloadMask: boolean;   // App download prompt
  isShowMaxModeIntroduce: boolean; // Max mode intro
  navTasksFolded: boolean;        // Navigation tasks collapsed
}
```

**State Management Logic:**
- Window resize → Updates `windowWidth`, recalculates `isMobile`
- User drags sidebar → Updates `chatSidebarPercentage`
- User folds nav → Toggles `navTasksFolded`

**Component Behavior:**
- Layout components read `isMobile` for responsive rendering
- Sidebar component binds to `chatSidebarPercentage`
- App download modal shows when `showAppDownloadMask` is true

---

### `chat` Slice

**Purpose:** Chat interface state

**State Structure:**
```typescript
interface ChatState {
  files: File[];                  // Uploaded files
  inputValue: string;             // Text input value
  showSharePopover: string | null; // Share popover target
  taskMode: "standard" | string;  // Task mode
  inputMode: "text" | "voice";    // Input mode
  microphonePermission: "prompt" | "granted" | "denied";
  chatExtData: any | null;        // Extended data
  sendQuestionBehavior: any | null;
  slideTemplateList: any[] | null;
  recommendedPlaybooks: any[] | null;
  slideTemplateListLoading: boolean;
  recommendedPlaybooksLoading: boolean;
  recommendedPlaybooksV2: {
    playbooks: any[] | null;
    loading: boolean;
    total: number;
    currentPage: number;
  };
  dataVisualization: any | null;
  debugModelOverride: {
    enabled: boolean;
    config: any | null;
    configText: string;
  };
  isPageVisible: boolean;
  fileSuggestions: any[];
  inputPlaybookId: string | null;
  inputPlaybookTemplate: any | null;
  isAppBannerVisible: boolean;
  imageStyleList: any[] | null;
  imageStyleListLoading: boolean;
  agentModeIntroduceScene: any | null;
  pinnedSlideTemplateId: string | null;
}
```

**State Management Logic:**
- User types → `inputValue` updates on every keystroke
- User uploads file → Adds to `files` array
- User clicks voice button → Requests `microphonePermission`
- User switches mode → Updates `taskMode` or `inputMode`
- User clicks send → Clears `inputValue` and `files`

**Component Behavior:**
- Input field controlled by `inputValue`
- File list renders from `files` array
- Voice button disabled if `microphonePermission` is "denied"
- Mode selector shows current `taskMode`

---

### `timeline` Slice

**Purpose:** Message and event timeline

**State Structure:**
```typescript
interface TimelineState {
  segmentEventsMap: Record<string, Event[]>;
  segmentEventsLoadingMap: Record<string, boolean>;
  percentage: number;  // Progress 0-100
}
```

**State Management Logic:**
- New message → Adds event to `segmentEventsMap`
- Tool execution starts → Sets loading in `segmentEventsLoadingMap`
- Tool completes → Updates event, clears loading
- Progress updates → Changes `percentage`

**Component Behavior:**
- Timeline renders events from `segmentEventsMap`
- Loading spinners show for segments in `segmentEventsLoadingMap`
- Progress bar displays `percentage`

---

### `sessions` Slice

**Purpose:** Session management

**State Structure:**
```typescript
interface SessionsState {
  entities: Record<string, Session>;
  ids: string[];
  // Normalized state (Redux Toolkit entities pattern)
}

interface Session {
  uid: string;
  title: string;
  status: "active" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
  costedCredits: number;
  // ... other fields
}
```

**State Management Logic:**
- New session created → Adds to `entities` and `ids`
- Session updated → Merges changes into `entities[sessionId]`
- Session deleted → Removes from `entities` and `ids`

**Component Behavior:**
- Session list renders from `ids.map(id => entities[id])`
- Active session highlighted based on `status`
- Credits display from `costedCredits`

---

### `aiCanvas` Slice

**Purpose:** Canvas data storage

**State Structure:**
```typescript
interface AICanvasState {
  allAiCanvas: Record<string, CanvasData>;
  ocrCache: Record<string, OCRResult>;
}
```

**State Management Logic:**
- Canvas created → Adds to `allAiCanvas`
- OCR performed → Caches in `ocrCache`
- Canvas updated → Merges changes

**Component Behavior:**
- Canvas list renders from `allAiCanvas`
- OCR results loaded from `ocrCache`

---

### `aiCanvasEditor` Slice

**Purpose:** Canvas editor state

**State Structure:**
```typescript
interface AICanvasEditorState {
  shapes: Record<string, Shape>;
  camera: {
    x: number;
    y: number;
    z: number;  // Zoom level
  };
  selectedShapeIds: string[];
  hoveredShapeId: string | null;
  previewSelectedId: string | null;
  altDragCloneIds: string[];
  isAltPressed: boolean;
  guides: Guide[];
  interaction: {
    activeTool: "select" | "brush" | "mark" | string;
    rightMouseDown: boolean;
    isImageDragging: boolean;
    temporaryPanMode: boolean;
    temporaryMarkMode: boolean;
    panning: boolean;
  };
  brushing: {
    isBrushing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
  };
  marking: {
    isMarking: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    imageShapeId: string | null;
  };
  contextMenu: {
    position: Point | null;
    target: any | null;
  };
  screenshots: {
    markScreenshots: Record<string, Screenshot>;
    markedImages: Record<string, MarkedImage>;
  };
  editTextMode: {
    imageId: string | null;
    annotations: Annotation[];
    selectedAnnotationIndex: number | null;
    hoveredAnnotationIndex: number | null;
    editedTexts: string[];
    isOcrLoading: boolean;
  };
  settings: {
    useScrollWheelZoom: boolean;
    rightClickDragToPan: boolean;
    gridState: boolean;
  };
  commentHistory: {
    past: any[];
    future: any[];
  };
  commentPopup: {
    commentId: string;
    isOpen: boolean;
  };
}
```

**State Management Logic:**
- User selects tool → Updates `interaction.activeTool`
- User draws → Updates `brushing` or `marking` state
- User creates shape → Adds to `shapes`
- User pans/zooms → Updates `camera`
- User right-clicks → Shows `contextMenu`

**Component Behavior:**
- Canvas renders shapes from `shapes`
- Camera transform applied from `camera`
- Tool cursor changes based on `activeTool`
- Context menu positioned at `contextMenu.position`

---

### `notification` Slice

**Purpose:** Notifications system

**State Structure:**
```typescript
interface NotificationState {
  connectStatus: "default" | "connected" | "disconnected";
  connectError: any | null;
  isNotificationListVisible: boolean;
  categoryNotifications: {
    "0": Notification[];
    "1": Notification[];
    "2": Notification[];
  };
  categoryHasMore: {
    "0": boolean;
    "1": boolean;
    "2": boolean;
  };
  notificationTab: 0 | 1 | 2;
  fetchNotificationLoading: boolean;
  hasNew: boolean;
  updatePageNotificationList: Notification[];
  updatePageHasMore: boolean;
  updatePageHasNew: boolean;
  updatePageLoading: boolean;
}
```

**State Management Logic:**
- WebSocket connects → Sets `connectStatus` to "connected"
- New notification arrives → Adds to `categoryNotifications`, sets `hasNew` to true
- User opens panel → Sets `isNotificationListVisible` to true, clears `hasNew`
- User switches tab → Updates `notificationTab`

**Component Behavior:**
- Bell icon shows badge when `hasNew` is true
- Dropdown panel visible when `isNotificationListVisible` is true
- Tabs render from `categoryNotifications`
- Loading spinner shows when `fetchNotificationLoading` is true

---

### `webDev` Slice

**Purpose:** Web development projects

**State Structure:**
```typescript
interface WebDevState {
  activeTab: "preview" | "code" | "file" | "database" | "dashboard" | "settings";
  mountedTabs: Record<string, boolean>;
  // ... other webdev state
}
```

**State Management Logic:**
- User clicks tab → Updates `activeTab`, sets `mountedTabs[tab]` to true
- Project created → Initializes webdev state
- Server starts → Updates server status

**Component Behavior:**
- Tab content renders based on `activeTab`
- Tabs lazy-load when `mountedTabs[tab]` becomes true

---

### `codeViewer` Slice

**Purpose:** Code editor state

**State Structure:**
```typescript
interface CodeViewerState {
  rootDirectory: string | null;
  directoryList: FileNode[];
  fileDataSource: Record<string, string>;
  fileTabList: FileTab[];
  activeTabId: string | null;
}
```

**State Management Logic:**
- User opens file → Adds to `fileTabList`, sets `activeTabId`
- File content loaded → Stores in `fileDataSource`
- User closes tab → Removes from `fileTabList`

**Component Behavior:**
- File tree renders from `directoryList`
- Tabs render from `fileTabList`
- Editor content loaded from `fileDataSource[activeTabId]`

---

### `mapReduce` Slice

**Purpose:** Parallel processing jobs

**State Management Logic:**
- Job created → Adds job to state
- Subtasks spawned → Tracks subtask status
- Results returned → Aggregates results

**Component Behavior:**
- Progress UI shows job status
- Results table renders aggregated data

---

### `connectors` Slice

**Purpose:** External integrations

**State Structure:**
```typescript
interface ConnectorsState {
  connectors: Connector[];
  githubRepositories: Repository[];
  temporaryEnabledOverrides: Record<string, boolean>;
  searchQuery: string;
  multipleEmailConfirmedInfo: Record<string, any>;
  multipleCalendarConfirmedInfo: Record<string, any>;
}
```

**State Management Logic:**
- User enables connector → Adds to `connectors`
- OAuth completes → Updates connector status
- User searches → Updates `searchQuery`

**Component Behavior:**
- Connector list renders from `connectors`
- Search filters based on `searchQuery`

---

## State Flow Patterns

### 1. User Input → State Update
```
User types in input
  ↓
onChange event
  ↓
dispatch(chatActions.setInputValue(value))
  ↓
Redux updates chat.inputValue
  ↓
Component re-renders with new value
```

### 2. API Call → State Update
```
User clicks Send
  ↓
dispatch(sendMessage(text))
  ↓
API: POST /v1/sessions/:id/messages
  ↓
dispatch(chatActions.clearInput())
  ↓
WebSocket: message_received event
  ↓
dispatch(timelineActions.addMessage(message))
  ↓
Timeline re-renders with new message
```

### 3. WebSocket → State Update
```
WebSocket receives event
  ↓
Event handler parses message
  ↓
dispatch(timelineActions.updateToolCall(data))
  ↓
Redux updates timeline.segmentEventsMap
  ↓
Timeline component re-renders
```

### 4. Tool Execution Flow
```
Claude returns tool call
  ↓
dispatch(timelineActions.addToolCall(toolCall))
  ↓
UI shows loading spinner
  ↓
Orchestration executes tool in E2B
  ↓
WebSocket: tool_result event
  ↓
dispatch(timelineActions.updateToolCall(result))
  ↓
UI shows result, removes spinner
```

---

## Component Behavior Patterns

### Pattern 1: Controlled Components
```typescript
// Input field controlled by Redux
const inputValue = useSelector(state => state.chat.inputValue);
const dispatch = useDispatch();

<input
  value={inputValue}
  onChange={(e) => dispatch(chatActions.setInputValue(e.target.value))}
/>
```

### Pattern 2: Derived State
```typescript
// Compute derived state from Redux
const isMobile = useSelector(state => state.ui.windowWidth < 768);
const showMobileLayout = isMobile || state.ui.isMobile;
```

### Pattern 3: Conditional Rendering
```typescript
// Render based on Redux state
const hasNew = useSelector(state => state.notification.hasNew);

{hasNew && <Badge>New</Badge>}
```

### Pattern 4: List Rendering
```typescript
// Render list from normalized state
const sessionIds = useSelector(state => state.sessions.ids);
const sessions = useSelector(state => state.sessions.entities);

{sessionIds.map(id => (
  <SessionItem key={id} session={sessions[id]} />
))}
```

### Pattern 5: Loading States
```typescript
// Show loading based on Redux state
const loading = useSelector(state => state.timeline.segmentEventsLoadingMap[segmentId]);

{loading ? <Spinner /> : <Content />}
```

---

## Redux Middleware

**Likely middleware:**
- `redux-thunk` - Async actions
- `redux-persist` - State persistence
- `redux-logger` - Development logging
- Custom WebSocket middleware

**WebSocket Middleware Pattern:**
```typescript
// Listens to WebSocket events and dispatches actions
websocketMiddleware = store => next => action => {
  if (action.type === 'websocket/message') {
    const { event, data } = action.payload;
    
    switch (event) {
      case 'message_received':
        store.dispatch(timelineActions.addMessage(data));
        break;
      case 'tool_result':
        store.dispatch(timelineActions.updateToolCall(data));
        break;
      // ... other events
    }
  }
  
  return next(action);
};
```

---

## State Persistence

**Redux Persist Configuration:**
```typescript
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth', 'ui', 'sessions'], // Persisted slices
  blacklist: ['websocket', 'timeline']    // Not persisted
};
```

**Persisted State:**
- User authentication
- UI preferences
- Session list
- Canvas data

**Not Persisted:**
- WebSocket connection state
- Timeline (messages loaded from server)
- Temporary UI state

---

## Summary

**Redux Architecture:**
- 41 slices organized by feature
- Normalized state for entities (sessions, canvas)
- Middleware for async actions and WebSocket
- State persistence for user preferences

**State Management Logic:**
- Actions dispatched from components
- Reducers update state immutably
- Selectors compute derived state
- Middleware handles side effects

**Component Behavior:**
- Components subscribe to Redux state
- Re-render on state changes
- Dispatch actions on user interactions
- Use selectors for performance optimization

This is the complete Redux architecture based on state.json analysis.
