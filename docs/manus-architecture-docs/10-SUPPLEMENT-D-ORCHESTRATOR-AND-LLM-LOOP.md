# Supplement D: Orchestrator Planning and LLM Agent Loop

## D.1 Overview

The Manus orchestrator is the central control plane that sits between the user's browser, the LLM, and the E2B sandbox. It manages sessions, routes messages, handles the LLM agent loop (plan → act → observe → repeat), manages sandbox lifecycle, and streams results back to the user in real time. This document traces every step of how the orchestrator works, from the moment a user sends a message to the final response delivery.

---

## D.2 The Orchestrator's Role

The orchestrator lives at `api.manus.im` (internal IP `10.9.181.1`) and performs these functions:

| Function | Description |
|----------|-------------|
| **Session Management** | Creates, tracks, and destroys conversation sessions |
| **Sandbox Lifecycle** | Spins up, hibernates, resumes, and destroys E2B sandboxes |
| **LLM Agent Loop** | Sends messages to LLM, receives tool calls, executes them, feeds results back |
| **Tool Routing** | Routes tool calls to the correct execution layer (sandbox, search API, frontend) |
| **Streaming** | Streams LLM responses and tool results to the frontend in real time |
| **File Transfer** | Moves files between sandbox, S3, CDN, and frontend |
| **Billing** | Tracks credits consumed per session |
| **Observability** | Sends traces to OpenTelemetry, errors to Sentry |

---

## D.3 Session Creation Flow

When a user starts a new conversation:

```
Step 1: User clicks "New Chat" in Manus UI
    ↓
Step 2: Frontend → Orchestration:
    POST https://api.manus.im/v1/sessions
    Headers: { Authorization: Bearer <user_jwt> }
    Body: { "title": "New Chat" }
    ↓
Step 3: Orchestration creates session:
    {
      "uid": "session_abc123",
      "user_id": "310519663278050818",
      "title": "New Chat",
      "status": "active",
      "created_at": "2026-02-09T14:00:00Z",
      "sandbox_id": null  // Not yet assigned
    }
    ↓
Step 4: Orchestration checks for existing sandbox:
    ├── User has active sandbox? → Reuse it
    └── No active sandbox? → Spin up new one:
        E2B API → Create sandbox from template (~150ms)
        Assign sandbox_id to session
    ↓
Step 5: Orchestration → Sandbox (WebSocket on port 8330):
    { "type": "init", "session_id": "session_abc123" }
    ↓
Step 6: Sandbox → Orchestration:
    { "type": "ready", "status": "ok" }
    ↓
Step 7: Orchestration → Frontend (WebSocket):
    { "type": "session_created", "session_id": "session_abc123" }
    ↓
Step 8: Frontend updates Redux state:
    dispatch(sessionsActions.addSession({ uid: "session_abc123", ... }))
```

**Key detail:** Multiple sessions (conversations) share the SAME sandbox. The orchestrator routes to the existing sandbox if one is already running for this user.

---

## D.4 The System Prompt Assembly

Before the first LLM call, the orchestrator assembles a massive system prompt. This prompt defines the LLM's identity, capabilities, tools, and constraints.

**System Prompt Structure:**
```
1. Identity: "You are Manus, an autonomous general AI agent..."
2. Language rules
3. Format rules (Markdown, professional style)
4. Agent loop description (analyze → think → select tool → execute → observe → iterate)
5. Tool use rules (exactly one tool per response, function calling only)
6. Error handling rules
7. Sandbox description (OS, packages, browser, Python, Node.js)
8. Utilities description (manus-render-diagram, manus-md-to-pdf, etc.)
9. Secrets (environment variables available)
10. Disclosure prohibition
11. Support policy
12. MCP integration (if connectors enabled)
13. Skills (available skill modules)
14. Webdev configuration (if webdev project active)
```

**The system prompt is DYNAMIC.** It changes based on:
- Which connectors the user has enabled (adds MCP section)
- Whether a webdev project is active (adds webdev config)
- Which skills are relevant (adds skill references)
- User's secrets (adds secret variable names)

