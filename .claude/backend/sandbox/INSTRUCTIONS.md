# Sandbox Service Instructions

> **VERIFIED against actual codebase -- Feb 2026 audit**

## Overview

The sandbox service (`services/sandbox/`) provides isolated code execution environments using E2B (e2b.dev). It creates sandboxes, executes code (Python, JS, Bash), runs shell commands, and manages files within sandboxed environments. This is the backbone for the `execute_code` tool in the agent service and the website preview functionality.

**Port:** 4012 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify
**Status:** 682 LOC, fully implemented with real E2B integration. All endpoints are live and wired to the database.

---

## Current File Structure

```
services/sandbox/src/
  index.ts              # 682 lines - all endpoints implemented with E2B SDK + Drizzle DB
```

---

## Current State (Fully Implemented)

Everything below is live and working in `services/sandbox/src/index.ts`.

### E2B SDK Integration

- Imports `Sandbox` from `@e2b/code-interpreter`
- Uses `E2B_API_KEY` from env for all SDK calls
- `E2BSandbox.create()`, `.connect()`, `.runCode()`, `.commands.run()`, `.files.*`, `.kill()`

### In-Memory Sandbox Registry

- `sandboxMap: Map<string, E2BSandbox>` keyed by DB sandbox ID
- `getE2BSandbox()` helper: checks map first, falls back to DB lookup + `E2BSandbox.connect()` for reconnection
- Graceful shutdown handler kills all active E2B sandboxes on SIGINT/SIGTERM

### Implemented Endpoints

| Method                          | Path | Status                                                            | Description |
| ------------------------------- | ---- | ----------------------------------------------------------------- | ----------- |
| `GET /health`                   | LIVE | Health check                                                      |
| `POST /sandboxes`               | LIVE | Creates E2B sandbox, stores in DB, caches instance                |
| `GET /sandboxes/:id`            | LIVE | Fetches sandbox record from DB                                    |
| `GET /users/:userId/sandboxes`  | LIVE | Lists user's sandboxes ordered by createdAt desc                  |
| `POST /sandboxes/:id/execute`   | LIVE | Executes code via `e2bSandbox.runCode()`, records execution in DB |
| `GET /executions/:id`           | LIVE | Fetches execution result from DB                                  |
| `POST /sandboxes/:id/shell`     | LIVE | Runs shell command via `e2bSandbox.commands.run()`, records in DB |
| `POST /sandboxes/:id/files`     | LIVE | Writes file via `e2bSandbox.files.write()`, tracks in DB          |
| `GET /sandboxes/:id/files`      | LIVE | Reads file via `e2bSandbox.files.read()`, falls back to DB        |
| `GET /sandboxes/:id/files/list` | LIVE | Lists files via `e2bSandbox.files.list()`, falls back to DB       |
| `POST /sandboxes/:id/stop`      | LIVE | Kills E2B sandbox, updates DB status to "stopped"                 |
| `DELETE /sandboxes/:id`         | LIVE | Kills E2B sandbox, deletes DB record                              |

### Key Implementation Details

- **Reconnection:** If an E2B sandbox is not in the in-memory map, `getE2BSandbox()` looks up the `e2bSandboxId` from DB and reconnects via `E2BSandbox.connect()`.
- **Execution history:** Every code execution and shell command creates a `sandbox_executions` record with status, stdout, stderr, exitCode, executionTimeMs.
- **File fallback:** File read and list endpoints fall back to DB records if the E2B sandbox is unreachable.
- **Timeout handling:** Execute endpoint detects timeout errors and returns HTTP 408 with `status: "timeout"`.
- **Error propagation:** Structured error responses with E2B error name/value/traceback for code execution failures.
- **Request logging:** Fastify hooks log every incoming request and response with requestId, method, URL, statusCode, and responseTime.
- **Graceful shutdown:** SIGINT/SIGTERM handlers kill all active E2B sandboxes via `Promise.allSettled`, then close the Fastify server.

### Agent Service Integration (Working)

The agent service (`services/agent/src/routes/tools.py`) already calls the sandbox service for the `execute_code` tool:

1. Agent receives tool_use block: `{ name: "execute_code", input: { code: "...", language: "python" } }`
2. `execute_code()` in tools.py calls `POST /sandboxes` to create a sandbox (or reuses an existing `sandbox_id`)
3. Calls `POST /sandboxes/:id/execute` with code, language, and timeout
4. Returns stdout/stderr/exitCode/sandbox_id back to the LLM as a tool_result
5. Sandbox ID is preserved so iterative coding reuses the same sandbox

---

## Database Tables

From `packages/database/src/schema/sandboxes.ts`:

### `sandboxes`

Sandbox instance records.

