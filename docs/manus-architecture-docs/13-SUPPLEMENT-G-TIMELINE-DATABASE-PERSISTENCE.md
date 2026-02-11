# Supplement G: Timeline Tracking, Database Persistence, and State Lifecycle

> **Scope:** This document covers how every event is tracked in the timeline, what is persisted in the database (both Manus platform and webdev TiDB), the exact table schemas, what is ephemeral vs. persistent, and the complete state lifecycle from creation to deletion.

---

## 1. The Three Layers of State

Manus maintains state across three distinct layers, each with different persistence characteristics, ownership, and access patterns.

| Layer | Technology | Persistence | Owner | Access |
|-------|-----------|-------------|-------|--------|
| **Frontend** | Redux (41 slices) + localStorage | Session-scoped + selective persistence via redux-persist | Browser client | Direct read/write |
| **Orchestration Backend** | Database (likely PostgreSQL/MySQL) + Redis cache | Permanent (until user deletes) | Manus API servers | HTTP + WebSocket |
| **E2B Sandbox** | Filesystem + process memory | Up to 14 days (sandbox lifetime) | E2B Firecracker VM | gRPC via start_server |

The critical insight is that the **orchestration backend is the source of truth**. The frontend Redux state is a projection of backend state, hydrated via API calls and kept in sync via WebSocket events. The sandbox filesystem is ephemeral infrastructure state that gets uploaded to S3 when files need to persist beyond the sandbox lifetime.

---

## 2. Timeline Event Architecture

### 2.1 The `timeline` Redux Slice

The timeline is the central data structure that renders the conversation view. It tracks every event that occurs during a session.

```typescript
interface TimelineState {
  segmentEventsMap: Record<string, Event[]>;  // segmentId → events array
  segmentEventsLoadingMap: Record<string, boolean>;  // segmentId → loading state
  percentage: number;  // Progress indicator (0-100)
}
```

The `segmentEventsMap` is the core structure. Each key is a **segment ID**, and the value is an ordered array of events that occurred within that segment. Segments represent logical groupings of events — typically one user message and all the agent responses, tool calls, and results that follow before the next user message.

### 2.2 Timeline Event Types

Every event in the timeline has a type that determines how it is rendered in the UI.

| Event Type | Source | Description | Rendered As |
|-----------|--------|-------------|-------------|
| `message` (role: user) | User input | User's chat message | Chat bubble (right-aligned) |
| `message` (role: assistant) | LLM response | Agent's text response | Chat bubble (left-aligned) with markdown |
| `tool_call` | LLM function call | Tool invocation started | Collapsible card with tool name + params |
| `tool_result` | Sandbox/orchestration | Tool execution completed | Result display inside tool card |
| `plan_update` | `plan` tool | Task plan created/updated | Plan sidebar with phases |
| `plan_advance` | `plan` tool | Phase advanced | Phase highlight change |
| `map_started` | `map` tool | Parallel processing began | Progress card with subtask count |
| `map_progress` | Orchestration | Subtask completed | Progress bar update |
| `map_completed` | Orchestration | All subtasks done | Results table |
| `file_uploaded` | User action | File attached to message | File preview card |
| `image_generated` | `generate` tool | Image created | Inline image display |
| `slides_created` | `slides` tool | Presentation generated | Slides preview card |
| `browser_screenshot` | `browser` tool | Page screenshot taken | Inline screenshot |
| `webdev_checkpoint` | `webdev_save_checkpoint` | Project checkpoint saved | Checkpoint card with preview |
| `error` | Any failure | Error occurred | Red error banner |

### 2.3 Event Structure

Each event in the `segmentEventsMap` follows this structure:

```typescript
interface TimelineEvent {
  type: string;           // Event type from table above
  id: string;             // Unique event ID (e.g., "msg_abc123", "toolu_def456")
  role?: string;          // "user" | "assistant" | "tool" (for messages)
  content?: string;       // Text content (for messages)
  tool?: string;          // Tool name (for tool_call events)
  toolCallId?: string;    // Tool call ID linking call to result
  status?: string;        // "pending" | "running" | "completed" | "failed"
  result?: any;           // Tool result data
  timestamp: number;      // Unix timestamp in milliseconds
  metadata?: Record<string, any>;  // Additional event-specific data
}
```

### 2.4 Segment Architecture

Segments are the pagination unit for the timeline. They enable lazy loading of conversation history.

