import { Sandbox as E2BSandbox } from "@e2b/code-interpreter";
import { createService, typedRoute, getEnv, createId } from "@repo/service-utils";
import {
  NotFoundError,
  AppError,
  AuthorizationError,
  BadGatewayError,
  ServiceUnavailableError,
} from "@repo/service-utils/errors";
import { z } from "zod";
import { initDb, db, sandboxes, sandboxExecutions, sandboxFiles, eq, and, desc } from "./lib/db.js";

// ---------------------------------------------------------------------------
// In-memory map of active E2B sandbox instances keyed by our DB sandbox ID
// ---------------------------------------------------------------------------
const sandboxMap = new Map<string, E2BSandbox>();

const E2B_API_KEY = getEnv("E2B_API_KEY", "");

// Execution boundaries and resource limits
const MAX_EXECUTION_TIME_MS = parseInt(getEnv("MAX_EXECUTION_TIME_MS", "300000"), 10); // 5 min default
const MAX_CODE_SIZE_BYTES = parseInt(getEnv("MAX_CODE_SIZE_BYTES", "1048576"), 10); // 1 MB default
const MAX_FILE_SIZE_BYTES = parseInt(getEnv("MAX_FILE_SIZE_BYTES", "10485760"), 10); // 10 MB default
const MAX_CONCURRENT_EXECUTIONS_PER_SANDBOX = parseInt(
  getEnv("MAX_CONCURRENT_EXECUTIONS_PER_SANDBOX", "3"),
  10
);

// Track concurrent executions per sandbox
const sandboxExecutionCounts = new Map<string, number>();

/**
 * Check and increment execution count for a sandbox
 * Throws error if limit exceeded
 */
function checkExecutionLimit(sandboxId: string): void {
  const currentCount = sandboxExecutionCounts.get(sandboxId) || 0;
  if (currentCount >= MAX_CONCURRENT_EXECUTIONS_PER_SANDBOX) {
    throw new AppError(
      `Sandbox has ${currentCount} concurrent executions (limit: ${MAX_CONCURRENT_EXECUTIONS_PER_SANDBOX})`,
      429,
      "TOO_MANY_EXECUTIONS"
    );
  }
  sandboxExecutionCounts.set(sandboxId, currentCount + 1);
}

/**
 * Decrement execution count for a sandbox
 */
function releaseExecutionSlot(sandboxId: string): void {
  const currentCount = sandboxExecutionCounts.get(sandboxId) || 0;
  if (currentCount > 0) {
    sandboxExecutionCounts.set(sandboxId, currentCount - 1);
  }
}

/**
 * Get or reconnect to an E2B sandbox instance.
 * Looks up our in-memory map first, then attempts to reconnect using the stored e2bSandboxId.
 */
async function getE2BSandbox(dbSandboxId: string): Promise<E2BSandbox> {
  const cached = sandboxMap.get(dbSandboxId);
  if (cached) {
    return cached;
  }

  // Look up the e2bSandboxId from the DB
  const [record] = await db
    .select({ e2bSandboxId: sandboxes.e2bSandboxId, status: sandboxes.status })
    .from(sandboxes)
    .where(eq(sandboxes.id, dbSandboxId))
    .limit(1);

  if (!record) {
    throw new AppError(`Sandbox ${dbSandboxId} not found in database`, 410, "SANDBOX_GONE");
  }

  if (!record.e2bSandboxId) {
    throw new AppError(`Sandbox ${dbSandboxId} has no E2B sandbox ID`, 410, "SANDBOX_GONE");
  }

  if (record.status === "stopped" || record.status === "terminated") {
    throw new AppError(`Sandbox ${dbSandboxId} is ${record.status}`, 410, "SANDBOX_GONE");
  }

  // Reconnect to the E2B sandbox
  const e2bSandbox = await E2BSandbox.connect(record.e2bSandboxId, {
    apiKey: E2B_API_KEY,
  });

  sandboxMap.set(dbSandboxId, e2bSandbox);
  return e2bSandbox;
}