- `id` - CUID2 primary key
- `userId`, `organizationId`, `projectId`, `agentSessionId`
- `e2bSandboxId` - External E2B sandbox ID
- `templateId` - E2B template used (e.g., "python", "node", "custom")
- `name` - Human-readable name
- `type` - "code" | "browser" | "desktop" | "custom"
- `status` - "creating" | "running" | "paused" | "stopped" | "error" | "terminated"
- `config` (JSONB) - `{ timeout, memory, cpu, env, ports }`
- `hostname` - E2B sandbox hostname (for URL access)
- `ports` (JSONB) - Array of `{ internal, external }` port mappings
- `workingDirectory` - Default `/home/user`
- `startedAt`, `lastActivityAt`, `expiresAt`
- `cpuUsage`, `memoryUsage` - Resource metrics
- `metadata` (JSONB) - Arbitrary metadata

### `sandbox_executions`

Code execution history.

- `id` - CUID2 primary key
- `sandboxId` - FK to sandboxes
- `type` - "code" | "command" | "script"
- `language` - "python" | "javascript" | "bash" | etc.
- `code` - The code that was executed
- `status` - "pending" | "running" | "completed" | "failed" | "timeout"
- `stdout`, `stderr` - Output text
- `exitCode` - Process exit code
- `result` (JSONB) - Structured result if applicable
- `error` - Error message
- `startedAt`, `completedAt`, `executionTimeMs`
- `timeoutMs` - Default 30000

### `sandbox_files`

Files tracked within sandboxes.

- `sandboxId`, `path`, `name`
- `isDirectory` - Boolean
- `content` - File content (for small files)
- `storageUrl` - For large files, stored externally
- `size`, `mimeType`, `version`, `checksum`

---

## What Needs Building

The following features are NOT yet implemented in the sandbox service.

### 1. Port Exposure Endpoint

The `sandboxes` table already has `hostname` and `ports` fields, and E2B supports `sandbox.getHost(port)`. What is missing is an explicit endpoint for the frontend to request port exposure for website previews.

```
POST /sandboxes/:id/ports
Body: { port: 3000 }
Response: { url: "https://<e2b-host>:3000", port: 3000 }
```

This is needed for the website builder preview pane (iframe pointing at sandbox URL).

### 2. Browser Integration (Playwright Screenshots)

For the "browser" sandbox type, add Playwright-based endpoints to take screenshots and interact with web pages inside the sandbox:

```
POST /sandboxes/:id/browser/navigate  - Navigate to URL
POST /sandboxes/:id/browser/screenshot - Take screenshot
POST /sandboxes/:id/browser/click      - Click element
POST /sandboxes/:id/browser/type       - Type into element
```

This requires installing Playwright in the E2B sandbox template and running headless Chromium.

### 3. Streaming Output (Real-Time stdout/stderr)

Currently, code execution and shell commands are synchronous (the HTTP response waits for completion). For long-running tasks, add WebSocket-based streaming:

- Subscribe to `sandbox:output` events for real-time stdout/stderr
- Use E2B's `onStdout`/`onStderr` callbacks during `runCode()` and `commands.run()`
- Emit events via the WebSocket gateway service
- Frontend terminal panel can display output as it streams

### 4. Resource Monitoring

The `sandboxes` table has `cpuUsage` and `memoryUsage` columns, but nothing populates them. Add:

```
GET /sandboxes/:id/metrics
Response: { cpu: 45, memoryMb: 128, diskMb: 50 }
```

Periodically poll E2B for resource usage and update the DB, or expose a one-shot endpoint that checks on demand.

### 5. Sandbox Templates

Currently the service passes `template` through to E2B but does not manage custom templates. Add:

- Custom E2B template definitions (pre-installed packages, system dependencies)
- Template registry endpoint: `GET /templates`, `POST /templates`
- Common templates: "python-data-science" (numpy, pandas, matplotlib), "node-web" (node + npm), "full-stack" (node + python + postgres)

### 6. Inactive Sandbox Cleanup

The in-memory map tracks sandboxes but there is no automatic cleanup of idle sandboxes. The old instructions described a 30-minute inactive cleanup interval. Add:

- Periodic cleanup (every 5 minutes) that checks `lastActivityAt`
- Kill sandboxes inactive for more than 30 minutes
- Update DB status to "terminated"
- This prevents E2B billing for abandoned sandboxes

---

## Frontend Integration

The frontend should display a terminal panel and preview pane for sandbox interactions:

- **Terminal panel:** Shows sandbox stdout/stderr. Currently works via polling execution results. Streaming (item 3 above) would enable real-time display.
- **Preview pane:** For web applications, show the sandbox URL (`hostname` field) in an iframe. Requires port exposure endpoint (item 1 above).
- **File tree:** Show sandbox files using `GET /sandboxes/:id/files/list`.

---

## Environment Variables

| Variable       | Default               | Description                                 |
| -------------- | --------------------- | ------------------------------------------- |
| `PORT`         | `4012`                | Sandbox service port                        |
| `HOST`         | `0.0.0.0`             | Sandbox service host                        |
| `E2B_API_KEY`  | None                  | E2B API key (required for sandbox creation) |
| `DATABASE_URL` | (from @repo/database) | PostgreSQL connection                       |