**System prompt size:** Approximately 15,000-25,000 tokens depending on active features.

---

## D.5 The LLM Agent Loop (Core Orchestration)

This is the heart of how Manus works. The orchestrator runs an agent loop that continues until the task is complete.

### D.5.1 Step-by-Step Agent Loop

```
LOOP START
    │
    ├── Step 1: PREPARE CONTEXT
    │   Orchestration assembles the messages array:
    │   [
    │     { "role": "system", "content": "<system_prompt>" },
    │     { "role": "user", "content": "User's message" },
    │     // If continuing:
    │     { "role": "assistant", "content": null, "tool_calls": [...] },
    │     { "role": "tool", "content": "<tool_result>" },
    │     { "role": "assistant", "content": null, "tool_calls": [...] },
    │     { "role": "tool", "content": "<tool_result>" },
    │     // ... continues
    │   ]
    │
    ├── Step 2: CALL LLM
    │   POST https://api.manus.im/api/llm-proxy/v1/chat/completions
    │   Body: {
    │     "model": "claude-sonnet-4-20250514",  // or similar
    │     "messages": [...],
    │     "tools": [<27 tool definitions>],
    │     "stream": true
    │   }
    │   ↓
    │   LLM proxy routes to actual provider (Anthropic, OpenAI, Google)
    │
    ├── Step 3: STREAM LLM RESPONSE
    │   LLM streams response tokens:
    │   ├── Text tokens → Streamed to frontend in real time
    │   └── Tool call tokens → Accumulated until complete
    │
    ├── Step 4: PARSE RESPONSE
    │   ├── If response is TEXT ONLY:
    │   │   → Send to frontend, END LOOP (task complete)
    │   │
    │   └── If response contains TOOL CALLS:
    │       → Parse tool_calls array
    │       → Validate parameters
    │       → Continue to Step 5
    │
    ├── Step 5: ROUTE TOOL CALL
    │   Based on tool name, route to execution layer:
    │   │
    │   ├── Sandbox tools (shell, file, browser, match, expose):
    │   │   → WebSocket to sandbox (169.254.0.21:8330)
    │   │
    │   ├── Orchestration tools (search, message, plan, schedule):
    │   │   → Execute in orchestration layer
    │   │
    │   └── External tools (generate, map):
    │       → Route to specialized services
    │
    ├── Step 6: EXECUTE TOOL
    │   ├── Send tool call to execution layer
    │   ├── Stream progress to frontend (loading indicators)
    │   ├── Wait for result
    │   └── Receive tool result
    │
    ├── Step 7: APPEND RESULT TO CONTEXT
    │   messages.append({
    │     "role": "assistant",
    │     "content": null,
    │     "tool_calls": [{ "function": { "name": "shell", "arguments": "..." } }]
    │   })
    │   messages.append({
    │     "role": "tool",
    │     "content": "<tool_result>"
    │   })
    │
    └── Step 8: LOOP BACK TO Step 1
        (Continue until LLM returns text-only response or message.result)
```

### D.5.2 Loop Termination Conditions

The agent loop ends when:
1. **LLM calls `message(type="result")`** — Task complete, deliver results
2. **LLM returns text-only response** — Simple answer, no tools needed
3. **Error limit reached** — After 3 consecutive failures
4. **User interrupts** — User sends new message or cancels
5. **Credit limit reached** — User's credits exhausted
6. **Timeout** — Maximum execution time exceeded

---

## D.6 Context Window Management

The LLM has a finite context window. The orchestrator manages this carefully.

### D.6.1 Context Compaction

When the conversation gets too long:

```
Original context: [system, user1, assistant1, tool1, assistant2, tool2, ..., userN]
    ↓
Orchestration detects: Context approaching limit
    ↓
Compaction strategy:
    1. Keep system prompt (always)
    2. Keep recent messages (last N turns)
    3. Compress older messages:
       - Tool results → Summarized
       - Long outputs → Truncated with "Content truncated..."
       - File contents → Replaced with "File read previously"
    4. Add <compacted_history> tag with summaries
    ↓
Compacted context: [system, <compacted_history>, recent_messages...]
```

