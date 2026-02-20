import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    status: "ok",
    service: "webrtc-media",
    timestamp: new Date().toISOString(),
  }));
}
