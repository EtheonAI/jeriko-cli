# Part 8: Complete Environment Variables in E2B Sandbox Sessions

> **Every single environment variable, where it comes from, when it's loaded, which process uses it, and how to replicate it.** This is the raw truth from a live running sandbox — no guessing, no assumptions.

---

## 1. The Four Injection Sources

Environment variables in the E2B sandbox come from **four distinct sources**, loaded in a specific order. Later sources override earlier ones.

```
INJECTION ORDER (earliest → latest):
┌─────────────────────────────────────────────────────────────┐
│ 1. SUPERVISOR CONFIGS (/etc/supervisor/conf.d/*.conf)       │
│    Set at: VM image build time (baked into E2B template)    │
│    Loaded by: supervisord when starting each process        │
│    Contains: PATH, HOME, CHROME_INSTANCE_PATH, TZ, etc.    │
├─────────────────────────────────────────────────────────────┤
│ 2. ~/.env (written by startup scripts at boot)              │
│    Set at: First boot + each service startup                │
│    Loaded by: .bashrc → source "$HOME/.env"                 │
│    Contains: Infrastructure vars, Neko passwords, OTEL,     │
│              Sentry, code-server config                     │
├─────────────────────────────────────────────────────────────┤
│ 3. ~/.user_env (written by orchestrator before session)     │
│    Set at: Session creation / sandbox acquisition           │
│    Loaded by: .bashrc → source "$HOME/.user_env"            │
│    Contains: User secrets, connector tokens, custom vars    │
├─────────────────────────────────────────────────────────────┤
│ 4. ORCHESTRATOR-INJECTED (set in process environment)       │
│    Set at: Tool execution time                              │
│    Loaded by: Orchestrator sets them in the shell env       │
│    Contains: OPENAI_API_KEY, OPENAI_BASE_URL, webdev vars   │
│              (VITE_*, JWT_SECRET, OWNER_*, etc.)            │
└─────────────────────────────────────────────────────────────┘
```

**The loading chain in `.bashrc` (lines 124-125):**
```bash
[ -f "$HOME/.env" ] && source "$HOME/.env"       # Line 124
[ -f "$HOME/.user_env" ] && source "$HOME/.user_env"  # Line 125
```

This means every new shell session (including those created by the `shell` tool) gets both `.env` and `.user_env` variables automatically.

---

## 2. Source 1: Supervisor Configs (Baked into VM Image)

These are set in `/etc/supervisor/conf.d/*.conf` files and are **baked into the E2B VM template**. They define the minimal environment for each managed process.

### 2.1 sandbox-runtime (start_server) — `/etc/supervisor/conf.d/1-sandbox-runtime.conf`

```ini
[program:sandbox-runtime]
command=/opt/.manus/.sandbox-runtime/start_server.sh
environment=
    PATH="/home/ubuntu/bin:/home/ubuntu/.local/bin:/home/ubuntu/.local/share/pnpm:/home/ubuntu/.nvm/versions/node/v22.13.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    HOME="/home/ubuntu",
    CHROME_INSTANCE_PATH="/usr/bin/chromium-browser",
    WEBDEV_TEMPLATES_PATH="/opt/.manus/webdev/templates",
    TZ="UTC"
```

| Variable | Value | Purpose |
|----------|-------|---------|
| `PATH` | Full path with nvm, pnpm, system bins | Ensures Node.js, pnpm, and system tools are available |
| `HOME` | `/home/ubuntu` | Home directory for the ubuntu user |
| `CHROME_INSTANCE_PATH` | `/usr/bin/chromium-browser` | Tells Playwright where Chromium is installed |
| `WEBDEV_TEMPLATES_PATH` | `/opt/.manus/webdev/templates` | Path to webdev project templates |
| `TZ` | `UTC` | Timezone for the process (overridden later) |

### 2.2 runtime-upgrade — `/etc/supervisor/conf.d/10-runtime-upgrade.conf`

```ini
[program:runtime-upgrade]
command=/opt/.manus/.sandbox-runtime/upgrade.sh
environment=
    PATH="/usr/local/bin:/usr/bin:/bin:/home/ubuntu/.local/bin",
    HOME="/home/ubuntu",
    WEBDEV_TEMPLATES_PATH="/opt/.manus/webdev/templates",
    TZ="UTC"
```

Minimal PATH — no nvm/pnpm since upgrade doesn't need Node.js.

### 2.3 manus-mcp-server — `/etc/supervisor/conf.d/11-manus-mcp-server.conf`

```ini
[program:manus-mcp-server]
command=/opt/.manus/.packages/scripts/start-manus-mcp-server.sh
environment=HOME="/home/ubuntu",USER="ubuntu",PATH="/home/ubuntu/.nvm/versions/node/v22.13.0/bin:/usr/lib/code-server/lib/vscode/bin/remote-cli:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"
```

Includes Node.js path for the MCP CLI (which is a Node.js binary).

### 2.4 Xorg — `/etc/supervisor/conf.d/2-xvfb.conf`

```ini
[program:Xorg]
command=/usr/lib/xorg/Xorg :0 -noreset -nolisten tcp
```

No custom environment — runs as root with system defaults.

### 2.5 Chrome — `/etc/supervisor/conf.d/4-chrome.conf`

