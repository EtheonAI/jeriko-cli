# Supplement C: Tool-by-Tool Execution Mechanics

## C.1 Overview

This document traces every tool available in the Manus system, documenting the exact execution chain from LLM function call to sandbox process to result. For each tool, we document: the JSON function call, the process chain inside the sandbox, the network calls involved, the files created, and the timing.

---

## C.2 Universal Execution Pattern

Every tool call follows this 14-step pattern:

```
1.  User sends message → Frontend (manus.im)
2.  Frontend → Orchestration (api.manus.im / 10.9.181.1) via WebSocket
3.  Orchestration → LLM API (api.manus.im/api/llm-proxy/v1) via HTTPS
4.  LLM returns function call JSON (tool_calls array)
5.  Orchestration parses and validates the function call
6.  Orchestration → E2B Sandbox (169.254.0.21:8330) via WebSocket
7.  start_server (PID 794) receives and routes to handler
8.  Handler executes the operation (tool-specific)
9.  Result compiled by handler
10. Sandbox → Orchestration via WebSocket
11. Orchestration → LLM API with tool result
12. LLM processes result, decides next action
13. Orchestration → Frontend via WebSocket
14. User sees response
```

**Exceptions to this pattern:**
- **search tool:** Executes in orchestration layer, NOT in sandbox
- **message tool:** Sends directly to frontend, no sandbox involvement
- **plan tool:** Updates orchestration state, no sandbox involvement
- **schedule tool:** Stores in orchestration, no sandbox involvement

---

## C.3 Shell Tool

### Actions: `exec`, `view`, `wait`, `send`, `kill`

### C.3.1 `shell.exec` — Execute Command

**LLM Function Call:**
```json
{
  "name": "shell",
  "arguments": {
    "action": "exec",
    "command": "ls -la /home/ubuntu",
    "session": "default",
    "timeout": 30
  }
}
```

**Process Chain Inside Sandbox:**
```
start_server (PID 794)
    │
    ├── Checks: Does PTY session "default" exist?
    │   ├── YES → Reuse existing PTY
    │   └── NO → Create new PTY:
    │       └── /usr/bin/sudo -n su ubuntu (PID 14783)
    │           └── su ubuntu (PID 14787)
    │               └── bash (PID 14788) [/dev/pts/11]
    │                   ├── Sources /home/ubuntu/.bashrc
    │                   ├── Sources /home/ubuntu/.env
    │                   └── Sources /home/ubuntu/.user_env
    │
    ├── Writes to PTY stdin: "ls -la /home/ubuntu\n"
    │
    ├── Reads from PTY stdout (with timeout=30s):
    │   └── "total 123\ndrwxr-x--- 16 ubuntu ubuntu 4096 Feb 9 14:56 .\n..."
    │
    └── Returns: { "output": "...", "exit_code": 0 }
```

**PTY File Descriptors (observed):**
```
/dev/ptmx → FD 21 (master side)
/dev/pts/11 → FD 22, 23 (slave side, stdin/stdout)
```

**Session Persistence:** Shell sessions persist by name. Session "default" created in Conversation A is accessible in Conversation B (same sandbox). Working directory and environment persist within a session.

**Timing:** ~20-50ms overhead + command execution time

### C.3.2 `shell.view` — View Session Output

**Purpose:** Read the current output buffer of a shell session without executing a new command.

**Process Chain:**
```
start_server → Read PTY output buffer for session → Return text
```

### C.3.3 `shell.wait` — Wait for Completion

**Purpose:** Wait for a previously started long-running command to complete.

**Process Chain:**
```
start_server → Poll PTY for session → Wait until command returns → Return output
```

### C.3.4 `shell.send` — Send Input

**Purpose:** Send keystrokes to a running process (e.g., answering a prompt).

**Process Chain:**
```
start_server → Write to PTY stdin → "\n" for Enter, "\x1b[B" for arrow down, etc.
```

### C.3.5 `shell.kill` — Terminate Process

**Purpose:** Kill the running process in a shell session.

**Process Chain:**
```
start_server → Send SIGTERM to process group of session → Confirm termination
```

