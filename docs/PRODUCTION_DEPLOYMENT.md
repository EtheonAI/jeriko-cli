# Rubic — Production Deployment Reference

Quick reference for all environment variables, infrastructure requirements, and service configuration needed to deploy Rubic in production.

---

## Service Ports

| Service | Dev Port | Prod Port | Protocol |
|---------|----------|-----------|----------|
| Next.js App | 3000 | 3000 | HTTP |
| Gateway | 4001 | 4001 | HTTP + WebSocket + SSE |
| Task Service | 4002 | 4002 | HTTP |
| Website Service | 4004 | 4004 | HTTP |
| File Service | 4005 | 4005 | HTTP |
| Notification Service | 4006 | 4006 | HTTP |
| Webhook Service | 4007 | 4007 | HTTP |
| Billing Service | 4008 | 4008 | HTTP |
| Connector Service | 4009 | 4009 | HTTP |
| Project Service | 4010 | 4010 | HTTP |
| Knowledge Service | 4011 | 4011 | HTTP |
| Sandbox Service | 4012 | 4012 | HTTP |
| Search Service | 4013 | 4013 | HTTP |
| **Orchestrator** | 4014 | 4014 | HTTP + SSE |
| Device Service | 4015 | 4015 | HTTP + WebSocket |
| WebRTC Media | 4016 | 4016 | HTTP |

---

## Orchestrator Service (`services/orchestrator`)

The orchestrator is the AI agent brain — it runs the tool loop, manages sandboxes, and serves the LLM proxy.

### Required Environment Variables

```env
# Core
PORT=4014
NODE_ENV=production

# LLM Provider — which provider the orchestrator itself uses for the agent loop
LLM_PROVIDER=anthropic           # 'anthropic', 'openai', or 'auto'
ANTHROPIC_API_KEY=sk-ant-...     # For the agent loop (Claude)
OPENAI_API_KEY=sk-proj-...       # For the LLM proxy (forwarded to OpenAI from sandboxes)
ORCHESTRATOR_MODEL=claude-sonnet-4-5-20250929
OPENAI_MODEL=gpt-4o

# Sandbox Service
SANDBOX_SERVICE_URL=http://sandbox:4012     # Internal service URL

# E2B
E2B_API_KEY=e2b_...              # From https://e2b.dev/dashboard

# LLM Proxy URL (CRITICAL — see below)
LLM_PROXY_URL=https://api.rubic.ai/api/llm-proxy/v1

# AWS S3
S3_BUCKET=rubic-prod
AWS_REGION=us-west-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# Task Service
TASK_SERVICE_URL=http://task:4002

# CORS
ALLOWED_ORIGINS=https://app.rubic.ai,https://rubic.ai
```

### LLM Proxy URL — CRITICAL

The `LLM_PROXY_URL` is injected into every E2B sandbox as `OPENAI_BASE_URL`. Code running inside sandboxes calls this URL to access LLM capabilities.

**Requirements:**
- Must be **publicly reachable from E2B sandboxes** (E2B runs on remote infrastructure)
- Must point to the orchestrator's `/api/llm-proxy/v1` endpoint
- The real `OPENAI_API_KEY` **never** enters the sandbox — only a per-sandbox proxy token (`sk-rubic-...`)

**Production:**
```
LLM_PROXY_URL=https://api.rubic.ai/api/llm-proxy/v1
```

**Development (tunnel required):**
```bash
# Option A: ngrok
ngrok http 4014
# Then set: LLM_PROXY_URL=https://<random>.ngrok-free.app/api/llm-proxy/v1

# Option B: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:4014
# Then set: LLM_PROXY_URL=https://<tunnel>.trycloudflare.com/api/llm-proxy/v1
```