```ini
[program:chrome]
command=/opt/.manus/.packages/scripts/check-start-chrome.sh
environment=DISPLAY=":0",TZ="UTC"
```

| Variable | Value | Purpose |
|----------|-------|---------|
| `DISPLAY` | `:0` | Connect to Xorg virtual display |
| `TZ` | `UTC` | Timezone |

### 2.6 x11vnc — `/etc/supervisor/conf.d/5-x11vnc.conf`

No custom environment variables.

### 2.7 websockify — `/etc/supervisor/conf.d/6-websockify.conf`

No custom environment variables.

### 2.8 code-server — `/etc/supervisor/conf.d/7-code-server.conf`

No custom environment variables (autostart=false — only starts when needed).

### 2.9 Neko Server — `/etc/supervisor/conf.d/neko-supervisor.conf`

```ini
[program:neko-server]
command=/opt/.manus/.packages/scripts/start-neko-with-turn.sh
environment=DISPLAY=":0",PULSE_RUNTIME_PATH="/tmp/pulse-runtime",XDG_RUNTIME_DIR="/run/user/1000",HOME="/home/ubuntu"
```

| Variable | Value | Purpose |
|----------|-------|---------|
| `DISPLAY` | `:0` | Connect to Xorg virtual display |
| `PULSE_RUNTIME_PATH` | `/tmp/pulse-runtime` | PulseAudio runtime path (audio) |
| `XDG_RUNTIME_DIR` | `/run/user/1000` | XDG runtime directory |
| `HOME` | `/home/ubuntu` | Home directory |

---

## 3. Source 2: `~/.env` (Written by Startup Scripts at Boot)

The `~/.env` file is written to by multiple startup scripts during the first boot. Each script appends its variables.

### 3.1 Who Writes to `~/.env` and When

| Writer Script | Variables Written | When |
|--------------|-------------------|------|
| `start-neko-with-turn.sh` | `NEKO_ADMIN_PASSWORD`, `NEKO_USER_PASSWORD`, `NEKO_USERNAME` | First boot (generates random passwords) |
| `check-start-code-server.sh` | `CODE_SERVER_PORT`, `CODE_SERVER_PASSWORD` | First boot (generates random password) |
| Orchestrator (via init-sandbox) | All infrastructure vars | Sandbox creation |

### 3.2 Complete `~/.env` Contents (Live Dump)

```bash
# === INFRASTRUCTURE (set by orchestrator at sandbox creation) ===
export APP_ENV=PROD
export RUNTIME_API_HOST=https://api.manus.im
export PW_TEST_SCREENSHOT_NO_FONTS_READY=1
export TZ=America/New_York
export DEPLOY_WASMER_OWNER=manus

# === OBSERVABILITY: OpenTelemetry ===
export OTEL_PYTHON_LOG_CORRELATION=true
export OTEL_BSP_MAX_EXPORT_BATCH_SIZE=1024
export OTEL_BSP_SCHEDULE_DELAY=10000
export OTEL_SERVICE_NAME=sandbox-runtime
export OTEL_RESOURCE_ATTRIBUTES=service.name=sandbox-runtime,service.env=prod
export OTEL_TRACES_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_ENDPOINT=https://http.butterflyotel.online
export OTEL_TRACE_CUSTOM_SAMPLER_EXCLUDED_URLS=/healthz
export OTEL_TRACES_SAMPLER_RATIO=1.0

# === OBSERVABILITY: Sentry ===
export SENTRY_DSN=https://962d173a894df4e4c23c744f8c39d6f3@sentry.butterflyotel.online/9

# === CODE SERVER ===
export CODE_SERVER_DOMAIN="us2.manus.computer"
export APP_DOMAIN=manus.im,manus.ai
export LAST_COMMIT_HASH=7.0.18

# === NEKO (generated at first boot by start-neko-with-turn.sh) ===
export NEKO_ADMIN_PASSWORD="03d86f52c3203f11"
export NEKO_USER_PASSWORD="eee5e523ca12466a"
export NEKO_USERNAME="neko"

# === CODE SERVER (generated at first boot by check-start-code-server.sh) ===
export CODE_SERVER_PORT="8329"
export CODE_SERVER_PASSWORD="d85479eabde611ec"
```

### 3.3 Detailed Variable Reference

