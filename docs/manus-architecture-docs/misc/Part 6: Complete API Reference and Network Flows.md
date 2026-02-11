# Part 6: Complete API Reference and Network Flows

## 6.1 Overview

This document maps every known API endpoint, WebSocket event, and network flow in the Manus architecture. It covers the full request lifecycle from user action to final response.

---

## 6.2 API Endpoints

### Authentication APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/auth/login` | Initiate login (returns OAuth URL) |
| `POST` | `/api/auth/callback` | OAuth callback handler |
| `GET` | `/api/auth/me` | Get current user profile |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Invalidate session |

### Session APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/v1/sessions` | Create new session |
| `GET` | `/v1/sessions` | List user sessions |
| `GET` | `/v1/sessions/:id` | Get session details |
| `DELETE` | `/v1/sessions/:id` | Delete session |
| `POST` | `/v1/sessions/:id/messages` | Send message to session |
| `GET` | `/v1/sessions/:id/messages` | Get session messages |
| `POST` | `/v1/sessions/:id/stop` | Stop running session |
| `POST` | `/v1/sessions/:id/resume` | Resume stopped session |

### Webdev APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/v1/webdev/projects` | Create project |
| `GET` | `/v1/webdev/projects/:id` | Get project details |
| `POST` | `/v1/webdev/projects/:id/checkpoint` | Save checkpoint |
| `POST` | `/v1/webdev/projects/:id/rollback` | Rollback to checkpoint |
| `GET` | `/v1/webdev/projects/:id/files` | List project files |
| `GET` | `/v1/webdev/projects/:id/files/:path` | Get file content |
| `POST` | `/v1/webdev/projects/:id/restart` | Restart dev server |
| `GET` | `/v1/webdev/projects/:id/status` | Check dev server status |
| `POST` | `/v1/webdev/projects/:id/publish` | Publish project |
| `POST` | `/v1/webdev/projects/:id/sql` | Execute SQL query |

### Connector APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/v1/connectors` | List available connectors |
| `POST` | `/v1/connectors/:id/enable` | Enable connector |
| `POST` | `/v1/connectors/:id/disable` | Disable connector |
| `GET` | `/v1/connectors/:id/oauth` | Get OAuth URL |
| `POST` | `/v1/connectors/:id/oauth/callback` | OAuth callback |

### File APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/v1/files/upload` | Upload file to S3 |
| `GET` | `/v1/files/:id` | Get file metadata |
| `GET` | `/v1/files/:id/download` | Download file |

### User/Billing APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/v1/user/plan` | Get subscription details |
| `GET` | `/v1/user/credits` | Get credit balance |
| `GET` | `/v1/user/usage` | Get usage statistics |
| `PUT` | `/v1/user/settings` | Update user settings |

### LLM Proxy API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/llm-proxy/v1/chat/completions` | Proxy LLM API calls |

---

## 6.3 WebSocket Protocol

### Connection

```
wss://manus.im/ws?token=<jwt_token>&session_id=<session_id>
```

### Message Format

All WebSocket messages use JSON:

```json
{
  "type": "<event_type>",
  "data": { ... },
  "timestamp": "2026-02-10T12:00:00Z"
}
```

### Server → Client Events

| Event Type | Data | Trigger |
|-----------|------|---------|
| `message` | `{ role, content, attachments }` | Assistant sends message |
| `message_chunk` | `{ content_delta }` | Streaming text chunk |
| `tool_call` | `{ id, tool, input, status }` | Tool execution starts |
| `tool_result` | `{ id, output, status }` | Tool execution completes |
| `plan_update` | `{ goal, phases, current_phase }` | Plan created/updated |
| `plan_advance` | `{ current_phase_id }` | Phase advanced |
| `thinking_start` | `{}` | LLM starts processing |
| `thinking_end` | `{}` | LLM finishes processing |
| `session_update` | `{ status, credits }` | Session state change |
| `credits_update` | `{ remaining, used }` | Credit consumption |
| `error` | `{ message, code }` | Error occurred |
| `notification` | `{ title, body, type }` | Push notification |
| `map_progress` | `{ job_id, completed, total }` | Parallel task progress |
| `file_upload_progress` | `{ file_id, progress }` | Upload progress |
| `heartbeat` | `{ timestamp }` | Keep-alive ping |

### Client → Server Events

| Event Type | Data | Purpose |
|-----------|------|---------|
| `message` | `{ content, files }` | Send user message |
| `stop` | `{}` | Stop current execution |
| `resume` | `{}` | Resume execution |
| `heartbeat_ack` | `{}` | Acknowledge heartbeat |

