# Supplement B: E2B Bootstrap and Spin-Up Sequence

## B.1 Overview

This document traces the complete lifecycle of an E2B sandbox from template creation through user session initialization, including every process that starts, every service that loads, and every connection that establishes. The sequence covers Firecracker microVM boot, `start_server` initialization, Chromium/Playwright launch, Neko WebRTC server startup, StateSync browser state restoration, and orchestration handshake.

---

## B.2 Phase 1: Template Build (One-Time)

Manus engineers build the E2B template image. This is a snapshot of a fully configured VM that E2B stores and clones for each user.

**What goes into the template:**

```
Ubuntu 22.04 Base Image
    │
    ├── /opt/.manus/current/
    │   └── start_server          (14.9 MB compiled Go/Rust binary, stripped)
    │
    ├── /opt/.manus/.sandbox-runtime/
    │   ├── data_api.py           (API proxy client)
    │   └── app_data/js/
    │       ├── analyzeHtmlElements.js
    │       ├── captchaDetection.js
    │       ├── collectClickableElements.js
    │       ├── scrollAtPoint.js
    │       ├── selectOption.js
    │       ├── findElementByClickId.js
    │       └── initScript.js
    │
    ├── /home/ubuntu/
    │   ├── .env                  (system environment variables)
    │   ├── .bashrc               (sources .env and .user_env)
    │   └── .secrets/             (empty, populated at session start)
    │
    ├── System Packages:
    │   ├── Python 3.11 + pip packages (fastapi, uvicorn, playwright, openai, etc.)
    │   ├── Node.js 22.13.0 + pnpm
    │   ├── Chromium (stable)
    │   ├── Playwright driver
    │   ├── code-server (VS Code web)
    │   ├── Neko server (WebRTC)
    │   └── Standard tools (git, curl, wget, etc.)
    │
    ├── Chrome Extension:
    │   └── "Manus Helper" v1.1.11
    │       ├── manifest.json (permissions: declarativeNetRequest, scripting, webRequest, etc.)
    │       ├── ReaderArticleFinder.js (191 KB - content extraction)
    │       ├── content.ts.js (77 KB - injected into all pages)
    │       └── background.ts.js (service worker)
    │
    └── Systemd/Init Services:
        ├── start_server.service
        ├── chromium.service
        ├── neko.service
        └── statesync.service
```

**Template is snapshotted** by E2B and stored. Every new sandbox is a clone of this snapshot.

---

## B.3 Phase 2: Sandbox Spawn (~150ms)

When a user needs a sandbox (first session or after hibernation timeout):

```
TRIGGER: User starts conversation (or sandbox expired)
    ↓
Orchestration → E2B API: "Create sandbox from template X"
    ↓
E2B Infrastructure:
    1. Firecracker hypervisor allocates microVM
    2. Clones template snapshot (copy-on-write)
    3. Assigns IP: 169.254.0.21 (link-local)
    4. Boots Linux kernel
    5. Init system starts
    ↓
~150ms elapsed
    ↓
Sandbox is running
```

**Why 150ms?** Firecracker uses:
- **Copy-on-write** filesystem (no full copy needed)
- **Minimal kernel** (stripped Linux)
- **Pre-configured image** (no package installation)
- **No Docker overhead** (bare metal VM, not container)

---

## B.4 Phase 3: Service Startup Sequence

After the VM boots, services start in this order:

### Step 1: `start_server` (PID ~794)

```
Init system → /opt/.manus/current/start_server
    ├── Binds 127.0.0.1:9330 (internal API)
    ├── Binds 0.0.0.0:8330 (external API - orchestration access)
    ├── Initializes:
    │   ├── FastAPI application
    │   ├── gRPC server
    │   ├── WebSocket server
    │   ├── Tool handlers (shell, file, browser)
    │   ├── PTY manager (for shell sessions)
    │   └── OpenTelemetry instrumentation
    └── WAITS for orchestration connection on port 8330
```

**Port 8330 is the critical port.** This is how the orchestration layer communicates with the sandbox. It is bound to `0.0.0.0` (all interfaces) so it is reachable from outside the VM.

**Port 9330 is internal only.** Bound to `127.0.0.1`, used for health checks and internal coordination.

### Step 2: Chromium (PID ~901)

```
Init system → chromium-browser
    ├── Flags:
    │   ├── --remote-debugging-port=9222  (CDP access)
    │   ├── --no-sandbox                  (running as non-root in VM)
    │   ├── --disable-gpu                 (no GPU in Firecracker)
    │   ├── --headless=new                (no display needed for automation)
    │   └── --user-data-dir=/home/ubuntu/.config/chromium
    ├── Loads Manus Helper extension
    ├── Opens about:blank as initial page
    └── Listens on 127.0.0.1:9222 for CDP connections
```

### Step 3: Playwright Driver (PID ~871)

```
Init system → node playwright-driver
    ├── Connects to Chromium via CDP (127.0.0.1:9222)
    ├── Registers as browser controller
    └── Waits for commands from start_server
```

**Playwright is the bridge** between `start_server` and Chromium. When a browser tool is called:
```
start_server → Playwright API → CDP WebSocket → Chromium
```

