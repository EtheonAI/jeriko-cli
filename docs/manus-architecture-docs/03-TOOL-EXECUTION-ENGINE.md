# Part 3: Tool Execution Engine

## 3.1 Overview

Manus provides **29 tools** to the LLM (Claude). These tools are defined in the orchestration layer and sent to Claude with every LLM API call. Claude decides which tool to use, and the orchestration routes execution to either the E2B sandbox or handles it locally.

---

## 3.2 Complete Tool Registry (29 Tools)

### Message Tools (2) — Executed in Orchestration

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `message_notify_user` | `text`, `attachments[]` | Send info/result to user without blocking |
| `message_ask_user` | `text`, `attachments[]`, `suggested_action` | Ask user a question and wait for response |

**Execution flow:**
```
Claude → Orchestration → WebSocket → Frontend → User sees message
```

### File Tools (5) — Executed in E2B Sandbox

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `file_read` | `path`, `range[]` | Read file content |
| `file_write` | `path`, `text` | Create or overwrite file |
| `file_str_replace` | `path`, `edits[]` | Find and replace in file |
| `file_find_in_content` | `scope`, `regex` | Search file contents (grep) |
| `file_find_by_name` | `scope` | Search filesystem (glob) |

**Execution flow:**
```
Claude → Orchestration → TCP (10.93.83.1 → 169.254.0.21:8330)
    → start_server → Filesystem operation → Result
    → TCP back → Orchestration → Claude
```

**Key detail:** File operations go through `start_server`, NOT direct filesystem access. Each operation creates a new TCP connection.

### Shell Tools (5) — Executed in E2B Sandbox

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `shell_exec` | `command`, `session`, `timeout` | Execute command in PTY |
| `shell_view` | `session` | View PTY output history |
| `shell_wait` | `session`, `timeout` | Wait for process completion |
| `shell_write_to_process` | `session`, `input` | Send stdin to process |
| `shell_kill_process` | `session` | Terminate process |

**Execution flow:**
```
Claude → Orchestration → TCP → start_server
    → Creates/reuses PTY session (e.g., /dev/pts/1)
    → Spawns: sudo -u ubuntu bash -c "<command>"
    → Process tree: start_server → sudo → bash → command
    → Captures output → Returns via TCP
```

**PTY session management:**
- Each `session` name maps to a persistent PTY
- Multiple named sessions can run concurrently
- Sessions persist across tool calls within same conversation

### Browser Tools (12) — Executed in E2B Sandbox

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `browser_view` | - | Return current page state + screenshot |
| `browser_navigate` | `url`, `intent`, `focus` | Navigate to URL |
| `browser_restart` | - | Restart Chromium |
| `browser_click` | `element_id` or `coordinates` | Click element |
| `browser_input` | `element_id`, `text` | Type into field |
| `browser_move_mouse` | `x`, `y` | Move cursor |
| `browser_press_key` | `key` | Press keyboard key |
| `browser_select_option` | `element_id`, `value` | Select dropdown option |
| `browser_scroll_up` | `target`, `amount` | Scroll up |
| `browser_scroll_down` | `target`, `amount` | Scroll down |
| `browser_console_exec` | `code` | Execute JavaScript via CDP |
| `browser_console_view` | - | Return console logs |

**Execution flow:**
```
Claude → Orchestration → TCP → start_server
    → Playwright connects to Chromium (CDP port 9222)
    → Executes browser action
    → Takes screenshot → saves to /home/ubuntu/screenshots/
    → Extracts page content (Markdown + element index)
    → Returns: { screenshot: base64, content: markdown, elements: [...] }
    → TCP back → Orchestration
    → Screenshot sent to Claude for vision analysis
```

**Browser automation stack:**
```
start_server (PID 794)
    ↓ Playwright
Chromium (PID 901, CDP port 9222)
    ↓ Display :0
Neko Server (PID ~1351, port 8333)
    ↓ WebRTC
User's Browser (live stream)
```

**Custom scripts injected:**
- `analyzeHtmlElements.js` - Analyze DOM structure
- `captchaDetection.js` - Detect CAPTCHAs
- `collectClickableElements.js` - Index clickable elements
- `scrollAtPoint.js` - Scroll operations

### Search Tool (1) — Executed in Orchestration

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `info_search_web` | `queries[]`, `type`, `time` | Search the web |

**Execution flow:**
```
Claude → Orchestration → External search API → Results → Claude
```

No sandbox involvement. Orchestration calls external search API directly.

### Deploy Tools (2) — Executed in Orchestration

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `deploy_expose_port` | `port` | Create public URL for sandbox port |
| `deploy_apply_deployment` | `config` | Deploy to hosting |

**Execution flow (expose_port):**
```
Claude → Orchestration → Configure proxy:
    https://{port}-{id}.us2.manus.computer → E2B:port
    → Return public URL to Claude
```

### Other Tools (2) — Executed in Orchestration

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `make_manus_page` | `content` | Create a Manus Page |
| `idle` | - | Mark task as complete |

---

## 3.3 Tool Routing Logic

The orchestration layer routes tools based on their category:

```
Tool call received from Claude
    ↓
Is it a sandbox tool? (file_*, shell_*, browser_*)
    ├── YES → Route to E2B sandbox via TCP to 169.254.0.21:8330
    └── NO → Handle locally in orchestration
```

**Routing table:**

