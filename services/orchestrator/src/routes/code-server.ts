/**
 * Code-Server Routes — Proxies to the terminal server inside E2B sandboxes.
 *
 * Manus 3-layer security architecture:
 *   Layer 1: code-server runs with auth: password (random per-sandbox) on port 8329
 *   Layer 2: Terminal server (port 8330) reverse-proxies at /cs/* with auto auth-cookie injection
 *   Layer 3: E2B port proxy (unguessable URL: https://8330-{sandboxId}.e2b.dev)
 *
 * Flow:
 *   1. Frontend calls GET /api/code-server/pre-auth → proxy to terminal server /code-server/pre-auth
 *   2. Frontend calls POST /api/code-server/auth → proxy to terminal server /code-server/auth
 *   3. Frontend loads iframe at https://8330-{e2bId}.e2b.dev/cs/ → no login page (proxy handles auth)
 *
 * The terminal server handles all code-server logic: pre-auth token generation, password management,
 * trigger file for code-server start, and the reverse proxy at /cs/ with automatic auth cookie injection.
 *
 * Routes:
 *   GET  /api/code-server/pre-auth — Proxy to terminal server pre-auth
 *   POST /api/code-server/auth     — Proxy to terminal server auth
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";
import { getSandboxInfo, getE2bSandboxIdBySandboxId, buildSandboxPortUrl } from "../lib/e2b-manager.js";
import { getRsaHeaders } from "../lib/rsa-auth.js";

const logger = createLogger({ service: "code-server" });

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

/**
 * Get the E2B port proxy URL for a sandbox.
 * Tries e2b-manager cache first (fast), falls back to sandbox service.
 */
async function getPortProxyUrl(
  sandboxId: string,
  userId: string,
  port: number
): Promise<string | null> {
  // Try cache first (avoids sandbox service roundtrip)
  const cachedE2bId = getE2bSandboxIdBySandboxId(sandboxId);
  if (cachedE2bId) {
    return buildSandboxPortUrl(cachedE2bId, port);
  }

  // Fall back to sandbox service
  try {
    const resp = await fetch(`${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}`, {
      headers: { "x-user-id": userId },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return null;
    const sbxData = (await resp.json()) as { data?: { e2bSandboxId?: string } };
    const e2bId = sbxData.data?.e2bSandboxId;
    if (!e2bId) return null;
    return buildSandboxPortUrl(e2bId, port);
  } catch {
    return null;
  }
}

/**
 * Call a terminal server endpoint inside the sandbox.
 */
async function callTerminalServer(
  sandboxId: string,
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get terminal server port proxy URL (port 8330)
  const baseUrl = await getPortProxyUrl(sandboxId, userId, 8330);
  if (!baseUrl) {
    throw new Error("Could not get terminal server URL");
  }

  const url = `${baseUrl}${endpoint}`;
  const body = typeof options.body === "string" ? options.body : "";
  const rsaHeaders = getRsaHeaders(body);
  return fetch(url, {
    ...options,
    headers: { ...options.headers, ...rsaHeaders },
    signal: AbortSignal.timeout(30000),
  });
}

export async function codeServerRoutes(app: FastifyInstance) {
  /**
   * GET /api/code-server/pre-auth — Proxy to terminal server pre-auth.
   *
   * Query params: (sessionId OR sandboxId), userId
   */
  app.get("/api/code-server/pre-auth", async (request, reply) => {
    const query = request.query as {
      sessionId?: string;
      sandboxId?: string;
      userId?: string;
    };

    const sessionId = query.sessionId;
    const userId = query.userId;

    if (!userId) {
      return reply.status(400).send({ error: "userId query param required" });
    }

    // Accept sandboxId directly (from IDE frontend) or resolve via sessionId
    let sandboxId = query.sandboxId;
    if (!sandboxId && sessionId) {
      const info = getSandboxInfo(sessionId);
      if (!info) {
        return reply.status(404).send({ error: "No active sandbox for this session" });
      }
      sandboxId = info.sandboxId;
    }

    if (!sandboxId) {
      return reply.status(400).send({ error: "sandboxId or sessionId query param required" });
    }

    try {
      // Proxy to terminal server /code-server/pre-auth
      const resp = await callTerminalServer(sandboxId, userId, "/code-server/pre-auth", {
        method: "GET",
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`Terminal server pre-auth failed: ${resp.status} ${errorText}`);
      }

      const data = (await resp.json()) as {
        ok: boolean;
        pre_auth_token: string;
        proxy_path: string;
        ready: boolean;
      };

      // Get the terminal server proxy URL (port 8330) — code-server is at /cs/ path
      const proxyBaseUrl = await getPortProxyUrl(sandboxId, userId, 8330);
      const codeServerUrl = proxyBaseUrl ? `${proxyBaseUrl}/cs/` : null;

      logger.info({ sandboxId, sessionId, ready: data.ready }, "Code-server pre-auth success");

      return reply.send({
        pre_auth_token: data.pre_auth_token,
        url: codeServerUrl,
        ready: data.ready,
        auth: "password",
        proxy_path: data.proxy_path,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, error: msg }, "Failed to get pre-auth token");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * POST /api/code-server/auth — Proxy to terminal server auth.
   *
   * Body: { pre_auth_token, sandboxId, userId } or { pre_auth_token, sessionId, userId }
   */
  app.post("/api/code-server/auth", async (request, reply) => {
    const body = request.body as {
      pre_auth_token?: string;
      sandboxId?: string;
      sessionId?: string;
      userId?: string;
    };

    const token = body.pre_auth_token;
    const userId = body.userId;

    if (!token) {
      return reply.status(400).send({ error: "Missing pre_auth_token in request" });
    }
    if (!userId) {
      return reply.status(400).send({ error: "Missing userId in request" });
    }

    // Accept sandboxId directly (from IDE frontend) or resolve via sessionId
    let sandboxId = body.sandboxId;
    if (!sandboxId && body.sessionId) {
      const info = getSandboxInfo(body.sessionId);
      if (!info) {
        return reply.status(404).send({ error: "No active sandbox for this session" });
      }
      sandboxId = info.sandboxId;
    }

    if (!sandboxId) {
      return reply.status(400).send({ error: "sandboxId or sessionId required" });
    }

    try {
      // Proxy to terminal server /code-server/auth
      const resp = await callTerminalServer(sandboxId, userId, "/code-server/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pre_auth_token: token }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        return reply.status(resp.status).send({ error: errorText });
      }

      const data = await resp.json();
      logger.info({ sandboxId }, "Code-server auth validated");

      return reply.send(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sandboxId, error: msg }, "Failed to validate auth");
      return reply.status(500).send({ error: msg });
    }
  });
}
