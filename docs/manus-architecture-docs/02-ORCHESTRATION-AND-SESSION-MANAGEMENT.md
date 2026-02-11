# Part 2: Orchestration and Session Management

## 2.1 Orchestration Overview

The **Orchestration Layer** is the brain of Manus. It sits between the user's frontend and the E2B sandbox, managing all communication, LLM calls, tool routing, session state, and billing.

**Host:** `api.manus.im`
**Internal Gateway:** `10.93.83.1` (as seen from E2B sandbox)

---

## 2.2 The LLM Architecture

### Primary LLM: Claude 3.5 Sonnet (Anthropic)

The main orchestrating LLM is **Claude 3.5 Sonnet**. This is the "brain" that:
- Reads user messages
- Creates plans
- Decides which tools to call
- Processes tool results
- Generates responses

**Called by:** Orchestration layer (NOT from within E2B sandbox)
**API:** `api.anthropic.com`

### Secondary LLMs: OpenAI + Google (In-Sandbox)

For parallel processing and user code, these models are available inside E2B sandboxes:

| Model | Provider | Available In Sandbox | Purpose |
|-------|----------|---------------------|---------|
| `gpt-4.1-mini` | OpenAI | ✅ Yes | Subtask processing |
| `gpt-4.1-nano` | OpenAI | ✅ Yes | Lightweight tasks |
| `gemini-2.5-flash` | Google | ✅ Yes | Alternative model |
| `claude-*` | Anthropic | ❌ Blocked | Only in orchestration |

**Key insight:** Claude models are **blocked** from being called inside E2B sandboxes. This confirms Claude runs in the orchestration layer, while OpenAI/Google models handle subtask work inside sandboxes.

**LLM Proxy:** All in-sandbox LLM calls route through:
```
https://api.manus.im/api/llm-proxy/v1
```

---

## 2.3 What "Session" Actually Means

"Session" in Manus refers to **three distinct but related concepts:**

### Session Type 1: Manus Session (Conversation)

A conversation between you and Manus. Created by the orchestrator when you start a new chat.

**Properties:**
```typescript
interface ManusSession {
  uid: string;              // e.g., "3Ga3tcpgGseNme5fiACp9c"
  title: string;            // e.g., "Daily Weather Forecast Email for Zagreb"
  status: "active" | "completed" | "failed";
  createdAt: string;        // ISO timestamp
  updatedAt: string;        // ISO timestamp
  costedCredits: number;    // e.g., 27
  messages: Message[];      // Conversation history
  timeline: TimelineEvent[];// All events (messages, tool calls, plans)
}
```

**Created by:** Orchestrator (when you start a new chat)
**Stored in:** Orchestration database
**Tracked in:** Redux `sessions` slice (frontend)

### Session Type 2: E2B Sandbox

The compute environment allocated for your account.

**Properties:**
- IP: `169.254.0.21`
- Shared across ALL your conversations
- Persistent (survives hibernation)
- One sandbox per user account

**Created by:** Orchestrator (when first needed)
**Managed by:** E2B infrastructure

### Session Type 3: Neko Session (WebRTC Streaming)

The browser streaming session for viewing the Manus Computer.

**Properties:**
- Authenticated with `NEKO_USERNAME` + `NEKO_USER_PASSWORD`
- WebRTC connection via Cloudflare TURN servers
- Streams Display :0 (Chromium browser)

**Created by:** Frontend (when user opens Manus Computer view)
**Managed by:** Neko server in E2B sandbox

---

## 2.4 Session Creation Flow

### Step 1: User Starts New Chat

```
User clicks "New Chat" in frontend
    ↓
Frontend: dispatch(createSession())
    ↓
HTTP: POST /v1/sessions
Headers: {
  Authorization: Bearer <user_token>
}
Body: {
  taskMode: "standard"
}
    ↓
Response: {
  uid: "abc123",
  title: "",
  status: "active",
  createdAt: "2026-02-10T...",
  costedCredits: 0
}
```

### Step 2: Orchestrator Allocates Resources

```
Orchestrator receives session creation request
    ↓
Checks if user has existing E2B sandbox
    ├── YES: Reuse existing sandbox (169.254.0.21)
    └── NO: Spin up new E2B sandbox (~150ms)
    ↓
Injects environment variables into sandbox
    ↓
Establishes WebSocket connection to start_server (port 8330)
    ↓
Returns session info to frontend
```

### Step 3: Frontend Connects

```
Frontend receives session info
    ↓
Establishes WebSocket to orchestration:
  wss://api.manus.im/ws?sessionId=abc123&token=<user_token>
    ↓
Redux updates:
  - sessions.entities["abc123"] = sessionData
  - sessions.ids.push("abc123")
    ↓
UI renders new chat interface
```

