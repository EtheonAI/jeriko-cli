/**
 * Code-Server Routes — Manages VS Code (code-server) inside E2B sandboxes.
 *
 * Manus 3-layer security pattern (from code_server_deep_dive.md):
 *   Layer 1: code-server runs on port 8329 inside sandbox (password auth)
 *   Layer 2: Orchestrator pre-auth endpoint generates short-lived token
 *   Layer 3: E2B port proxy exposes {port}-{sandbox-id}.e2b.dev publicly
 *
 * Authentication flow (from code_server_auth.json):
 *   1. Frontend calls GET /api/code-server/pre-auth → gets pre_auth_token
 *   2. Frontend opens iframe to E2B proxy URL
 *   3. Frontend calls POST /api/code-server/auth with pre_auth_token → validates + returns password
 *   4. Frontend POSTs to code-server /login with password → session cookie set
 *
 * Routes:
 *   GET  /api/code-server/pre-auth — Generate pre-auth token (Manus: GET /code-server/pre-auth)
 *   POST /api/code-server/auth     — Validate token, return password (Manus: POST /code-server/auth)
 *   POST /api/code-server/start    — Ensure code-server is running
 *   POST /api/code-server/status   — Check if code-server is running
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";
import { getSandboxDetails } from "../lib/e2b-manager.js";

const logger = createLogger({ service: "code-server" });

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";
const CODE_SERVER_DOMAIN = process.env.CODE_SERVER_DOMAIN || "";

// In-memory pre-auth token store (short-lived, single-use)
const preAuthTokens = new Map<
  string,
  { sessionId: string; sandboxId: string; codeServerPassword: string; createdAt: number }
>();

// Clean up expired tokens every 60s (tokens expire after 60s)
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of preAuthTokens) {
    if (now - data.createdAt > 60_000) {
      preAuthTokens.delete(token);
    }
  }
}, 60_000);

/**
 * Execute a shell command in a sandbox via the sandbox service.
 */
async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 10000
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/shell`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ command, timeout }),
    signal: AbortSignal.timeout(timeout + 5000),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox exec failed: ${resp.status} ${detail}`);
  }

  const data = (await resp.json()) as {
    data?: { stdout?: string; stderr?: string; exitCode?: number };
  };
  return {
    stdout: data.data?.stdout || "",
    stderr: data.data?.stderr || "",
    exitCode: data.data?.exitCode ?? 1,
  };
}

/**
 * Write a file to the sandbox filesystem.
 */
async function sandboxWriteFile(
  sandboxId: string,
  path: string,
  content: string,
  userId: string
): Promise<void> {
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ path, content }),
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) {
    throw new Error(`Sandbox file write failed: ${resp.status}`);
  }
}

/**
 * Get the E2B port proxy URL for a sandbox.
 */
async function getPortProxyUrl(
  sandboxId: string,
  userId: string,
  port: number
): Promise<string | null> {
  const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}`, {
    headers: { "x-user-id": userId },
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) return null;

  const sbxData = (await resp.json()) as {
    data?: { e2bSandboxId?: string };
  };
  const e2bId = sbxData.data?.e2bSandboxId;
  if (!e2bId) return null;

  // E2B port proxy format: {port}-{sandboxId}.e2b.dev (port FIRST)
  if (CODE_SERVER_DOMAIN) {
    return `https://${port}-${e2bId}.${CODE_SERVER_DOMAIN}`;
  }
  return `https://${port}-${e2bId}.e2b.dev`;
}

