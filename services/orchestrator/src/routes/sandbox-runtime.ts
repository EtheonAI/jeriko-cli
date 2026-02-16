import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";
import {
  sandboxExec,
  sandboxWriteFile,
  sandboxReadFile,
  terminalServerPost,
  terminalServerGet,
} from "../lib/sandbox-helpers.js";

const logger = createLogger({ service: "sandbox-runtime" });

// ---------------------------------------------------------------------------
// TURN credential helpers
// ---------------------------------------------------------------------------

interface TurnCredentials {
  urls: string[];
  username: string;
  credential: string;
  ttl: number;
}

async function getTurnCredentials(): Promise<TurnCredentials> {
  // Priority 1: Static TURN config from env
  const turnUrls = process.env.TURN_URLS;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrls && turnUsername && turnCredential) {
    return {
      urls: turnUrls.split(",").map((u) => u.trim()),
      username: turnUsername,
      credential: turnCredential,
      ttl: 86400,
    };
  }

  // Priority 2: Cloudflare TURN API
  const cfTurnKeyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const cfTurnApiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  if (cfTurnKeyId && cfTurnApiToken) {
    const resp = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${cfTurnKeyId}/credentials/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfTurnApiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ttl: 86400 }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (resp.ok) {
      const data = (await resp.json()) as {
        iceServers?: {
          urls?: string[];
          username?: string;
          credential?: string;
        };
      };
      const ice = data.iceServers;
      if (ice?.urls && ice.username && ice.credential) {
        return {
          urls: ice.urls,
          username: ice.username,
          credential: ice.credential,
          ttl: 86400,
        };
      }
    }
    logger.warn("Cloudflare TURN credential generation failed, using fallback");
  }

  // Priority 3: Fallback — no TURN (STUN only)
  return {
    urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"],
    username: "",
    credential: "",
    ttl: 0,
  };
}