```typescript
// In the sessions slice
interface SessionsState {
  segmentEndpoints: SegmentEndpoint[];  // Ordered list of segment boundaries
  // ...
}

interface SegmentEndpoint {
  segmentId: string;
  startEventId: string;
  endEventId: string;
  timestamp: number;
}
```

The `segmentEndpoints` array in the `sessions` slice defines the boundaries of each segment. When the user scrolls up in the conversation, the frontend uses `loadTopSegmentsLoading` and `loadBottomSegmentsLoading` flags to fetch older/newer segments from the backend API.

**Loading flow:**
1. User scrolls to top of visible timeline
2. Frontend checks `segmentEndpoints` for the next older segment
3. Dispatches `loadTopSegments` async thunk
4. `loadTopSegmentsLoading` set to `true`
5. API call: `GET /v1/sessions/:id/segments?before=:segmentId`
6. Response contains events for the requested segment
7. Events inserted into `segmentEventsMap` under the segment ID
8. `loadTopSegmentsLoading` set to `false`
9. Timeline re-renders with the new events prepended

---

## 3. Backend Database Schema (Orchestration)

The orchestration backend persists all session data in a relational database. Based on the API endpoints, WebSocket events, and data structures observed, the following tables exist.

### 3.1 Core Tables

#### `users` Table

Stores user account information, membership, and billing data.