export async function codeServerRoutes(app: FastifyInstance) {
  /**
   * GET /api/code-server/pre-auth — Generate a pre-auth token.
   *
   * Manus equivalent: GET /code-server/pre-auth
   * Returns a short-lived, single-use token for code-server authentication.
   * Also starts code-server if not already running.
   *
   * Query params: sessionId, userId
   */
  app.get("/api/code-server/pre-auth", async (request, reply) => {
    const query = request.query as {
      sessionId?: string;
      userId?: string;
    };

    const sessionId = query.sessionId;
    const userId = query.userId;

    if (!sessionId || !userId) {
      return reply.status(400).send({ error: "sessionId and userId query params required" });
    }

    // Get sandbox details (includes code-server password)
    const details = getSandboxDetails(sessionId);
    if (!details) {
      return reply.status(404).send({ error: "No active sandbox for this session" });
    }

    const { sandboxId, codeServerPassword } = details;
    if (!codeServerPassword) {
      return reply.status(500).send({ error: "Code-server password not configured" });
    }

    try {
      // Ensure code-server is running (write trigger file)
      await sandboxWriteFile(sandboxId, "/tmp/start_code_server", "1", userId);

      // Generate short-lived pre-auth token
      const tokenBytes = new Uint8Array(24);
      crypto.getRandomValues(tokenBytes);
      const preAuthToken = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      preAuthTokens.set(preAuthToken, {
        sessionId,
        sandboxId,
        codeServerPassword,
        createdAt: Date.now(),
      });

      // Get code-server URL
      const codeServerUrl = await getPortProxyUrl(sandboxId, userId, 8329);

      // Wait for code-server to be ready (poll up to 15s)
      let ready = false;
      for (let i = 0; i < 15; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const check = await sandboxExec(
            sandboxId,
            `curl -s -o /dev/null -w "%{http_code}" http://localhost:8329/healthz 2>/dev/null || echo "0"`,
            userId,
            5000
          );
          if (check.stdout.trim() === "200") {
            ready = true;
            break;
          }
        } catch {
          // Keep polling
        }
      }

      logger.info({ sandboxId, sessionId, ready }, "Code-server pre-auth token generated");

      return reply.send({
        pre_auth_token: preAuthToken,
        url: codeServerUrl,
        ready,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, error: msg }, "Failed to generate pre-auth token");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/code-server/auth — Validate pre-auth token and return credentials.
   *
   * Manus equivalent: POST /code-server/auth
   * Validates the pre_auth_token and returns the code-server password.
   * The frontend uses this to POST to code-server's /login endpoint.
   *
   * Body: { pre_auth_token }
   */
  app.post("/api/code-server/auth", async (request, reply) => {
    const body = request.body as {
      pre_auth_token?: string;
    };

    const token = body.pre_auth_token;
    if (!token) {
      return reply.status(400).send({ error: "Missing pre_auth_token in request" });
    }

    const tokenData = preAuthTokens.get(token);
    if (!tokenData) {
      return reply.status(401).send({ error: "Invalid or expired pre-auth token" });
    }

    // Check expiry (60 seconds)
    if (Date.now() - tokenData.createdAt > 60_000) {
      preAuthTokens.delete(token);
      return reply.status(401).send({ error: "Pre-auth token expired" });
    }

    // Single-use: delete after validation
    preAuthTokens.delete(token);

    logger.info(
      { sandboxId: tokenData.sandboxId, sessionId: tokenData.sessionId },
      "Code-server pre-auth token validated"
    );

    return reply.send({
      password: tokenData.codeServerPassword,
      port: 8329,
      folder: "/home/user",
    });
  });

  /**
   * POST /api/code-server/start — Start code-server in the sandbox.
   *
   * Writes the trigger file that the start_command.sh watcher picks up.
   * Idempotent — safe to call multiple times.
   */
  app.post("/api/code-server/start", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
    };

    const { sandboxId, userId } = body;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      // Write trigger file
      await sandboxWriteFile(sandboxId, "/tmp/start_code_server", "1", userId);

      // Check if already running
      const check = await sandboxExec(
        sandboxId,
        `pgrep -f "code-server" > /dev/null 2>&1 && echo "running" || echo "starting"`,
        userId,
        5000
      );

      return reply.send({
        success: true,
        status: check.stdout.trim(),
        port: 8329,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/code-server/status — Check code-server status.
   */
  app.post("/api/code-server/status", async (request, reply) => {
    const body = request.body as {
      sandboxId: string;
      userId: string;
    };

    const { sandboxId, userId } = body;

    if (!sandboxId || !userId) {
      return reply.status(400).send({ error: "sandboxId and userId required" });
    }

    try {
      const check = await sandboxExec(
        sandboxId,
        `curl -s -o /dev/null -w "%{http_code}" http://localhost:8329/healthz 2>/dev/null || echo "0"`,
        userId,
        5000
      );

      const running = check.stdout.trim() === "200";

      return reply.send({
        running,
        port: 8329,
        httpStatus: check.stdout.trim(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({ error: msg });
    }
  });
}
