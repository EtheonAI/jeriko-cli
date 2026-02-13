/**
 * Sandbox Management Routes — Create and manage E2B sandboxes via orchestrator.
 *
 * These routes wrap the e2b-manager functions to provide HTTP access to sandbox
 * lifecycle management. Unlike the sandbox service (port 4012) which manages
 * E2B sandboxes directly, these routes maintain the orchestrator's session cache
 * and handle proxy tokens, code-server passwords, and database names.
 *
 * Routes:
 *   POST /api/sandbox/create — Create a sandbox for a session
 *   GET  /api/sandbox/info   — Get sandbox info by session ID
 *   POST /api/sandbox/destroy — Destroy a sandbox for a session
 */

import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";
import {
  getOrCreateSandbox,
  getSandboxInfo,
  destroySandbox,
  getActiveSandboxCount,
} from "../lib/e2b-manager.js";

const logger = createLogger({ service: "sandbox-manager" });

export async function sandboxManagerRoutes(app: FastifyInstance) {
  /**
   * POST /api/sandbox/create — Create or get existing sandbox for a session.
   *
   * Body: { sessionId, userId }
   * Returns: { sandboxId, nekoUrl, sessionId }
   */
  app.post("/api/sandbox/create", async (request, reply) => {
    const body = request.body as {
      sessionId?: string;
      userId?: string;
    };

    const sessionId = body.sessionId;
    const userId = body.userId;

    if (!sessionId || !userId) {
      return reply.status(400).send({
        error: "sessionId and userId required",
      });
    }

    try {
      const result = await getOrCreateSandbox(sessionId, userId);
      logger.info({ sessionId, sandboxId: result.sandboxId }, "Sandbox created/retrieved");

      return reply.send({
        sandboxId: result.sandboxId,
        e2bSandboxId: result.e2bSandboxId,
        nekoUrl: result.nekoUrl,
        sessionId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sessionId, error: msg }, "Failed to create sandbox");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * GET /api/sandbox/info — Get sandbox info by session ID.
   *
   * Query: ?sessionId=xxx
   * Returns: { sandboxId, nekoUrl } or 404
   */
  app.get("/api/sandbox/info", async (request, reply) => {
    const query = request.query as {
      sessionId?: string;
    };

    const sessionId = query.sessionId;

    if (!sessionId) {
      return reply.status(400).send({
        error: "sessionId query param required",
      });
    }

    const info = getSandboxInfo(sessionId);
    if (!info) {
      return reply.status(404).send({
        error: "No sandbox found for this session",
      });
    }

    return reply.send(info);
  });

  /**
   * POST /api/sandbox/destroy — Destroy a sandbox for a session.
   *
   * Body: { sessionId }
   * Returns: { success: true }
   */
  app.post("/api/sandbox/destroy", async (request, reply) => {
    const body = request.body as {
      sessionId?: string;
    };

    const sessionId = body.sessionId;

    if (!sessionId) {
      return reply.status(400).send({
        error: "sessionId required",
      });
    }

    try {
      await destroySandbox(sessionId);
      logger.info({ sessionId }, "Sandbox destroyed");

      return reply.send({
        success: true,
        sessionId,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ sessionId, error: msg }, "Failed to destroy sandbox");
      return reply.status(500).send({ error: msg });
    }
  });

  /**
   * GET /api/sandbox/stats — Get sandbox statistics.
   *
   * Returns: { activeSandboxes }
   */
  app.get("/api/sandbox/stats", async (_request, reply) => {
    return reply.send({
      activeSandboxes: getActiveSandboxCount(),
    });
  });
}