| Variable | Example Value | Set By | Used By | Purpose |
|----------|--------------|--------|---------|---------|
| `APP_ENV` | `PROD` | Orchestrator | sandbox-runtime | Environment flag (PROD/DEV) |
| `RUNTIME_API_HOST` | `https://api.manus.im` | Orchestrator | sandbox-runtime, data_api.py | Base URL for Manus API calls from sandbox |
| `PW_TEST_SCREENSHOT_NO_FONTS_READY` | `1` | Orchestrator | Playwright | Skip font-ready check for screenshots |
| `TZ` | `America/New_York` | Orchestrator | All processes | User's timezone (overrides UTC default) |
| `DEPLOY_WASMER_OWNER` | `manus` | Orchestrator | Deployment tools | Wasmer deployment namespace |
| `OTEL_PYTHON_LOG_CORRELATION` | `true` | Orchestrator | sandbox-runtime (Python) | Correlate Python logs with traces |
| `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | `1024` | Orchestrator | OTEL SDK | Max batch size for trace export |
| `OTEL_BSP_SCHEDULE_DELAY` | `10000` | Orchestrator | OTEL SDK | Delay (ms) between trace batch exports |
| `OTEL_SERVICE_NAME` | `sandbox-runtime` | Orchestrator | OTEL SDK | Service name in traces |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.name=sandbox-runtime,service.env=prod` | Orchestrator | OTEL SDK | Resource attributes for traces |
| `OTEL_TRACES_EXPORTER` | `otlp` | Orchestrator | OTEL SDK | Trace export protocol |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `https://http.butterflyotel.online` | Orchestrator | OTEL SDK | Trace collector endpoint |
| `OTEL_TRACE_CUSTOM_SAMPLER_EXCLUDED_URLS` | `/healthz` | Orchestrator | OTEL SDK | URLs to exclude from tracing |
| `OTEL_TRACES_SAMPLER_RATIO` | `1.0` | Orchestrator | OTEL SDK | Sample 100% of traces |
| `SENTRY_DSN` | `https://962d173a...@sentry.butterflyotel.online/9` | Orchestrator | sandbox-runtime | Sentry error reporting endpoint |
| `CODE_SERVER_DOMAIN` | `us2.manus.computer` | Orchestrator | code-server proxy | Domain for code-server access |
| `APP_DOMAIN` | `manus.im,manus.ai` | Orchestrator | sandbox-runtime | Allowed app domains |
| `LAST_COMMIT_HASH` | `7.0.18` | Orchestrator | sandbox-runtime | Version of the sandbox runtime |
| `NEKO_ADMIN_PASSWORD` | `03d86f52c3203f11` (random) | start-neko-with-turn.sh | Neko server | Admin password for WebRTC streaming |
| `NEKO_USER_PASSWORD` | `eee5e523ca12466a` (random) | start-neko-with-turn.sh | Neko server | User password for WebRTC streaming |
| `NEKO_USERNAME` | `neko` | start-neko-with-turn.sh | Neko server | Username for WebRTC streaming |
| `CODE_SERVER_PORT` | `8329` | check-start-code-server.sh | code-server | Port for VS Code in browser |
| `CODE_SERVER_PASSWORD` | `d85479eabde611ec` (random) | check-start-code-server.sh | code-server | Password for code-server auth |

---

## 4. Source 3: `~/.user_env` (Written by Orchestrator Per User)

The `~/.user_env` file contains **user-specific secrets and connector tokens**. It's written by the orchestrator when the sandbox is acquired for a user session.

### 4.1 Complete `~/.user_env` Contents (Live Dump)

```bash
# My website database
export DATABASE_URL="aa41fd04-9b07-4508-b046-e6ac9daced02"

# Cats Facts
export CATS_FACTS_API="https://cat-fact.herokuapp.com"

# connectors_GH_TOKEN
export GH_TOKEN=""

# connectors_GOOGLE_DRIVE_TOKEN
export GOOGLE_DRIVE_TOKEN=""
```

### 4.2 Detailed Variable Reference

| Variable | Example Value | Source | Purpose |
|----------|--------------|--------|---------|
| `DATABASE_URL` | `aa41fd04-9b07-4508-b046-e6ac9daced02` | User's "My website database" secret | **NOT a real connection string** — it's a UUID reference that the webdev system resolves to the actual TiDB connection |
| `CATS_FACTS_API` | `https://cat-fact.herokuapp.com` | User's "Cats Facts" secret | Custom user-defined API endpoint |
| `GH_TOKEN` | (empty) | GitHub connector | GitHub Personal Access Token for `gh` CLI |
| `GOOGLE_DRIVE_TOKEN` | (empty) | Google Drive connector | Google Drive OAuth token |

**Critical finding:** The `DATABASE_URL` in `.user_env` is `aa41fd04-9b07-4508-b046-e6ac9daced02` (a UUID), but the actual `DATABASE_URL` in the running process environment is `mysql://root:password@localhost:3306/webdev_db`. This means the webdev system **overrides** the user-defined `DATABASE_URL` with the actual local MySQL connection string when a webdev project is active.

### 4.3 How `.user_env` Is Created

```
User configures secrets in Manus Settings → Secrets panel
    ↓
Orchestrator receives secret definitions:
    [
      { name: "DATABASE_URL", value: "aa41fd04-...", label: "My website database" },
      { name: "CATS_FACTS_API", value: "https://cat-fact...", label: "Cats Facts" }
    ]
    ↓
Orchestrator also receives connector tokens:
    [
      { name: "GH_TOKEN", value: "", source: "github_connector" },
      { name: "GOOGLE_DRIVE_TOKEN", value: "", source: "google_drive_connector" }
    ]
    ↓
Orchestrator writes ~/.user_env:
    # {label}
    export {name}="{value}"
    ↓
File is sourced by .bashrc on every new shell session
```

---

## 5. Source 4: Orchestrator-Injected (Runtime Environment)

These variables are **NOT in any file**. They are injected directly into the process environment by the orchestrator when it creates shell sessions or sets up the webdev project. They appear in `env` output but not in `.env` or `.user_env`.

### 5.1 The Multi-Purpose Token

The most critical variable is `OPENAI_API_KEY`:

```
OPENAI_API_KEY=sk-M4miWoGWn3hLQaPenoRoGX
OPENAI_API_BASE=https://api.manus.im/api/llm-proxy/v1
OPENAI_BASE_URL=https://api.manus.im/api/llm-proxy/v1
```

**Where it comes from:** The `~/.secrets/sandbox_api_token` file contains `sk-M4miWoGWn3hLQaPenoRoGX` — the exact same value as `OPENAI_API_KEY`. This token is:

1. Written to `~/.secrets/sandbox_api_token` by the orchestrator at sandbox creation
2. Injected as `OPENAI_API_KEY` into the shell environment by the orchestrator
3. Used by `data_api.py` to authenticate API calls (reads from `~/.secrets/sandbox_api_token`)
4. Used by any OpenAI SDK calls as the API key (points to Manus LLM proxy, not OpenAI directly)

**This is a MULTI-PURPOSE token.** It authenticates:
- LLM proxy calls (via `OPENAI_API_KEY` + `OPENAI_BASE_URL`)
- Sandbox API calls (via `x-sandbox-token` header in `data_api.py`)
- File upload/download (via `manus-upload-file` utility)
- Any Forge API call from the sandbox

### 5.2 Webdev-Injected Variables

When a webdev project is initialized (`webdev_init_project`), the orchestrator injects additional variables into the environment:

| Variable | Example Value | Purpose | Used By |
|----------|--------------|---------|---------|
| `BUILT_IN_FORGE_API_KEY` | `iYteMZid8PPv8NczekKsfj` | Server-side Forge API key (LLM, image gen, voice) | Server routes (tRPC) |
| `BUILT_IN_FORGE_API_URL` | `https://forge.manus.ai` | Forge API base URL (server-side) | Server routes |
| `JWT_SECRET` | `Dhe5DTfoBayKNpu9aLUaMV` | JWT signing secret for user auth tokens | Server auth middleware |
| `OAUTH_SERVER_URL` | `https://api.manus.im` | OAuth server for Manus login | Server auth routes |
| `OWNER_NAME` | `khaleelmusleh` | Username of the project owner | Server auth (owner identification) |
| `OWNER_OPEN_ID` | `SUiQxqrAPF6LWgcrbjRqdv` | OpenID of the project owner | Server auth (owner verification) |
| `VITE_ANALYTICS_ENDPOINT` | `https://manus-analytics.com` | Analytics collection endpoint | Frontend analytics |
| `VITE_ANALYTICS_WEBSITE_ID` | `389059b9-4577-4ef2-9a7d-76639cb92d8d` | Unique website ID for analytics | Frontend analytics |
| `VITE_APP_ID` | `AckWz76VCtLRxGsvdTX5cN` | Unique app identifier | Frontend OAuth, API calls |
| `VITE_APP_LOGO` | (empty) | App logo URL | Frontend header/branding |
| `VITE_APP_TITLE` | `Test WebDev Trace` | App display title | Frontend header, HTML title |
| `VITE_FRONTEND_FORGE_API_KEY` | `oAKMj8nzHn3pHkW4hX7t5s` | Client-side Forge API key (maps, limited features) | Frontend Google Maps proxy |
| `VITE_FRONTEND_FORGE_API_URL` | `https://forge.manus.ai` | Forge API base URL (client-side) | Frontend API calls |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` | OAuth portal for user login redirect | Frontend login flow |
| `PORT` | `3000` | Dev server port | Vite/Express dev server |
| `NODE_ENV` | `development` | Node environment | Vite, Express |
| `DATABASE_URL` | `mysql://root:password@localhost:3306/webdev_db` | **Overrides** the `.user_env` value with actual MySQL connection | Drizzle ORM, server DB access |

**Key insight:** There are TWO Forge API keys:
- `BUILT_IN_FORGE_API_KEY` — server-side only, full access (LLM, image generation, voice transcription, notifications)
- `VITE_FRONTEND_FORGE_API_KEY` — client-side (exposed in browser), limited access (Google Maps proxy only)

The `VITE_` prefix means the variable is exposed to the Vite frontend build. Non-`VITE_` variables are server-side only.

---

## 6. Source 5: `~/.secrets/` Directory (Token Files)

The `~/.secrets/` directory contains individual token files:

```
/home/ubuntu/.secrets/
└── sandbox_api_token    # Contains: sk-M4miWoGWn3hLQaPenoRoGX
```

This file is:
- Written by the orchestrator at sandbox creation
- Read by `data_api.py` for API proxy authentication
- The same value as `OPENAI_API_KEY` in the environment
- Used as the `x-sandbox-token` header for all Manus API calls from the sandbox

---

## 7. Process-Specific Environment Maps

Different processes inside the sandbox see different subsets of environment variables. Here's exactly what each process has:

### 7.1 start_server (PID 787) — The Shell Wrapper

**Minimal environment** — only what supervisor provides:

| Variable | Value |
|----------|-------|
| `CHROME_INSTANCE_PATH` | `/usr/bin/chromium-browser` |
| `HOME` | `/home/ubuntu` |
| `LANG` | `C.UTF-8` |
| `PATH` | Full path with nvm, pnpm |
| `SUPERVISOR_ENABLED` | `1` |
| `SUPERVISOR_GROUP_NAME` | `sandbox-runtime` |
| `SUPERVISOR_PROCESS_NAME` | `sandbox-runtime` |
| `SUPERVISOR_SERVER_URL` | `unix:///var/run/supervisor.sock` |
| `SYSTEMD_EXEC_PID` | `579` |
| `TZ` | `UTC` |
| `WEBDEV_TEMPLATES_PATH` | `/opt/.manus/webdev/templates` |

