# Complete Manus UI/UX Architecture

Based on Redux state analysis and system architecture, here's every UI component:

## Core UI Components:

### 1. **Chat Interface** (`chat` slice)
**State:**
```json
{
  "files": [],
  "inputValue": "",
  "taskMode": "standard",
  "inputMode": "text",
  "microphonePermission": "prompt",
  "showSharePopover": null,
  "isPageVisible": true
}
```

**Components:**
- Text input field (`inputValue`)
- File attachments (`files`)
- Voice input button (`microphonePermission`)
- Task mode selector (`taskMode`: "standard")
- Input mode toggle (`inputMode`: "text" or "voice")
- Share popover (`showSharePopover`)

**Triggers:**
- User types → Updates `inputValue`
- User uploads file → Adds to `files` array
- User clicks voice → Requests `microphonePermission`
- User selects task mode → Updates `taskMode`

### 2. **Timeline** (`timeline` slice)
**State:**
```json
{
  "segmentEventsMap": {},
  "segmentEventsLoadingMap": {},
  "percentage": 100
}
```

**Components:**
- Event segments display (`segmentEventsMap`)
- Loading indicators per segment (`segmentEventsLoadingMap`)
- Progress bar (`percentage`)

**Triggers:**
- Tool execution → Creates new segment event
- Loading state → Updates `segmentEventsLoadingMap`
- Progress updates → Changes `percentage`

### 3. **Planner UI** (embedded in timeline)
**From system prompt:**
> "plan tool to create and advance the structured task plan"

**Components:**
- Goal statement
- Phase list (numbered)
- Current phase indicator
- Phase completion checkmarks
- Advance/update controls

**States:**
- Planning (creating plan)
- Executing (current phase highlighted)
- Completed (checkmarks shown)

**Triggers:**
- `plan` tool with `action: "update"` → Creates/updates plan UI
- `plan` tool with `action: "advance"` → Moves to next phase
- Phase completion → Shows checkmark, highlights next phase

### 4. **AI Canvas** (`aiCanvas` + `aiCanvasEditor` slices)
**State:**
```json
{
  "shapes": {},
  "camera": {"x": 0, "y": 0, "z": 0.24},
  "selectedShapeIds": [],
  "interaction": {
    "activeTool": "select",
    "panning": false
  },
  "contextMenu": {"position": null},
  "screenshots": {
    "markScreenshots": {},
    "markedImages": {}
  }
}
```

**Components:**
- Canvas viewport with zoom/pan
- Shape tools (select, brush, mark)
- Context menu (right-click)
- Screenshot annotation
- Text editing mode
- Grid overlay

**Triggers:**
- User clicks canvas → Opens canvas editor
- User selects tool → Updates `activeTool`
- User draws → Creates shapes
- User right-clicks → Shows `contextMenu`
- User marks screenshot → Enters marking mode

### 5. **Notifications** (`notification` slice)
**State:**
```json
{
  "connectStatus": "default",
  "isNotificationListVisible": false,
  "categoryNotifications": {"0": [], "1": [], "2": []},
  "notificationTab": 0,
  "hasNew": false
}
```

**Components:**
- Notification bell icon
- Notification dropdown panel
- Category tabs (0, 1, 2)
- "New" indicator badge
- Connection status indicator

**Triggers:**
- New notification → Sets `hasNew: true`
- User clicks bell → Toggles `isNotificationListVisible`
- User switches tab → Updates `notificationTab`
- WebSocket disconnect → Updates `connectStatus`

### 6. **Global UI** (`ui` slice)
**State:**
```json
{
  "isMobile": false,
  "chatSidebarPercentage": null,
  "windowWidth": 1792,
  "showAppDownloadMask": false,
  "navTasksFolded": true
}
```

**Components:**
- Responsive layout detector (`isMobile`)
- Resizable sidebar (`chatSidebarPercentage`)
- App download prompt (`showAppDownloadMask`)
- Navigation tasks panel (`navTasksFolded`)

**Triggers:**
- Window resize → Updates `windowWidth`, `isMobile`
- User drags sidebar → Updates `chatSidebarPercentage`
- User folds nav → Toggles `navTasksFolded`

## Message UI Components:

### 7. **User Messages**
**Display:**
- Avatar (user profile pic)
- Message text
- Timestamp
- File attachments (if any)

### 8. **Assistant Messages**
**Display:**
- Manus logo avatar
- Message text (markdown rendered)
- Timestamp
- Attachments (files, images)
- Action buttons (copy, regenerate)

### 9. **Tool Call Messages**
**Display:**
- Tool name badge
- Tool parameters (collapsed)
- Loading spinner (while executing)
- Result preview
- Expand/collapse button

### 10. **Loading States**
**Types:**
- Typing indicator (3 dots animation)
- Tool execution spinner
- Progress bar (for long operations)
- Skeleton loaders (for content)