### Step 4: Neko Server (PID ~1351, port 8333)

```
Init system → neko-server
    ├── Starts virtual display (:0)
    ├── Captures display via X11/Wayland
    ├── Encodes to H.264 video stream
    ├── Starts WebRTC signaling server on port 8333
    ├── Authentication:
    │   ├── Username: neko
    │   └── Password: eee5e523ca12466a (from .env)
    └── Waits for WebRTC connections
```

**What Neko does:** Neko provides a live video stream of the sandbox's virtual display. When the user clicks "Manus Computer" in the UI, they see a real-time WebRTC stream of what Chromium is displaying.

**The display chain:**
```
Chromium renders webpage
    ↓ X11/virtual framebuffer
Virtual Display :0
    ↓ screen capture
Neko Server (H.264 encoding)
    ↓ WebRTC (STUN/TURN)
User's Browser (video playback)
```

**Resolution:** 1280x1029 pixels (observed from screenshots)

### Step 5: StateSync (PID ~1329)

```
Init system → statesync
    ├── Config: pull=true, push=false
    ├── Connects to Chromium via CDP (127.0.0.1:9222)
    ├── Pulls browser state from external storage:
    │   ├── Cookies
    │   ├── LocalStorage
    │   ├── SessionStorage
    │   ├── IndexedDB
    │   └── Service Worker registrations
    ├── Injects state into Chromium:
    │   ├── CDP: Network.setCookies(cookies)
    │   ├── CDP: DOMStorage.setDOMStorageItems(items)
    │   └── CDP: IndexedDB.requestData(data)
    └── Browser state restored ✓
```

**Why StateSync matters:** This is how browser logins persist across sandbox restarts. If you logged into Gmail in a previous session, StateSync pulls those cookies from S3 and injects them into Chromium, so you're still logged in.

**Config detail:** `push=false` means the sandbox does NOT push state back. State is only pulled at startup. This is a security measure — if the sandbox is compromised, it cannot overwrite the stored browser state.

### Step 6: Code Server (port 8329)

```
Init system → code-server
    ├── Binds 0.0.0.0:8329
    ├── Password: 5da9dd2cee09d5f5 (from .env)
    ├── Working directory: /home/ubuntu
    └── Status: Running but NOT user-facing
```

**Important:** Code-server runs but is NOT the editor users see. Manus built a custom Monaco-based editor in their frontend. Code-server may be used internally by Manus engineers for debugging.

---

## B.5 Phase 4: Orchestration Handshake

Once all services are running, the orchestration layer connects:

```
Orchestration (10.93.83.1) → TCP → Sandbox (169.254.0.21:8330)
    ↓
WebSocket upgrade on port 8330
    ↓
Handshake:
    Orchestration sends: {
        "type": "init",
        "session_id": "abc123",
        "user_id": "310519663278050818",
        "capabilities": ["shell", "file", "browser", "search", "generate"]
    }
    ↓
start_server responds: {
        "type": "ready",
        "status": "ok",
        "services": {
            "chromium": "running",
            "playwright": "connected",
            "neko": "running",
            "statesync": "completed"
        }
    }
    ↓
Connection ESTABLISHED
```

### Environment Injection (during handshake)

```
Orchestration writes files to sandbox:
    1. /home/ubuntu/.user_env (user secrets)
    2. /home/ubuntu/.secrets/sandbox_api_token (API token)
    
Orchestration injects into start_server process:
    3. OPENAI_API_KEY=sk-M4miWoGWn3hLQaPenoRoGX
    4. OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1
```

### MCP Server Configuration (if connectors enabled)

```
IF user has connectors enabled (e.g., Gmail):
    Orchestration → start_server: {
        "type": "configure_mcp",
        "servers": {
            "gmail": {
                "endpoint": "https://mcp.manus.im/gmail",
                "auth": "oauth",
                "token_ref": "stored_server_side"
            }
        }
    }
    ↓
start_server configures manus-mcp-cli:
    /usr/local/bin/manus-mcp-cli now knows about gmail server
```

---

## B.6 Phase 5: Ready for Tool Calls

After handshake, the sandbox is fully operational:

```
E2B Sandbox (169.254.0.21) — READY
    │
    ├── start_server (PID 794)
    │   ├── Port 8330: WebSocket ↔ Orchestration (CONNECTED)
    │   ├── Port 9330: Internal API (LISTENING)
    │   ├── PTY Manager: Ready to spawn shells
    │   ├── File Handler: Ready for filesystem operations
    │   └── Browser Handler: Connected to Playwright
    │
    ├── Chromium (PID 901)
    │   ├── Port 9222: CDP (LISTENING)
    │   ├── Manus Helper: LOADED
    │   ├── Browser State: RESTORED (via StateSync)
    │   └── Display: :0 (virtual framebuffer)
    │
    ├── Playwright (PID 871)
    │   └── CDP Connection: ESTABLISHED to Chromium
    │
    ├── Neko (PID ~1351)
    │   ├── Port 8333: WebRTC (LISTENING)
    │   ├── Display Capture: ACTIVE
    │   └── H.264 Encoding: READY
    │
    ├── StateSync (PID 1329)
    │   └── Status: COMPLETED (pulled state, now idle)
    │
    ├── Code Server (PID ~xxx)
    │   └── Port 8329: HTTP (LISTENING, internal)
    │
    └── Environment:
        ├── OPENAI_API_KEY=sk-M4mi... (LLM proxy access)
        ├── OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1
        ├── DATABASE_URL=aa41fd04-... (user secret)
        ├── CATS_FACTS_API=https://cat-fact... (user secret)
        ├── OTEL_EXPORTER_OTLP_ENDPOINT=https://http.butterfly...
        └── SENTRY_DSN=https://...@sentry.butterfly...
```