| Category | Execution Location | Connection |
|----------|-------------------|------------|
| `file_*` | E2B Sandbox | TCP to :8330 |
| `shell_*` | E2B Sandbox | TCP to :8330 |
| `browser_*` | E2B Sandbox | TCP to :8330 |
| `message_*` | Orchestration | WebSocket to frontend |
| `info_*` | Orchestration | External API |
| `deploy_*` | Orchestration | Proxy configuration |
| `make_*` | Orchestration | Internal |
| `idle` | Orchestration | Internal |

---

## 3.4 Network Patterns Per Tool Call

### Sandbox-Executed Tools:

**Each tool call creates a NEW TCP connection:**
```
FROM: 10.93.83.1:<random_ephemeral_port>
TO:   169.254.0.21:8330
```

**Observed timing:**
- Connection establishment: ~5ms
- Tool execution: 50ms - 10s (depends on operation)
- Connection teardown: ~5ms

**Example traced connections:**
```
Before plan call:  10.93.83.1:47070 → 169.254.0.21:8330
After plan call:   10.93.83.1:47534 → 169.254.0.21:8330 (NEW)

Before shell call: 10.93.83.1:35062 → 169.254.0.21:8330
After shell call:  10.93.83.1:47416 → 169.254.0.21:8330 (NEW)

After file write:  10.93.83.1:37392 → 169.254.0.21:8330 (NEW)
```

### Orchestration-Executed Tools:

**No sandbox connection needed.** Handled entirely within orchestration.

---

## 3.5 Tool Definition Format

Tools are sent to Claude as function definitions with every LLM API call:

```json
{
  "tools": [
    {
      "name": "file_write",
      "description": "Overwrite the full content of a text file...",
      "input_schema": {
        "type": "object",
        "properties": {
          "path": {
            "type": "string",
            "description": "The absolute path to the target file"
          },
          "text": {
            "type": "string",
            "description": "The content to be written"
          }
        },
        "required": ["path", "text"]
      }
    },
    // ... 28 more tools
  ]
}
```

**All 29 tools are sent with EVERY Claude API call.** Claude sees the full toolset and decides which to use.

---

## 3.6 Tool Execution State Machine

Each tool call goes through these states:

```
PENDING → EXECUTING → COMPLETED
                   └→ FAILED
                   └→ TIMEOUT
```

**State transitions:**
```
1. Claude returns tool_use → State: PENDING
2. Orchestration receives → State: EXECUTING
   WebSocket → Frontend: { event: "tool_call", status: "executing" }
3a. Success → State: COMPLETED
    WebSocket → Frontend: { event: "tool_result", status: "completed" }
3b. Error → State: FAILED
    WebSocket → Frontend: { event: "tool_result", status: "failed", error: "..." }
3c. Timeout → State: TIMEOUT
    WebSocket → Frontend: { event: "tool_result", status: "timeout" }
```

---

## 3.7 Tool Call Lifecycle (Database)

For each tool call:

```sql
-- Step 1: Tool call initiated
INSERT INTO tool_calls (session_id, tool_name, input, status, created_at)
VALUES ('abc123', 'file_write', '{"path": "...", "text": "..."}', 'executing', NOW());

-- Step 2: Tool call completed
UPDATE tool_calls
SET status = 'completed', output = '{"success": true}', completed_at = NOW()
WHERE id = 'tool_call_id';

-- Step 3: Credits deducted
UPDATE sessions
SET costed_credits = costed_credits + 1
WHERE uid = 'abc123';
```

---

## 3.8 Webdev-Specific Tools

Beyond the 29 core tools, webdev projects add specialized tools:

| Tool | Purpose |
|------|---------|
| `webdev_init_project` | Create new web project |
| `webdev_check_status` | Check dev server health |
| `webdev_restart_server` | Restart dev server |
| `webdev_add_feature` | Add database/auth/stripe |
| `webdev_save_checkpoint` | Save project state (git commit) |
| `webdev_rollback_checkpoint` | Rollback to previous state |
| `webdev_execute_sql` | Run SQL on TiDB |

These tools are **additional** to the 29 core tools and are only available when a webdev project is active.

---

## 3.9 Error Handling

When a tool fails:

```
1. start_server returns error
2. Orchestration captures error
3. Error sent back to Claude as tool_result
4. Claude reads error and decides:
   ├── Retry with different parameters
   ├── Try alternative approach
   └── Report error to user (after 3 failures)
```

**Error propagation:**
```
E2B Sandbox (error) → TCP → Orchestration → Claude → Decision
                                          → WebSocket → Frontend (error UI)
```

---

## 3.10 MCP Tools (Connectors)

MCP (Model Context Protocol) tools are separate from the 29 core tools. They're accessed via `manus-mcp-cli` through the shell tool:

```
Claude decides to use Gmail
    ↓
Claude calls: shell_exec("manus-mcp-cli tool call gmail_search_messages --server gmail --input '{...}'")
    ↓
Orchestration → E2B sandbox → start_server → PTY
    ↓
manus-mcp-cli → MCP Server (external, Manus infrastructure)
    ↓
MCP Server → Gmail API (with stored OAuth tokens)
    ↓
Results → /tmp/manus-mcp/mcp_result_*.json
    ↓
Claude reads result file
```

**Available MCP servers (configured per user):**
- `gmail` - Gmail integration (search, read, send)
- And 190+ other connectors available in Manus settings

**Gmail tools:**
- `gmail_search_messages` - Search emails
- `gmail_read_threads` - Read email threads
- `gmail_send_messages` - Send emails
