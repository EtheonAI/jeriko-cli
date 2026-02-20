/**
 * ICE servers endpoint — returns cached TURN credentials.
 *
 * GET /v1/media/ice-servers → { iceServers: [...], ttl: 86400 }
 */

import type { FastifyInstance } from "fastify";
import { getIceServers } from "../lib/turn-manager.js";

export async function iceServerRoutes(app: FastifyInstance) {
  app.get("/v1/media/ice-servers", async (_request, reply) => {
    const result = await getIceServers();
    return reply
      .header("Cache-Control", "public, max-age=3600")
      .send(result);
  });
}