---

## 6.4 Complete Request Lifecycle

### Lifecycle: User Sends a Message

```
Step 1: User types message and clicks Send
    Frontend: dispatch(chat.clearInput())
    Frontend: dispatch(timeline.addUserMessage(text))
    Frontend: WebSocket.send({ type: "message", data: { content: text } })

Step 2: Orchestration receives message
    Orchestration: Validates session
    Orchestration: Appends to conversation history
    Orchestration: Prepares LLM API call

Step 3: LLM API call
    Orchestration → POST api.manus.im/api/llm-proxy/v1/chat/completions
    Body: {
      model: "claude-sonnet-4-20250514",
      messages: [system_prompt, ...conversation_history],
      tools: [29 tool definitions],
      stream: true
    }

Step 4: LLM streams response
    Orchestration: WebSocket → Frontend: { type: "thinking_start" }
    
    IF text response:
        Orchestration: WebSocket → Frontend: { type: "message_chunk", data: { delta } }
        (repeated for each chunk)
        Orchestration: WebSocket → Frontend: { type: "message", data: { full_content } }
    
    IF tool_use response:
        Orchestration: WebSocket → Frontend: { type: "tool_call", data: { tool, input, status: "executing" } }
        
        Step 5: Tool execution
        Orchestration → TCP → E2B sandbox (169.254.0.21:8330)
        start_server executes tool
        Result → TCP → Orchestration
        
        Orchestration: WebSocket → Frontend: { type: "tool_result", data: { output, status: "completed" } }
        
        Step 6: Feed result back to LLM
        Orchestration → POST LLM API (with tool_result in messages)
        GOTO Step 4 (loop until LLM returns text or idle)

Step 7: Task complete
    Orchestration: WebSocket → Frontend: { type: "thinking_end" }
    Orchestration: WebSocket → Frontend: { type: "session_update", data: { status: "completed" } }
```

### Lifecycle: File Upload

```
Step 1: User attaches file in chat
    Frontend: dispatch(fileManagement.startUpload(file))
    Frontend: POST /v1/files/upload (multipart/form-data)

Step 2: File stored
    Backend: Upload to S3 → Get CDN URL
    Backend: Return { id, url, name, size }

Step 3: File reference sent with message
    Frontend: WebSocket.send({ type: "message", data: { content: text, files: [{ id, url }] } })

Step 4: Orchestration downloads to sandbox
    Orchestration: wget/curl CDN URL → /home/ubuntu/uploads/<filename>
    Orchestration: Adds file path to system context for Claude
```

### Lifecycle: Webdev Project Creation

```
Step 1: Claude calls webdev_init_project
    Orchestration: Creates project directory in sandbox
    Orchestration: Scaffolds template (React + Tailwind + shadcn/ui)
    Orchestration: Runs pnpm install
    Orchestration: Starts dev server (pnpm run dev)
    Orchestration: Configures proxy: https://{port}-{id}.us2.manus.computer → localhost:3000

Step 2: Frontend receives project info
    WebSocket → Frontend: { type: "webdev_project", data: { name, url, status } }
    Frontend: dispatch(webDev.setProject(data))
    Frontend: Renders project card in timeline
    Frontend: Enables Management UI tabs

Step 3: Dev server accessible
    User can open Preview tab → iframe loads dev server URL
    Live reload enabled via Vite HMR
```

### Lifecycle: Parallel Processing (map tool)

```
Step 1: Claude calls map tool
    Orchestration: Receives { prompt_template, inputs[], output_schema }

Step 2: Spawn subtasks
    FOR each input in inputs[]:
        Orchestration: Create new E2B sandbox (separate from main)
        Orchestration: Inject prompt_template with input
        Orchestration: Start new LLM conversation in subtask sandbox
    
    WebSocket → Frontend: { type: "map_progress", data: { total: N, completed: 0 } }

Step 3: Subtasks execute in parallel
    Each subtask: LLM → tool calls → results (independent)
    
    On each completion:
        WebSocket → Frontend: { type: "map_progress", data: { total: N, completed: M } }

Step 4: Aggregate results
    Orchestration: Collect all subtask outputs
    Orchestration: Validate against output_schema
    Orchestration: Return aggregated results to main Claude
    Orchestration: Destroy subtask sandboxes

Step 5: Main Claude processes results
    Claude receives aggregated data
    Claude continues with next steps
```

---

## 6.5 Network Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                              │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ React App    │  │ WebSocket    │  │ Neko WebRTC Client       │  │
│  │ (Redux)      │  │ Connection   │  │ (Browser live view)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘  │
│         │                  │                      │                   │
└─────────┼──────────────────┼──────────────────────┼──────────────────┘
          │ HTTPS            │ WSS                  │ WebRTC
          │                  │                      │
