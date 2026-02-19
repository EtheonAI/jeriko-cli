import crypto from "node:crypto";
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

// ---------------------------------------------------------------------------
// Stateful terminal sessions — Manus pattern (in-sandbox terminal server)
//
// Architecture (matching Manus exactly):
//   LLM → Orchestrator → Sandbox Service → Terminal Server (port 8330) → PTY → bash
//
// The terminal server runs INSIDE the E2B sandbox as a Node.js HTTP server.
// It manages persistent bash sessions via the sentinel pattern.
// We communicate with it via HTTP instead of using E2B SDK's commands.run(),
// which has layered timeout issues (requestTimeoutMs + timeoutMs).
// ---------------------------------------------------------------------------

/** Maps sandbox ID → { url, terminalId } for session reuse */
const terminalSessionMap = new Map<string, { url: string; terminalId: string }>();

/**
 * Get the terminal server base URL for a sandbox.
 * Uses E2B's getHost() to get the proxied URL.
 */
function getTerminalServerUrl(e2bSandbox: E2BSandbox): string {
  const host = e2bSandbox.getHost(8330);
  return `https://${host}`;
}

/**
 * Ensure a terminal session exists for a sandbox.
 * Creates one on first call, reuses on subsequent calls.
 * Retries if the terminal server isn't ready yet.
 */
async function ensureTerminal(
  sandboxId: string,
  e2bSandbox: E2BSandbox,
  logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void },
): Promise<{ url: string; terminalId: string }> {
  const existing = terminalSessionMap.get(sandboxId);
  if (existing) {
    // Verify terminal is still alive
    try {
      const resp = await fetch(`${existing.url}/terminals/${existing.terminalId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) {
        const info = await resp.json() as { alive?: boolean };
        if (info.alive) return existing;
      }
    } catch {
      // Terminal dead or unreachable — recreate below
    }
    terminalSessionMap.delete(sandboxId);
  }

  const url = getTerminalServerUrl(e2bSandbox);

  // Wait for terminal server to be ready (retry up to 30 times, ~15s)
  // E2B sandboxes take ~10s to fully boot, so we need generous timeout
  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const resp = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      if (resp.ok) {
        serverReady = true;
        break;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!serverReady) {
    throw new AppError(
      "Terminal server not ready inside sandbox after 15s",
      503,
      "TERMINAL_SERVER_UNAVAILABLE",
    );
  }

  // Create a new terminal session
  const createResp = await fetch(`${url}/terminals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cwd: "/home/user" }),
    signal: AbortSignal.timeout(10000),
  });

  if (!createResp.ok) {
    const err = await createResp.text().catch(() => "Unknown error");
    throw new AppError(
      `Failed to create terminal: ${err}`,
      502,
      "TERMINAL_CREATE_FAILED",
    );
  }

  const { id: terminalId } = (await createResp.json()) as { id: string };

  const session = { url, terminalId };
  terminalSessionMap.set(sandboxId, session);
  logger.info({ sandboxId, terminalId }, "Terminal session created via terminal server");
  return session;
}

/**
 * Execute a command via the in-sandbox terminal server.
 * Manus pattern: HTTP call to stateful PTY, not E2B SDK commands.
 */
async function execViaTerminalServer(
  sandboxId: string,
  e2bSandbox: E2BSandbox,
  command: string,
  timeoutMs: number,
  logger: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { url, terminalId } = await ensureTerminal(sandboxId, e2bSandbox, logger);

  const resp = await fetch(`${url}/terminals/${terminalId}/exec`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, timeout: timeoutMs }),
    // HTTP timeout slightly longer than command timeout to avoid double-timeout
    signal: AbortSignal.timeout(timeoutMs + 10000),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText })) as { error?: string };
    const errMsg = (body as { error?: string }).error || `Terminal server error: ${resp.status}`;

    // If terminal died, clear cache so next call creates a new one
    if (resp.status === 404 || resp.status === 410) {
      terminalSessionMap.delete(sandboxId);
    }

    if (resp.status === 408) {
      throw new Error(`Command timed out after ${timeoutMs}ms`);
    }
    throw new Error(errMsg);
  }

  const result = (await resp.json()) as { stdout?: string; stderr?: string; exitCode?: number };
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    exitCode: result.exitCode ?? 0,
  };
}

