# Part 1: Infrastructure and E2B Sandbox

## 1.1 Overview

Manus runs on **E2B's Firecracker microVM** infrastructure. E2B provides ephemeral, lightweight virtual machines originally developed by AWS. Manus self-hosts E2B on their own infrastructure, giving each user session a fully isolated compute environment with ~150ms spin-up time.

According to Tao Zhang (Manus co-founder), building this infrastructure themselves would have required 3-5 full-time engineers. Docker was evaluated but rejected due to 10-20 second spin-up times and lack of full OS functionality.

---

## 1.2 E2B Sandbox Specification

| Property | Value |
|----------|-------|
| **OS** | Ubuntu 22.04 linux/amd64 |
| **User** | `ubuntu` (sudo, no password) |
| **Home Directory** | `/home/ubuntu` |
| **IP Address** | `169.254.0.21` (internal) |
| **Gateway** | `10.93.83.1` (orchestration) |
| **Hypervisor** | Firecracker microVM |
| **Spin-up Time** | ~150ms |
| **Persistence** | Survives hibernation, shared across conversations |

---

## 1.3 Running Processes

Every E2B sandbox runs these core processes:

| Process | PID | Port | Purpose |
|---------|-----|------|---------|
| `start_server` | 794 | 8330 | AI tool execution handler |
| `neko serve` | ~1351 | 8333 | Browser streaming (WebRTC) |
| `code-server` | ~1384 | 8329 | VS Code in browser (internal) |
| `chromium-browser` | ~901 | 9222 (CDP) | Browser automation |
| `statesync` | ~1316 | - | Browser state synchronization |
| `Xvfb` / Display | - | :0 | Virtual display for Neko |

---

## 1.4 Port Map

| Port | Service | Protocol | Exposed To |
|------|---------|----------|------------|
| **8329** | code-server | HTTP | Internal (proxied) |
| **8330** | start_server | HTTP/WebSocket | Orchestration only |
| **8333** | Neko server | HTTP/WebSocket/WebRTC | Frontend (proxied) |
| **8340** | Upgrade handler | HTTP | Internal |
| **9222** | Chromium CDP | WebSocket | Internal (Playwright) |
| **3000** | Dev server (webdev) | HTTP | Frontend (proxied) |
| **59000-59100** | Neko WebRTC | UDP | Frontend (via TURN) |

---

## 1.5 start_server Binary

The core runtime handler is a **compiled ELF binary** (14.9 MB), likely written in Go or Rust with an embedded Python 3.13 interpreter.

**Location:** `/opt/.manus/current/start_server`
**Launched by:** Supervisor (`/etc/supervisor/conf.d/1-sandbox-runtime.conf`)
**Startup script:** `/opt/.manus/.sandbox-runtime/start_server.sh`

**Embedded capabilities:**
- FastAPI + Uvicorn (REST API)
- gRPC + Protocol Buffers (structured API)
- WebSocket support (streaming)
- Playwright (browser automation)
- OpenTelemetry (telemetry)

**What it does:**
1. Listens on port 8330 for incoming tool execution requests
2. Receives tool calls from orchestration via TCP/WebSocket
3. Executes the requested operation (file write, shell command, browser action)
4. Returns results to orchestration
5. Reports telemetry to OpenTelemetry collector

---

## 1.6 Neko Server (Browser Streaming)

