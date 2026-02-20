/**
 * Neko pre-auth endpoint.
 *
 * GET /v1/media/sessions/:sessionId/auth
 *   → Fetch Neko admin password from sandbox runtime
 *   → Cache in media_sessions.nekoPassword
 *   → Return { token, nekoUrl }
 */

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getNekoAuth } from "../lib/neko-auth.js";

const paramsSchema = z.object({ sessionId: z.string().min(1) });

export async function authRoutes(app: FastifyInstance) {
  app.get("/v1/media/sessions/:sessionId/auth", async (request, reply) => {
    const { sessionId } = paramsSchema.parse(request.params);

    // Build the WebSocket base URL for the proxy
    const proto = request.headers["x-forwarded-proto"] || "http";
    const host = request.headers["x-forwarded-host"] || request.headers.host || "localhost:4016";
    const wsProto = proto === "https" ? "wss" : "ws";
    const wsBaseUrl = `${wsProto}://${host}`;

    const result = await getNekoAuth(sessionId, wsBaseUrl);

    if (!result) {
      return reply.status(404).send({ error: "Auth not available — session not found or Neko not ready" });
    }

    return result;
  });
}