┌─────────┼──────────────────┼──────────────────────┼──────────────────┐
│         ▼                  ▼                      │                   │
│  ┌──────────────────────────────┐                 │                   │
│  │     MANUS API GATEWAY        │                 │                   │
│  │     (api.manus.im)           │                 │                   │
│  │                              │                 │                   │
│  │  ├─ REST API endpoints       │                 │                   │
│  │  ├─ WebSocket upgrade        │                 │                   │
│  │  ├─ Authentication           │                 │                   │
│  │  └─ Rate limiting            │                 │                   │
│  └──────────┬───────────────────┘                 │                   │
│             │                                     │                   │
│             ▼                                     │                   │
│  ┌──────────────────────────────┐                 │                   │
│  │   ORCHESTRATION LAYER        │                 │                   │
│  │   (10.9.181.1)               │                 │                   │
│  │                              │                 │                   │
│  │  ├─ Session management       │                 │                   │
│  │  ├─ LLM API calls            │                 │                   │
│  │  ├─ Tool routing             │                 │                   │
│  │  ├─ Context management       │                 │                   │
│  │  └─ Credit tracking          │                 │                   │
│  └──────┬──────────┬────────────┘                 │                   │
│         │          │                              │                   │
│    TCP  │          │ HTTPS                        │                   │
│         │          │                              │                   │
│         │          ▼                              │                   │
│         │  ┌──────────────────┐                   │                   │
│         │  │ LLM Provider     │                   │                   │
│         │  │ (Claude API)     │                   │                   │
│         │  └──────────────────┘                   │                   │
│         │                                         │                   │
│         ▼                                         ▼                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    E2B SANDBOX (Firecracker microVM)            │  │
│  │                    IP: 169.254.0.21                             │  │
│  │                                                                 │  │
│  │  ┌─────────────────────────────────────────────────────────┐   │  │
│  │  │  start_server (PID 794, port 8330)                       │   │  │
│  │  │  ├─ TCP listener: accepts tool execution requests        │   │  │
│  │  │  ├─ File operations: read/write/search filesystem        │   │  │
│  │  │  ├─ Shell operations: PTY management, process spawning   │   │  │
│  │  │  ├─ Browser operations: Playwright → Chromium (CDP 9222) │   │  │
│  │  │  └─ WebSocket: streams results back to orchestration     │   │  │
│  │  └─────────────────────────────────────────────────────────┘   │  │
│  │                                                                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐   │  │
│  │  │ Chromium      │  │ Neko Server  │  │ Dev Server (Vite)  │   │  │
│  │  │ (CDP 9222)    │  │ (port 8333)  │  │ (port 3000)        │   │  │
│  │  │ Browser auto  │  │ WebRTC stream│  │ Webdev projects    │   │  │
│  │  └──────────────┘  └──────────────┘  └────────────────────┘   │  │
│  │                                                                 │  │
│  │  ┌──────────────────────────────────────────────────────────┐  │  │
│  │  │  Filesystem: /home/ubuntu/                                │  │  │
│  │  │  ├─ User files, code, data                                │  │  │
│  │  │  ├─ screenshots/ (browser captures)                       │  │  │
│  │  │  ├─ Downloads/ (browser downloads)                        │  │  │
│  │  │  └─ <project>/ (webdev project directory)                 │  │  │
│  │  └──────────────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ S3 / CDN         │  │ MCP Servers       │  │ External APIs    │  │
│  │ (cdn.manus.im)   │  │ (Gmail, Slack...) │  │ (Search, etc.)   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│                        MANUS INFRASTRUCTURE                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 6.6 Port Map

| Port | Service | Location | Access |
|------|---------|----------|--------|
| 8330 | start_server (tool executor) | E2B Sandbox | Internal only (from orchestration) |
| 9222 | Chromium CDP | E2B Sandbox | Internal only (from start_server) |
| 8333 | Neko Server (WebRTC) | E2B Sandbox | Proxied to user via WebRTC |
| 3000 | Vite Dev Server | E2B Sandbox | Proxied via `https://{port}-{id}.us2.manus.computer` |
| 443 | Manus API Gateway | Manus Infrastructure | Public HTTPS |
| 443 | WebSocket | Manus Infrastructure | Public WSS |

---

## 6.7 IP Address Map