---

## C.4 File Tool

### Actions: `read`, `write`, `append`, `edit`, `view`

### C.4.1 `file.write` — Create/Overwrite File

**LLM Function Call:**
```json
{
  "name": "file",
  "arguments": {
    "action": "write",
    "path": "/home/ubuntu/notes.txt",
    "text": "Meeting Notes\n- Topic 1\n- Topic 2\n"
  }
}
```

**Process Chain:**
```
start_server (PID 794)
    │
    ├── Validate path: /home/ubuntu/notes.txt
    │   ├── Check: Is path under allowed directories? ✅
    │   └── Check: Does parent directory exist? ✅ (create if not)
    │
    ├── Python: open('/home/ubuntu/notes.txt', 'w')
    ├── Write content
    ├── Close file
    │
    └── Return: { "status": "success", "bytes_written": 35, "path": "/home/ubuntu/notes.txt" }
```

**File on Disk:**
```
Path: /home/ubuntu/notes.txt
Size: 35 bytes
Owner: ubuntu:ubuntu
Permissions: 0644 (-rw-r--r--)
Inode: 262107
Device: fe00h (E2B sandbox disk)
```

**Timing:** ~10-20ms

### C.4.2 `file.read` — Read File Content

**Process Chain:**
```
start_server → Validate path → open(path, 'r') → Read content → Return text
```

**With range parameter:** Reads only specified line range (1-indexed).

### C.4.3 `file.edit` — Find/Replace in File

**LLM Function Call:**
```json
{
  "name": "file",
  "arguments": {
    "action": "edit",
    "path": "/home/ubuntu/notes.txt",
    "edits": [
      { "find": "Topic 1", "replace": "Budget Review" },
      { "find": "Topic 2", "replace": "Q2 Planning", "all": true }
    ]
  }
}
```

**Process Chain:**
```
start_server → Read file → Apply edits sequentially → Write file → Return result
```

**Atomicity:** All edits must succeed or none are applied.

### C.4.4 `file.view` — Multimodal File View

**Purpose:** View images, PDFs, and other non-text files using multimodal understanding.

**Process Chain:**
```
start_server → Read file as binary → Encode base64 → Return to orchestration
    ↓
Orchestration → LLM API with image_url content type
    ↓
LLM (multimodal) → Sees and describes the image/PDF
```

**For PDFs:** The `range` parameter specifies page numbers, not line numbers.

---

## C.5 Browser Tool

### Actions: `navigate`, `click`, `input`, `scroll`, `save_image`, `fill_form`, `press_key`, `select_option`, `find_keyword`, `console_exec`, `upload_file`

### C.5.1 `browser.navigate` — Navigate to URL

**LLM Function Call:**
```json
{
  "name": "browser",
  "arguments": {
    "url": "https://example.com",
    "intent": "informational",
    "focus": "Main content and navigation structure"
  }
}
```

**Process Chain (6 stages):**

**Stage 1: Command Routing**
```
start_server (PID 794)
    └── Browser handler receives navigate command
```

**Stage 2: Playwright → Chromium**
```
start_server → Playwright API
    └── Playwright → CDP WebSocket (127.0.0.1:9222)
        └── CDP Command: Page.navigate(url="https://example.com")
```

**Stage 3: Chromium Loads Page**
```
Chromium (PID 901)
    ├── DNS lookup: example.com → 93.184.216.34
    ├── TCP: 169.254.0.21:xxxxx → 93.184.216.34:443
    ├── TLS handshake (TLS 1.3)
    ├── HTTP GET / (HTTP/2)
    ├── Receive HTML response
    ├── Parse HTML → DOM tree
    ├── Load CSS → CSSOM
    ├── Load JavaScript → Execute
    ├── Load images/fonts/media
    └── Render → Composite → Paint
```

**Stage 4: Manus Helper Extension Injects Scripts**
```
Manus Helper Extension (v1.1.11)
    ├── content.ts.js → Injected into page
    ├── ReaderArticleFinder.js → Extracts readable content
    └── Triggers:
        ├── analyzeHtmlElements.js → Page structure analysis
        ├── collectClickableElements.js → Interactive element indexing
        └── Markdown extraction from page content
```