const E2B_API_KEY = getEnv("E2B_API_KEY", "");

// TURN relay credentials — required for WebRTC through E2B proxy
// Cloudflare TURN (recommended): https://developers.cloudflare.com/realtime/turn/
const CLOUDFLARE_TURN_KEY_ID = getEnv("CLOUDFLARE_TURN_KEY_ID", "");
const CLOUDFLARE_TURN_TOKEN = getEnv("CLOUDFLARE_TURN_TOKEN", "");

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
    cors: true,
    publicRoutes: ["/internal/"],
    onShutdown: [
      async () => {
        logger.info({ activeSandboxes: sandboxMap.size }, "Killing active E2B sandboxes");
        // Clear terminal session cache
        terminalSessionMap.clear();
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
      // (Ubuntu + XFCE + Neko WebRTC on port 8333 + Python sandbox runtime on 8330)
      const templateId = template || getEnv("E2B_TEMPLATE", "desktop");

      // Build env vars for the sandbox
      // These are available to all commands.run() calls (NOT to start_command.sh at boot)
      // The caller (orchestrator) passes OPENAI_API_KEY (proxy token) + OPENAI_BASE_URL
      // via config.env — we just spread them in.
      const sandboxEnvs: Record<string, string> = { ...(config?.env || {}) };

      // Create E2B sandbox with Desktop template
      // Resource allocation: Manus uses 6 vCPUs / 4GB RAM.
      // CPU + RAM are set at template build time: e2b template build --cpu-count 4 --memory-mb 4096
      let e2bSandbox: E2BSandbox;
      try {
        // E2B SDK: create(template, opts) or create(opts)
        if (templateId && templateId !== "default") {
          e2bSandbox = await E2BSandbox.create(templateId, {
            apiKey: E2B_API_KEY,
            timeoutMs,
            envs: sandboxEnvs,
          });
        } else {
          e2bSandbox = await E2BSandbox.create({
            apiKey: E2B_API_KEY,
            timeoutMs,
            envs: sandboxEnvs,
          });
        }
      } catch (error) {
        logger.error(error, "Failed to create E2B sandbox");
        const message = error instanceof Error ? error.message : "Failed to create sandbox";
        throw new BadGatewayError(message);
      }

      const dbId = createId();

      // Determine stream URLs based on template type
      // Template can be "desktop" or "rubic-desktop" (E2B template name)
      const isNekoTemplate = templateId === "desktop" || templateId === "rubic-desktop";

      // Neko WebRTC URL — Desktop template exposes Neko signaling on port 8333.
      // CDN mode (Manus pattern): client hosted on S3/CDN, ?server= points to sandbox.
      // Fallback: serve client from sandbox itself if NEKO_CLIENT_URL not set.
      const nekoHost = isNekoTemplate ? e2bSandbox.getHost(8333) : null;
      const nekoClientBase = process.env.NEKO_CLIENT_URL; // e.g. https://cdn.rubic.ai/neko-client
      const nekoUrl = nekoHost
        ? nekoClientBase
          ? `${nekoClientBase}/autoconnect.html?server=${encodeURIComponent(`https://${nekoHost}`)}`
          : `https://${nekoHost}/autoconnect.html`
        : null;

      // Legacy noVNC URL — for non-Neko templates that use port 6080
      const vncUrl = !isNekoTemplate ? `https://${e2bSandbox.getHost(6080)}` : null;

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

      // ─── Post-creation TURN setup for Neko desktop template ─────────────
      // E2B's `envs` parameter only injects vars for `exec` commands, NOT
      // for the boot `start_command.sh`. The start-neko-with-turn.sh reads
      // ICE servers from /opt/.rubic/neko/config/ice_servers.json on startup.
      // If we write the file before Neko starts, it picks up TURN automatically.
      // If Neko already started with STUN-only, a restart may be needed.
      if (isNekoTemplate && CLOUDFLARE_TURN_KEY_ID && CLOUDFLARE_TURN_TOKEN) {
        // Fetch Cloudflare TURN credentials from our service (not from inside sandbox)
        fetch(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${CLOUDFLARE_TURN_KEY_ID}/credentials/generate-ice-servers`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${CLOUDFLARE_TURN_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ttl: 86400 }),
          }
        )
          .then((res) => res.json())
          .then((turnData) => {
            // Write TURN credentials to the path that start-neko-with-turn.sh reads
            // (ice_servers.json at the Neko config directory — Neko reads on startup)
            return e2bSandbox.files.write(
              "/opt/.rubic/neko/config/ice_servers.json",
              JSON.stringify(turnData.iceServers ?? turnData)
            );
          })
          .then(() => {
            logger.info(
              { sandboxId: dbId },
              "TURN credentials written to sandbox — Neko will auto-restart with TURN"
            );
          })
          .catch((err) => {
            logger.warn({ sandboxId: dbId, error: err }, "Failed to fetch/write TURN credentials");
          });
      }

      // ─── Post-creation env setup (Manus Layer 2 + Layer 3) ─────────────
      // The template bakes ~/.env (Layer 1: static config) and .bashrc/.zshrc
      // that source both ~/.env and ~/.user_env. We write session-specific
      // secrets to ~/.user_env (Layer 2) and ~/.secrets/sandbox_api_token (Layer 3).
      // The .user_env watcher in start_command.sh re-sources it for the session.
      const proxyToken = sandboxEnvs.OPENAI_API_KEY;
      const proxyUrl = sandboxEnvs.OPENAI_BASE_URL;
      const uploadUrl = sandboxEnvs.RUBIC_UPLOAD_URL;
      const codeServerPassword = sandboxEnvs.CODE_SERVER_PASSWORD;
      const codeServerPort = sandboxEnvs.CODE_SERVER_PORT;
      const codeServerDomain = sandboxEnvs.CODE_SERVER_DOMAIN;
      const forgeApiKey = sandboxEnvs.BUILT_IN_FORGE_API_KEY;
      const forgeApiUrl = sandboxEnvs.BUILT_IN_FORGE_API_URL;
      const forgeFrontendKey = sandboxEnvs.VITE_FRONTEND_FORGE_API_KEY;
      const forgeFrontendUrl = sandboxEnvs.VITE_FRONTEND_FORGE_API_URL;
      if (isNekoTemplate && proxyToken) {
        const userEnvLines = [
          "# Rubic Session Environment — Layer 2 (injected at session start)",
          `export OPENAI_API_KEY="${proxyToken}"`,
          ...(proxyUrl ? [`export OPENAI_BASE_URL="${proxyUrl}"`, `export OPENAI_API_BASE="${proxyUrl}"`] : []),
          ...(uploadUrl ? [`export RUBIC_UPLOAD_URL="${uploadUrl}"`] : []),
          // Code-server (Manus pattern: password per session)
          ...(codeServerPassword ? [`export CODE_SERVER_PASSWORD="${codeServerPassword}"`] : []),
          ...(codeServerPort ? [`export CODE_SERVER_PORT="${codeServerPort}"`] : []),
          ...(codeServerDomain ? [`export CODE_SERVER_DOMAIN="${codeServerDomain}"`] : []),
          // Forge API for webdev projects
          ...(forgeApiKey ? [`export BUILT_IN_FORGE_API_KEY="${forgeApiKey}"`] : []),
          ...(forgeApiUrl ? [`export BUILT_IN_FORGE_API_URL="${forgeApiUrl}"`] : []),
          ...(forgeFrontendKey ? [`export VITE_FRONTEND_FORGE_API_KEY="${forgeFrontendKey}"`] : []),
          ...(forgeFrontendUrl ? [`export VITE_FRONTEND_FORGE_API_URL="${forgeFrontendUrl}"`] : []),
        ];
        Promise.all([
          // Layer 2: Write session secrets to ~/.user_env (sourced by .bashrc/.zshrc)
          e2bSandbox.files.write("/home/user/.user_env", userEnvLines.join("\n") + "\n"),
          // Layer 3: Write sandbox_api_token to ~/.secrets/ (pre-created by template)
          e2bSandbox.files.write("/home/user/.secrets/sandbox_api_token", proxyToken),
        ])
          .then(() => {
            logger.info({ sandboxId: dbId }, "Sandbox env files written (.user_env + sandbox_api_token)");
          })
          .catch((err) => {
            logger.warn({ sandboxId: dbId, error: err }, "Failed to write sandbox env files");
          });
      }

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
        ...(nekoUrl ? { nekoUrl } : {}),
        ...(vncUrl ? { vncUrl } : {}),
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
        // Manus pattern: HTTP call to in-sandbox terminal server (port 8330)
        // This avoids the E2B SDK's layered timeout issue (requestTimeoutMs + timeoutMs)
        const result = await execViaTerminalServer(id, e2bSandbox, command, timeoutMs, logger);

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

        // E2B SDK throws TimeoutError when command exceeds timeoutMs
        const isTimeout =
          error instanceof Error &&
          (error.name === "TimeoutError" || errorMsg.includes("deadline_exceeded") || errorMsg.includes("timed out"));

        await db
          .update(sandboxExecutions)
          .set({
            status: isTimeout ? "timeout" : "failed",
            error: errorMsg,
            completedAt,
            executionTimeMs,
          })
          .where(eq(sandboxExecutions.id, execId));

        if (isTimeout) {
          logger.warn({ sandboxId: id, executionId: execId, executionTimeMs }, "Shell command timed out");
          throw new AppError(errorMsg, 408, "EXECUTION_TIMEOUT", true, {
            id: execId,
            status: "timeout",
            executionTimeMs,
          });
        }

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

      // Get E2B sandbox instance (for terminal server URL)
      const e2bSandbox = await getE2BSandbox(id);

      // Build curl command — write payload to temp file to avoid shell injection
      const payloadFile = `/tmp/bp_${Date.now()}.json`;
      const payloadJson = JSON.stringify(params || {});
      // Use terminal server for consistent execution (avoids E2B SDK timeout layering)
      const curlCmd = `cat > ${payloadFile} << 'PAYLOAD_EOF'\n${payloadJson}\nPAYLOAD_EOF\ncurl -sf -X POST http://localhost:9821/${action} -H 'Content-Type: application/json' -d @${payloadFile}; rm -f ${payloadFile}`;

      const result = await execViaTerminalServer(id, e2bSandbox, curlCmd, 45_000, logger);

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
        terminalSessionMap.delete(id);
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
        terminalSessionMap.delete(id);
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
      terminalSessionMap.delete(id);
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

  // Get browser stream URL — Neko WebRTC for desktop template, noVNC for legacy
  app.get(
    "/sandboxes/:id/browser/stream",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;
      await verifySandboxOwner(id, request.userId);

      // Look up template to determine streaming provider
      const [record] = await db
        .select({ templateId: sandboxes.templateId })
        .from(sandboxes)
        .where(eq(sandboxes.id, id))
        .limit(1);

      const e2bSandbox = await getE2BSandbox(id);
      const isNeko = record?.templateId === "desktop" || record?.templateId === "rubic-desktop";

      if (isNeko) {
        // Neko WebRTC — autoconnect.html calls REST API login then redirects to client
        const nekoHost = e2bSandbox.getHost(8333);
        const nekoUrl = `https://${nekoHost}/autoconnect.html`;
        logger.info({ sandboxId: id, provider: "neko" }, "Browser stream URL requested");
        return reply.success({ streamUrl: nekoUrl, nekoUrl, provider: "neko", sandboxId: id });
      }

      // Legacy noVNC — web client on port 6080
      const host = e2bSandbox.getHost(6080);
      const streamUrl = `https://${host}/vnc.html?autoconnect=true&resize=scale&reconnect=true&reconnect_delay=1000`;
      logger.info({ sandboxId: id, provider: "novnc" }, "Browser stream URL requested");
      return reply.success({ streamUrl, provider: "novnc", sandboxId: id });
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
  // E2B Lifecycle Webhook — receives events from E2B when sandboxes change state
  // Events: sandbox.lifecycle.created, killed, updated, paused, resumed
  // Docs: https://e2b.dev/docs/sandbox/lifecycle-events-webhooks
  // -------------------------------------------------------------------------
  const E2B_WEBHOOK_SECRET = getEnv("E2B_WEBHOOK_SIGNATURE_SECRET", "");

  app.post("/internal/e2b-webhook", async (request, reply) => {
    // Verify signature if secret is configured
    if (E2B_WEBHOOK_SECRET) {
      const signature = request.headers["e2b-signature"] as string | undefined;
      if (!signature) {
        logger.warn("E2B webhook: missing e2b-signature header");
        return reply.code(401).send({ error: "Missing signature" });
      }

      const rawBody = JSON.stringify(request.body);
      const expected = crypto
        .createHmac("sha256", E2B_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      if (signature !== expected) {
        logger.warn("E2B webhook: invalid signature");
        return reply.code(401).send({ error: "Invalid signature" });
      }
    }

    const event = request.body as {
      version?: string;
      id?: string;
      type?: string;
      sandboxId?: string;
      sandboxTemplateId?: string;
      sandboxTeamId?: string;
      timestamp?: string;
      eventData?: Record<string, unknown>;
    };

    const eventType = event.type || "unknown";
    const e2bSandboxId = event.sandboxId;

    logger.info(
      { eventType, e2bSandboxId, eventId: event.id, timestamp: event.timestamp },
      "E2B lifecycle webhook received"
    );

    // Find our sandbox record by e2bSandboxId
    if (e2bSandboxId) {
      try {
        const [record] = await db
          .select({ id: sandboxes.id, status: sandboxes.status })
          .from(sandboxes)
          .where(eq(sandboxes.e2bSandboxId, e2bSandboxId))
          .limit(1);

        if (record) {
          switch (eventType) {
            case "sandbox.lifecycle.killed": {
              // Sandbox was killed — mark as terminated, clean up in-memory state
              await db
                .update(sandboxes)
                .set({ status: "terminated" })
                .where(eq(sandboxes.id, record.id));
              sandboxMap.delete(record.id);
              terminalSessionMap.delete(record.id);
              logger.info({ sandboxId: record.id, e2bSandboxId }, "Sandbox marked terminated via webhook");
              break;
            }
            case "sandbox.lifecycle.paused": {
              await db
                .update(sandboxes)
                .set({ status: "stopped" })
                .where(eq(sandboxes.id, record.id));
              sandboxMap.delete(record.id);
              terminalSessionMap.delete(record.id);
              logger.info({ sandboxId: record.id, e2bSandboxId }, "Sandbox paused via webhook");
              break;
            }
            case "sandbox.lifecycle.resumed": {
              await db
                .update(sandboxes)
                .set({ status: "running", lastActivityAt: new Date() })
                .where(eq(sandboxes.id, record.id));
              logger.info({ sandboxId: record.id, e2bSandboxId }, "Sandbox resumed via webhook");
              break;
            }
            case "sandbox.lifecycle.created":
            case "sandbox.lifecycle.updated":
            default:
              // Log only — creation is already handled by our POST /sandboxes route
              logger.debug({ sandboxId: record.id, eventType }, "E2B webhook event (no action needed)");
              break;
          }
        } else {
          logger.debug({ e2bSandboxId, eventType }, "E2B webhook for unknown sandbox (not in our DB)");
        }
      } catch (err) {
        logger.error({ e2bSandboxId, eventType, error: err }, "Failed to process E2B webhook");
      }
    }

    return reply.code(200).send({ received: true });
  });

  // -------------------------------------------------------------------------
  // Start
  // -------------------------------------------------------------------------
  await start();
}

main();
