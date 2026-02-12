# Manus Sandbox Inspection Findings

## Running Services
| Service | Port | Process | Purpose |
|---|---|---|---|
| sandbox-runtime (Nuitka-compiled Python) | 8330 (public), 9330 (internal) | start_server | Main API server - handles all tool calls |
| code-server | 8329 | node | VS Code in browser (password: from env) |
| neko | 8333 | neko serve | WebRTC remote desktop (browser streaming) |
| chromium | 9222 | chromium-browser | Headless browser with remote debugging |
| manus-mcp-cli | 8350 | manus-mcp-cli | MCP server bridge |
| VNC | 5900/5901 | (system) | Virtual display for neko |
| upgrade | 8340 | upgrade | Hot-upgrade service |

## Key Environment Variables
- `DATABASE_URL` = `aa41fd04-9b07-4508-b046-e6ac9daced02` (UUID, NOT a mysql:// connection string)
- `CODE_SERVER_DOMAIN` = `us1.manus.computer`
- `CODE_SERVER_PORT` = `8329`
- `CODE_SERVER_PASSWORD` = `d0b85f110c1c669c`
- `NEKO_ADMIN_PASSWORD` = `2c540aa6812d36be`
- `NEKO_USER_PASSWORD` = `952c36df9b250391`
- `RUNTIME_API_HOST` = `https://api.manus.im`
- `OPENAI_BASE_URL` = `https://api.manus.im/api/llm-proxy/v1`
- `DEPLOY_WASMER_OWNER` = `manus`
- `APP_DOMAIN` = `manus.im,manus.ai`

## Architecture Findings

### 1. DATABASE_URL is a UUID, not a connection string
The `DATABASE_URL` env var is `aa41fd04-9b07-4508-b046-e6ac9daced02` — a UUID identifier.
This is NOT a mysql:// connection string. It's a **TiDB Cloud cluster/branch identifier**.
The drizzle ORM in `db.ts` calls `drizzle(process.env.DATABASE_URL)` which means drizzle-orm/mysql2
must resolve this UUID through TiDB's serverless driver or a proxy.

Actually: drizzle-orm v0.44+ supports passing a TiDB Serverless connection string that looks like
a UUID-based identifier when using the TiDB Cloud Data API / serverless driver.
The `@tidbcloud/serverless` driver accepts a database ID as the connection parameter.

### 2. Browser streaming uses Neko (WebRTC), NOT screenshots
The browser is NOT streamed via screenshots. It uses **neko** — an open-source WebRTC-based
remote desktop solution. The browser runs in a virtual X11 display (:0), neko captures the
display at 1280x1029@30fps, encodes it as H.264, and streams it via WebRTC to the frontend.

This is why the browser view is "live" — it's a real-time video stream, not periodic screenshots.

### 3. code-server provides the IDE
VS Code runs as code-server on port 8329, accessible via `us1.manus.computer` domain.
This is how users can edit code directly in the sandbox.

### 4. sandbox-runtime is a compiled Python binary (Nuitka)
The main server is a Python application compiled with Nuitka into a native binary.
It runs on port 8330 (public) and 9330 (internal).
Source package name: `sandbox_runtime`

### 5. Deployment uses Wasmer Edge
`DEPLOY_WASMER_OWNER=manus` — deployed apps go to Wasmer Edge.

### 6. The webdev_init_project tool scaffolds from templates
Templates are stored in `/opt/.manus/webdev/templates/web-dev-templates/templates/`
Three template types: `web-static`, `web-db-user`, `app` (mobile)
The init tool copies the template, writes .env with the project-specific DATABASE_URL,
and runs pnpm install.

### 7. The sandbox is NOT E2B
This is Manus's own sandbox infrastructure. It's a full Linux VM with:
- Ubuntu 22.04
- X11 virtual display
- Chromium browser
- code-server (VS Code)
- neko (WebRTC remote desktop)
- Python 3.13 runtime
- Node.js 22.13
- MySQL client
- Full networking