**Stage 5: Screenshot Capture**
```
start_server → CDP Command: Page.captureScreenshot(format="webp", quality=80)
    ↓
Screenshot saved: /home/ubuntu/screenshots/example_com_2026-02-09_14-42-00_a1b2.webp
    ↓
Annotate screenshot: Draw numbered boxes around interactive elements
```

**Stage 6: Result Compilation**
```
Return: {
  "url": "https://example.com",
  "title": "Example Domain",
  "markdown": "# Example Domain\n\nThis domain is for use in illustrative examples...",
  "elements": [
    { "index": 1, "tag": "a", "text": "More information...", "href": "https://www.iana.org/domains/example" }
  ],
  "screenshot": "/home/ubuntu/screenshots/example_com_2026-02-09_14-42-00_a1b2.webp",
  "viewport": { "width": 1280, "height": 1029 }
}
```

**Network Calls:**
- Multiple HTTPS (Chromium → target site): Page + assets (~1-3MB)
- Multiple CDP WebSocket (start_server → Chromium): Commands + responses
- 1x WebSocket (sandbox → orchestration): Results + screenshot data

**Files Created:**
- 1x screenshot: `/home/ubuntu/screenshots/{domain}_{date}_{time}_{random}.webp` (~50-200KB)

**Timing:** ~2-5 seconds

### C.5.2 `browser.click` — Click Element

**LLM Function Call:**
```json
{
  "name": "browser_click",
  "arguments": {
    "index": 3,
    "coordinate": null
  }
}
```

**Process Chain:**
```
start_server → Playwright
    ├── findElementByClickId.js → Locate element with index 3
    ├── Scroll element into view
    ├── CDP: Input.dispatchMouseEvent(type="mousePressed", x=450, y=320)
    ├── CDP: Input.dispatchMouseEvent(type="mouseReleased", x=450, y=320)
    ├── Wait for navigation/response
    ├── Re-analyze page (if navigation occurred)
    ├── Capture new screenshot
    └── Return updated page state
```

### C.5.3 `browser.input` — Type Text

**Process Chain:**
```
start_server → Playwright
    ├── Focus target element
    ├── CDP: Input.dispatchKeyEvent for each character
    ├── Or: CDP: Input.insertText(text="search query")
    └── Return confirmation
```

### C.5.4 `browser.console_exec` — Execute JavaScript

**LLM Function Call:**
```json
{
  "name": "browser_console_exec",
  "arguments": {
    "javascript": "document.querySelectorAll('a').length"
  }
}
```

**Process Chain:**
```
start_server → Playwright
    └── CDP: Runtime.evaluate(expression="document.querySelectorAll('a').length")
        └── Returns: { "result": { "type": "number", "value": 42 } }
```

### C.5.5 `browser.save_image` — Download Image

**Process Chain:**
```
start_server → Playwright
    ├── CDP: Fetch image URL
    ├── Download image data
    ├── Save to /home/ubuntu/Downloads/{filename}
    └── Return file path
```

---

## C.6 Search Tool

### Types: `info`, `image`, `api`, `news`, `tool`, `data`, `research`

**Critical distinction:** Search executes in the ORCHESTRATION layer, NOT in the sandbox.

### C.6.1 `search.info` — Web Search

**LLM Function Call:**
```json
{
  "name": "search",
  "arguments": {
    "type": "info",
    "queries": ["E2B sandbox", "E2B documentation", "E2B code interpreter"]
  }
}
```

**Execution Flow:**
```
Orchestration (NOT sandbox)
    │
    ├── POST https://api.manus.im/search/v1/query
    │   Body: { "type": "info", "queries": [...] }
    │
    ├── Search Service:
    │   ├── Calls external search API (Google/Bing/custom)
    │   ├── Aggregates results from up to 3 queries
    │   └── Ranks by relevance
    │
    └── Returns to LLM:
        {
          "results": [
            { "title": "...", "url": "...", "snippet": "...", "position": 1 },
            ...
          ]
        }
```