| IP | Role | Notes |
|----|------|-------|
| `169.254.0.21` | E2B Sandbox | Link-local address, Firecracker guest |
| `10.9.181.1` | Orchestration Layer | Private network, manages sandbox |
| `10.93.83.1` | Orchestration (alternate/observed) | Source IP for TCP connections to sandbox |
| `100.64.0.0/10` | Carrier-grade NAT range | Used for internal routing |

---

## 6.8 DNS and Domain Structure

| Domain | Purpose |
|--------|---------|
| `manus.im` | Main website and API |
| `api.manus.im` | API gateway |
| `cdn.manus.im` | S3 CDN for uploaded files |
| `{port}-{id}.us2.manus.computer` | Sandbox port proxy (dev servers, exposed ports) |
| `{prefix}.manus.space` | Published webdev projects |
| `help.manus.im` | Support and help center |

---

## 6.9 Authentication Flow

### JWT Token Flow

```
1. User logs in via OAuth (Google, GitHub, etc.)
2. Manus backend issues JWT token
3. JWT stored in browser (httpOnly cookie or localStorage)
4. All API calls include: Authorization: Bearer <jwt>
5. WebSocket connection includes token in query string
6. JWT contains: { userId, email, plan, exp }
7. Refresh token used for silent renewal
```

### Sandbox Authentication

```
1. Orchestration creates sandbox
2. Injects authentication tokens as environment variables:
   - OPENAI_API_KEY (for LLM proxy access)
   - BUILT_IN_FORGE_API_KEY (for internal APIs)
   - JWT_SECRET (for webdev auth)
3. Sandbox uses these tokens for outbound API calls
4. Tokens are scoped to the user's session
```

---

## 6.10 Error Codes and Handling

| Code | Meaning | Recovery |
|------|---------|----------|
| `401` | Unauthorized | Refresh token or re-login |
| `403` | Forbidden | Check permissions/plan |
| `429` | Rate limited | Wait and retry |
| `500` | Server error | Retry with backoff |
| `503` | Service unavailable | Sandbox hibernated, auto-resume |
| `SANDBOX_TIMEOUT` | Tool execution timeout | Retry or use shorter timeout |
| `SANDBOX_OOM` | Out of memory | Reduce workload |
| `LLM_CONTEXT_EXCEEDED` | Context too long | Context compaction triggered |
| `CREDITS_EXHAUSTED` | No credits remaining | Upgrade plan or wait |
| `CONNECTOR_AUTH_EXPIRED` | OAuth token expired | Re-authenticate connector |

---

## 6.11 Context Compaction

When conversation history exceeds Claude's context window:

```
1. Orchestration detects context approaching limit
2. Triggers context compaction:
   a. Summarize older messages
   b. Remove tool call details (keep results)
   c. Preserve system prompt and recent context
   d. Create "compacted_history" summary
3. New LLM call uses compacted context
4. Frontend shows: "Context compacted" indicator
```

**Evidence from this session:**
```
<system_reminder>
The context has been compacted to fit within token limits and maintain system performance.
Some previous tool use records have been replaced by <compacted_history>
</system_reminder>
```

---

## 6.12 Credit System

### Credit Consumption

| Action | Credits |
|--------|---------|
| LLM API call | 1+ (varies by model/tokens) |
| Tool execution | 1 per call |
| Image generation | Higher cost |
| Parallel subtask | 1+ per subtask |

### Credit Tracking

```
Each tool call:
    Orchestration: UPDATE sessions SET costed_credits = costed_credits + N

WebSocket → Frontend: { type: "credits_update", data: { remaining, used } }
Frontend: dispatch(auth.updateCredits(data))
```

---

## 6.13 Observability Stack

```
┌─────────────────────────────────────────┐
│           OBSERVABILITY                  │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ OpenTelemetry │  │ Sentry           │ │
│  │ (Traces)      │  │ (Errors)         │ │
│  │               │  │                  │ │
│  │ - Tool timing │  │ - JS exceptions  │ │
│  │ - LLM latency │  │ - API errors     │ │
│  │ - Sandbox ops │  │ - Crash reports  │ │
│  └──────────────┘  └──────────────────┘ │
│                                          │
│  ┌──────────────┐  ┌──────────────────┐ │
│  │ Analytics     │  │ Logging          │ │
│  │ (UV/PV)       │  │ (.manus-logs/)   │ │
│  │               │  │                  │ │
│  │ - Page views  │  │ - devserver.log  │ │
│  │ - Sessions    │  │ - browserConsole │ │
│  │ - Events      │  │ - networkReqs    │ │
│  └──────────────┘  │ - sessionReplay  │ │
│                     └──────────────────┘ │
└─────────────────────────────────────────┘
```