**Neko** (https://github.com/m1k1o/neko) is a self-hosted virtual browser that streams the desktop via WebRTC.

**Configuration:**
```yaml
Server: 0.0.0.0:8333
Display: :0 (1280x1029@30fps)
Video: H.264, 3000 kbps, 15 FPS
Audio: Opus, 128 kbps
WebRTC Ports: 59000-59100
```

**ICE Servers (STUN/TURN via Cloudflare):**
```
STUN: stun.cloudflare.com:3478
TURN: turn.cloudflare.com:3478 (UDP/TCP)
TURNS: turn.cloudflare.com:5349 (TCP)
```

**Credentials:**
```bash
NEKO_USERNAME=neko
NEKO_USER_PASSWORD=eee5e523ca12466a
NEKO_ADMIN_PASSWORD=03d86f52c3203f11
```

**Purpose:** Streams the Chromium browser running on Display :0 to the frontend in real-time. This is how users see the "Manus Computer" live browser view.

---

## 1.7 code-server

**Version:** 4.104.3 (VS Code 1.104.3)
**Port:** 8329
**Password:** `5da9dd2cee09d5f5`

code-server runs in the sandbox but is **NOT the primary user-facing code editor**. Manus built a custom code viewer in their frontend (see Part 4). code-server exists as internal infrastructure.

---

## 1.8 Chromium + Playwright

**Chromium** runs with Chrome DevTools Protocol (CDP) on port 9222. **Playwright** controls it programmatically.

**Custom scripts in `/opt/.manus/.sandbox-runtime/app_data/js/`:**
- `analyzeHtmlElements.js` - Analyze page elements
- `captchaDetection.js` - Detect CAPTCHAs
- `collectClickableElements.js` - Index interactive elements
- `scrollAtPoint.js` - Scroll operations

**Manus Helper Chrome Extension:**
- Location: `/opt/.manus/.packages/chrome-extensions/manus-helper/`
- Injected into Chromium for additional functionality

**Screenshots:** Saved to `/home/ubuntu/screenshots/` in WebP format with timestamps.

---

## 1.9 StateSync

A background process that synchronizes browser state (cookies, login sessions) from external storage into the sandbox.

**Config:** `/home/ubuntu/.config/state-sync/state-sync-config.yaml`
**Mode:** `pull: true, push: false` (one-way sync INTO sandbox)

This is how login sessions persist across sandbox restarts and conversations.

---

## 1.10 Environment Variables

Environment variables are injected in layers:

### Layer 1: Base Template (`~/.env`)
Created when E2B template was built. Contains system configuration:
```bash
APP_DOMAIN=manus.im,manus.ai
APP_ENV=PROD
RUNTIME_API_HOST=https://api.manus.im
TZ=Etc/GMT-1
NODE_ENV=development
```

### Layer 2: User Secrets (`~/.user_env`)
Dynamically injected when session starts. Contains user-configured secrets:
```bash
DATABASE_URL=aa41fd04-9b07-4508-b046-e6ac9daced02
CATS_FACTS_API=https://cat-fact.herokuapp.com
```

### Layer 3: Sandbox Token (`~/.secrets/sandbox_api_token`)
Dynamically injected when session starts. Multi-purpose token:
```bash
# Same value used for:
OPENAI_API_KEY=sk-M4miWoGWn3hLQaPenoRoGX
# Routes through Manus LLM proxy:
OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1
```

### Layer 4: Service Configuration
```bash
# Neko
NEKO_USERNAME=neko
NEKO_USER_PASSWORD=eee5e523ca12466a
NEKO_ADMIN_PASSWORD=03d86f52c3203f11

# code-server
CODE_SERVER_PORT=8329
CODE_SERVER_PASSWORD=5da9dd2cee09d5f5
CODE_SERVER_DOMAIN=us2.manus.computer

# Telemetry
OTEL_EXPORTER_OTLP_ENDPOINT=https://http.butterflyotel.online
OTEL_SERVICE_NAME=sandbox-runtime
SENTRY_DSN=https://962d173a894df4e4c23c744f8c39d6f3@sentry.butterflyotel.online/9

# Webdev
VITE_ANALYTICS_ENDPOINT=...
VITE_APP_ID=...
VITE_APP_TITLE=...
VITE_OAUTH_PORTAL_URL=...
BUILT_IN_FORGE_API_KEY=...
```

### Full Environment Variable List (73 variables):
```
APP_DOMAIN, APP_ENV, BUILT_IN_FORGE_API_KEY, BUILT_IN_FORGE_API_URL,
CATS_FACTS_API, CODE_SERVER_DOMAIN, CODE_SERVER_PASSWORD, CODE_SERVER_PORT,
DATABASE_URL, DEPLOY_WASMER_OWNER, GH_TOKEN, GOOGLE_DRIVE_TOKEN, HOME,
JWT_SECRET, LANG, LAST_COMMIT_HASH, LOGNAME, MAIL, NEKO_ADMIN_PASSWORD,
NEKO_USERNAME, NEKO_USER_PASSWORD, NODE_ENV, NVM_BIN, NVM_CD_FLAGS,
NVM_DIR, NVM_INC, OAUTH_SERVER_URL, OPENAI_API_BASE, OPENAI_API_KEY,
OPENAI_BASE_URL, OTEL_BSP_MAX_EXPORT_BATCH_SIZE, OTEL_BSP_SCHEDULE_DELAY,
OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_PYTHON_LOG_CORRELATION,
OTEL_RESOURCE_ATTRIBUTES, OTEL_SERVICE_NAME, OTEL_TRACES_EXPORTER,
OTEL_TRACES_SAMPLER_RATIO, OTEL_TRACE_CUSTOM_SAMPLER_EXCLUDED_URLS,
OWNER_NAME, OWNER_OPEN_ID, PATH, PNPM_HOME, PORT, PWD,
PW_TEST_SCREENSHOT_NO_FONTS_READY, PYTHONIOENCODING, RUNTIME_API_HOST,
SENTRY_DSN, SHELL, SHLVL, SUDO_COMMAND, SUDO_GID, SUDO_UID, SUDO_USER,
TERM, TZ, USER, VITE_ANALYTICS_ENDPOINT, VITE_ANALYTICS_WEBSITE_ID,
VITE_APP_ID, VITE_APP_LOGO, VITE_APP_TITLE, VITE_FRONTEND_FORGE_API_KEY,
VITE_FRONTEND_FORGE_API_URL, VITE_OAUTH_PORTAL_URL
```

---

## 1.11 Filesystem Structure

```
/home/ubuntu/
├── .env                          # Base system config
├── .user_env                     # User secrets (dynamic)
├── .secrets/
│   └── sandbox_api_token         # Session token (dynamic)
├── .bashrc                       # Loads .env and .user_env
├── .browser_data_dir/            # Chromium profile data
├── .config/
│   ├── code-server/config.yaml   # code-server config
│   └── state-sync/               # StateSync config
├── screenshots/                  # Browser screenshots (WebP)
├── Downloads/                    # Browser downloads
├── gmail-attachments/            # Gmail connector downloads
├── [project files]               # User projects
│
/opt/.manus/
├── current/
│   ├── start_server              # Main runtime binary (ELF)
│   └── .venv/                    # Python 3.13 venv
│       └── lib/python3.13/site-packages/
│           ├── fastapi/
│           ├── playwright/
│           ├── langchain*/       # Installed but NOT used
│           ├── openai/
│           └── ...
├── .sandbox-runtime/
│   ├── start_server.sh           # Startup script
│   ├── data_api.py               # API proxy client
│   └── app_data/js/              # Browser automation scripts
├── .packages/
│   ├── chrome-extensions/        # Manus Helper extension
│   └── scripts/                  # Utility scripts
└── neko/
    ├── server/neko               # Neko binary
    └── config/neko.yml           # Neko config
│
/tmp/manus-mcp/
├── builtin_tools.json            # MCP tool definitions
└── mcp_result_*.json             # MCP call results
```

---

## 1.12 Sandbox Lifecycle

1. **Creation:** Orchestration requests E2B to spin up sandbox from template (~150ms)
2. **Injection:** Environment variables and secrets injected
3. **Active:** Processes start (start_server, Neko, Chromium, code-server, StateSync)
4. **Shared:** Same sandbox used across multiple conversations for same user
5. **Hibernation:** Inactive sandbox hibernates, resumes when needed
6. **State persists:** Filesystem, installed packages, browser state survive hibernation

---

## 1.13 Telemetry and Observability

**OpenTelemetry:**
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://http.butterflyotel.online
OTEL_SERVICE_NAME=sandbox-runtime
OTEL_TRACES_EXPORTER=otlp
```

**Sentry (Error Tracking):**
```bash
SENTRY_DSN=https://962d173a894df4e4c23c744f8c39d6f3@sentry.butterflyotel.online/9
```

Every operation in the sandbox is traced and errors are reported. This is how Manus monitors performance, tracks usage, and debugs issues.

---

## 1.14 Network Topology

```
Internet
    │
    ├── api.manus.im (Orchestration)
    │       │
    │       └── 10.93.83.1 (Gateway to E2B)
    │               │
    │               └── 169.254.0.21 (E2B Sandbox)
    │                       ├── :8330 (start_server)
    │                       ├── :8333 (Neko)
    │                       ├── :8329 (code-server)
    │                       ├── :9222 (Chromium CDP)
    │                       └── :3000+ (dev servers)
    │
    ├── butterflyotel.online (Telemetry)
    ├── stun/turn.cloudflare.com (WebRTC)
    └── AWS EC2 (S3, CloudFront CDN)
```

**Active connections from start_server:**
- `10.93.83.1` - Orchestration (primary)
- `44.193.41.67:443` - AWS (telemetry/storage)
- `52.5.251.250:443` - AWS (telemetry/storage)
- `54.209.2.128:443` - AWS (telemetry/storage)