**Evidence:** The system prompt includes `<compacted_history>` tags that contain summaries of previous tool calls and results.

### D.6.2 System Reminders

The orchestrator injects `<system_reminder>` tags at strategic points:

```xml
<system_reminder>
You must rewrite the final version of the document; everything written up to this point is only a draft.
</system_reminder>
```

These reminders guide the LLM's behavior at specific phases:
- After `webdev_init_project`: Reminds to edit files directly
- Before delivery: Reminds to create checkpoint
- After context compaction: Reminds about lost information

---

## D.7 How the Orchestrator Spins Up E2B

### D.7.1 First-Time Sandbox Creation

```
User's first conversation ever:
    ↓
Orchestration → E2B API:
    POST https://api.e2b.dev/v1/sandboxes
    Headers: { Authorization: Bearer <e2b_api_key> }
    Body: {
      "template_id": "manus-sandbox-v2",
      "timeout": 86400,  // 24 hours
      "metadata": {
        "user_id": "310519663278050818",
        "user_name": "Khaleel"
      }
    }
    ↓
E2B API:
    1. Selects Firecracker host with capacity
    2. Clones template snapshot (copy-on-write)
    3. Assigns IP: 169.254.0.21
    4. Boots microVM
    5. Returns sandbox metadata
    ↓
E2B API → Orchestration:
    {
      "sandbox_id": "f259c00a6c36",
      "ip": "169.254.0.21",
      "status": "running",
      "template_id": "manus-sandbox-v2"
    }
    ↓
Orchestration stores sandbox assignment:
    user_id → sandbox_id mapping
    ↓
Orchestration → Sandbox: WebSocket handshake on port 8330
    ↓
Orchestration → Sandbox: Inject environment:
    1. Write /home/ubuntu/.user_env (user secrets)
    2. Write /home/ubuntu/.secrets/sandbox_api_token
    3. Configure MCP servers (if connectors enabled)
```

### D.7.2 Reusing Existing Sandbox

```
User starts new conversation (sandbox already running):
    ↓
Orchestration checks: user_id → sandbox_id mapping
    ├── Sandbox still running? → Reuse
    └── Sandbox expired? → Create new one (D.7.1)
    ↓
Orchestration → Sandbox: WebSocket message
    { "type": "new_session", "session_id": "session_xyz789" }
    ↓
Sandbox acknowledges: Same processes, same filesystem, new logical session
```

### D.7.3 Sandbox Hibernation

```
No activity for X minutes:
    ↓
Orchestration → E2B API:
    POST https://api.e2b.dev/v1/sandboxes/{sandbox_id}/hibernate
    ↓
E2B: Snapshots VM state (memory + disk)
E2B: Suspends Firecracker microVM
E2B: Frees compute resources
    ↓
Orchestration updates: sandbox status = "hibernated"
```

### D.7.4 Sandbox Resume

```
User sends message (sandbox hibernated):
    ↓
Orchestration → E2B API:
    POST https://api.e2b.dev/v1/sandboxes/{sandbox_id}/resume
    ↓
E2B: Restores VM from snapshot (~150ms)
E2B: All processes resume
    ↓
Orchestration → Sandbox: WebSocket reconnect
    ↓
Agent loop continues
```

---

## D.8 Tool Definitions Sent to LLM

The orchestrator sends 27+ tool definitions to the LLM. Each definition follows the OpenAI function calling schema:

```json
{
  "type": "function",
  "function": {
    "name": "shell",
    "description": "Interact with shell sessions in the sandbox environment...",
    "parameters": {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "enum": ["view", "exec", "wait", "send", "kill"],
          "description": "The action to perform"
        },
        "command": {
          "type": "string",
          "description": "The shell command to execute"
        },
        "session": {
          "type": "string",
          "description": "The unique identifier of the target shell session"
        },
        "timeout": {
          "type": "integer",
          "description": "Timeout in seconds"
        }
      },
      "required": ["action", "session"]
    }
  }
}
```