**No sandbox involvement.** Zero files created. ~500ms-2s.

### C.6.2 `search.image` — Image Search

**Execution Flow:**
```
Orchestration
    ├── POST search API with type="image"
    ├── Download all result images (full resolution)
    ├── Save to sandbox: /home/ubuntu/.search_cache/{filename}
    └── Return image paths + metadata to LLM
```

**Files Created:** Multiple images in `/home/ubuntu/.search_cache/`

---

## C.7 Match Tool

### Actions: `glob`, `grep`

### C.7.1 `match.glob` — Find Files by Pattern

**LLM Function Call:**
```json
{
  "name": "match",
  "arguments": {
    "action": "glob",
    "scope": "/home/ubuntu/**/*.py"
  }
}
```

**Process Chain:**
```
start_server → Python glob.glob("/home/ubuntu/**/*.py", recursive=True)
    → Sort by modification time (descending)
    → Return list of matching file paths
```

### C.7.2 `match.grep` — Search File Contents

**LLM Function Call:**
```json
{
  "name": "match",
  "arguments": {
    "action": "grep",
    "scope": "/home/ubuntu/**/*.py",
    "regex": "def\\s+main",
    "leading": 2,
    "trailing": 2
  }
}
```

**Process Chain:**
```
start_server → Glob files matching scope → For each file: regex search
    → Return matched lines with context (leading/trailing lines)
```

---

## C.8 Message Tool

### Types: `info`, `ask`, `result`

**Message tool does NOT execute in the sandbox.** It communicates directly from orchestration to frontend.

### C.8.1 `message.info` — Inform User

**Process Chain:**
```
LLM returns: message(type="info", text="Working on it...")
    ↓
Orchestration → Frontend (WebSocket):
    { "type": "info_message", "content": "Working on it..." }
    ↓
Frontend displays info message (no user response needed)
    ↓
LLM continues immediately (non-blocking)
```

### C.8.2 `message.ask` — Ask User

**Process Chain:**
```
LLM returns: message(type="ask", text="Which format?")
    ↓
Orchestration → Frontend (WebSocket):
    { "type": "ask_message", "content": "Which format?" }
    ↓
Frontend displays question, enables input
    ↓
User types response: "PDF"
    ↓
Frontend → Orchestration (WebSocket):
    { "type": "user_response", "content": "PDF" }
    ↓
Orchestration → LLM: Continue with user's answer
    ↓
LLM RESUMES (was blocked waiting for response)
```

### C.8.3 `message.result` — Deliver Final Results

**Process Chain:**
```
LLM returns: message(type="result", text="Here's your report", attachments=["/home/ubuntu/report.pdf"])
    ↓
Orchestration processes attachments:
    For each attachment path:
        1. Request file from sandbox (WebSocket)
        2. Receive file data (base64)
        3. Upload to S3
        4. Generate signed CDN URL
    ↓
Orchestration → Frontend (WebSocket):
    {
      "type": "result_message",
      "content": "Here's your report",
      "attachments": [{ "name": "report.pdf", "url": "https://cdn.manus.im/...", "size": 245678 }]
    }
    ↓
Frontend displays message + download links
    ↓
Task marked as COMPLETE
```

---

## C.9 Plan Tool

### Actions: `update`, `advance`

**Plan tool updates orchestration state only.** No sandbox involvement.

### C.9.1 `plan.update` — Create/Revise Plan

**LLM Function Call:**
```json
{
  "name": "plan",
  "arguments": {
    "action": "update",
    "current_phase_id": 1,
    "goal": "Build a landing page",
    "phases": [
      { "id": 1, "title": "Design brainstorming", "capabilities": {} },
      { "id": 2, "title": "Implement layout", "capabilities": { "web_development": true } },
      { "id": 3, "title": "Deliver to user", "capabilities": {} }
    ]
  }
}
```