```sql
CREATE TABLE users (
  id              BIGINT PRIMARY KEY,           -- e.g., 310519663278050818
  uid             VARCHAR(64) UNIQUE NOT NULL,   -- e.g., "UQPBfxni7R9yLHS9RacYAL"
  email           VARCHAR(320),                  -- e.g., "khaleelmusleh@gmail.com"
  displayname     VARCHAR(255),
  membership_version  VARCHAR(32),               -- "free" | "pro" | "max"
  membership_interval VARCHAR(32),               -- "monthly" | "yearly"
  membership_tier     INT,                       -- 20 for pro
  subscription_status INT,                       -- 2 = active
  concurrent_sessions INT DEFAULT 1,             -- 20 for pro
  concurrent_schedule_task_limit INT DEFAULT 1,  -- 20 for pro
  area            INT,                           -- Region code
  is_alpha        BOOLEAN DEFAULT false,
  is_beta         BOOLEAN DEFAULT false,
  sms_verified    BOOLEAN DEFAULT false,
  payment_platform VARCHAR(32),                  -- "stripe"
  current_period_end BIGINT,                     -- Unix timestamp
  cancel_at_period_end BOOLEAN DEFAULT false,
  credits_used    DECIMAL(10,2) DEFAULT 0,
  credits_limit   DECIMAL(10,2),
  last_active_at  TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### `sessions` Table

Each conversation is a session. Sessions are the top-level container for all messages and events.

```sql
CREATE TABLE sessions (
  id              VARCHAR(64) PRIMARY KEY,       -- e.g., "3Ga3tcpgGseNme5fiACp9c"
  user_id         BIGINT NOT NULL REFERENCES users(id),
  title           VARCHAR(500),                  -- Auto-generated or user-set
  model           VARCHAR(64),                   -- "claude-3.5-sonnet"
  status          VARCHAR(32) NOT NULL,          -- "active" | "completed" | "failed"
  agent_mode      VARCHAR(32),                   -- "standard" | "research" | etc.
  sandbox_id      VARCHAR(128),                  -- E2B sandbox identifier
  costed_credits  DECIMAL(10,4) DEFAULT 0,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  deleted_at      TIMESTAMP NULL                 -- Soft delete
);
```

#### `messages` Table

Every message exchanged in a session — user messages, assistant responses, and tool results.

```sql
CREATE TABLE messages (
  id              VARCHAR(64) PRIMARY KEY,       -- e.g., "msg_abc123"
  session_id      VARCHAR(64) NOT NULL REFERENCES sessions(id),
  segment_id      VARCHAR(64),                   -- Groups related events
  role            VARCHAR(32) NOT NULL,          -- "user" | "assistant" | "tool"
  content         TEXT,                          -- Message text (may be large)
  content_type    VARCHAR(32) DEFAULT 'text',    -- "text" | "markdown" | "json"
  tool_call_id    VARCHAR(64),                   -- Links tool result to tool call
  metadata        JSON,                          -- Additional structured data
  created_at      TIMESTAMP DEFAULT NOW(),
  INDEX idx_session_segment (session_id, segment_id),
  INDEX idx_session_created (session_id, created_at)
);
```

#### `tool_calls` Table

Every tool invocation is tracked separately for auditing, billing, and replay.

```sql
CREATE TABLE tool_calls (
  id              VARCHAR(64) PRIMARY KEY,       -- e.g., "toolu_abc123"
  session_id      VARCHAR(64) NOT NULL REFERENCES sessions(id),
  segment_id      VARCHAR(64),
  tool_name       VARCHAR(128) NOT NULL,         -- "shell", "file", "browser", etc.
  parameters      JSON NOT NULL,                 -- Tool input parameters
  status          VARCHAR(32) NOT NULL,          -- "pending" | "running" | "completed" | "failed"
  result          JSON,                          -- Tool output
  error           TEXT,                          -- Error message if failed
  execution_time_ms INT,                         -- How long the tool took
  started_at      TIMESTAMP,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  INDEX idx_session (session_id),
  INDEX idx_status (status)
);
```

#### `plans` Table

Task plans created by the `plan` tool are persisted for display and resumption.

```sql
CREATE TABLE plans (
  id              VARCHAR(64) PRIMARY KEY,
  session_id      VARCHAR(64) NOT NULL REFERENCES sessions(id),
  goal            TEXT NOT NULL,
  phases          JSON NOT NULL,                 -- Array of phase objects
  current_phase_id INT NOT NULL,
  status          VARCHAR(32) DEFAULT 'active',  -- "active" | "completed"
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  INDEX idx_session (session_id)
);
```

#### `files` Table

Metadata for files uploaded by users or created by the agent.

```sql
CREATE TABLE files (
  id              VARCHAR(64) PRIMARY KEY,
  session_id      VARCHAR(64) REFERENCES sessions(id),
  user_id         BIGINT REFERENCES users(id),
  filename        VARCHAR(500) NOT NULL,
  content_type    VARCHAR(128),
  size_bytes      BIGINT,
  s3_key          VARCHAR(1024),                 -- S3 object key
  cdn_url         VARCHAR(2048),                 -- Public CDN URL
  source          VARCHAR(32),                   -- "user_upload" | "agent_created" | "screenshot"
  created_at      TIMESTAMP DEFAULT NOW(),
  INDEX idx_session (session_id),
  INDEX idx_user (user_id)
);
```

### 3.2 Feature-Specific Tables

#### `scheduled_tasks` Table

```sql
CREATE TABLE scheduled_tasks (
  id              VARCHAR(64) PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  session_id      VARCHAR(64) REFERENCES sessions(id),
  name            VARCHAR(255) NOT NULL,
  prompt          TEXT NOT NULL,
  schedule_type   VARCHAR(32) NOT NULL,          -- "cron" | "interval"
  cron_expression VARCHAR(128),
  interval_seconds INT,
  repeat          BOOLEAN DEFAULT false,
  expire_at       TIMESTAMP,
  playbook        TEXT,
  status          VARCHAR(32) DEFAULT 'active',
  last_run_at     TIMESTAMP,
  next_run_at     TIMESTAMP,
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### `connectors` Table

```sql
CREATE TABLE connectors (
  id              VARCHAR(64) PRIMARY KEY,
  user_id         BIGINT NOT NULL REFERENCES users(id),
  connector_type  VARCHAR(128) NOT NULL,         -- "gmail", "github", etc.
  status          VARCHAR(32) NOT NULL,          -- "connected" | "disconnected" | "error"
  oauth_token     TEXT,                          -- Encrypted OAuth token
  refresh_token   TEXT,                          -- Encrypted refresh token
  token_expires_at TIMESTAMP,
  metadata        JSON,                          -- Connector-specific config
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);
```

#### `map_reduce_jobs` Table

```sql
CREATE TABLE map_reduce_jobs (
  id              VARCHAR(64) PRIMARY KEY,
  session_id      VARCHAR(64) NOT NULL REFERENCES sessions(id),
  name            VARCHAR(255),
  title           VARCHAR(500),
  prompt_template TEXT NOT NULL,
  target_count    INT NOT NULL,
  completed_count INT DEFAULT 0,
  status          VARCHAR(32) DEFAULT 'pending',
  output_schema   JSON NOT NULL,
  results         JSON,                          -- Aggregated results
  created_at      TIMESTAMP DEFAULT NOW(),
  completed_at    TIMESTAMP
);
```

### 3.3 WebDev-Specific Tables (TiDB)

When a user upgrades to `web-db-user`, a separate TiDB (MySQL-compatible) database is provisioned. The `DATABASE_URL` environment variable contains a UUID reference that the orchestration uses to route database queries.

The default schema created by the Drizzle ORM migration:

```sql
-- TiDB (MySQL-compatible) schema for webdev projects
CREATE TABLE users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  openId          VARCHAR(64) NOT NULL UNIQUE,   -- Manus OAuth identifier
  name            TEXT,
  email           VARCHAR(320),
  loginMethod     VARCHAR(64),
  role            ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  createdAt       TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt       TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  lastSignedIn    TIMESTAMP NOT NULL DEFAULT NOW()
);
```

The `DATABASE_URL` is **not a connection string** — it is a UUID reference (e.g., `aa41fd04-9b07-4508-b046-e6ac9daced02`). The Drizzle ORM `drizzle(process.env.DATABASE_URL)` call routes through Manus's infrastructure, which maps this UUID to the actual TiDB instance hosted externally.

---

## 4. Redis Cache Layer

The orchestration uses Redis (or equivalent in-memory cache) for transient state that needs fast access but not permanent storage.

| Cache Key Pattern | Data | TTL | Purpose |
|-------------------|------|-----|---------|
| `session:{sessionId}:state` | Session status, current model | 1 hour | Fast session lookup |
| `session:{sessionId}:context` | LLM conversation context | Session lifetime | Avoid re-loading from DB |
| `sandbox:{sandboxId}:health` | Sandbox health status | 30 seconds | Health check caching |
| `user:{userId}:credits` | Current credit usage | 5 minutes | Fast credit checks |
| `user:{userId}:sessions` | Active session list | 1 minute | Rate limiting |
| `ws:{connectionId}` | WebSocket connection metadata | Connection lifetime | Message routing |

---

## 5. Redux Persist Configuration

The frontend uses `redux-persist` to selectively persist certain slices to `localStorage`, ensuring state survives page refreshes.

```typescript
const persistConfig = {
  key: 'root',
  storage: localStorage,
  whitelist: ['auth', 'ui', 'sessions'],  // Persisted across page loads
  blacklist: ['websocket', 'timeline']     // Never persisted locally
};
```

### 5.1 What Is Persisted Locally

| Slice | Persisted? | Why |
|-------|-----------|-----|
| `auth` | Yes | User stays logged in across page refreshes |
| `ui` | Yes | Theme preference, sidebar state, window dimensions |
| `sessions` | Yes | Session list cached for instant display |
| `_persist` | Yes | Redux-persist internal metadata |
| `timeline` | **No** | Always loaded fresh from server (source of truth) |
| `websocket` | **No** | Connection state is transient |
| `chat` | **No** | Input cleared on refresh |
| `notification` | **No** | Fetched fresh from server |
| `webDev` | Partial | Project reference persisted, preview state not |
| `connectors` | Partial | Connector list cached, tokens not stored locally |

### 5.2 Hydration Flow on Page Load

```
1. Browser loads React app
   ↓
2. Redux store created with initial state
   ↓
3. redux-persist reads localStorage
   ↓
4. Persisted slices (auth, ui, sessions) rehydrated
   ↓
5. App renders with cached data (instant display)
   ↓
6. useEffect hooks fire API calls:
   - GET /v1/user → Refresh auth state
   - GET /v1/sessions → Refresh session list
   - WebSocket connect → Subscribe to updates
   ↓
7. API responses update Redux state
   ↓
8. If session selected:
   - GET /v1/sessions/:id/segments → Load timeline segments
   - Events populate segmentEventsMap
   ↓
9. Timeline renders with server data (source of truth)
```

---

## 6. Complete State Change Lifecycle

### 6.1 Message Send → Full Lifecycle

This traces every state change from user typing to final response display.

**Phase 1: User Types**
```
Keystroke event
  → dispatch(chatActions.setInputValue(text))
  → Redux: chat.inputValue = "Create a file called test.txt"
  → Input component re-renders
```

**Phase 2: User Clicks Send**
```
Click/Enter event
  → dispatch(sendMessage(text))  // async thunk
  → Redux: chat.inputValue = ""
  → Redux: chat.files = []
  → HTTP: POST /v1/sessions/:id/messages { role: "user", content: "..." }
```

**Phase 3: Backend Receives Message**
```
Backend:
  → INSERT INTO messages (id, session_id, role, content, created_at)
  → Load conversation history from messages table
  → Load tool definitions (29 tools)
  → Build system prompt
  → POST https://api.anthropic.com/v1/messages (Claude API)
```

**Phase 4: WebSocket — Message Acknowledged**
```
WebSocket event: { type: "message", role: "user", id: "msg_001", ... }
  → dispatch(timelineActions.addMessage(event))
  → Redux: timeline.segmentEventsMap[segmentId].push(userMessage)
  → Timeline component re-renders with user message
```

**Phase 5: LLM Returns Tool Call**
```
Claude response: { tool_calls: [{ id: "toolu_001", name: "file", arguments: {...} }] }
Backend:
  → INSERT INTO tool_calls (id, session_id, tool_name, parameters, status)
  → WebSocket: { type: "tool_call", toolCallId: "toolu_001", toolName: "file", ... }
```

**Phase 6: WebSocket — Tool Call Started**
```
WebSocket event: { type: "tool_call", ... }
  → dispatch(timelineActions.addToolCall(event))
  → Redux: timeline.segmentEventsMap[segmentId].push(toolCallEvent)
  → Redux: timeline.segmentEventsLoadingMap[segmentId] = true
  → UI shows loading spinner with "Writing file..." text
```

**Phase 7: Tool Executes in Sandbox**
```
Backend → E2B Sandbox (gRPC via start_server on port 8330):
  → File write operation executes
  → Result returned to orchestration
Backend:
  → UPDATE tool_calls SET status='completed', result='{...}', completed_at=NOW()
  → WebSocket: { type: "tool_result", toolCallId: "toolu_001", status: "completed", ... }
```

**Phase 8: WebSocket — Tool Result**
```
WebSocket event: { type: "tool_result", ... }
  → dispatch(timelineActions.updateToolCall(event))
  → Redux: Find tool call in segmentEventsMap, update status to "completed"
  → Redux: timeline.segmentEventsLoadingMap[segmentId] = false
  → UI removes spinner, shows result
```

**Phase 9: LLM Final Response**
```
Backend:
  → Add tool result to conversation context
  → POST https://api.anthropic.com/v1/messages (second Claude call)
  → Claude returns text response
  → INSERT INTO messages (id, session_id, role, content) VALUES ('msg_002', ..., 'assistant', '...')
  → WebSocket: { type: "message", role: "assistant", content: "I've created the file..." }
```

**Phase 10: WebSocket — Assistant Message**
```
WebSocket event: { type: "message", role: "assistant", ... }
  → dispatch(timelineActions.addMessage(event))
  → Redux: timeline.segmentEventsMap[segmentId].push(assistantMessage)
  → Timeline renders assistant message with markdown
```

**Phase 11: Task Finished**
```
WebSocket event: { type: "task_finished", creditsUsed: 0.5 }
  → dispatch(websocketActions.taskFinished())
  → Redux: websocket.taskFinished = true
  → dispatch(authActions.updateCredits(0.5))
  → Redux: auth.usageInfo.creditsUsed += 0.5
  → UI: "Processing..." indicator hidden, credit display updated
```

**Backend final state:**
```sql
-- sessions table
UPDATE sessions SET costed_credits = costed_credits + 0.5, updated_at = NOW() WHERE id = 'abc123';

-- users table
UPDATE users SET credits_used = credits_used + 0.5, last_active_at = NOW() WHERE id = '310519663278050818';
```

### 6.2 State Changes Per Message (Summary)

| Layer | Changes | Count |
|-------|---------|-------|
| **Frontend Redux** | chat.inputValue, chat.files, timeline.segmentEventsMap (4 events), timeline.segmentEventsLoadingMap, websocket.taskFinished, auth.usageInfo | ~8 dispatches |
| **Backend Database** | sessions (update), messages (2 inserts), tool_calls (insert + update), users (update) | ~6 SQL operations |
| **Redis Cache** | session state, credit cache, context update | ~3 cache writes |
| **E2B Sandbox** | File created on filesystem | 1 file operation |
| **WebSocket** | 5-6 messages (user msg, tool_call, tool_result, assistant msg, task_finished) | ~5 events |

---

## 7. Session Lifecycle

### 7.1 Session Creation

```
User opens manus.im/app
  → Frontend checks auth (localStorage + API)
  → GET /v1/sessions → Load session list
  → User clicks "New Chat" or sends first message
  → POST /v1/sessions { title: "New Chat", model: "claude-3.5-sonnet", agentMode: "standard" }
  → Backend: INSERT INTO sessions (...)
  → Backend: Assign sandbox (reuse existing or create new)
  → Response: { sessionId: "abc123", sandboxId: "...", ... }
  → Redux: sessions.entities["abc123"] = newSession
  → Redux: sessions.ids.push("abc123")
  → Redux: sessions.currentSessionId = "abc123"
  → WebSocket: Subscribe to session "abc123"
```

### 7.2 Session Resumption

When a user returns to an existing session:

```
User clicks session in sidebar
  → dispatch(sessions.setCurrentSession("abc123"))
  → Redux: sessions.currentSessionId = "abc123"
  → GET /v1/sessions/abc123/segments?limit=20
  → Response: { segments: [...], segmentEndpoints: [...] }
  → dispatch(timelineActions.loadSegments(segments))
  → Redux: timeline.segmentEventsMap populated with events
  → Redux: sessions.segmentEndpoints = [...]
  → Timeline renders conversation history
  → WebSocket: Subscribe to session "abc123"
```

### 7.3 Session Deletion

```
User clicks delete on session
  → DELETE /v1/sessions/abc123
  → Backend: UPDATE sessions SET deleted_at = NOW() WHERE id = 'abc123'  (soft delete)
  → Redux: Remove from sessions.entities and sessions.ids
  → Redux: Clear timeline.segmentEventsMap for that session
  → If was current session: redirect to session list
```

---

## 8. What Lives Where (Complete Map)

| Data | Frontend (Redux) | Backend (DB) | Sandbox (FS) | S3/CDN | Redis |
|------|------------------|-------------|--------------|--------|-------|
| User profile | auth slice | users table | - | - | user cache |
| Session list | sessions slice | sessions table | - | - | session cache |
| Messages | timeline slice | messages table | - | - | context cache |
| Tool calls | timeline slice | tool_calls table | - | - | - |
| Plans | agentWorkspace | plans table | - | - | - |
| Files (user uploaded) | fileManagement | files table | /home/ubuntu/ | CDN URL | - |
| Files (agent created) | timeline (as events) | files table | /home/ubuntu/ | CDN URL | - |
| Screenshots | myBrowser slice | files table | /home/ubuntu/screenshots/ | CDN URL | - |
| Browser state | myBrowser slice | - | Chromium process | - | - |
| Browser cookies | - | - | StateSync | - | - |
| Shell sessions | - | - | PTY processes | - | - |
| Scheduled tasks | scheduledTask slice | scheduled_tasks table | - | - | - |
| Connectors | connectors slice | connectors table | - | - | - |
| Map/reduce jobs | mapReduce slice | map_reduce_jobs table | subtask sandboxes | - | - |
| WebDev projects | webDev slice | webdev tables | project directory | CDN (assets) | - |
| Canvas data | aiCanvas slice | canvas tables | - | - | - |
| Notifications | notification slice | notifications table | - | - | - |
| Credits/billing | auth slice | users table | - | - | credit cache |
| UI preferences | ui slice | - | - | - | - |
| WebSocket state | websocket slice | - | - | - | ws connections |

---

## 9. Data Retention and Cleanup

| Data Type | Retention | Cleanup Trigger |
|-----------|----------|----------------|
| User account | Permanent | User deletion request |
| Sessions | Permanent (soft delete) | User deletes session |
| Messages | Permanent (soft delete) | Session deletion |
| Tool calls | Permanent | Session deletion |
| Files on S3 | Permanent | Manual cleanup |
| Sandbox filesystem | Up to 14 days | Sandbox hibernation/termination |
| Redis cache | TTL-based (1 min - 1 hour) | Automatic expiry |
| localStorage | Until cleared | User clears browser data |
| Browser cookies (sandbox) | StateSync managed | Sandbox termination |

---

## 10. Consistency Guarantees

The system uses **eventual consistency** between the three layers:

1. **Backend is source of truth** — All data originates from or is validated by the backend database.

2. **Frontend is a projection** — Redux state is populated from API responses and WebSocket events. If the frontend state diverges (e.g., due to a missed WebSocket event), a page refresh re-fetches from the backend.

3. **Sandbox is ephemeral infrastructure** — Files exist in the sandbox for tool execution. When files need to be shown to the user or persist beyond the session, they are uploaded to S3 and the CDN URL is stored in the backend.

4. **WebSocket provides real-time sync** — Events flow from backend to frontend via WebSocket, keeping the timeline in sync without polling. If the WebSocket disconnects, the frontend reconnects and re-subscribes, potentially missing events that are caught up via API calls.

5. **No cross-sandbox state** — Each user has one sandbox, but there is no state sharing between different users' sandboxes. The sandbox is isolated at the Firecracker VM level.