/** Verify the requesting user owns this sandbox */
async function verifySandboxOwner(sandboxId: string, userId: string): Promise<void> {
  const [record] = await db
    .select({ userId: sandboxes.userId })
    .from(sandboxes)
    .where(eq(sandboxes.id, sandboxId))
    .limit(1);

  if (!record) {
    throw new NotFoundError("Sandbox");
  }

  if (record.userId !== userId) {
    throw new AuthorizationError("Not authorized to access this sandbox");
  }
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------
const IdParams = z.object({ id: z.string().min(1) });
const UserIdParams = z.object({ userId: z.string().min(1) });

const CreateSandboxBody = z.object({
  projectId: z.string().optional(),
  template: z.string().optional(),
  config: z
    .object({
      timeout: z.number().positive().optional(),
      memory: z.number().positive().optional(),
      env: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

const ExecuteCodeBody = z.object({
  code: z.string().min(1),
  language: z.string().optional(),
  timeout: z.number().positive().optional(),
});

const ShellCommandBody = z.object({
  command: z.string().min(1),
  timeout: z.number().positive().optional(),
});

const BrowserActionBody = z.object({
  action: z.string().min(1),
  params: z.record(z.string(), z.unknown()).optional(),
});

const UpdateResourcesBody = z.object({
  cpuUsage: z.number().min(0).max(100).optional(),
  memoryUsage: z.number().min(0).optional(),
});

const WriteFileBody = z.object({
  path: z.string().min(1),
  content: z.string(),
});

const ReadFileQuery = z.object({
  path: z.string().min(1),
});

const ListFilesQuery = z.object({
  path: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Browser action allowlist
// ---------------------------------------------------------------------------
const ALLOWED_BROWSER_ACTIONS = new Set([
  "navigate",
  "view",
  "click",
  "input",
  "scroll",
  "scroll_up",
  "scroll_down",
  "key_press",
  "press_key",
  "move_mouse",
  "select_option",
  "console_exec",
  "console_view",
  "screenshot",
  "take_screenshot",
  "restart",
  "health",
]);

// ---------------------------------------------------------------------------
// Service bootstrap
// ---------------------------------------------------------------------------
async function main() {
  // Initialize database (dynamic import to work around ESM + pnpm resolution)
  await initDb();

  if (!E2B_API_KEY) {
    console.warn("E2B_API_KEY not set — sandbox creation will fail");
  }

  const { app, logger, start } = await createService({
    name: "sandbox",
    port: parseInt(getEnv("PORT", "4012"), 10),
    onShutdown: [
      async () => {
        logger.info({ activeSandboxes: sandboxMap.size }, "Killing active E2B sandboxes");
        const killPromises = Array.from(sandboxMap.entries()).map(async ([dbId, e2bSandbox]) => {
          try {
            await e2bSandbox.kill();
            logger.info({ sandboxId: dbId }, "Killed E2B sandbox on shutdown");
          } catch (err) {
            logger.warn({ sandboxId: dbId, error: err }, "Failed to kill E2B sandbox on shutdown");
          }
        });
        await Promise.allSettled(killPromises);
        sandboxMap.clear();
      },
    ],
  });

  // -------------------------------------------------------------------------
  // Routes
  // -------------------------------------------------------------------------

  // Create sandbox
  app.post(
    "/sandboxes",
    typedRoute({ body: CreateSandboxBody }, async (request, reply) => {
      const { projectId, template, config } = request.body;
      const userId = request.userId;

      if (!E2B_API_KEY) {
        throw new ServiceUnavailableError("E2B_API_KEY not configured");
      }

      const timeoutMs = config?.timeout || 300_000; // 5 minutes default

      // Use Desktop template by default for full virtual computer experience
      // (Ubuntu + XFCE + x11vnc + noVNC on port 6080 + Playwright)
      const templateId = template || getEnv("E2B_TEMPLATE", "rubic-desktop");

      // Create E2B sandbox with Desktop template
      let e2bSandbox: E2BSandbox;
      try {
        // E2B SDK: create(template, opts) or create(opts)
        if (templateId && templateId !== "default") {
          e2bSandbox = await E2BSandbox.create(templateId, {
            apiKey: E2B_API_KEY,
            timeoutMs,
            envs: config?.env,
          });
        } else {
          e2bSandbox = await E2BSandbox.create({
            apiKey: E2B_API_KEY,
            timeoutMs,
            envs: config?.env,
          });
        }
      } catch (error) {
        logger.error(error, "Failed to create E2B sandbox");
        const message = error instanceof Error ? error.message : "Failed to create sandbox";
        throw new BadGatewayError(message);
      }

      const dbId = createId();

      // noVNC URL — Desktop template exposes noVNC web client on port 6080
      // Format: https://6080-{e2b_sandbox_id}.e2b.app
      const vncHost = e2bSandbox.getHost(6080);
      const vncUrl = `https://${vncHost}`;

      // Store in DB
      const [sandbox] = await db
        .insert(sandboxes)
        .values({
          id: dbId,
          userId,
          projectId,
          name: `sandbox-${Date.now()}`,
          type: "code",
          status: "running",
          templateId,
          config: config || {},
          e2bSandboxId: e2bSandbox.sandboxId,
          hostname: e2bSandbox.getHost(80),
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + timeoutMs),
        })
        .returning();

      // Cache the instance
      sandboxMap.set(dbId, e2bSandbox);

      logger.info(
        { sandboxId: dbId, e2bSandboxId: e2bSandbox.sandboxId, userId, templateId },
        "Sandbox created"
      );

      return reply.success({
        id: sandbox!.id,
        status: "running",
        e2bSandboxId: e2bSandbox.sandboxId,
        hostname: e2bSandbox.getHost(80),
        template: templateId,
        vncUrl,
      });
    })
  );

  // Get sandbox
  app.get(
    "/sandboxes/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);

      const [sandbox] = await db.select().from(sandboxes).where(eq(sandboxes.id, id)).limit(1);

      if (!sandbox) {
        throw new NotFoundError("Sandbox");
      }

      return reply.success(sandbox);
    })
  );

  // Resume/reconnect to existing sandbox
  app.post(
    "/sandboxes/:id/resume",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);

      const [sandbox] = await db.select().from(sandboxes).where(eq(sandboxes.id, id)).limit(1);

      if (!sandbox) {
        throw new NotFoundError("Sandbox");
      }

      // Check if sandbox is in a resumable state
      if (sandbox.status === "terminated") {
        throw new AppError("Cannot resume terminated sandbox", 410, "SANDBOX_TERMINATED");
      }

      // Check if already cached
      const cached = sandboxMap.get(id);
      if (cached) {
        // Update last activity and return
        await db
          .update(sandboxes)
          .set({
            status: "running",
            lastActivityAt: new Date(),
          })
          .where(eq(sandboxes.id, id));

        logger.info({ sandboxId: id }, "Sandbox already active");
        return reply.success({
          id,
          status: "running",
          resumed: false,
          alreadyActive: true,
        });
      }

      // Try to reconnect to E2B sandbox
      if (!sandbox.e2bSandboxId) {
        throw new AppError("Sandbox has no E2B sandbox ID", 410, "SANDBOX_GONE");
      }

      try {
        const e2bSandbox = await E2BSandbox.connect(sandbox.e2bSandboxId, {
          apiKey: E2B_API_KEY,
        });

        sandboxMap.set(id, e2bSandbox);

        // Update status and activity
        await db
          .update(sandboxes)
          .set({
            status: "running",
            lastActivityAt: new Date(),
          })
          .where(eq(sandboxes.id, id));

        logger.info(
          { sandboxId: id, e2bSandboxId: sandbox.e2bSandboxId },
          "Sandbox resumed successfully"
        );

        return reply.success({
          id,
          status: "running",
          resumed: true,
          e2bSandboxId: sandbox.e2bSandboxId,
          hostname: sandbox.hostname,
        });
      } catch (error) {
        // E2B sandbox no longer exists
        const errorMsg = error instanceof Error ? error.message : "Failed to reconnect";

        await db.update(sandboxes).set({ status: "terminated" }).where(eq(sandboxes.id, id));

        logger.error({ sandboxId: id, error }, "Failed to resume sandbox - marking as terminated");

        throw new AppError(`Sandbox no longer available: ${errorMsg}`, 410, "SANDBOX_GONE");
      }
    })
  );

  // List user sandboxes
  app.get(
    "/users/:userId/sandboxes",
    typedRoute({ params: UserIdParams }, async (request, reply) => {
      const { userId } = request.params;
      if (request.userId !== userId) {
        throw new AuthorizationError("Not authorized to list another user's sandboxes");
      }

      const results = await db
        .select()
        .from(sandboxes)
        .where(eq(sandboxes.userId, userId))
        .orderBy(desc(sandboxes.createdAt));

      return reply.success({ sandboxes: results });
    })
  );

  // Execute code in sandbox (synchronous — waits for result)
  app.post(
    "/sandboxes/:id/execute",
    typedRoute({ params: IdParams, body: ExecuteCodeBody }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);
      const { code, language, timeout } = request.body;

      // Enforce execution boundaries
      const codeSize = Buffer.byteLength(code, "utf-8");
      if (codeSize > MAX_CODE_SIZE_BYTES) {
        throw new AppError(
          `Code size ${codeSize} bytes exceeds limit of ${MAX_CODE_SIZE_BYTES} bytes`,
          413,
          "CODE_TOO_LARGE"
        );
      }

      const timeoutMs = Math.min(timeout || 30_000, MAX_EXECUTION_TIME_MS);
      if (timeout && timeout > MAX_EXECUTION_TIME_MS) {
        logger.warn(
          { requestedTimeout: timeout, enforcedTimeout: timeoutMs },
          "Timeout clamped to maximum"
        );
      }

      // Check concurrent execution limit
      checkExecutionLimit(id);

      const execId = createId();
      const startedAt = new Date();

      // Insert execution record
      await db.insert(sandboxExecutions).values({
        id: execId,
        sandboxId: id,
        type: "code",
        language: language || "python",
        code,
        status: "running",
        timeoutMs,
        startedAt,
      });

      // Get E2B sandbox instance
      let e2bSandbox: E2BSandbox;
      try {
        e2bSandbox = await getE2BSandbox(id);
      } catch (err) {
        releaseExecutionSlot(id);
        const errorMsg = err instanceof Error ? err.message : "Sandbox unavailable";
        await db
          .update(sandboxExecutions)
          .set({ status: "failed", error: errorMsg, completedAt: new Date() })
          .where(eq(sandboxExecutions.id, execId));
        throw new AppError(errorMsg, 410, "SANDBOX_GONE");
      }

      try {
        // Run code in E2B
        const execution = await e2bSandbox.runCode(code, {
          language: language || "python",
          timeoutMs,
        });

        const completedAt = new Date();
        const executionTimeMs = completedAt.getTime() - startedAt.getTime();
        const stdout = execution.logs.stdout.join("\n");
        const stderr = execution.logs.stderr.join("\n");
        const hasError = !!execution.error;
        const status = hasError ? "failed" : "completed";

        // Update execution record
        await db
          .update(sandboxExecutions)
          .set({
            status,
            stdout,
            stderr,
            exitCode: hasError ? 1 : 0,
            result: execution.toJSON(),
            error: execution.error ? `${execution.error.name}: ${execution.error.value}` : null,
            completedAt,
            executionTimeMs,
          })
          .where(eq(sandboxExecutions.id, execId));

        // Update sandbox last activity
        await db.update(sandboxes).set({ lastActivityAt: completedAt }).where(eq(sandboxes.id, id));

        logger.info(
          { sandboxId: id, executionId: execId, language, status, executionTimeMs },
          "Execution completed"
        );

        // Release execution slot
        releaseExecutionSlot(id);

        return reply.success({
          id: execId,
          status,
          stdout,
          stderr,
          exitCode: hasError ? 1 : 0,
          error: execution.error
            ? {
                name: execution.error.name,
                value: execution.error.value,
                traceback: execution.error.traceback,
              }
            : null,
          results: execution.results.map((r) => r.toJSON()),
          text: execution.text,
          executionTimeMs,
        });
      } catch (error) {
        // Release execution slot on error
        releaseExecutionSlot(id);

        const completedAt = new Date();
        const executionTimeMs = completedAt.getTime() - startedAt.getTime();
        const errorMsg = error instanceof Error ? error.message : "Execution failed";

        // Check if it's a timeout
        const isTimeout = error instanceof Error && error.message.toLowerCase().includes("timeout");

        await db
          .update(sandboxExecutions)
          .set({
            status: isTimeout ? "timeout" : "failed",
            error: errorMsg,
            completedAt,
            executionTimeMs,
          })
          .where(eq(sandboxExecutions.id, execId));

        logger.error(error, "Failed to execute code");

        if (isTimeout) {
          throw new AppError(errorMsg, 408, "EXECUTION_TIMEOUT", true, {
            id: execId,
            status: "timeout",
            executionTimeMs,
          });
        }

        throw new BadGatewayError(errorMsg);
      }
    })
  );

  // Get execution result
  app.get(
    "/executions/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      const [execution] = await db
        .select()
        .from(sandboxExecutions)
        .where(eq(sandboxExecutions.id, id))
        .limit(1);

      if (!execution) {
        throw new NotFoundError("Execution");
      }

      // Verify sandbox ownership
      const [sbx] = await db
        .select({ userId: sandboxes.userId })
        .from(sandboxes)
        .where(eq(sandboxes.id, execution.sandboxId))
        .limit(1);
      if (!sbx || sbx.userId !== request.userId) {
        throw new AuthorizationError("Not authorized to access this execution");
      }

      return reply.success({
        id: execution.id,
        status: execution.status,
        stdout: execution.stdout || "",
        stderr: execution.stderr || "",
        exitCode: execution.exitCode ?? 0,
        error: execution.error || null,
        result: execution.result || null,
        executionTimeMs: execution.executionTimeMs || null,
      });
    })
  );

  // Run shell command in sandbox (synchronous)
  app.post(
    "/sandboxes/:id/shell",
    typedRoute({ params: IdParams, body: ShellCommandBody }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);
      const { command, timeout } = request.body;

      // Enforce execution boundaries
      const commandSize = Buffer.byteLength(command, "utf-8");
      if (commandSize > MAX_CODE_SIZE_BYTES) {
        throw new AppError(
          `Command size ${commandSize} bytes exceeds limit of ${MAX_CODE_SIZE_BYTES} bytes`,
          413,
          "COMMAND_TOO_LARGE"
        );
      }

      const timeoutMs = Math.min(timeout || 30_000, MAX_EXECUTION_TIME_MS);

      // Check concurrent execution limit
      checkExecutionLimit(id);

      const execId = createId();
      const startedAt = new Date();

      await db.insert(sandboxExecutions).values({
        id: execId,
        sandboxId: id,
        type: "command",
        code: command,
        status: "running",
        timeoutMs,
        startedAt,
      });

      // Get E2B sandbox instance
      let e2bSandbox: E2BSandbox;
      try {
        e2bSandbox = await getE2BSandbox(id);
      } catch (err) {
        releaseExecutionSlot(id);
        const errorMsg = err instanceof Error ? err.message : "Sandbox unavailable";
        await db
          .update(sandboxExecutions)
          .set({ status: "failed", error: errorMsg, completedAt: new Date() })
          .where(eq(sandboxExecutions.id, execId));
        throw new AppError(errorMsg, 410, "SANDBOX_GONE");
      }

      try {
        // Run shell command
        const result = await e2bSandbox.commands.run(command, { timeoutMs });

        const completedAt = new Date();
        const executionTimeMs = completedAt.getTime() - startedAt.getTime();
        const status = result.exitCode === 0 ? "completed" : "failed";

        await db
          .update(sandboxExecutions)
          .set({
            status,
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: result.exitCode,
            completedAt,
            executionTimeMs,
          })
          .where(eq(sandboxExecutions.id, execId));

        await db.update(sandboxes).set({ lastActivityAt: completedAt }).where(eq(sandboxes.id, id));

        logger.info(
          { sandboxId: id, executionId: execId, exitCode: result.exitCode },
          "Shell command completed"
        );

        // Release execution slot
        releaseExecutionSlot(id);

        return reply.success({
          id: execId,
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          executionTimeMs,
        });
      } catch (error) {
        // Release execution slot on error
        releaseExecutionSlot(id);

        const completedAt = new Date();
        const executionTimeMs = completedAt.getTime() - startedAt.getTime();
        const errorMsg = error instanceof Error ? error.message : "Command failed";

        await db
          .update(sandboxExecutions)
          .set({
            status: "failed",
            error: errorMsg,
            completedAt,
            executionTimeMs,
          })
          .where(eq(sandboxExecutions.id, execId));

        logger.error(error, "Failed to run shell command");
        throw new BadGatewayError(errorMsg);
      }
    })
  );

  // Browser control — proxy actions to the Playwright controller (port 9821) inside the sandbox
  app.post(
    "/sandboxes/:id/browser",
    typedRoute({ params: IdParams, body: BrowserActionBody }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);
      const { action, params } = request.body;

      // Validate action against allowlist
      if (!ALLOWED_BROWSER_ACTIONS.has(action)) {
        throw new AppError(`Invalid browser action: ${action}`, 400, "INVALID_ACTION");
      }

      // Get E2B sandbox instance (throws AppError 410 if unavailable)
      const e2bSandbox = await getE2BSandbox(id);

      // Write payload to temp file to avoid shell injection
      const payloadFile = `/tmp/bp_${Date.now()}.json`;
      await e2bSandbox.files.write(payloadFile, JSON.stringify(params || {}));
      const curlCmd = `curl -s -X POST http://localhost:9821/${action} -H 'Content-Type: application/json' -d @${payloadFile}; rm -f ${payloadFile}`;

      const result = await e2bSandbox.commands.run(curlCmd, { timeoutMs: 45_000 });

      if (result.stdout.trim()) {
        try {
          const parsed = JSON.parse(result.stdout.trim());
          return reply.success(parsed);
        } catch {
          return reply.success({ output: result.stdout, raw: true });
        }
      }

      if (result.stderr) {
        throw new BadGatewayError(result.stderr);
      }

      throw new BadGatewayError("No response from browser controller");
    })
  );

  // Write file to sandbox
  app.post(
    "/sandboxes/:id/files",
    typedRoute({ params: IdParams, body: WriteFileBody }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);
      const { path, content } = request.body;

      // Validate file size
      const fileSize = Buffer.byteLength(content, "utf-8");
      if (fileSize > MAX_FILE_SIZE_BYTES) {
        throw new AppError(
          `File size ${fileSize} bytes exceeds limit of ${MAX_FILE_SIZE_BYTES} bytes`,
          413,
          "FILE_TOO_LARGE"
        );
      }

      // Validate path (prevent path traversal attempts)
      if (path.includes("..") || path.includes("~")) {
        throw new AppError("Invalid file path: path traversal not allowed", 400, "INVALID_PATH");
      }

      // Get E2B sandbox instance (throws AppError 410 if unavailable)
      const e2bSandbox = await getE2BSandbox(id);

      await e2bSandbox.files.write(path, content);

      // Track in DB (best effort — don't fail the write if DB insert fails)
      try {
        const fileName = path.split("/").pop() || path;
        await db.insert(sandboxFiles).values({
          id: createId(),
          sandboxId: id,
          path,
          name: fileName,
          content: content.length > 100_000 ? null : content, // Skip large content
          size: Buffer.byteLength(content, "utf-8"),
        });
      } catch (dbErr) {
        logger.warn({ sandboxId: id, path, error: dbErr }, "Failed to track file in DB");
      }

      logger.info({ sandboxId: id, path }, "File written");
      return reply.success({ path, written: true });
    })
  );

  // Read file from sandbox
  app.get(
    "/sandboxes/:id/files",
    typedRoute({ params: IdParams, query: ReadFileQuery }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);
      const { path } = request.query;

      try {
        // Read directly from E2B sandbox
        const e2bSandbox = await getE2BSandbox(id);
        const content = await e2bSandbox.files.read(path, { format: "text" });
        return reply.success({ path, content });
      } catch {
        // Fall back to DB if sandbox is unavailable
        const [file] = await db
          .select()
          .from(sandboxFiles)
          .where(and(eq(sandboxFiles.sandboxId, id), eq(sandboxFiles.path, path)))
          .limit(1);

        if (!file) {
          throw new NotFoundError("File");
        }
        return reply.success({ path: file.path, content: file.content || "" });
      }
    })
  );

  // List files in sandbox
  app.get(
    "/sandboxes/:id/files/list",
    typedRoute({ params: IdParams, query: ListFilesQuery }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);
      const { path } = request.query;

      try {
        const e2bSandbox = await getE2BSandbox(id);
        const dirPath = path || "/home/user";
        const entries = await e2bSandbox.files.list(dirPath);

        return reply.success({
          files: entries.map((entry) => ({
            name: entry.name,
            path: entry.path,
            type: entry.type,
            size: entry.size,
          })),
        });
      } catch {
        // Fall back to DB listing
        const conditions = [eq(sandboxFiles.sandboxId, id)];
        if (path) {
          conditions.push(eq(sandboxFiles.path, path));
        }
        const filesList = await db
          .select({
            path: sandboxFiles.path,
            name: sandboxFiles.name,
            isDirectory: sandboxFiles.isDirectory,
            size: sandboxFiles.size,
          })
          .from(sandboxFiles)
          .where(and(...conditions));

        return reply.success({ files: filesList });
      }
    })
  );

  // Update sandbox resource usage (for monitoring)
  app.patch(
    "/sandboxes/:id/resources",
    typedRoute({ params: IdParams, body: UpdateResourcesBody }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);
      const { cpuUsage, memoryUsage } = request.body;

      const updates: Partial<typeof sandboxes.$inferInsert> = {};
      if (cpuUsage !== undefined) updates.cpuUsage = cpuUsage;
      if (memoryUsage !== undefined) updates.memoryUsage = memoryUsage;

      const [updated] = await db
        .update(sandboxes)
        .set({ ...updates, lastActivityAt: new Date() })
        .where(eq(sandboxes.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundError("Sandbox");
      }

      logger.debug({ sandboxId: id, cpuUsage, memoryUsage }, "Resource usage updated");
      return reply.success({ updated: true, cpuUsage, memoryUsage });
    })
  );

  // Stop sandbox
  app.post(
    "/sandboxes/:id/stop",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);

      // Kill E2B sandbox if available
      const cached = sandboxMap.get(id);
      if (cached) {
        try {
          await cached.kill();
        } catch (err) {
          logger.warn(
            { sandboxId: id, error: err },
            "Failed to kill E2B sandbox (may already be stopped)"
          );
        }
        sandboxMap.delete(id);
      } else {
        // Try to kill via stored e2bSandboxId
        const [record] = await db
          .select({ e2bSandboxId: sandboxes.e2bSandboxId })
          .from(sandboxes)
          .where(eq(sandboxes.id, id))
          .limit(1);

        if (record?.e2bSandboxId) {
          try {
            const e2b = await E2BSandbox.connect(record.e2bSandboxId, {
              apiKey: E2B_API_KEY,
            });
            await e2b.kill();
          } catch (err) {
            logger.warn({ sandboxId: id, error: err }, "Failed to kill E2B sandbox on stop");
          }
        }
      }

      const [updated] = await db
        .update(sandboxes)
        .set({ status: "stopped" })
        .where(eq(sandboxes.id, id))
        .returning();

      if (!updated) {
        throw new NotFoundError("Sandbox");
      }

      logger.info({ sandboxId: id }, "Sandbox stopped");
      return reply.success({ id, status: "stopped" });
    })
  );

  // Delete sandbox
  app.delete(
    "/sandboxes/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);

      // Kill E2B sandbox if available
      const cached = sandboxMap.get(id);
      if (cached) {
        try {
          await cached.kill();
        } catch (err) {
          logger.warn({ sandboxId: id, error: err }, "Failed to kill E2B sandbox on delete");
        }
        sandboxMap.delete(id);
      } else {
        const [record] = await db
          .select({ e2bSandboxId: sandboxes.e2bSandboxId })
          .from(sandboxes)
          .where(eq(sandboxes.id, id))
          .limit(1);

        if (record?.e2bSandboxId) {
          try {
            const e2b = await E2BSandbox.connect(record.e2bSandboxId, {
              apiKey: E2B_API_KEY,
            });
            await e2b.kill();
          } catch (err) {
            logger.warn({ sandboxId: id, error: err }, "Failed to kill E2B sandbox on delete");
          }
        }
      }

      const [deleted] = await db.delete(sandboxes).where(eq(sandboxes.id, id)).returning();

      if (!deleted) {
        throw new NotFoundError("Sandbox");
      }

      return reply.success({ deleted: true });
    })
  );

  // -------------------------------------------------------------------------
  // Stream URLs — Return WebSocket URLs for live browser (noVNC) and terminal (PTY)
  // -------------------------------------------------------------------------

  // Get noVNC URL for live browser streaming (Desktop template)
  app.get(
    "/sandboxes/:id/browser/stream",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);

      const e2bSandbox = await getE2BSandbox(id);
      // E2B Desktop sandboxes expose noVNC web client on port 6080
      // The HTTPS URL serves the noVNC HTML page which connects to VNC via WebSocket internally
      // We return the full URL with autoconnect params so it can be embedded in an iframe
      const host = e2bSandbox.getHost(6080);
      const streamUrl = `https://${host}/vnc.html?autoconnect=true&resize=scale&reconnect=true&reconnect_delay=1000`;

      logger.info({ sandboxId: id }, "Browser stream URL requested");
      return reply.success({ streamUrl, sandboxId: id });
    })
  );

  // Get PTY WebSocket URL for live terminal streaming
  app.get(
    "/sandboxes/:id/terminal/stream",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);

      const e2bSandbox = await getE2BSandbox(id);
      // E2B sandboxes expose terminal on port 3000 (PTY via WebSocket)
      const streamUrl = `wss://${e2bSandbox.getHost(3000)}/pty`;

      logger.info({ sandboxId: id }, "Terminal stream URL requested");
      return reply.success({ streamUrl, sandboxId: id });
    })
  );

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------
  await start();
}

main();