**Complete tool list sent to LLM:**

| # | Tool Name | Category |
|---|-----------|----------|
| 1 | `plan` | Orchestration |
| 2 | `message` | Communication |
| 3 | `shell` | Sandbox execution |
| 4 | `file` | Sandbox filesystem |
| 5 | `match` | Sandbox search |
| 6 | `search` | External search |
| 7 | `browser` | Browser automation |
| 8 | `map` | Parallel processing |
| 9 | `expose` | Network proxy |
| 10 | `generate` | Media generation |
| 11 | `slides` | Presentation |
| 12 | `schedule` | Task scheduling |
| 13 | `webdev_init_project` | Webdev |
| 14 | `webdev_check_status` | Webdev |
| 15 | `webdev_restart_server` | Webdev |
| 16 | `webdev_add_feature` | Webdev |
| 17 | `webdev_save_checkpoint` | Webdev |
| 18 | `webdev_rollback_checkpoint` | Webdev |
| 19 | `webdev_execute_sql` | Webdev |

**Note:** Browser sub-actions (navigate, click, input, etc.) may be presented as separate tools or as actions within the browser tool, depending on the orchestration configuration.

---

## D.9 How Sessions Work (The Full Truth)

### D.9.1 Session vs. Sandbox vs. Conversation

| Concept | Scope | Lifecycle | Shared? |
|---------|-------|-----------|---------|
| **Conversation** | One chat thread in the UI | Created when user clicks "New Chat" | No (separate LLM context) |
| **Session** | Orchestration tracking unit | Maps 1:1 to conversation | No (separate tracking) |
| **Sandbox** | E2B Firecracker microVM | Persists across conversations | Yes (one per user) |

### D.9.2 What the Orchestrator Sends Back

When the user chats, the orchestrator sends back session information:

```
User sends message
    ↓
Orchestration processes:
    1. Identifies session_id from WebSocket connection
    2. Loads session state (message history, active plan, etc.)
    3. Identifies sandbox_id for this user
    4. Prepares LLM context
    ↓
Orchestration → Frontend (WebSocket, real-time):
    {
      "type": "session_update",
      "session_id": "session_abc123",
      "status": "processing",
      "events": [
        { "type": "thinking", "timestamp": "..." },
        { "type": "tool_call", "tool": "shell", "status": "executing" },
        { "type": "tool_result", "tool": "shell", "status": "complete" },
        { "type": "message", "content": "Here's what I found..." }
      ]
    }
```

### D.9.3 Session State Tracked by Orchestrator

```typescript
interface SessionState {
  uid: string;                    // Unique session ID
  user_id: string;                // User's Manus ID
  sandbox_id: string;             // Assigned E2B sandbox
  title: string;                  // Conversation title
  status: "active" | "completed" | "failed";
  created_at: string;
  updated_at: string;
  
  // Message history
  messages: Message[];            // Full conversation history
  
  // Active plan
  plan: {
    goal: string;
    phases: Phase[];
    current_phase_id: number;
  } | null;
  
  // Billing
  costed_credits: number;         // Credits consumed
  
  // Webdev (if active)
  webdev_project: {
    name: string;
    path: string;
    version: string;
    features: string[];
  } | null;
  
  // Scheduled tasks
  scheduled_tasks: ScheduledTask[];
}
```

---

## D.10 Real-Time Streaming Architecture

### D.10.1 Frontend ↔ Orchestration WebSocket