### Step 4: Neko Connection (When User Opens Browser View)

```
User clicks "Manus Computer" button
    ↓
Frontend connects to Neko:
  wss://<neko-proxy>/ws?password=eee5e523ca12466a
    ↓
WebRTC negotiation via Cloudflare TURN
    ↓
Browser video stream begins (H.264, 30fps)
    ↓
User sees live browser view
```

---

## 2.5 Message Flow (Complete)

### When User Sends a Message:

```
STEP 1: USER INPUT
├── User types message
├── Redux: chat.inputValue = "Create a Python script"
├── User clicks Send
└── Redux: chat.inputValue = "" (cleared)

STEP 2: FRONTEND → ORCHESTRATION
├── HTTP: POST /v1/sessions/abc123/messages
│   Body: {
│     role: "user",
│     content: "Create a Python script",
│     files: []
│   }
├── Response: 202 Accepted
└── Redux: timeline adds user message event

STEP 3: ORCHESTRATION PROCESSES
├── Stores user message in database
├── Loads conversation history
├── WebSocket → Frontend: { event: "thinking", status: "started" }
├── Constructs LLM request with:
│   - System prompt (instructions, tools, context)
│   - Conversation history
│   - 29 tool definitions
│   - User's latest message
└── HTTP: POST api.anthropic.com/v1/messages
    Body: {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 8192,
      system: "<system_prompt>",
      messages: [...conversation_history],
      tools: [
        { name: "message_notify_user", ... },
        { name: "file_write", ... },
        { name: "shell_exec", ... },
        ... (29 tools total)
      ]
    }

STEP 4: CLAUDE RESPONDS WITH TOOL CALL
├── Claude returns:
│   {
│     role: "assistant",
│     content: [
│       { type: "tool_use", name: "file_write",
│         input: { path: "/home/ubuntu/script.py", content: "..." } }
│     ]
│   }
├── Orchestration stores tool call in database
├── WebSocket → Frontend: { event: "tool_call", tool: "file_write", status: "executing" }
└── Redux: timeline adds tool_call event with loading state

STEP 5: TOOL EXECUTION
├── Orchestration routes tool to E2B sandbox
├── TCP: 10.93.83.1:<random_port> → 169.254.0.21:8330
├── start_server receives request
├── Writes file to /home/ubuntu/script.py
├── Returns: { success: true }
├── TCP connection closes
├── Orchestration stores tool result in database
├── WebSocket → Frontend: { event: "tool_result", status: "completed" }
└── Redux: timeline updates tool_call event (loading → completed)

STEP 6: CLAUDE PROCESSES RESULT
├── Orchestration sends tool result back to Claude:
│   HTTP: POST api.anthropic.com/v1/messages
│   Body: {
│     messages: [...previous + tool_result],
│     tools: [... same 29 tools]
│   }
├── Claude responds:
│   {
│     role: "assistant",
│     content: [
│       { type: "text", text: "I've created the Python script..." }
│     ]
│   }
└── Orchestration stores assistant message

STEP 7: RESPONSE TO USER
├── WebSocket → Frontend: { event: "message", role: "assistant", content: "..." }
├── Redux: timeline adds assistant message event
├── Redux: timeline.percentage = 100
├── Database: UPDATE sessions SET costedCredits = costedCredits + N
└── WebSocket → Frontend: { event: "credits_update", credits: N }
```

---

## 2.6 Orchestrator Responsibilities

| Responsibility | How |
|---------------|-----|
| **Session management** | Creates, updates, deletes sessions in database |
| **Message routing** | Routes user messages to Claude, tool calls to sandbox |
| **LLM calls** | Calls Anthropic API for Claude, proxies OpenAI for subtasks |
| **Tool routing** | Routes sandbox tools to E2B, handles orchestration tools locally |
| **State management** | Stores plans, messages, tool calls in database |
| **WebSocket streaming** | Streams events to frontend in real-time |
| **Credit tracking** | Tracks and deducts credits per operation |
| **File management** | Uploads files to S3, serves via CDN |
| **Connector management** | Routes MCP calls to external services |
| **Sandbox lifecycle** | Allocates, hibernates, resumes E2B sandboxes |

---

## 2.7 The Planner

The planner is a feature of the orchestrating LLM (Claude). When Claude calls the `plan` tool:

### Plan Creation:
```
Claude: plan.update({
  goal: "Build a landing page",
  phases: [
    { id: 1, title: "Design brainstorming" },
    { id: 2, title: "Generate images" },
    { id: 3, title: "Implement frontend" },
    { id: 4, title: "Deliver to user" }
  ],
  current_phase_id: 1
})
```