Without a tunnel in dev, the LLM proxy endpoint is unreachable from inside E2B sandboxes (localhost doesn't work).

### LLM Proxy Security Model (Manus Pattern)

1. Orchestrator creates sandbox → generates unique `sk-rubic-<random>` token
2. Token is set as `OPENAI_API_KEY` inside the sandbox (via `config.env`)
3. `OPENAI_BASE_URL` points to our proxy, NOT to OpenAI directly
4. Sandbox code uses OpenAI SDK normally — SDK reads env vars automatically
5. Proxy validates the `sk-rubic-...` token → forwards to real OpenAI with server-side key
6. On sandbox destroy, token is invalidated

**Blocked models:** Claude/Anthropic models are blocked at the proxy to prevent recursive self-invocation from sandbox code.

### File Upload API (S3 Presigned URL Flow)

The orchestrator also serves a file upload API that sandboxes use to upload files to S3/CDN:

1. `rubic-upload-file` (shell script baked into E2B template) reads auth token from `~/.secrets/sandbox_api_token`
2. Calls `POST /api/upload/presign` on the orchestrator with `{ filename: "image.png" }`
3. Orchestrator validates token → generates presigned S3 PUT URL + CDN access URL
4. `rubic-upload-file` PUTs the file directly to S3 using the presigned URL (orchestrator never sees file bytes)
5. Prints CDN URL to stdout

**Environment:** `RUBIC_UPLOAD_URL` is automatically set in sandbox `~/.user_env` (derived from `LLM_PROXY_URL`).

**S3 Configuration:** The orchestrator needs S3 access for presigned URL generation:
```env
S3_BUCKET=rubic-prod
AWS_REGION=us-west-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
CDN_URL=https://cdn.rubic.ai    # Optional: CDN domain for access URLs
```

---

## Sandbox Service (`services/sandbox`)

Manages E2B sandbox lifecycle — creation, destruction, file operations, shell execution.

### Required Environment Variables

```env
# Core
PORT=4012

# Database
DATABASE_URL=postgresql://...

# E2B
E2B_API_KEY=e2b_...              # Same key as orchestrator
E2B_TEMPLATE=desktop             # Neko WebRTC template
E2B_WEBHOOK_SIGNATURE_SECRET=... # For E2B lifecycle webhooks

# Cloudflare TURN (CRITICAL — see below)
CLOUDFLARE_TURN_KEY_ID=...       # From https://dash.cloudflare.com → Realtime → TURN
CLOUDFLARE_TURN_TOKEN=...        # Token for the TURN key
```

**Note:** `OPENAI_API_KEY` is NOT in this service. The orchestrator generates per-sandbox proxy tokens and passes them via `config.env` during sandbox creation.

---

## Cloudflare TURN — Required for Neko WebRTC

E2B sandboxes run on remote infrastructure that blocks raw UDP/TCP traffic. WebRTC requires a TURN relay to work through E2B's network.

### Setup

1. Go to [Cloudflare Dashboard → Realtime → TURN](https://dash.cloudflare.com/?to=/:account/realtime/turn)
2. Create a TURN key → get `Key ID` and `API Token`
3. Set in `services/sandbox/.env`:
   ```env
   CLOUDFLARE_TURN_KEY_ID=<key-id>
   CLOUDFLARE_TURN_TOKEN=<api-token>
   ```

### How It Works

1. Sandbox service creates E2B sandbox (Neko starts with STUN-only)
2. Sandbox service fetches Cloudflare TURN credentials via API
3. Sandbox service writes credentials to `/tmp/turn_credentials.json` inside sandbox
4. `start_command.sh` TURN watcher detects the file → restarts Neko with TURN relay
5. Browser connects via WebRTC through Cloudflare TURN

### Without TURN

If TURN is not configured, Neko will start with STUN-only. This means:
- WebRTC will NOT connect through E2B (E2B blocks direct UDP/TCP)
- The desktop view in the browser will fail to load
- Other sandbox features (shell, files, code exec) still work fine

### Debugging TURN Issues

```bash
# Check if TURN credentials file exists inside sandbox
e2b sandbox exec <sandbox-id> -- cat /tmp/turn_credentials.json

# Check if TURN watcher completed
e2b sandbox exec <sandbox-id> -- ls -la /tmp/turn_ready

# Check Neko logs
e2b sandbox exec <sandbox-id> -- journalctl -u neko --no-pager -n 50
```

---

## E2B Desktop Template

The desktop template provides a full Ubuntu desktop with Neko WebRTC streaming. Modeled after the Manus sandbox environment for feature parity.

### Template Contents

- Ubuntu 22.04 + XFCE desktop + D-Bus
- Neko v3 WebRTC server (port 8080) with Cloudflare TURN
- GStreamer VP8 encoding pipeline
- Playwright + Chromium (for agent browser automation)
- PulseAudio (audio capture)
- Node.js 22 LTS + pnpm (via corepack) + yarn
- Python 3.12 + uv (fast pip wrapper) + venv
- Developer tools: ripgrep, fd-find, tree, htop, jq, build-essential, zip/unzip
- GitHub CLI (gh)
- Document tools: pandoc, wkhtmltopdf (MD→PDF, HTML→PDF)
- LibreOffice, gedit, PCManFM, galculator
- Shell: bash (default), zsh available

### Directory Structure (Manus-equivalent)

```
/home/user/                     — Default workspace
/home/user/screenshots/         — Browser screenshots (WebP)
/home/user/Downloads/           — Browser download target
/home/user/upload/              — User-uploaded files
/home/user/skills/              — Skill system files
/home/user/terminal_full_output/ — Terminal session logs
/home/user/.secrets/            — Session secrets (sandbox_api_token)
/home/user/.browser_data_dir/   — Chromium profile data
/home/user/.search_cache/       — Search image cache
/home/user/webdev-static-assets/ — CDN-uploaded media (moved from projects)
/home/user/.env                 — Layer 1: static config (baked)
/home/user/.user_env            — Layer 2: session secrets (injected)
/opt/.rubic/                    — Platform runtime root
/opt/.rubic/runtime/            — Runtime scripts
/opt/.rubic/runtime/js/         — Browser automation JS scripts
/opt/.rubic/deploy/templates/   — Deployment templates
/opt/.rubic/webdev/templates/   — Web dev project templates
/opt/.rubic/neko/               — Neko config
/tmp/rubic-mcp/                 — MCP tool results
```

### Environment Layers (Manus 4-Layer Model)

| Layer | File | When Written | Contents |
|-------|------|-------------|----------|
| 1 | `~/.env` | Template build | DISPLAY, PYTHONIOENCODING, RUBIC_OPT_PATH, NODE_OPTIONS |
| 2 | `~/.user_env` | Session start | OPENAI_API_KEY (proxy token), OPENAI_BASE_URL, RUBIC_UPLOAD_URL |
| 3 | `~/.secrets/sandbox_api_token` | Session start | Proxy token for API auth |
| 4 | Process env | Per exec | Dynamic tool-specific env vars |

Both `~/.env` and `~/.user_env` are sourced by `.bashrc` and `.zshrc`, so interactive shells pick them up automatically.

### Building the Template

```bash
cd e2b-templates/desktop
npx tsx build.ts
```

This uses the E2B v2 TypeScript API (`Template.build()`). Do NOT use the deprecated `e2b template build` CLI command.

### Neko Configuration (in start_command.sh)

| Env Var | Value | Notes |
|---------|-------|-------|
| `NEKO_SERVER_BIND` | `:8080` | HTTP + WebSocket signaling |
| `NEKO_DESKTOP_SCREEN` | `1280x720@30` | Resolution + framerate |
| `NEKO_MEMBER_PROVIDER` | `multiuser` | Neko v3 auth provider |
| `NEKO_MEMBER_MULTIUSER_USER_PASSWORD` | `neko` | Default user password |
| `NEKO_MEMBER_MULTIUSER_ADMIN_PASSWORD` | `admin` | Admin password |
| `NEKO_SESSION_COOKIE_ENABLED` | `false` | Cookies don't work cross-origin in iframes |
| `NEKO_SESSION_IMPLICIT_HOSTING` | `true` | Auto-grant control to first user |

### Auth Bridge

Since cookie auth doesn't work in cross-origin iframes (browser blocks third-party cookies), we use token-based auth:

1. `autoconnect.html` — POSTs to `/api/login` with credentials → gets token
2. Token is stored in `localStorage` and injected into WebSocket URL as `?token=`
3. `index.html` includes a script that monkey-patches WebSocket to append the token

---

## Database

```env
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
```

- **Provider:** Neon (serverless Postgres)
- **ORM:** Drizzle
- Used by: sandbox, task, file, billing, connector, notification, webhook, project, knowledge, search, website, device services
- **NOT used by:** orchestrator, gateway (stateless)

---

## Next.js App (`apps/app`)

### Key Environment Variables

```env
# Auth
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://app.rubic.ai

# Services (internal, not exposed to browser)
ORCHESTRATOR_URL=http://orchestrator:4014
SANDBOX_SERVICE_URL=http://sandbox:4012

# Public (exposed to browser via NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_APP_URL=https://app.rubic.ai
```

### Sandbox Proxy Routes

Browser-side sandbox calls MUST go through Next.js API proxy routes (same-origin), NOT directly to the sandbox service:

| Proxy Route | Target |
|-------------|--------|
| `POST /api/sandbox` | Create sandbox |
| `POST /api/sandbox/[id]/shell` | Shell exec |
| `POST /api/sandbox/[id]/files` | File write |
| `GET /api/sandbox/[id]/files?path=...` | File read |
| `GET /api/sandbox/[id]/files/list?path=...` | File list |
| `GET /api/sandbox/[id]/browser/stream` | Neko URL |
| `POST /api/sandbox/[id]/stop` | Stop sandbox |

These proxy routes handle Better-Auth session validation and forward `x-user-id` to the sandbox service.

---

## Infrastructure Checklist

### Required External Services

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **E2B** | Code sandboxes | https://e2b.dev |
| **Cloudflare TURN** | WebRTC relay for Neko through E2B | https://dash.cloudflare.com → Realtime → TURN |
| **Neon** | Serverless Postgres | https://neon.tech |
| **AWS S3** | File storage | https://aws.amazon.com |
| **Anthropic** | Claude API (agent brain) | https://console.anthropic.com |
| **OpenAI** | GPT API (sandbox LLM proxy) | https://platform.openai.com |

### Optional External Services

| Service | Purpose | Sign Up |
|---------|---------|---------|
| **Inngest** | Task scheduling + workflows | https://inngest.com |
| **Knock** | Email/push notifications | https://knock.app |
| **Composio** | Third-party app connectors | https://composio.dev |
| **Stripe** | Billing | https://stripe.com |
| **Typesense** | Full-text search | https://typesense.org |
| **Redis** | Resumable streams + pub/sub | Self-hosted or managed |

### Network Requirements

1. **Orchestrator must be publicly reachable** from E2B sandboxes (for LLM proxy)
   - In prod: behind a reverse proxy / load balancer with HTTPS
   - URL set via `LLM_PROXY_URL`

2. **Sandbox service** needs outbound HTTPS to:
   - E2B API (`api.e2b.dev`)
   - Cloudflare TURN API (`rtc.live.cloudflare.com`)

3. **Next.js app** needs internal access to:
   - Orchestrator (:4014)
   - Sandbox service (:4012)
   - All other microservices

---

## Quick Start (Development)

```bash
# 1. Install dependencies
pnpm install

# 2. Copy env files
cp services/orchestrator/.env.example services/orchestrator/.env
cp services/sandbox/.env.example services/sandbox/.env

# 3. Fill in API keys (see Required Environment Variables above)

# 4. Start services
pnpm --filter orchestrator dev    # Port 4014
pnpm --filter sandbox dev         # Port 4012
pnpm --filter app dev             # Port 3000

# 5. (Optional) Tunnel for LLM proxy — needed for sandbox → proxy flow
ngrok http 4014
# Update LLM_PROXY_URL in services/orchestrator/.env with ngrok URL
```

---

## Gotchas

- **proxy.ts NOT middleware.ts** — Next.js 16.1 renamed middleware.ts to proxy.ts
- **E2B `envs` not available to start_command.sh** — Only available to `exec` commands. That's why TURN credentials are written post-creation via file write.
- **Helmet CORS blocking** — `@fastify/helmet` defaults `Cross-Origin-Resource-Policy: same-origin`. Must set `crossOriginResourcePolicy: { policy: "cross-origin" }`.
- **ESM + pnpm + tsx** — Dynamic `import("@repo/database")` wraps under `mod.default`. Use `(mod as any).default ?? mod`.
- **Neon HTTP driver** — No transaction support. Avoid `db.transaction()`.
- **Cookie auth in iframes** — Third-party cookies blocked in modern browsers. Use token-based auth for Neko.
