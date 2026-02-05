# Sandbox Service Instructions

## Overview

The sandbox service (`services/sandbox/`) provides isolated code execution environments using E2B (e2b.dev). It creates sandboxes, executes code, runs shell commands, and manages files within sandboxed environments. This is the backbone for the `execute_code` tool in the agent service and the website preview functionality.

**Port:** 4012 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify
**Status:** 190 lines with 10 endpoints, all stubs returning placeholder data. No E2B integration.

---

## Current File Structure

```
services/sandbox/src/
  index.ts              # 190 lines - 10 endpoints, all TODO stubs
```

---

## Current Endpoints (All Stubs)

| Method                          | Path | Status                             | Returns |
| ------------------------------- | ---- | ---------------------------------- | ------- |
| `POST /sandboxes`               | STUB | Returns UUID + `"creating"` status |
| `GET /sandboxes/:id`            | STUB | Returns `{ status: "not_found" }`  |
| `GET /users/:userId/sandboxes`  | STUB | Returns `{ sandboxes: [] }`        |
| `POST /sandboxes/:id/execute`   | STUB | Returns UUID + `"running"` status  |
| `GET /executions/:id`           | STUB | Returns empty stdout/stderr        |
| `POST /sandboxes/:id/shell`     | STUB | Returns empty stdout/stderr        |
| `POST /sandboxes/:id/files`     | STUB | Returns `{ written: true }`        |
| `GET /sandboxes/:id/files`      | STUB | Returns `{ content: "" }`          |
| `GET /sandboxes/:id/files/list` | STUB | Returns `{ files: [] }`            |
| `POST /sandboxes/:id/stop`      | STUB | Returns `{ status: "stopped" }`    |
| `DELETE /sandboxes/:id`         | STUB | Returns `{ deleted: true }`        |

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

## What Needs to Be Built

### 1. E2B Client Setup

```typescript
import { Sandbox } from "e2b";

// E2B API key from environment
const E2B_API_KEY = process.env.E2B_API_KEY!;
```

The E2B SDK manages sandbox lifecycle. Key methods:

- `Sandbox.create()` - Create a new sandbox
- `sandbox.runCode()` - Execute code
- `sandbox.commands.run()` - Run shell commands
- `sandbox.files.write()` - Write files
- `sandbox.files.read()` - Read files
- `sandbox.files.list()` - List files
- `sandbox.close()` - Stop sandbox
- `sandbox.kill()` - Force stop sandbox

### 2. In-Memory Sandbox Registry

Keep track of active E2B sandbox instances for quick access:

```typescript
// Map of our sandbox ID -> E2B Sandbox instance
const activeSandboxes = new Map<
  string,
  {
    sandbox: Sandbox;
    userId: string;
    createdAt: Date;
    lastActivityAt: Date;
  }
>();

// Cleanup inactive sandboxes every 5 minutes
setInterval(
  async () => {
    const now = Date.now();
    for (const [id, entry] of activeSandboxes) {
      const inactiveMs = now - entry.lastActivityAt.getTime();
      if (inactiveMs > 30 * 60 * 1000) {
        // 30 minutes inactive
        try {
          await entry.sandbox.close();
          activeSandboxes.delete(id);
          await db.update(sandboxes).set({ status: "stopped" }).where(eq(sandboxes.id, id));
        } catch (err) {
          logger.warn({ err, sandboxId: id }, "Failed to cleanup sandbox");
        }
      }
    }
  },
  5 * 60 * 1000
);
```

### 3. POST /sandboxes - Create Sandbox

```typescript
app.post("/sandboxes", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  if (!userId) return reply.status(401).send({ error: "Unauthorized" });

  const {
    projectId,
    template,
    config: sandboxConfig,
  } = request.body as {
    projectId?: string;
    template?: string;
    config?: { timeout?: number; memory?: number; env?: Record<string, string> };
  };

  const sandboxId = createId();

  // 1. Save to database first
  const [record] = await db
    .insert(sandboxes)
    .values({
      id: sandboxId,
      userId,
      projectId,
      templateId: template || "base",
      name: `Sandbox ${sandboxId.slice(0, 8)}`,
      type: "code",
      status: "creating",
      config: sandboxConfig || {},
      workingDirectory: "/home/user",
    })
    .returning();

  // 2. Create E2B sandbox (async)
  try {
    const e2bSandbox = await Sandbox.create({
      template: template || "base", // E2B template ID
      apiKey: E2B_API_KEY,
      timeout: sandboxConfig?.timeout || 300000, // 5 minutes default
      envs: sandboxConfig?.env || {},
    });

    // 3. Update database with E2B details
    await db
      .update(sandboxes)
      .set({
        e2bSandboxId: e2bSandbox.sandboxId,
        status: "running",
        hostname: e2bSandbox.getHost(3000), // Get hostname for port 3000
        startedAt: new Date(),
        lastActivityAt: new Date(),
        expiresAt: new Date(Date.now() + (sandboxConfig?.timeout || 300000)),
      })
      .where(eq(sandboxes.id, sandboxId));

    // 4. Add to active registry
    activeSandboxes.set(sandboxId, {
      sandbox: e2bSandbox,
      userId,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });

    return reply.status(201).send({
      id: sandboxId,
      e2bSandboxId: e2bSandbox.sandboxId,
      status: "running",
      hostname: e2bSandbox.getHost(3000),
    });
  } catch (err) {
    await db
      .update(sandboxes)
      .set({
        status: "error",
        metadata: { error: (err as Error).message },
      })
      .where(eq(sandboxes.id, sandboxId));

    logger.error({ err, sandboxId }, "Failed to create E2B sandbox");
    return reply.status(500).send({ error: "Failed to create sandbox" });
  }
});
```