**Process Chain:**
```
Orchestration stores plan in session state
    ↓
Frontend receives plan update via WebSocket
    ↓
Timeline UI renders plan card:
    ┌─────────────────────────────────┐
    │ Goal: Build a landing page      │
    │ → Phase 1: Design brainstorming │
    │   Phase 2: Implement layout     │
    │   Phase 3: Deliver to user      │
    └─────────────────────────────────┘
```

### C.9.2 `plan.advance` — Move to Next Phase

**Process Chain:**
```
Orchestration updates current_phase_id
    ↓
Frontend updates plan card:
    ┌─────────────────────────────────┐
    │ Goal: Build a landing page      │
    │ ✓ Phase 1: Design brainstorming │
    │ → Phase 2: Implement layout     │
    │   Phase 3: Deliver to user      │
    └─────────────────────────────────┘
```

---

## C.10 Map Tool (Parallel Processing)

**LLM Function Call:**
```json
{
  "name": "map",
  "arguments": {
    "name": "research_companies",
    "title": "Research three tech companies",
    "prompt_template": "Research {{input}} and provide overview and recent news",
    "target_count": 3,
    "inputs": ["Apple", "Google", "Microsoft"],
    "output_schema": [
      { "name": "company_name", "type": "string", "title": "Company Name", "description": "...", "format": "..." },
      { "name": "overview", "type": "string", "title": "Overview", "description": "...", "format": "..." }
    ]
  }
}
```

**Execution Flow (Detailed):**

```
Step 1: Orchestration receives map call from main LLM
    ↓
Step 2: Orchestration spawns N E2B sandboxes (one per input):
    ├── Sandbox A: E2B API → Create from template (~150ms)
    ├── Sandbox B: E2B API → Create from template (~150ms)
    └── Sandbox C: E2B API → Create from template (~150ms)
    (All spawned in PARALLEL)
    ↓
Step 3: Each sandbox bootstraps:
    ├── start_server starts
    ├── Environment variables injected (same OPENAI_API_KEY)
    ├── WebSocket connection established
    └── Ready for subtask
    ↓
Step 4: Orchestration sends subtask to each sandbox:
    Sandbox A: "Research Apple and provide overview and recent news"
    Sandbox B: "Research Google and provide overview and recent news"
    Sandbox C: "Research Microsoft and provide overview and recent news"
    ↓
Step 5: Each sandbox runs INDEPENDENTLY:
    Each sandbox has its own LLM instance that:
    ├── Reads the prompt
    ├── Decides which tools to use (search, browser, etc.)
    ├── Makes tool calls within its own sandbox
    ├── Calls LLM via OPENAI_API_KEY through Manus proxy
    ├── Iterates until task complete
    └── Returns structured results matching output_schema
    ↓
Step 6: Orchestration collects results:
    ├── Sandbox A returns: { "company_name": "Apple Inc.", "overview": "..." }
    ├── Sandbox B returns: { "company_name": "Google LLC", "overview": "..." }
    └── Sandbox C returns: { "company_name": "Microsoft Corp.", "overview": "..." }
    ↓
Step 7: Orchestration destroys subtask sandboxes
    ↓
Step 8: Orchestration returns aggregated results to main LLM:
    {
      "results": [
        { "company_name": "Apple Inc.", "overview": "..." },
        { "company_name": "Google LLC", "overview": "..." },
        { "company_name": "Microsoft Corp.", "overview": "..." }
      ]
    }
```

**Key details:**
- Subtask sandboxes are **ephemeral** (destroyed after completion)
- Each subtask has its own **independent LLM instance**
- Subtask sandboxes do NOT share filesystem with main sandbox
- Files can be sent TO subtasks via absolute paths in prompt_template
- Files can be returned FROM subtasks via `file` type in output_schema
- Up to **2000 subtasks** can be spawned in parallel

**Timing:** ~10-30 seconds (parallel execution)

---

## C.11 Generate Tool

**LLM Function Call:**
```json
{
  "name": "generate",
  "arguments": {
    "brief": "Generate a hero image for a tech startup landing page"
  }
}
```