```
Frontend (manus.im) ←→ WebSocket ←→ Orchestration (api.manus.im)

Messages FROM frontend:
    { "type": "user_message", "content": "...", "files": [...] }
    { "type": "user_response", "content": "..." }  // Answer to ask
    { "type": "cancel", "session_id": "..." }
    { "type": "ping" }

Messages TO frontend:
    { "type": "thinking" }                          // LLM is processing
    { "type": "text_delta", "content": "..." }      // Streaming text
    { "type": "tool_call_start", "tool": "shell", "id": "..." }
    { "type": "tool_call_progress", "id": "...", "data": "..." }
    { "type": "tool_call_end", "id": "...", "result": "..." }
    { "type": "plan_update", "plan": {...} }
    { "type": "message_complete", "content": "...", "attachments": [...] }
    { "type": "error", "message": "..." }
    { "type": "credits_update", "remaining": 450 }
    { "type": "pong" }
```

### D.10.2 Orchestration ↔ Sandbox WebSocket

```
Orchestration ←→ WebSocket (port 8330) ←→ start_server

Messages FROM orchestration:
    { "type": "tool_call", "tool": "shell", "parameters": {...} }
    { "type": "read_file", "path": "/home/ubuntu/report.pdf" }
    { "type": "init", "session_id": "..." }
    { "type": "new_session", "session_id": "..." }
    { "type": "configure_mcp", "servers": {...} }

Messages FROM sandbox:
    { "type": "tool_result", "status": "success", "data": {...} }
    { "type": "file_content", "path": "...", "data": "<base64>" }
    { "type": "ready", "status": "ok" }
    { "type": "error", "message": "..." }
    { "type": "progress", "tool": "shell", "output": "..." }  // Streaming
```

---

## D.11 The Planning System

### D.11.1 How Plans Are Created

The LLM decides when to create a plan. For complex tasks, it calls the `plan` tool:

```
LLM reasoning: "This is a complex task with multiple steps. I should create a plan."
    ↓
LLM → plan(action="update", goal="...", phases=[...])
    ↓
Orchestration stores plan in session state
    ↓
Orchestration → Frontend: Plan card rendered in timeline
    ↓
LLM → Begins executing Phase 1
    ↓
After Phase 1 complete:
    LLM → plan(action="advance", next_phase_id=2)
    ↓
Orchestration updates plan state
    ↓
Frontend updates plan card (Phase 1 ✓, Phase 2 →)
    ↓
LLM → Begins executing Phase 2
    ↓
... continues until all phases complete
```

### D.11.2 Plan Capabilities and Phase Routing

Each phase can declare capabilities that guide optimization:

```json
{
  "id": 2,
  "title": "Generate hero images",
  "capabilities": {
    "media_generation": true
  }
}
```

Available capabilities:
- `creative_writing` — Fiction, storytelling
- `data_analysis` — Data processing, visualization
- `deep_research` — Multi-source research
- `image_processing` — Programmatic image operations
- `media_generation` — AI image/video/audio generation
- `parallel_processing` — Divide into parallel subtasks
- `slides_content_writing` — Prepare slide content
- `slides_generation` — Generate slide presentations
- `technical_writing` — Technical/academic writing
- `web_development` — Build websites/apps

These capabilities are hints to the orchestration layer for optimization. All tools remain available regardless of declared capabilities.

---

## D.12 Error Handling in the Agent Loop

### D.12.1 Tool Execution Errors

```
LLM calls: shell.exec(command="cat /nonexistent/file")
    ↓
Sandbox executes: cat /nonexistent/file
    ↓
Error: "cat: /nonexistent/file: No such file or directory"
    ↓
Sandbox → Orchestration: { "status": "error", "error": "..." }
    ↓
Orchestration → LLM: Tool result with error
    ↓
LLM sees error, tries alternative approach
    ↓
After 3 consecutive failures: LLM explains failure to user
```

### D.12.2 LLM API Errors

```
Orchestration → LLM API: POST /chat/completions
    ↓
LLM API returns: 429 Too Many Requests
    ↓
Orchestration: Retry with exponential backoff
    ├── Retry 1: Wait 1s
    ├── Retry 2: Wait 2s
    └── Retry 3: Wait 4s
    ↓
If still failing: Route to different LLM provider
    ↓
If all providers fail: Error message to user
```