// Note: Browser actions now proxy through the terminal server's /browser/action
// endpoint (Manus pattern), not Playwright script generation.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function sandboxRuntimeRoutes(app: FastifyInstance): Promise<void> {
  // =========================================================================
  // POST /api/sandbox/init — Initialize sandbox, verify tools
  // =========================================================================
  app.post("/api/sandbox/init", async (request, reply) => {
    const { sandboxId, userId } = request.body as {
      sandboxId: string;
      userId: string;
    };

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId are required" });
    }

    try {
      logger.info({ sandboxId }, "Initializing sandbox");

      // Source environment files
      await sandboxExec(
        sandboxId,
        "[ -f /home/ubuntu/.env ] && source /home/ubuntu/.env; [ -f /home/ubuntu/.user_env ] && source /home/ubuntu/.user_env; echo 'env sourced'",
        userId,
        10000
      );

      // Verify available tools in parallel
      const [nodeResult, pythonResult, pnpmResult] = await Promise.allSettled([
        sandboxExec(sandboxId, "node --version 2>/dev/null || echo 'not found'", userId, 10000),
        sandboxExec(sandboxId, "python3 --version 2>/dev/null || echo 'not found'", userId, 10000),
        sandboxExec(sandboxId, "pnpm --version 2>/dev/null || echo 'not found'", userId, 10000),
      ]);

      const nodeVersion =
        nodeResult.status === "fulfilled" ? nodeResult.value.stdout.trim() : "unavailable";
      const pythonVersion =
        pythonResult.status === "fulfilled" ? pythonResult.value.stdout.trim() : "unavailable";
      const pnpmVersion =
        pnpmResult.status === "fulfilled" ? pnpmResult.value.stdout.trim() : "unavailable";

      // Ensure required directories exist
      await sandboxExec(
        sandboxId,
        "mkdir -p /home/ubuntu/{screenshots,Downloads,.browser_data_dir,.search_cache,upload,skills,terminal_full_output}",
        userId,
        10000
      );

      logger.info({ sandboxId, nodeVersion, pythonVersion, pnpmVersion }, "Sandbox initialized");

      return reply.send({
        ok: true,
        sandboxId,
        versions: {
          node: nodeVersion,
          python: pythonVersion,
          pnpm: pnpmVersion,
        },
        directories: [
          "/home/ubuntu/screenshots",
          "/home/ubuntu/Downloads",
          "/home/ubuntu/.browser_data_dir",
          "/home/ubuntu/.search_cache",
          "/home/ubuntu/upload",
          "/home/ubuntu/skills",
          "/home/ubuntu/terminal_full_output",
        ],
      });
    } catch (err) {
      logger.error({ sandboxId, err }, "Sandbox init failed");
      return reply.status(500).send({
        error: "Sandbox initialization failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // GET /api/sandbox/version — Server version info
  // =========================================================================
  app.get("/api/sandbox/version", async (_request, reply) => {
    return reply.send({
      version: "1.0.0",
      server: "rubic-sandbox",
      runtime: "e2b-desktop",
      features: ["neko-webrtc", "terminal-server", "code-server", "playwright", "webdev-templates"],
    });
  });

  // =========================================================================
  // POST /api/sandbox/refresh-turn — Refresh TURN credentials for WebRTC
  // =========================================================================
  app.post("/api/sandbox/refresh-turn", async (request, reply) => {
    const { sandboxId } = request.body as {
      sandboxId?: string;
      userId?: string;
    };

    try {
      const credentials = await getTurnCredentials();

      logger.info({ sandboxId, urlCount: credentials.urls.length }, "TURN credentials refreshed");

      return reply.send({
        ok: true,
        iceServers: [
          {
            urls: credentials.urls,
            username: credentials.username,
            credential: credentials.credential,
          },
        ],
        ttl: credentials.ttl,
      });
    } catch (err) {
      logger.error({ sandboxId, err }, "TURN credential refresh failed");
      return reply.status(500).send({
        error: "Failed to refresh TURN credentials",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // POST /api/sandbox/set-env — Set env vars in sandbox (Layer 2)
  // =========================================================================
  app.post("/api/sandbox/set-env", async (request, reply) => {
    const { sandboxId, userId, env } = request.body as {
      sandboxId: string;
      userId: string;
      env: Record<string, string>;
    };

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId are required" });
    }

    if (!env || typeof env !== "object" || Object.keys(env).length === 0) {
      return reply.status(400).send({ error: "env must be a non-empty object" });
    }

    try {
      // Build the env file content — append to existing .user_env
      const lines = Object.entries(env)
        .map(([key, value]) => {
          // Sanitize: strip newlines from values, escape single quotes
          const safeValue = String(value).replace(/\n/g, "\\n").replace(/'/g, "'\\''");
          return `export ${key}='${safeValue}'`;
        })
        .join("\n");

      // Read existing .user_env, filter out duplicate keys, append new ones
      let existing = "";
      try {
        existing = await sandboxReadFile(sandboxId, "/home/ubuntu/.user_env", userId);
      } catch {
        // File may not exist yet
      }

      const newKeys = new Set(Object.keys(env));
      const filteredLines = existing
        .split("\n")
        .filter((line) => {
          const match = line.match(/^export\s+(\w+)=/);
          return !match || !match[1] || !newKeys.has(match[1]);
        })
        .filter((line) => line.trim() !== "");

      const finalContent = [...filteredLines, lines].join("\n") + "\n";

      await sandboxWriteFile(sandboxId, "/home/ubuntu/.user_env", finalContent, userId);

      // Source the updated env in the current shell session
      await sandboxExec(sandboxId, "source /home/ubuntu/.user_env", userId, 5000);

      logger.info({ sandboxId, keys: Object.keys(env) }, "Environment variables set");

      return reply.send({
        ok: true,
        keys: Object.keys(env),
        path: "/home/ubuntu/.user_env",
      });
    } catch (err) {
      logger.error({ sandboxId, err }, "Failed to set env vars");
      return reply.status(500).send({
        error: "Failed to set environment variables",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // GET /api/sandbox/github-auth-status — Check GitHub CLI auth in sandbox
  // =========================================================================
  app.get("/api/sandbox/github-auth-status", async (request, reply) => {
    const { sandboxId, userId } = request.query as {
      sandboxId: string;
      userId: string;
    };

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId query params are required" });
    }

    try {
      const result = await sandboxExec(sandboxId, "gh auth status 2>&1", userId, 15000);

      const output = result.stdout + result.stderr;
      const isAuthenticated = result.exitCode === 0 && output.includes("Logged in to");

      // Extract username if authenticated
      let username: string | null = null;
      const userMatch = output.match(/Logged in to [\w.]+\s+as\s+(\S+)/);
      if (userMatch?.[1]) {
        username = userMatch[1];
      }

      // Extract scopes
      let scopes: string[] = [];
      const scopeMatch = output.match(/Token scopes:\s*(.+)/);
      if (scopeMatch?.[1]) {
        scopes = scopeMatch[1].split(",").map((s) => s.trim().replace(/'/g, ""));
      }

      return reply.send({
        authenticated: isAuthenticated,
        username,
        scopes,
        raw: output,
      });
    } catch (err) {
      logger.error({ sandboxId, err }, "GitHub auth check failed");
      return reply.send({
        authenticated: false,
        username: null,
        scopes: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // POST /api/sandbox/notify-browser-config-update — Push browser config
  // =========================================================================
  app.post("/api/sandbox/notify-browser-config-update", async (request, reply) => {
    const { sandboxId, userId, config } = request.body as {
      sandboxId: string;
      userId: string;
      config: Record<string, unknown>;
    };

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId are required" });
    }

    if (!config || typeof config !== "object") {
      return reply.status(400).send({ error: "config must be an object" });
    }

    try {
      const configJson = JSON.stringify(config, null, 2);

      // Ensure browser data dir exists
      await sandboxExec(sandboxId, "mkdir -p /home/ubuntu/.browser_data_dir", userId, 5000);

      // Write config file
      await sandboxWriteFile(
        sandboxId,
        "/home/ubuntu/.browser_data_dir/config.json",
        configJson,
        userId
      );

      logger.info({ sandboxId }, "Browser config updated");

      return reply.send({
        ok: true,
        path: "/home/ubuntu/.browser_data_dir/config.json",
      });
    } catch (err) {
      logger.error({ sandboxId, err }, "Browser config update failed");
      return reply.status(500).send({
        error: "Failed to update browser config",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // POST /api/browser/action — Execute browser action (proxy to terminal server)
  // =========================================================================
  app.post("/api/browser/action", async (request, reply) => {
    const { sandboxId, userId, action, params } = request.body as {
      sandboxId: string;
      userId: string;
      action: string;
      params?: Record<string, unknown>;
    };

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId are required" });
    }

    if (!action) {
      return reply.status(400).send({ error: "action is required" });
    }

    try {
      logger.info({ sandboxId, action }, "Executing browser action via terminal server");

      const result = await terminalServerPost(
        sandboxId,
        "/browser/action",
        {
          action,
          ...(params || {}),
        },
        45000
      );

      return reply.send({ action, sandboxId, result });
    } catch (err) {
      logger.error({ sandboxId, action, err }, "Browser action failed");
      return reply.status(500).send({
        error: "Browser action failed",
        action,
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // GET /api/browser/status — Check browser process status in sandbox
  // =========================================================================
  app.get("/api/browser/status", async (request, reply) => {
    const { sandboxId, userId } = request.query as {
      sandboxId: string;
      userId: string;
    };

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId query params are required" });
    }

    try {
      const result = await sandboxExec(
        sandboxId,
        `ps aux 2>/dev/null | grep -E '(chromium|firefox|chrome)' | grep -v grep | head -5`,
        userId,
        10000
      );

      const processes = result.stdout
        .trim()
        .split("\n")
        .filter((line) => line.trim() !== "");

      const isRunning = processes.length > 0;

      // Also check Neko server status
      const nekoResult = await sandboxExec(
        sandboxId,
        `pgrep -f neko >/dev/null 2>&1 && echo 'running' || echo 'stopped'`,
        userId,
        5000
      );

      const nekoRunning = nekoResult.stdout.trim() === "running";

      return reply.send({
        browser: {
          running: isRunning,
          processCount: processes.length,
          processes: processes.slice(0, 5),
        },
        neko: {
          running: nekoRunning,
          port: 8333,
        },
        display: ":0",
      });
    } catch (err) {
      logger.error({ sandboxId, err }, "Browser status check failed");
      return reply.status(500).send({
        error: "Failed to check browser status",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // POST /api/browser/clear — Clear browser data and caches
  // =========================================================================
  app.post("/api/browser/clear", async (request, reply) => {
    const { sandboxId, userId } = request.body as {
      sandboxId: string;
      userId: string;
    };

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId are required" });
    }

    try {
      logger.info({ sandboxId }, "Clearing browser data");

      // Kill existing browser processes first
      await sandboxExec(
        sandboxId,
        "pkill -f chromium 2>/dev/null; pkill -f chrome 2>/dev/null; pkill -f firefox 2>/dev/null; true",
        userId,
        10000
      );

      // Clear browser data directory (preserve the directory itself)
      const clearResult = await sandboxExec(
        sandboxId,
        [
          "rm -rf /home/ubuntu/.browser_data_dir/* 2>/dev/null",
          "rm -rf /home/ubuntu/.search_cache/* 2>/dev/null",
          "rm -rf /home/ubuntu/screenshots/* 2>/dev/null",
          // Recreate dirs in case rm -rf removed them
          "mkdir -p /home/ubuntu/.browser_data_dir",
          "mkdir -p /home/ubuntu/.search_cache",
          "mkdir -p /home/ubuntu/screenshots",
          'echo "cleared"',
        ].join(" && "),
        userId,
        15000
      );

      return reply.send({
        ok: clearResult.exitCode === 0,
        cleared: [
          "/home/ubuntu/.browser_data_dir",
          "/home/ubuntu/.search_cache",
          "/home/ubuntu/screenshots",
        ],
      });
    } catch (err) {
      logger.error({ sandboxId, err }, "Browser clear failed");
      return reply.status(500).send({
        error: "Failed to clear browser data",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // Terminal Management — Proxy to terminal server (port 8330) in sandbox
  // =========================================================================

  // POST /api/terminal/create — Create a new terminal session
  app.post("/api/terminal/create", async (request, reply) => {
    const { sandboxId, cwd, userId } = request.body as {
      sandboxId: string;
      cwd?: string;
      userId?: string;
    };

    if (!sandboxId) {
      return reply.status(400).send({ error: "sandboxId is required" });
    }

    try {
      const result = await terminalServerPost(
        sandboxId,
        "/terminals",
        { cwd: cwd || "/home/ubuntu" },
        30000,
        userId || "system"
      );
      logger.info({ sandboxId, terminalId: result.id }, "Terminal created");
      return reply.send({ ok: true, ...result });
    } catch (err) {
      logger.error({ sandboxId, err }, "Failed to create terminal");
      return reply.status(500).send({
        error: "Failed to create terminal",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/terminal/exec — Execute command synchronously in terminal
  app.post("/api/terminal/exec", async (request, reply) => {
    const { sandboxId, terminalId, command, timeout, userId } = request.body as {
      sandboxId: string;
      terminalId: string;
      command: string;
      timeout?: number;
      userId?: string;
    };

    if (!sandboxId || !terminalId || !command) {
      return reply.status(400).send({ error: "sandboxId, terminalId, and command are required" });
    }

    try {
      const result = await terminalServerPost(
        sandboxId,
        `/terminal/${encodeURIComponent(terminalId)}/exec`,
        { command, timeout: timeout || 30000 },
        (timeout || 30000) + 5000,
        userId || "system"
      );
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, terminalId, err }, "Terminal exec failed");
      return reply.status(500).send({
        error: "Terminal exec failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/terminal/write — Write input to terminal stdin (async)
  app.post("/api/terminal/write", async (request, reply) => {
    const { sandboxId, terminalId, input, enter } = request.body as {
      sandboxId: string;
      terminalId: string;
      input: string;
      enter?: boolean;
    };

    if (!sandboxId || !terminalId) {
      return reply.status(400).send({ error: "sandboxId and terminalId are required" });
    }

    try {
      const result = await terminalServerPost(
        sandboxId,
        `/terminal/${encodeURIComponent(terminalId)}/write`,
        { input: input || "", command: input || "", enter: enter ?? true }
      );
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, terminalId, err }, "Terminal write failed");
      return reply.status(500).send({
        error: "Terminal write failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/terminal/view — View terminal output buffer
  app.get("/api/terminal/view", async (request, reply) => {
    const { sandboxId, terminalId } = request.query as {
      sandboxId: string;
      terminalId: string;
    };

    if (!sandboxId || !terminalId) {
      return reply
        .status(400)
        .send({ error: "sandboxId and terminalId query params are required" });
    }

    try {
      const result = await terminalServerGet(
        sandboxId,
        `/terminal/${encodeURIComponent(terminalId)}/view`
      );
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, terminalId, err }, "Terminal view failed");
      return reply.status(500).send({
        error: "Terminal view failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/terminal/kill — Kill a terminal session
  app.post("/api/terminal/kill", async (request, reply) => {
    const { sandboxId, terminalId } = request.body as {
      sandboxId: string;
      terminalId: string;
    };

    if (!sandboxId || !terminalId) {
      return reply.status(400).send({ error: "sandboxId and terminalId are required" });
    }

    try {
      const result = await terminalServerPost(
        sandboxId,
        `/terminal/${encodeURIComponent(terminalId)}/kill`,
        {}
      );
      logger.info({ sandboxId, terminalId }, "Terminal killed");
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, terminalId, err }, "Terminal kill failed");
      return reply.status(500).send({
        error: "Terminal kill failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/terminal/reset — Kill and recreate a terminal
  app.post("/api/terminal/reset", async (request, reply) => {
    const { sandboxId, terminalId } = request.body as {
      sandboxId: string;
      terminalId: string;
    };

    if (!sandboxId || !terminalId) {
      return reply.status(400).send({ error: "sandboxId and terminalId are required" });
    }

    try {
      const result = await terminalServerPost(
        sandboxId,
        `/terminal/${encodeURIComponent(terminalId)}/reset`,
        {}
      );
      logger.info({ sandboxId, terminalId, newId: result.newId }, "Terminal reset");
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, terminalId, err }, "Terminal reset failed");
      return reply.status(500).send({
        error: "Terminal reset failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/terminal/reset-all — Kill all terminals in a sandbox
  app.post("/api/terminal/reset-all", async (request, reply) => {
    const { sandboxId } = request.body as { sandboxId: string };

    if (!sandboxId) {
      return reply.status(400).send({ error: "sandboxId is required" });
    }

    try {
      const result = await terminalServerPost(sandboxId, "/terminal/reset-all", {});
      logger.info({ sandboxId, killed: result.killed }, "All terminals reset");
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, err }, "Terminal reset-all failed");
      return reply.status(500).send({
        error: "Terminal reset-all failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // GET /api/terminal/info — Get terminal session info
  app.get("/api/terminal/info", async (request, reply) => {
    const { sandboxId, terminalId } = request.query as {
      sandboxId: string;
      terminalId: string;
    };

    if (!sandboxId || !terminalId) {
      return reply
        .status(400)
        .send({ error: "sandboxId and terminalId query params are required" });
    }

    try {
      const result = await terminalServerGet(
        sandboxId,
        `/terminal/${encodeURIComponent(terminalId)}`
      );
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, terminalId, err }, "Terminal info failed");
      return reply.status(500).send({
        error: "Terminal info failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // Text Editor — Proxy to terminal server /text_editor
  // =========================================================================

  // POST /api/text-editor — Structured file editing (Manus text_editor tool)
  app.post("/api/text-editor", async (request, reply) => {
    const { sandboxId, ...editorParams } = request.body as {
      sandboxId: string;
      command: string;
      path: string;
      [key: string]: unknown;
    };

    if (!sandboxId) {
      return reply.status(400).send({ error: "sandboxId is required" });
    }

    if (!editorParams.command || !editorParams.path) {
      return reply.status(400).send({ error: "command and path are required" });
    }

    try {
      const result = await terminalServerPost(sandboxId, "/text_editor", editorParams);
      return reply.send(result);
    } catch (err) {
      logger.error(
        { sandboxId, command: editorParams.command, err },
        "Text editor operation failed"
      );
      return reply.status(500).send({
        error: "Text editor operation failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // File Operations — Proxy to terminal server /file
  // NOTE: POST /api/file/read and /api/file/write are defined in file-ops.ts
  // (which routes through the sandbox service). Do NOT duplicate them here
  // or Fastify will throw FST_ERR_DUPLICATED_ROUTE on startup.
  // =========================================================================

  // POST /api/file/batch-read — Read multiple files from sandbox
  app.post("/api/file/batch-read", async (request, reply) => {
    const { sandboxId, paths } = request.body as {
      sandboxId: string;
      paths: string[];
    };

    if (!sandboxId || !paths?.length) {
      return reply.status(400).send({ error: "sandboxId and paths are required" });
    }

    try {
      const result = await terminalServerPost(sandboxId, "/file/batch_read", {
        paths,
      });
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, err }, "File batch read failed");
      return reply.status(500).send({
        error: "File batch read failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/file/exists — Check if files exist in sandbox
  app.post("/api/file/exists", async (request, reply) => {
    const { sandboxId, paths, basePath } = request.body as {
      sandboxId: string;
      paths: string[];
      basePath?: string;
    };

    if (!sandboxId || !paths?.length) {
      return reply.status(400).send({ error: "sandboxId and paths are required" });
    }

    try {
      const endpoint = basePath ? "/file/files_exist" : "/file/files_exist_abs";
      const result = await terminalServerPost(sandboxId, endpoint, {
        paths,
        ...(basePath ? { basePath } : {}),
      });
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, err }, "File exists check failed");
      return reply.status(500).send({
        error: "File exists check failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // POST /api/file/upload — Upload file from sandbox to S3
  app.post("/api/file/upload", async (request, reply) => {
    const { sandboxId, filePath } = request.body as {
      sandboxId: string;
      filePath: string;
    };

    if (!sandboxId || !filePath) {
      return reply.status(400).send({ error: "sandboxId and filePath are required" });
    }

    try {
      const result = await terminalServerPost(
        sandboxId,
        "/file/upload_to_s3",
        { file_path: filePath },
        60000
      );
      return reply.send(result);
    } catch (err) {
      logger.error({ sandboxId, filePath, err }, "File upload failed");
      return reply.status(500).send({
        error: "File upload failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // Terminal Server Health — Check terminal server is running in sandbox
  // =========================================================================

  app.get("/api/terminal-server/health", async (request, reply) => {
    const { sandboxId } = request.query as { sandboxId: string };

    if (!sandboxId) {
      return reply.status(400).send({ error: "sandboxId query param is required" });
    }

    try {
      const result = await terminalServerGet(sandboxId, "/health");
      return reply.send(result);
    } catch (err) {
      return reply.status(502).send({
        ok: false,
        error: "Terminal server unreachable",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // =========================================================================
  // File Listing — List files in a sandbox directory via terminal server
  // Uses POST /file/list_dir endpoint on the sandbox runtime (Python FastAPI)
  // =========================================================================

  app.post("/api/file/list", async (request, reply) => {
    const { sandboxId, path: dirPath } = request.body as {
      sandboxId: string;
      path?: string;
    };

    if (!sandboxId) {
      return reply.status(400).send({ error: "sandboxId is required" });
    }

    const targetPath = dirPath || "/home/ubuntu";

    try {
      const result = await terminalServerPost(sandboxId, "/file/list_dir", {
        path: targetPath,
      });

      // Terminal server returns { entries: [{name, type, size, modified}], path }
      const entries = (result.entries || []) as {
        name: string;
        type: string;
        size?: number;
        modified?: number;
      }[];

      const files = entries.map((e) => ({
        name: e.name,
        path: `${targetPath}/${e.name}`,
        size: e.size || 0,
        lastModified: e.modified ? new Date(e.modified * 1000).toISOString() : new Date().toISOString(),
        type: (e.type === "directory" ? "directory" : "file") as "file" | "directory",
      }));

      return reply.send({ files, path: targetPath });
    } catch (err) {
      logger.error({ sandboxId, path: targetPath, err }, "File listing failed");
      return reply.status(500).send({
        error: "File listing failed",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  });

  logger.info("Sandbox runtime routes registered");
}