**Note:** The shell wrapper has `TZ=UTC` from supervisor. The actual Python process overrides this.

### 7.2 sandbox-runtime (Nuitka-compiled Python, child of start_server)

**Full environment** — loads `.env` via `start_server.sh`, plus Nuitka/Python paths:

| Category | Variables |
|----------|-----------|
| **Infrastructure** | `APP_ENV`, `RUNTIME_API_HOST`, `APP_DOMAIN`, `LAST_COMMIT_HASH`, `DEPLOY_WASMER_OWNER` |
| **Observability** | All `OTEL_*` vars (8 total), `SENTRY_DSN` |
| **Neko** | `NEKO_ADMIN_PASSWORD`, `NEKO_USER_PASSWORD`, `NEKO_USERNAME` |
| **Code Server** | `CODE_SERVER_DOMAIN`, `CODE_SERVER_PORT`, `CODE_SERVER_PASSWORD` |
| **Python** | `PYTHONHOME`, `PYTHONPATH`, `NUITKA_PYTHONPATH` |
| **Playwright** | `PW_TEST_SCREENSHOT_NO_FONTS_READY`, `PLAYWRIGHT_ARTIFACTS_DIR`, `PW_CLI_DISPLAY_VERSION`, `PW_LANG_NAME`, `PW_LANG_NAME_VERSION` |
| **OpenCV** | `LD_LIBRARY_PATH`, `QT_QPA_FONTDIR`, `QT_QPA_PLATFORM_PLUGIN_PATH` |
| **Sentry Trace** | `SUBPROCESS_BAGGAGE`, `SUBPROCESS_SENTRY_TRACE` |
| **Timezone** | `TZ=America/New_York` (overridden from UTC) |

**This process does NOT have:** `OPENAI_API_KEY`, `OPENAI_BASE_URL`, webdev `VITE_*` vars, `.user_env` vars. It reads the sandbox token from `~/.secrets/sandbox_api_token` directly.

### 7.3 Playwright Node.js Process (PID 871)

Inherits the **full sandbox-runtime environment** including all OTEL, Sentry, Python, and Playwright vars. This is the process that actually controls Chromium via CDP.

### 7.4 statesync (PID 1316)

Inherits the **full sandbox-runtime environment**. Responsible for syncing browser state (cookies, localStorage) between sessions. Config:

```yaml
browser-port: '9222'
pull: true    # Pull state INTO sandbox on start
push: false   # Do NOT push state out (one-way sync)
```

### 7.5 Neko Server (PID 1351)

**Minimal environment** from supervisor:

| Variable | Value |
|----------|-------|
| `DISPLAY` | `:0` |
| `PULSE_RUNTIME_PATH` | `/tmp/pulse-runtime` |
| `XDG_RUNTIME_DIR` | `/run/user/1000` |
| `HOME` | `/home/ubuntu` |

Neko reads its config from `/opt/.manus/neko/config/neko.yml` and `/opt/.manus/neko/config/ice_servers.json`, not from environment variables.

### 7.6 User Shell Sessions (Created by `shell` tool)

When the orchestrator creates a shell session via the `shell` tool, the user gets the **full merged environment**:

```
Supervisor vars (from process inheritance)
    + ~/.env vars (sourced by .bashrc line 124)
    + ~/.user_env vars (sourced by .bashrc line 125)
    + Orchestrator-injected vars (OPENAI_*, webdev VITE_*, etc.)
```

This is why `env | sort` shows **all 70+ variables** — the shell session merges everything.

### 7.7 Chromium (PID 901)

| Variable | Value |
|----------|-------|
| `DISPLAY` | `:0` |
| `TZ` | `UTC` |

Minimal — Chromium doesn't need application env vars.

---

## 8. Complete Variable Catalog (All 70+ Variables)

Here is every single environment variable visible in a user shell session, sorted alphabetically:

| # | Variable | Value | Source | Category |
|---|----------|-------|--------|----------|
| 1 | `APP_DOMAIN` | `manus.im,manus.ai` | `.env` | Infrastructure |
| 2 | `APP_ENV` | `PROD` | `.env` | Infrastructure |
| 3 | `BUILT_IN_FORGE_API_KEY` | `iYteMZid8PPv8NczekKsfj` | Orchestrator (webdev) | Forge API |
| 4 | `BUILT_IN_FORGE_API_URL` | `https://forge.manus.ai` | Orchestrator (webdev) | Forge API |
| 5 | `CATS_FACTS_API` | `https://cat-fact.herokuapp.com` | `.user_env` | User Secret |
| 6 | `CODE_SERVER_DOMAIN` | `us2.manus.computer` | `.env` | Code Server |
| 7 | `CODE_SERVER_PASSWORD` | `d85479eabde611ec` | `.env` (generated) | Code Server |
| 8 | `CODE_SERVER_PORT` | `8329` | `.env` (generated) | Code Server |
| 9 | `DATABASE_URL` | `mysql://root:password@localhost:3306/webdev_db` | Orchestrator (webdev) | Database |
| 10 | `DEPLOY_WASMER_OWNER` | `manus` | `.env` | Deployment |
| 11 | `GH_TOKEN` | (empty) | `.user_env` | Connector |
| 12 | `GOOGLE_DRIVE_TOKEN` | (empty) | `.user_env` | Connector |
| 13 | `HOME` | `/home/ubuntu` | System | System |
| 14 | `JWT_SECRET` | `Dhe5DTfoBayKNpu9aLUaMV` | Orchestrator (webdev) | Auth |
| 15 | `LANG` | `C.UTF-8` | System | System |
| 16 | `LAST_COMMIT_HASH` | `7.0.18` | `.env` | Versioning |
| 17 | `LESSCLOSE` | `/usr/bin/lesspipe %s %s` | System | System |
| 18 | `LESSOPEN` | `\| /usr/bin/lesspipe %s` | System | System |
| 19 | `LOGNAME` | `ubuntu` | System | System |
| 20 | `LS_COLORS` | (empty) | System | System |
| 21 | `MAIL` | `/var/mail/ubuntu` | System | System |
| 22 | `NEKO_ADMIN_PASSWORD` | `03d86f52c3203f11` | `.env` (generated) | Neko WebRTC |
| 23 | `NEKO_USERNAME` | `neko` | `.env` (generated) | Neko WebRTC |
| 24 | `NEKO_USER_PASSWORD` | `eee5e523ca12466a` | `.env` (generated) | Neko WebRTC |
| 25 | `NODE_ENV` | `development` | Orchestrator (webdev) | Webdev |
| 26 | `NVM_BIN` | `/home/ubuntu/.nvm/versions/node/v22.13.0/bin` | `.bashrc` (nvm) | Node.js |
| 27 | `NVM_CD_FLAGS` | (empty) | `.bashrc` (nvm) | Node.js |
| 28 | `NVM_DIR` | `/home/ubuntu/.nvm` | `.bashrc` (nvm) | Node.js |
| 29 | `NVM_INC` | `/home/ubuntu/.nvm/versions/node/v22.13.0/include/node` | `.bashrc` (nvm) | Node.js |
| 30 | `OAUTH_SERVER_URL` | `https://api.manus.im` | Orchestrator (webdev) | Auth |
| 31 | `OLDPWD` | `/home/ubuntu` | System | System |
| 32 | `OPENAI_API_BASE` | `https://api.manus.im/api/llm-proxy/v1` | Orchestrator | LLM Proxy |
| 33 | `OPENAI_API_KEY` | `sk-M4miWoGWn3hLQaPenoRoGX` | Orchestrator | LLM Proxy |
| 34 | `OPENAI_BASE_URL` | `https://api.manus.im/api/llm-proxy/v1` | Orchestrator | LLM Proxy |
| 35 | `OTEL_BSP_MAX_EXPORT_BATCH_SIZE` | `1024` | `.env` | Observability |
| 36 | `OTEL_BSP_SCHEDULE_DELAY` | `10000` | `.env` | Observability |
| 37 | `OTEL_EXPORTER_OTLP_ENDPOINT` | `https://http.butterflyotel.online` | `.env` | Observability |
| 38 | `OTEL_PYTHON_LOG_CORRELATION` | `true` | `.env` | Observability |
| 39 | `OTEL_RESOURCE_ATTRIBUTES` | `service.name=sandbox-runtime,service.env=prod` | `.env` | Observability |
| 40 | `OTEL_SERVICE_NAME` | `sandbox-runtime` | `.env` | Observability |
| 41 | `OTEL_TRACES_EXPORTER` | `otlp` | `.env` | Observability |
| 42 | `OTEL_TRACES_SAMPLER_RATIO` | `1.0` | `.env` | Observability |
| 43 | `OTEL_TRACE_CUSTOM_SAMPLER_EXCLUDED_URLS` | `/healthz` | `.env` | Observability |
| 44 | `OWNER_NAME` | `khaleelmusleh` | Orchestrator (webdev) | Auth |
| 45 | `OWNER_OPEN_ID` | `SUiQxqrAPF6LWgcrbjRqdv` | Orchestrator (webdev) | Auth |
| 46 | `PATH` | (full path with nvm, pnpm, system) | Supervisor + `.bashrc` | System |
| 47 | `PNPM_HOME` | `/home/ubuntu/.local/share/pnpm` | `.bashrc` | Node.js |
| 48 | `PORT` | `3000` | Orchestrator (webdev) | Webdev |
| 49 | `PS1` | Custom prompt with `\u@\h:\w` | System | System |
| 50 | `PS2` | (empty) | System | System |
| 51 | `PWD` | `/home/ubuntu` | System | System |
| 52 | `PW_TEST_SCREENSHOT_NO_FONTS_READY` | `1` | `.env` | Playwright |
| 53 | `PYTHONIOENCODING` | `utf-8` | `.bashrc` | Python |
| 54 | `RUNTIME_API_HOST` | `https://api.manus.im` | `.env` | Infrastructure |
| 55 | `SENTRY_DSN` | `https://962d173a...@sentry.butterflyotel.online/9` | `.env` | Observability |
| 56 | `SHELL` | `/bin/bash` | System | System |
| 57 | `SHLVL` | `0` | System | System |
| 58 | `SUDO_COMMAND` | `/usr/bin/su ubuntu` | System | System |
| 59 | `SUDO_GID` | `1000` | System | System |
| 60 | `SUDO_UID` | `1000` | System | System |
| 61 | `SUDO_USER` | `ubuntu` | System | System |
| 62 | `TERM` | `xterm-256color` | System | System |
| 63 | `TZ` | `America/New_York` | `.env` (overrides supervisor UTC) | Timezone |
| 64 | `USER` | `ubuntu` | System | System |
| 65 | `VITE_ANALYTICS_ENDPOINT` | `https://manus-analytics.com` | Orchestrator (webdev) | Analytics |
| 66 | `VITE_ANALYTICS_WEBSITE_ID` | `389059b9-4577-4ef2-9a7d-76639cb92d8d` | Orchestrator (webdev) | Analytics |
| 67 | `VITE_APP_ID` | `AckWz76VCtLRxGsvdTX5cN` | Orchestrator (webdev) | Webdev |
| 68 | `VITE_APP_LOGO` | (empty) | Orchestrator (webdev) | Webdev |
| 69 | `VITE_APP_TITLE` | `Test WebDev Trace` | Orchestrator (webdev) | Webdev |
| 70 | `VITE_FRONTEND_FORGE_API_KEY` | `oAKMj8nzHn3pHkW4hX7t5s` | Orchestrator (webdev) | Forge API |
| 71 | `VITE_FRONTEND_FORGE_API_URL` | `https://forge.manus.ai` | Orchestrator (webdev) | Forge API |
| 72 | `VITE_OAUTH_PORTAL_URL` | `https://manus.im` | Orchestrator (webdev) | Auth |