**Execution Flow:**
```
Step 1: Orchestration enters "generate mode"
    ↓
Step 2: LLM receives special generate tools (image_generation, etc.)
    ↓
Step 3: LLM calls image_generation with detailed prompt
    ↓
Step 4: Orchestration → Image Generation API (NOT in sandbox):
    POST https://api.manus.im/generate/v1/image
    Body: { "prompt": "...", "model": "...", "size": "1024x1024" }
    ↓
Step 5: Image generation service calls external provider (DALL-E, Stability AI, etc.)
    ↓
Step 6: Generated image returned as cloud URL
    ↓
Step 7: LLM receives URL, can use directly in code or save to sandbox
```

**Timing:** ~5-30 seconds

---

## C.12 Schedule Tool

**LLM Function Call:**
```json
{
  "name": "schedule",
  "arguments": {
    "type": "cron",
    "cron": "0 0 9 * * 1-5",
    "repeat": true,
    "name": "morning_report",
    "prompt": "Generate daily morning report with latest news"
  }
}
```

**Process Chain:**
```
Orchestration stores schedule:
    {
      "name": "morning_report",
      "cron": "0 0 9 * * 1-5",
      "repeat": true,
      "prompt": "Generate daily morning report..."
    }
    ↓
At scheduled time (9:00 AM weekdays):
    Orchestration → Creates new session
    Orchestration → Spins up sandbox (or reuses existing)
    Orchestration → Sends prompt to LLM
    LLM executes task
    Results delivered to user
```

**No sandbox involvement at schedule creation time.**

---

## C.13 Slides Tool

**LLM Function Call:**
```json
{
  "name": "slides",
  "arguments": {
    "slide_content_file_path": "/home/ubuntu/project/slide_content.md",
    "slide_count": 10,
    "generate_mode": "html"
  }
}
```

**Process Chain:**
```
Orchestration reads slide content from sandbox
    ↓
Slide generation service creates presentation
    ↓
Returns slides URI: manus-slides://{version_id}
    ↓
Frontend renders slides in presentation viewer
```

---

## C.14 Webdev Tools

### C.14.1 `webdev_init_project`

**Process Chain:**
```
Orchestration → Sandbox:
    1. Create project directory: /home/ubuntu/{project_name}/
    2. Scaffold template files (React + Tailwind + shadcn/ui)
    3. Install dependencies: pnpm install
    4. Start dev server: vite on port 3000
    5. Create initial git commit
    ↓
Return: {
    "project_path": "/home/ubuntu/test-webdev-trace",
    "version": "e1f2a434",
    "dev_server_url": "https://3000-{id}.us2.manus.computer",
    "port": 3000
}
```

### C.14.2 `webdev_save_checkpoint`

**Process Chain:**
```
Sandbox:
    1. git add -A
    2. git commit -m "{description}"
    3. Capture screenshot of running app
    4. Upload checkpoint metadata to orchestration
    ↓
Return: { "version_id": "abc123", "description": "..." }
```

### C.14.3 `webdev_check_status`

**Process Chain:**
```
Sandbox:
    1. Check dev server process
    2. Read recent logs from .manus-logs/
    3. Check TypeScript compilation
    4. Check dependency status
    5. Capture preview screenshot
    ↓
Return: { "status": "running", "port": 3000, "errors": [], "screenshot": "..." }
```

### C.14.4 `webdev_restart_server`

**Process Chain:**
```
Sandbox:
    1. Kill existing dev server process
    2. Clear build cache
    3. Restart: pnpm run dev
    4. Wait for server ready
    ↓
Return: { "status": "running", "port": 3000 }
```

### C.14.5 `webdev_add_feature`

**Process Chain:**
```
Sandbox:
    1. Install additional dependencies
    2. Scaffold new files (database, auth, etc.)
    3. Update configuration
    4. Restart server
    ↓
Return: { "feature": "web-db-user", "status": "added" }
```

### C.14.6 `webdev_execute_sql`

**Process Chain:**
```
Sandbox:
    1. Connect to TiDB database (using DATABASE_URL)
    2. Execute SQL query
    3. Return results
    ↓
Return: { "rows": [...], "affected_rows": 5 }
```

---

## C.15 Expose Tool

