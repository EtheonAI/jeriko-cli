import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { createLogger, getEnv } from "@repo/service-utils";
import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/sessions.js";
import { completionRoutes } from "./routes/completions.js";
import { mediaRoutes } from "./routes/media.js";
import { llmProxyRoutes } from "./routes/llm-proxy.js";
import { uploadRoutes } from "./routes/upload.js";
import { nekoClientRoutes } from "./routes/neko-client.js";
import { webdevRoutes } from "./routes/webdev.js";
import { codeServerRoutes } from "./routes/code-server.js";
import { forgeRoutes } from "./routes/forge.js";
import { deployRoutes } from "./routes/deploy.js";
import { sandboxRuntimeRoutes } from "./routes/sandbox-runtime.js";
import { fileOpsRoutes } from "./routes/file-ops.js";
import { emailRoutes } from "./routes/email.js";
import { imageOpsRoutes } from "./routes/image-ops.js";
import { slideRoutes } from "./routes/slides.js";
import { skillRoutes } from "./routes/skills.js";
import { sandboxManagerRoutes } from "./routes/sandbox-manager.js";
import { apiProxyRoutes } from "./routes/apiproxy.js";
import { startCleanupLoop, stopCleanupLoop } from "./lib/e2b-manager.js";
import { initRsaSigning } from "./lib/rsa-auth.js";

const logger = createLogger({ service: "orchestrator" });

export async function buildApp() {
  const port = parseInt(getEnv("PORT", "4014"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 10 * 1024 * 1024,
    trustProxy: true,
  });

  const allowedOrigins = getEnv("ALLOWED_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((o: string) => o.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-api-key",
      "x-request-id",
      "x-user-id",
      "x-user-name",
      "x-session-id",
    ],
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });

  await app.register(healthRoutes);
  await app.register(sessionRoutes);
  await app.register(completionRoutes);
  await app.register(mediaRoutes);
  await app.register(llmProxyRoutes);
  await app.register(uploadRoutes);
  await app.register(nekoClientRoutes);
  await app.register(webdevRoutes);
  await app.register(codeServerRoutes);
  await app.register(forgeRoutes);
  await app.register(deployRoutes);
  await app.register(sandboxRuntimeRoutes);
  await app.register(fileOpsRoutes);
  await app.register(emailRoutes);
  await app.register(imageOpsRoutes);
  await app.register(slideRoutes);
  await app.register(skillRoutes);
  await app.register(sandboxManagerRoutes);
  await app.register(apiProxyRoutes);

  // Remove X-Frame-Options for neko-client routes — must be embeddable in iframes.
  // Helmet sets headers on raw response, so we must override at that level.
  app.addHook("onSend", async (request, reply) => {
    if (request.url.startsWith("/neko-client/")) {
      reply.raw.removeHeader("X-Frame-Options");
      reply.raw.removeHeader("Cross-Origin-Opener-Policy");
    }
  });

  return { app, port, host };
}

async function main() {
  // 19 route plugins + shutdown listeners exceeds default 10
  process.setMaxListeners(25);

  // Initialize RSA signing for sandbox API calls
  initRsaSigning();

  const { app, port, host } = await buildApp();

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    logger.error({ err: error, requestId: request.id }, "Request error");

    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      data: null,
      meta: {
        requestId: request.id,
        timestamp: new Date().toISOString(),
      },
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: statusCode === 500 ? "Internal server error" : error.message,
      },
    });
  });

  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  try {
    await app.listen({ port, host });
    startCleanupLoop();
    logger.info({ port, host }, "Orchestrator service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      stopCleanupLoop();
      await app.close();
      process.exit(0);
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
