/**
 * WebRTC Media / Neko Proxy Service — port 4016.
 *
 * Responsibilities:
 * - DB-backed media session CRUD (Neko streaming sessions)
 * - Cloudflare TURN credential cache + rotation
 * - Neko client static files served from S3
 * - WebSocket signaling proxy (frontend → sandbox Neko)
 * - Neko pre-auth proxy (password fetch + cache)
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import websocket from "@fastify/websocket";
import { createLogger } from "@repo/service-utils";
import { initDb } from "./lib/db.js";
import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/sessions.js";
import { iceServerRoutes } from "./routes/ice-servers.js";
import { nekoClientRoutes } from "./routes/neko-client.js";
import { wsProxyRoutes } from "./routes/ws-proxy.js";
import { authRoutes } from "./routes/auth.js";

const logger = createLogger({ service: "webrtc-media" });

const PORT = Number(process.env.PORT ?? 4016);
const HOST = process.env.HOST ?? "0.0.0.0";

export async function buildApp() {
  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 1 * 1024 * 1024, // 1MB
    trustProxy: true,
  });

  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((o: string) => o.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id", "x-session-id"],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  await app.register(websocket);

  // Register routes
  await app.register(healthRoutes);
  await app.register(sessionRoutes);
  await app.register(iceServerRoutes);
  await app.register(nekoClientRoutes);
  await app.register(wsProxyRoutes);
  await app.register(authRoutes);

  // Remove X-Frame-Options for neko-client routes — must be embeddable in iframes
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/neko-client/")) {
      reply.raw.removeHeader("X-Frame-Options");
      reply.raw.removeHeader("Cross-Origin-Opener-Policy");
    }
  });

  return app;
}

async function main() {
  // Initialize database connection
  await initDb();

  const app = await buildApp();

  app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) => {
    logger.error({ err: error }, "Request error");
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal server error" : error.message,
    });
  });

  try {
    await app.listen({ port: PORT, host: HOST });
    logger.info({ port: PORT, host: HOST }, "WebRTC media service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