### D.12.3 Sandbox Errors

```
Sandbox becomes unresponsive:
    ↓
Orchestration: WebSocket ping timeout
    ↓
Orchestration → E2B API: Restart sandbox
    ↓
New sandbox spins up
    ↓
Orchestration reconnects
    ↓
Agent loop resumes
```

---

## D.13 Billing and Credit Tracking

```
Each LLM call:
    Orchestration calculates tokens used:
    ├── Input tokens: system_prompt + messages + tool_definitions
    ├── Output tokens: LLM response
    └── Total cost: (input_tokens × rate) + (output_tokens × rate)
    ↓
Orchestration updates session:
    session.costed_credits += cost
    ↓
Orchestration → Frontend:
    { "type": "credits_update", "remaining": 450, "used_this_session": 50 }
    ↓
Frontend updates Redux:
    dispatch(userActions.updateCredits(450))
```

---

## D.14 Complete End-to-End Example

**User asks:** "Create a Python script to analyze my CSV data and generate a chart"

```
T+0ms: User types message and clicks Send
    ↓
T+50ms: Frontend → Orchestration (WebSocket):
    { "type": "user_message", "content": "Create a Python script..." }
    ↓
T+100ms: Orchestration loads session state
    Orchestration checks sandbox: Running ✅
    Orchestration assembles context (system prompt + history)
    ↓
T+200ms: Orchestration → LLM API (streaming):
    POST /chat/completions { messages: [...], tools: [...], stream: true }
    ↓
T+500ms: LLM streams: plan(action="update", goal="Create CSV analysis script", phases=[...])
    ↓
T+600ms: Orchestration stores plan, sends to frontend
    Frontend renders plan card
    ↓
T+700ms: LLM streams: file.write(path="/home/ubuntu/analyze.py", text="import pandas...")
    ↓
T+750ms: Orchestration → Sandbox (WebSocket):
    { "type": "tool_call", "tool": "file", "parameters": { "action": "write", ... } }
    ↓
T+770ms: Sandbox writes file
    Sandbox → Orchestration: { "status": "success" }
    ↓
T+800ms: Orchestration → LLM: Tool result appended to context
    ↓
T+1200ms: LLM streams: shell.exec(command="python3 /home/ubuntu/analyze.py")
    ↓
T+1250ms: Orchestration → Sandbox: Execute command
    ↓
T+1300ms: Sandbox: PTY spawns, bash runs python3
    Python script executes...
    ↓
T+3000ms: Script completes, output captured
    Sandbox → Orchestration: { "output": "Chart saved to /home/ubuntu/chart.png" }
    ↓
T+3100ms: Orchestration → LLM: Tool result
    ↓
T+3500ms: LLM streams: message(type="result", text="Here's your analysis...", attachments=[...])
    ↓
T+3600ms: Orchestration processes attachments:
    1. Read /home/ubuntu/analyze.py from sandbox (WebSocket)
    2. Read /home/ubuntu/chart.png from sandbox (WebSocket)
    3. Upload both to S3
    4. Generate CDN URLs
    ↓
T+4000ms: Orchestration → Frontend (WebSocket):
    {
      "type": "message_complete",
      "content": "Here's your analysis...",
      "attachments": [
        { "name": "analyze.py", "url": "https://cdn.manus.im/..." },
        { "name": "chart.png", "url": "https://cdn.manus.im/..." }
      ]
    }
    ↓
T+4050ms: Frontend renders message with download links
    User sees result ✅
    ↓
T+4100ms: Orchestration updates billing:
    Credits used: ~15 (LLM tokens + tool execution)
    ↓
T+4150ms: Agent loop ENDS (message.result was called)
```

**Total time:** ~4 seconds
**LLM calls:** 3 (plan + file.write + shell.exec + message.result across 3 turns)
**Sandbox operations:** 2 (file write + shell exec)
**S3 uploads:** 2 (script + chart)
**WebSocket messages:** ~12 (bidirectional)