### 4. POST /sandboxes/:id/execute - Execute Code

```typescript
app.post("/sandboxes/:id/execute", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { code, language, timeout } = request.body as {
    code: string;
    language?: string;
    timeout?: number;
  };

  const entry = activeSandboxes.get(id);
  if (!entry) {
    // Try to reconnect to E2B sandbox
    const [record] = await db.select().from(sandboxes).where(eq(sandboxes.id, id)).limit(1);
    if (!record || !record.e2bSandboxId) {
      return reply.status(404).send({ error: "Sandbox not found" });
    }

    // Reconnect
    try {
      const reconnected = await Sandbox.connect(record.e2bSandboxId, { apiKey: E2B_API_KEY });
      activeSandboxes.set(id, {
        sandbox: reconnected,
        userId: record.userId,
        createdAt: record.createdAt,
        lastActivityAt: new Date(),
      });
    } catch {
      return reply.status(410).send({ error: "Sandbox expired" });
    }
  }

  const sandbox = activeSandboxes.get(id)!;
  sandbox.lastActivityAt = new Date();

  const executionId = createId();
  const startedAt = new Date();

  // Save execution record
  await db.insert(sandboxExecutions).values({
    id: executionId,
    sandboxId: id,
    type: "code",
    language: language || "python",
    code,
    status: "running",
    startedAt,
    timeoutMs: timeout || 30000,
  });

  try {
    // Execute code in E2B sandbox
    const result = await sandbox.sandbox.runCode(code, {
      language: language || "python",
      timeout: timeout || 30000,
    });

    const completedAt = new Date();
    const executionTimeMs = completedAt.getTime() - startedAt.getTime();

    // Update execution record
    await db
      .update(sandboxExecutions)
      .set({
        status: "completed",
        stdout: result.logs.stdout.join("\n"),
        stderr: result.logs.stderr.join("\n"),
        exitCode: result.exitCode,
        result: result.results?.length ? result.results[0] : null,
        completedAt,
        executionTimeMs,
      })
      .where(eq(sandboxExecutions.id, executionId));

    // Update sandbox activity
    await db.update(sandboxes).set({ lastActivityAt: new Date() }).where(eq(sandboxes.id, id));

    return {
      id: executionId,
      status: "completed",
      stdout: result.logs.stdout.join("\n"),
      stderr: result.logs.stderr.join("\n"),
      exitCode: result.exitCode,
      result: result.results?.length ? result.results[0] : null,
      executionTimeMs,
    };
  } catch (err) {
    await db
      .update(sandboxExecutions)
      .set({
        status: "failed",
        error: (err as Error).message,
        completedAt: new Date(),
      })
      .where(eq(sandboxExecutions.id, executionId));

    return reply.status(500).send({
      id: executionId,
      status: "failed",
      error: (err as Error).message,
    });
  }
});
```

### 5. POST /sandboxes/:id/shell - Run Shell Command

```typescript
app.post("/sandboxes/:id/shell", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { command, timeout } = request.body as { command: string; timeout?: number };

  const entry = activeSandboxes.get(id);
  if (!entry) return reply.status(404).send({ error: "Sandbox not found or inactive" });

  entry.lastActivityAt = new Date();

  const executionId = createId();
  await db.insert(sandboxExecutions).values({
    id: executionId,
    sandboxId: id,
    type: "command",
    language: "bash",
    code: command,
    status: "running",
    startedAt: new Date(),
  });

  try {
    const result = await entry.sandbox.commands.run(command, {
      timeout: timeout || 30000,
    });

    await db
      .update(sandboxExecutions)
      .set({
        status: "completed",
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        completedAt: new Date(),
      })
      .where(eq(sandboxExecutions.id, executionId));

    return {
      id: executionId,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    };
  } catch (err) {
    await db
      .update(sandboxExecutions)
      .set({
        status: "failed",
        error: (err as Error).message,
        completedAt: new Date(),
      })
      .where(eq(sandboxExecutions.id, executionId));

    return reply.status(500).send({ error: (err as Error).message });
  }
});
```

### 6. File Operations in Sandbox