### Plan Storage:
```
Orchestration receives plan update
    ↓
Stores plan in database (associated with session)
    ↓
WebSocket → Frontend: { event: "plan_update", plan: {...} }
    ↓
Redux: timeline adds plan event
    ↓
UI renders planner widget in timeline
```

### Plan Advancement:
```
Claude: plan.advance({
  current_phase_id: 1,
  next_phase_id: 2
})
    ↓
Orchestration updates plan in database
    ↓
WebSocket → Frontend: { event: "plan_advance", phase: 2 }
    ↓
Redux: timeline updates plan event
    ↓
UI shows Phase 1 ✓ completed, Phase 2 → current
```

### Planner UI States:
```
📋 Task Plan
Goal: Build a landing page

✓ Phase 1: Design brainstorming        [completed]
→ Phase 2: Generate images              [current - highlighted]
  Phase 3: Implement frontend           [pending]
  Phase 4: Deliver to user              [pending]

Progress: ████████░░░░░░░░ 50%
```

---

## 2.8 Credit System

Each session tracks credit usage:

```typescript
interface CreditTracking {
  costedCredits: number;  // Total credits used
  // Breakdown:
  // - LLM calls: ~15 credits per message cycle
  // - Tool executions: ~1-2 credits each
  // - File operations: ~1 credit each
  // - Browser operations: ~2 credits each
  // - Parallel processing: credits per subtask
}
```

**Example:** A session titled "Daily Weather Forecast Email for Zagreb" used **27 credits**.

---

## 2.9 Parallel Processing (map/reduce)

When Claude uses the `map` tool for parallel processing:

```
STEP 1: CLAUDE DECIDES
├── Claude: map({
│     prompt_template: "Research {{input}}",
│     inputs: ["Company A", "Company B", "Company C"],
│     target_count: 3
│   })

STEP 2: ORCHESTRATION SPAWNS SANDBOXES
├── Creates 3 new E2B sandboxes
├── Each gets same environment variables (OPENAI_API_KEY, etc.)
├── Each runs independently

STEP 3: SUBTASK EXECUTION
├── Sandbox A (169.254.0.X):
│   └── Calls gpt-4.1-mini via LLM proxy → Researches "Company A"
├── Sandbox B (169.254.0.Y):
│   └── Calls gpt-4.1-mini via LLM proxy → Researches "Company B"
├── Sandbox C (169.254.0.Z):
│   └── Calls gpt-4.1-mini via LLM proxy → Researches "Company C"

STEP 4: AGGREGATION
├── Orchestration collects results from all 3 sandboxes
├── Destroys subtask sandboxes
├── Returns aggregated results to Claude (main LLM)

STEP 5: CLAUDE PROCESSES
├── Claude formats results
└── Returns final response to user
```

**Network topology during parallel processing:**
```
Orchestration (10.93.83.1)
    ├→ Main Sandbox (169.254.0.21:8330) ← Claude (main LLM)
    ├→ Subtask A (169.254.0.X:8330) ← gpt-4.1-mini
    ├→ Subtask B (169.254.0.Y:8330) ← gpt-4.1-mini
    └→ Subtask C (169.254.0.Z:8330) ← gpt-4.1-mini
```

---

## 2.10 Database Operations

### Session Database (Orchestration):

**Tables (inferred):**
- `sessions` - Session metadata
- `messages` - Message history
- `tool_calls` - Tool execution log
- `plans` - Task plans
- `users` - User accounts and credits

**Operations per message cycle:**
```
1. INSERT INTO messages (user message)
2. INSERT INTO tool_calls (tool execution)
3. UPDATE tool_calls SET status = 'completed'
4. INSERT INTO messages (assistant response)
5. UPDATE sessions SET costedCredits = costedCredits + N
```

### User Database (TiDB):

For user-created web applications, Manus provides TiDB:
- **NOT running in E2B sandbox**
- Hosted externally by Manus
- Accessed via UUID identifier: `DATABASE_URL=aa41fd04-9b07-4508-b046-e6ac9daced02`
- Proxied through Manus API

---

## 2.11 File Storage Flow

### Files Created in Sandbox:
```
AI creates file → /home/ubuntu/filename.ext (stays in sandbox)
```

### Files Delivered to User:
```
AI calls message(attachments=["/home/ubuntu/filename.ext"])
    ↓
Orchestration reads file from sandbox via WebSocket
    ↓
Uploads to S3: s3://manus-user-files/{user_id}/{session_id}/filename.ext
    ↓
CDN URL generated: https://cdn.manus.im/files/...
    ↓
Frontend receives CDN URL
    ↓
User downloads from CDN
```

### Webdev Static Assets:
```
Images/media in webdev project
    ↓
AI calls: manus-upload-file image.png
    ↓
Uploaded to S3
    ↓
CDN URL returned
    ↓
Code references CDN URL (not local path)
```