---

## B.7 Sandbox Sharing Across Conversations

**Critical architectural detail:** One sandbox serves ALL of a user's conversations.

```
User Account (Khaleel)
    │
    └── Single E2B Sandbox (169.254.0.21)
        │
        ├── Conversation A (started Feb 6)
        │   ├── LLM Context: Separate (Claude instance A)
        │   ├── Files created: /home/ubuntu/project_a/
        │   └── Shell sessions: session_a
        │
        ├── Conversation B (started Feb 8)
        │   ├── LLM Context: Separate (Claude instance B)
        │   ├── Files created: /home/ubuntu/project_b/
        │   └── Shell sessions: session_b
        │
        └── Conversation C (started Feb 9, THIS session)
            ├── LLM Context: Separate (Claude instance C)
            ├── Files created: /home/ubuntu/manus-architecture-docs/
            └── Shell sessions: default, verify, etc.
```

**What is shared:**
- Filesystem (all files from all conversations visible)
- Browser state (cookies, tabs, history)
- Running processes (Chromium, Neko, etc.)
- Environment variables
- Network connections

**What is isolated:**
- LLM context (each conversation has its own Claude instance)
- Message history (tracked per conversation in orchestration)
- Orchestration tracking (which tools were called per conversation)

**Evidence:** Sandbox uptime was 3 days, 7 hours — far longer than any single conversation. Files from previous conversations were visible via `ls /home/ubuntu/`.

---

## B.8 Sandbox Hibernation and Resume

```
HIBERNATION (after inactivity timeout):
    1. Orchestration detects no activity for X minutes
    2. Orchestration → E2B: "Hibernate sandbox"
    3. E2B: Snapshots VM state (memory + disk)
    4. E2B: Suspends Firecracker microVM
    5. Resources freed

RESUME (on next user message):
    1. User sends message
    2. Orchestration → E2B: "Resume sandbox"
    3. E2B: Restores VM from snapshot
    4. All processes resume from where they were
    5. WebSocket reconnects
    6. ~150ms to resume
    7. Tool calls can proceed
```

**Persistence guarantees:**
- Files survive hibernation
- Browser state survives (StateSync re-pulls if needed)
- Shell sessions may need to be recreated
- Environment variables persist (in files)
- Running processes resume (Chromium, Neko, etc.)

---

## B.9 Subtask Sandbox Bootstrap (map tool)

When the `map` tool spawns parallel subtasks, each gets a NEW sandbox:

```
Main Sandbox (169.254.0.21) — map tool called
    ↓
Orchestration spawns N new sandboxes:
    ↓
For each subtask:
    1. E2B: Create sandbox from SAME template (~150ms)
    2. Assign new IP (169.254.0.X)
    3. Same Phase 3 startup sequence:
       ├── start_server starts
       ├── Chromium starts (if needed)
       └── Environment injected
    4. Orchestration connects via WebSocket
    5. Orchestration sends subtask prompt
    6. Subtask LLM runs independently:
       ├── Reads prompt
       ├── Makes tool calls (search, browser, etc.)
       ├── Calls LLM via OPENAI_API_KEY (through proxy)
       └── Returns structured results
    7. Results sent back to orchestration
    8. Sandbox destroyed after completion
```

**Key difference from main sandbox:**
- Subtask sandboxes are **ephemeral** (destroyed after use)
- Main sandbox is **persistent** (shared across conversations)
- Subtask sandboxes do NOT share filesystem with main sandbox
- Each subtask has its own independent LLM instance

---

## B.10 Complete Port Map (Post-Bootstrap)

| Port | Service | Bind Address | Access | Purpose |
|------|---------|-------------|--------|---------|
| 8330 | start_server | 0.0.0.0 | Orchestration (external) | Tool execution API |
| 9330 | start_server | 127.0.0.1 | Internal only | Health checks, internal API |
| 9222 | Chromium CDP | 127.0.0.1 | Internal only | Browser automation |
| 8333 | Neko WebRTC | 0.0.0.0 | User browser (proxied) | Live browser view |
| 8329 | code-server | 0.0.0.0 | Internal only | VS Code web (unused by users) |
| 8340 | Upgrade service | 0.0.0.0 | Orchestration | Feature upgrades |
| 8350 | MCP server | 127.0.0.1 | Internal only | MCP protocol handler |
| 3000 | Vite dev server | 0.0.0.0 | User browser (proxied) | Webdev project preview |

**Proxied ports** are accessible via `https://{port}-{id}.us2.manus.computer`