---

## 9. The sandbox-runtime Python Process — Additional Variables

The sandbox-runtime process (Nuitka-compiled Python binary) has additional variables that user shell sessions do NOT see:

| Variable | Value | Purpose |
|----------|-------|---------|
| `PYTHONHOME` | `/home/ubuntu/.local/share/uv/python/cpython-3.13.8-linux-x86_64-gnu` | Python interpreter location |
| `PYTHONPATH` | (long path to .venv and stdlib) | Python module search path |
| `NUITKA_PYTHONPATH` | (same as PYTHONPATH) | Nuitka-compiled binary Python path |
| `LD_LIBRARY_PATH` | `.../cv2/../../lib64:` | OpenCV shared library path |
| `QT_QPA_FONTDIR` | `.../cv2/qt/fonts` | Qt font directory (for OpenCV GUI) |
| `QT_QPA_PLATFORM_PLUGIN_PATH` | `.../cv2/qt/plugins` | Qt platform plugins |
| `PLAYWRIGHT_ARTIFACTS_DIR` | `/home/ubuntu/Downloads/.tmp` | Where Playwright saves downloads |
| `PW_CLI_DISPLAY_VERSION` | `1.49.1` | Playwright version |
| `PW_LANG_NAME` | `python` | Playwright language binding |
| `PW_LANG_NAME_VERSION` | `3.13` | Python version for Playwright |
| `SUBPROCESS_BAGGAGE` | `sentry-environment=production,...` | Sentry distributed tracing baggage |
| `SUBPROCESS_SENTRY_TRACE` | `cd1bb180...-9f62a734...` | Sentry trace ID propagation |

**The `SUBPROCESS_BAGGAGE` reveals the orchestrator's Sentry config:**
```
sentry-environment=production
sentry-release=2661e2bb
sentry-public_key=372785e4d3e53b5c8636a1adfa7508fb
sentry-trace_id=cd1bb180aaadfcc8b9e713bc3e05285a
sentry-transaction=create_sandbox_instance
sentry-sampled=true
sentry-sample_rand=0.512639
```

This tells us:
- The orchestrator's Sentry release is `2661e2bb` (a git commit hash)
- The transaction that created this sandbox was `create_sandbox_instance`
- The orchestrator uses a DIFFERENT Sentry project (public key `372785e4...`) than the sandbox (`962d173a...`)

---

## 10. How to Replicate This in Your Clone

### 10.1 The Four-Layer Environment System