```typescript
// POST /sandboxes/:id/files - Write file to sandbox
app.post("/sandboxes/:id/files", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { path, content } = request.body as { path: string; content: string };

  const entry = activeSandboxes.get(id);
  if (!entry) return reply.status(404).send({ error: "Sandbox not found" });

  await entry.sandbox.files.write(path, content);

  // Track in database
  const existing = await db
    .select()
    .from(sandboxFiles)
    .where(and(eq(sandboxFiles.sandboxId, id), eq(sandboxFiles.path, path)))
    .limit(1);

  if (existing.length) {
    await db
      .update(sandboxFiles)
      .set({
        content: content.length < 100000 ? content : null, // Only store small files inline
        size: content.length,
        version: sql`${sandboxFiles.version} + 1`,
      })
      .where(eq(sandboxFiles.id, existing[0].id));
  } else {
    await db.insert(sandboxFiles).values({
      sandboxId: id,
      path,
      name: path.split("/").pop() || path,
      content: content.length < 100000 ? content : null,
      size: content.length,
    });
  }

  return { path, written: true };
});

// GET /sandboxes/:id/files - Read file from sandbox
app.get("/sandboxes/:id/files", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { path } = request.query as { path: string };

  const entry = activeSandboxes.get(id);
  if (!entry) return reply.status(404).send({ error: "Sandbox not found" });

  const content = await entry.sandbox.files.read(path);

  return { path, content };
});

// GET /sandboxes/:id/files/list - List files
app.get("/sandboxes/:id/files/list", async (request, reply) => {
  const { id } = request.params as { id: string };
  const { path } = request.query as { path?: string };

  const entry = activeSandboxes.get(id);
  if (!entry) return reply.status(404).send({ error: "Sandbox not found" });

  const files = await entry.sandbox.files.list(path || "/home/user");

  return { files };
});
```

### 7. Sandbox Lifecycle Management

```typescript
// POST /sandboxes/:id/stop - Stop sandbox (keeps state)
app.post("/sandboxes/:id/stop", async (request, reply) => {
  const { id } = request.params as { id: string };

  const entry = activeSandboxes.get(id);
  if (entry) {
    await entry.sandbox.close();
    activeSandboxes.delete(id);
  }

  await db.update(sandboxes).set({ status: "stopped" }).where(eq(sandboxes.id, id));

  return { id, status: "stopped" };
});

// DELETE /sandboxes/:id - Delete sandbox permanently
app.delete("/sandboxes/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  const entry = activeSandboxes.get(id);
  if (entry) {
    try {
      await entry.sandbox.kill();
    } catch {}
    activeSandboxes.delete(id);
  }

  // Delete from DB (cascade deletes executions and files)
  await db.delete(sandboxes).where(eq(sandboxes.id, id));

  return { deleted: true };
});
```

### 8. GET /sandboxes/:id - Get Sandbox Info

```typescript
app.get("/sandboxes/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  const [record] = await db.select().from(sandboxes).where(eq(sandboxes.id, id)).limit(1);

  if (!record) return reply.status(404).send({ error: "Sandbox not found" });

  // Check if still active in memory
  const isActive = activeSandboxes.has(id);

  return {
    ...record,
    isActive,
    // Include recent executions
    recentExecutions: await db
      .select()
      .from(sandboxExecutions)
      .where(eq(sandboxExecutions.sandboxId, id))
      .orderBy(desc(sandboxExecutions.createdAt))
      .limit(10),
  };
});
```

---

## Integration with Agent Service

The agent service calls the sandbox service when the `execute_code` tool is invoked:

1. Agent receives tool_use block: `{ name: "execute_code", input: { code: "...", language: "python" } }`
2. Agent service calls `POST /sandboxes` to create a sandbox (or reuses existing one for the session)
3. Agent service calls `POST /sandboxes/:id/execute` with the code
4. Result (stdout/stderr/exitCode) is passed back to the LLM as a tool_result
5. Sandbox is kept alive for the duration of the agent session for iterative coding

The session-to-sandbox mapping should use the `agentSessionId` field in the `sandboxes` table.

## Frontend Integration

The frontend should display a terminal panel and preview pane for sandbox interactions:

- **Terminal panel:** Shows sandbox stdout/stderr in real-time. Subscribe to WebSocket events of type `sandbox:output`.
- **Preview pane:** For web applications, show the sandbox URL (`hostname` field) in an iframe. The E2B sandbox exposes ports that map to URLs.
- **File tree:** Show sandbox files using `GET /sandboxes/:id/files/list`.

---

## Environment Variables

| Variable                   | Default               | Description                       |
| -------------------------- | --------------------- | --------------------------------- |
| `PORT`                     | `4012`                | Sandbox service port              |
| `E2B_API_KEY`              | None                  | E2B API key (required)            |
| `DATABASE_URL`             | (from @repo/database) | PostgreSQL connection             |
| `SANDBOX_DEFAULT_TIMEOUT`  | `300000`              | Default sandbox timeout (5 min)   |
| `SANDBOX_MAX_TIMEOUT`      | `3600000`             | Max sandbox timeout (1 hour)      |
| `SANDBOX_CLEANUP_INTERVAL` | `300000`              | Inactive sandbox cleanup interval |