**LLM Function Call:**
```json
{
  "name": "expose",
  "arguments": {
    "port": 3000
  }
}
```

**Process Chain:**
```
Orchestration configures proxy:
    Internal: 169.254.0.21:3000
    External: https://3000-{sandbox_id}.us2.manus.computer
    ↓
Return: { "url": "https://3000-{sandbox_id}.us2.manus.computer" }
```

---

## C.16 MCP Tools (via manus-mcp-cli)

**LLM Function Call:**
```json
{
  "name": "shell",
  "arguments": {
    "action": "exec",
    "command": "manus-mcp-cli tool call search_emails --server gmail --input '{\"query\": \"from:boss@company.com\"}'",
    "session": "mcp"
  }
}
```

**Process Chain:**
```
start_server → PTY → bash → manus-mcp-cli
    ├── manus-mcp-cli connects to MCP server (port 8350)
    ├── MCP server routes to Gmail connector
    ├── Gmail connector:
    │   ├── Uses stored OAuth token (server-side)
    │   ├── Calls Gmail API: GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:boss@company.com
    │   └── Returns email results
    ├── MCP server returns results to manus-mcp-cli
    └── manus-mcp-cli prints JSON results to stdout
```

---

## C.17 Performance Summary

| Tool | Execution Layer | Avg Duration | Network Calls | Files Created |
|------|----------------|-------------|---------------|---------------|
| shell.exec | Sandbox (PTY) | 20-50ms + exec | 2x WebSocket | 0 |
| file.write | Sandbox (filesystem) | 10-20ms | 2x WebSocket | 1 |
| file.read | Sandbox (filesystem) | 10-20ms | 2x WebSocket | 0 |
| file.view | Sandbox + LLM (multimodal) | 500ms-2s | 2x WebSocket + 1x HTTPS | 0 |
| browser.navigate | Sandbox (Playwright+CDP) | 2-5s | Many HTTP + WebSocket | 1 screenshot |
| browser.click | Sandbox (Playwright+CDP) | 500ms-2s | WebSocket + HTTP | 1 screenshot |
| search.info | Orchestration | 500ms-2s | 1x HTTPS | 0 |
| search.image | Orchestration + Sandbox | 1-3s | Multiple HTTPS + WebSocket | Multiple images |
| message.info | Orchestration → Frontend | <100ms | 1x WebSocket | 0 |
| message.ask | Orchestration → Frontend | Blocks until user responds | 2x WebSocket | 0 |
| message.result | Orchestration → Frontend + S3 | 100ms-2s | Multiple | 0 (S3 upload) |
| plan.update | Orchestration | <100ms | 1x WebSocket | 0 |
| map (N subtasks) | N new sandboxes | 10-30s | Many (parallel) | Varies |
| generate | Orchestration + External API | 5-30s | Multiple HTTPS | 1 image |
| schedule | Orchestration | <100ms | 1x WebSocket | 0 |
| webdev_init_project | Sandbox | 30-60s | Many | Many (scaffold) |
| webdev_save_checkpoint | Sandbox | 10-45s | WebSocket + git | 0 |
| expose | Orchestration (proxy config) | <100ms | 1x WebSocket | 0 |
| MCP tools | Sandbox → MCP server → External API | 1-5s | Multiple | 0 |

---

## C.18 Network Bandwidth Per Tool

| Tool | Upload (to orchestration) | Download (from orchestration) |
|------|--------------------------|------------------------------|
| shell.exec | ~1KB (command) | ~1-100KB (output) |
| file.write (1MB file) | ~1KB (command) | ~1.3MB (base64 content) |
| file.read (1MB file) | ~1.3MB (base64 content) | ~1KB (command) |
| browser.navigate | ~100-300KB (screenshot + markdown) | ~10KB (command) |
| search | 0 (not in sandbox) | ~5-50KB (results) |
| message.result (with 1MB attachment) | ~1.3MB (base64 file) | ~1KB (command) |
| map (3 subtasks) | ~3x sandbox overhead | ~3x results |
| generate | 0 (not in sandbox) | ~1-5MB (image) |