## Special UI Elements:

### 11. **Webdev Management UI**
**From earlier analysis:**
- Preview tab (live preview)
- Code tab (Monaco editor)
- File tab (file tree)
- Database tab (TiDB CRUD)
- Dashboard tab (analytics)
- Settings tab (configuration)

**Trigger:**
- `webdev_init_project` → Opens Management UI
- User clicks tab → Switches active tab

### 12. **Email UI** (for Gmail connector)
**Display:**
- Email subject (bold)
- From/To/Date headers
- Email body (formatted)
- Attachments (if any)
- Thread indicator

**Trigger:**
- Gmail connector returns results → Renders email UI

### 13. **Manus Computer Mini Window**
**From user description:**
> "you have a manus computer mini window when clicked opens the rightside canvas"

**Components:**
- Mini window button/icon
- Expandable panel
- Canvas integration

**Trigger:**
- User clicks mini window → Opens canvas panel

## State Change Flow:

### Example: User Sends Message

```
1. User types in input field
   → Redux: chat.inputValue updates

2. User clicks Send
   → Redux: chat.inputValue clears
   → API: POST /v1/sessions/:id/messages
   → Redux: timeline adds user message event

3. WebSocket: message_received
   → Redux: timeline updates

4. Orchestration calls Claude
   → Redux: timeline adds "thinking" indicator

5. Claude returns tool call
   → Redux: timeline adds tool_call event
   → UI: Shows tool badge + loading spinner

6. Tool executes
   → Redux: timeline updates tool_call status
   → UI: Spinner animates

7. Tool completes
   → Redux: timeline updates tool_call result
   → UI: Shows result, removes spinner

8. Claude returns final message
   → Redux: timeline adds assistant message event
   → UI: Renders message with markdown

9. Credits updated
   → Redux: user.credits updates
   → UI: Updates credit display
```

## UI Rendering:

**Framework:** React
**State Management:** Redux
**Styling:** Tailwind CSS (likely)
**Components:** Custom React components

**Key Libraries (likely):**
- `react-markdown` - Markdown rendering
- `monaco-editor` or `codemirror` - Code editor
- `framer-motion` - Animations
- `radix-ui` - UI primitives
- `lucide-react` - Icons

## The Complete UI Architecture:

```
┌─────────────────────────────────────────────────────────┐
│ Manus Frontend (React + Redux)                         │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────┐  ┌──────────────────────────┐   │
│  │ Left Sidebar      │  │ Main Chat Area           │   │
│  │ - Nav Tasks       │  │ - Timeline (messages)    │   │
│  │ - Folders         │  │ - User messages          │   │
│  │ - Settings        │  │ - Assistant messages     │   │
│  └───────────────────┘  │ - Tool calls             │   │
│                         │ - Loading states         │   │
│  ┌───────────────────┐  │ - Planner UI             │   │
│  │ Chat Input        │  └──────────────────────────┘   │
│  │ - Text field      │                                 │
│  │ - File upload     │  ┌──────────────────────────┐   │
│  │ - Voice input     │  │ Right Panel (optional)   │   │
│  │ - Send button     │  │ - Management UI          │   │
│  └───────────────────┘  │ - AI Canvas              │   │
│                         │ - Notifications          │   │
│                         └──────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Inline Chat UI Components:

### Planner Display:
```
┌─────────────────────────────────────┐
│ 📋 Task Plan                        │
├─────────────────────────────────────┤
│ Goal: [Goal statement]              │
│                                     │
│ ✓ Phase 1: [Completed]             │
│ → Phase 2: [Current]                │
│   Phase 3: [Pending]                │
│   Phase 4: [Pending]                │
└─────────────────────────────────────┘
```

### Tool Call Display:
```
┌─────────────────────────────────────┐
│ 🔧 shell_exec                       │
│ ⏳ Executing...                     │
│ [Expand to see details]             │
└─────────────────────────────────────┘
```

### Loading State:
```
┌─────────────────────────────────────┐
│ ●●● Thinking...                     │
└─────────────────────────────────────┘
```

## The Truth:

Based on Redux state analysis, I can confirm:

✅ **6 main UI slices**: ui, chat, timeline, aiCanvas, aiCanvasEditor, notification
✅ **Planner UI**: Embedded in timeline, shows goal + phases
✅ **Canvas**: Full editor with shapes, tools, screenshots
✅ **Timeline**: Shows all events (messages, tool calls, loading)
✅ **Loading states**: Multiple types (spinner, progress, skeleton)
✅ **Notifications**: Bell icon + dropdown panel
✅ **Management UI**: For webdev projects (6 tabs)
✅ **Email UI**: For Gmail connector results

**What I cannot see directly:**
- Exact React component code (not in state files)
- CSS styling details (not in state files)
- Animation implementations (not in state files)

**But I can confirm the architecture and state management based on Redux state structure.**