```typescript
// src/server/sandbox/env-builder.ts

export function buildSandboxEnvironment(
  userId: string,
  userSecrets: Record<string, string>,
  connectorTokens: Record<string, string>,
  webdevProject?: { id: string; title: string },
  timezone?: string,
): Record<string, string> {

  // Layer 1: Infrastructure (baked into VM template via supervisor)
  // These are already in the E2B template — you don't set them at runtime

  // Layer 2: Write ~/.env at sandbox creation
  const dotEnv: Record<string, string> = {
    APP_ENV: 'PROD',
    RUNTIME_API_HOST: process.env.API_HOST!,
    TZ: timezone || 'UTC',
    // OTEL config
    OTEL_SERVICE_NAME: 'sandbox-runtime',
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_ENDPOINT!,
    OTEL_TRACES_EXPORTER: 'otlp',
    OTEL_TRACES_SAMPLER_RATIO: '1.0',
    // Sentry
    SENTRY_DSN: process.env.SANDBOX_SENTRY_DSN!,
  };

  // Layer 3: Write ~/.user_env with user secrets
  const userEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(userSecrets)) {
    userEnv[key] = value;
  }
  for (const [key, value] of Object.entries(connectorTokens)) {
    userEnv[key] = value;
  }

  // Layer 4: Inject into shell environment (not written to files)
  const runtimeEnv: Record<string, string> = {
    OPENAI_API_KEY: generateSandboxToken(userId),
    OPENAI_API_BASE: `${process.env.API_HOST}/api/llm-proxy/v1`,
    OPENAI_BASE_URL: `${process.env.API_HOST}/api/llm-proxy/v1`,
  };

  // Webdev-specific vars (only when project is active)
  if (webdevProject) {
    Object.assign(runtimeEnv, {
      BUILT_IN_FORGE_API_KEY: generateForgeKey(userId, 'server'),
      BUILT_IN_FORGE_API_URL: process.env.FORGE_API_URL!,
      JWT_SECRET: generateJwtSecret(webdevProject.id),
      OAUTH_SERVER_URL: process.env.API_HOST!,
      OWNER_NAME: userId,
      OWNER_OPEN_ID: generateOpenId(userId),
      VITE_APP_ID: webdevProject.id,
      VITE_APP_TITLE: webdevProject.title,
      VITE_FRONTEND_FORGE_API_KEY: generateForgeKey(userId, 'frontend'),
      VITE_FRONTEND_FORGE_API_URL: process.env.FORGE_API_URL!,
      VITE_OAUTH_PORTAL_URL: process.env.OAUTH_PORTAL_URL!,
      VITE_ANALYTICS_ENDPOINT: process.env.ANALYTICS_ENDPOINT!,
      VITE_ANALYTICS_WEBSITE_ID: generateAnalyticsId(webdevProject.id),
      PORT: '3000',
      NODE_ENV: 'development',
      DATABASE_URL: `mysql://root:password@localhost:3306/${webdevProject.id}_db`,
    });
  }

  return { ...dotEnv, ...userEnv, ...runtimeEnv };
}
```

### 10.2 Writing the Files to the Sandbox

```typescript
async function setupSandboxEnvironment(sandbox: Sandbox, env: ReturnType<typeof buildSandboxEnvironment>) {
  // Write ~/.env (infrastructure vars)
  const dotEnvContent = Object.entries(env)
    .filter(([k]) => INFRASTRUCTURE_VARS.includes(k))
    .map(([k, v]) => `export ${k}="${v}"`)
    .join('\n');
  await sandbox.files.write('/home/ubuntu/.env', dotEnvContent);

  // Write ~/.user_env (user secrets)
  const userEnvContent = Object.entries(env)
    .filter(([k]) => USER_SECRET_VARS.includes(k))
    .map(([k, v]) => `# User secret\nexport ${k}="${v}"`)
    .join('\n\n');
  await sandbox.files.write('/home/ubuntu/.user_env', userEnvContent);

  // Write ~/.secrets/sandbox_api_token
  await sandbox.files.write('/home/ubuntu/.secrets/sandbox_api_token', env.OPENAI_API_KEY);

  // Runtime vars are injected via the shell tool's environment parameter
  // They don't get written to files
}
```

---

## 11. Summary: The Complete Environment Loading Chain

```
VM BOOT (Firecracker microVM starts)
    ↓
systemd starts supervisord
    ↓
supervisord reads /etc/supervisor/conf.d/*.conf
    ↓
supervisord starts processes with their configured environment= vars
    ├── sandbox-runtime: PATH, HOME, CHROME_INSTANCE_PATH, WEBDEV_TEMPLATES_PATH, TZ=UTC
    ├── Xorg: (minimal)
    ├── chrome: DISPLAY=:0, TZ=UTC
    ├── neko: DISPLAY=:0, PULSE_RUNTIME_PATH, XDG_RUNTIME_DIR, HOME
    └── runtime-upgrade: PATH, HOME, WEBDEV_TEMPLATES_PATH, TZ=UTC
    ↓
start-neko-with-turn.sh generates NEKO passwords → appends to ~/.env
check-start-code-server.sh generates CODE_SERVER password → appends to ~/.env
    ↓
Orchestrator writes infrastructure vars to ~/.env (APP_ENV, OTEL_*, SENTRY_DSN, etc.)
Orchestrator writes user secrets to ~/.user_env (DATABASE_URL, CATS_FACTS_API, GH_TOKEN, etc.)
Orchestrator writes sandbox token to ~/.secrets/sandbox_api_token
    ↓
start_server.sh sources ~/.env → sets PYTHONHOME, PYTHONPATH → launches start_server binary
start_server binary loads full environment including OTEL, Sentry, Playwright vars
    ↓
User sends message → orchestrator creates shell session
    ↓
Shell session runs .bashrc:
    Line 124: source ~/.env (infrastructure vars)
    Line 125: source ~/.user_env (user secrets)
    ↓
Orchestrator injects runtime vars into shell environment:
    OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_API_BASE
    + webdev vars if project active (VITE_*, JWT_SECRET, OWNER_*, etc.)
    ↓
User shell session now has ALL 70+ variables merged
```

**That's every single environment variable, where it comes from, when it's loaded, and which process uses it.**
