// src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { createLogger as createLogger3, getEnv } from "@repo/service-utils";

// src/plugins/auth.ts
import fp from "fastify-plugin";
import { extractAuth } from "@repo/service-utils";
var authPluginCallback = async (fastify) => {
  fastify.decorateRequest("auth", null);
  fastify.addHook("onRequest", async (request) => {
    const authorization = request.headers.authorization;
    const apiKey = request.headers["x-api-key"];
    request.auth = await extractAuth(authorization, apiKey);
  });
};
var authPlugin = fp(authPluginCallback, {
  name: "auth"
});
function requireAuth(request) {
  if (!request.auth) {
    const error = new Error("Unauthorized");
    error.statusCode = 401;
    error.code = "UNAUTHORIZED";
    throw error;
  }
  return request.auth;
}

// src/routes/health.ts
import { createHealthCheck, getRedisClient } from "@repo/service-utils";
var healthRoutes = async (fastify) => {
  fastify.get("/health", async () => {
    return { status: "ok" };
  });
  fastify.get("/health/detailed", async () => {
    const checks = [];
    try {
      const redis = getRedisClient();
      await redis.ping();
      checks.push({ name: "redis", status: "pass" });
    } catch (error) {
      checks.push({
        name: "redis",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
    const services2 = [
      { name: "task", url: process.env.TASK_SERVICE_URL },
      { name: "agent", url: process.env.AGENT_SERVICE_URL },
      { name: "device", url: process.env.DEVICE_SERVICE_URL }
    ];
    for (const service of services2) {
      if (!service.url) {
        checks.push({ name: service.name, status: "fail", message: "URL not configured" });
        continue;
      }
      try {
        const response = await fetch(`${service.url}/health`, {
          signal: AbortSignal.timeout(5e3)
        });
        checks.push({
          name: service.name,
          status: response.ok ? "pass" : "fail",
          message: response.ok ? void 0 : `HTTP ${response.status}`
        });
      } catch (error) {
        checks.push({
          name: service.name,
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
    return createHealthCheck("gateway", "0.0.1", checks);
  });
  fastify.get("/ready", async () => {
    try {
      const redis = getRedisClient();
      await redis.ping();
      return { status: "ready" };
    } catch {
      const error = new Error("Service not ready");
      error.statusCode = 503;
      throw error;
    }
  });
};

// src/routes/proxy.ts
import { errorResponse, ErrorCodes, createLogger } from "@repo/service-utils";
var logger = createLogger({ service: "gateway-proxy" });
var services = {
  tasks: { url: process.env.TASK_SERVICE_URL || "http://localhost:3002" },
  agents: { url: process.env.AGENT_SERVICE_URL || "http://localhost:8000" },
  devices: { url: process.env.DEVICE_SERVICE_URL || "http://localhost:8080" },
  files: { url: process.env.FILE_SERVICE_URL || "http://localhost:3003" },
  websites: { url: process.env.WEBSITE_SERVICE_URL || "http://localhost:3004" },
  billing: { url: process.env.BILLING_SERVICE_URL || "http://localhost:3005" },
  notifications: { url: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3006" },
  webhooks: { url: process.env.WEBHOOK_SERVICE_URL || "http://localhost:3007" },
  connectors: { url: process.env.CONNECTOR_SERVICE_URL || "http://localhost:3008" },
  search: { url: process.env.SEARCH_SERVICE_URL || "http://localhost:3009" },
  projects: { url: process.env.PROJECT_SERVICE_URL || "http://localhost:3010" },
  knowledge: { url: process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:8001" },
  sandbox: { url: process.env.SANDBOX_SERVICE_URL || "http://localhost:8081" }
};
async function proxyRequest(serviceUrl, path, method, headers, body, timeout = 3e4) {
  const url = `${serviceUrl}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    body: body ? JSON.stringify(body) : void 0,
    signal: AbortSignal.timeout(timeout)
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
var proxyRoutes = async (fastify) => {
  fastify.all("/:service/*", async (request, reply) => {
    const { service } = request.params;
    const path = request.params["*"];
    const serviceConfig = services[service];
    if (!serviceConfig) {
      return reply.status(404).send(
        errorResponse(
          { code: ErrorCodes.NOT_FOUND, message: `Service '${service}' not found` },
          request.id
        )
      );
    }
    const auth = requireAuth(request);
    const downstreamHeaders = {
      "x-request-id": request.id,
      "x-user-id": auth.userId
    };
    if (auth.email) {
      downstreamHeaders["x-user-email"] = auth.email;
    }
    try {
      const result = await proxyRequest(
        serviceConfig.url,
        `/${path}`,
        request.method,
        downstreamHeaders,
        request.body,
        serviceConfig.timeout
      );
      return reply.status(result.status).send(result.data);
    } catch (error) {
      logger.error({ err: error, service, path }, "Proxy request failed");
      if (error instanceof Error && error.name === "TimeoutError") {
        return reply.status(504).send(
          errorResponse(
            { code: "GATEWAY_TIMEOUT", message: "Downstream service timeout" },
            request.id
          )
        );
      }
      return reply.status(502).send(
        errorResponse(
          { code: "BAD_GATEWAY", message: "Downstream service unavailable" },
          request.id
        )
      );
    }
  });
  fastify.post("/auth/token", async (request, reply) => {
    return reply.status(501).send(
      errorResponse(
        { code: "NOT_IMPLEMENTED", message: "Use the Next.js auth endpoints" },
        request.id
      )
    );
  });
};

// src/routes/websocket.ts
import { WebSocket } from "ws";
import {
  createLogger as createLogger2,
  getRedisPubClient,
  getRedisSubClient,
  extractAuth as extractAuth2
} from "@repo/service-utils";
var logger2 = createLogger2({ service: "gateway-websocket" });
var clients = /* @__PURE__ */ new Map();
var websocketRoutes = async (fastify) => {
  fastify.get("/stream", { websocket: true }, async (socket, request) => {
    const ws = socket;
    const token = request.query.token || request.headers.authorization?.replace("Bearer ", "");
    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }
    const auth = await extractAuth2(`Bearer ${token}`, void 0);
    if (!auth) {
      ws.close(4001, "Invalid authentication");
      return;
    }
    const clientId = crypto.randomUUID();
    const client = {
      userId: auth.userId,
      sessionId: clientId,
      ws,
      subscriptions: /* @__PURE__ */ new Set()
    };
    clients.set(clientId, client);
    logger2.info({ clientId, userId: auth.userId }, "WebSocket client connected");
    const userChannel = `user:${auth.userId}`;
    subscribeToChannel(client, userChannel);
    ws.send(
      JSON.stringify({
        type: "connected",
        data: { clientId, userId: auth.userId }
      })
    );
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleClientMessage(client, message);
      } catch (error) {
        logger2.error({ err: error, clientId }, "Failed to process message");
        ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Invalid message format" }
          })
        );
      }
    });
    ws.on("close", () => {
      logger2.info({ clientId, userId: auth.userId }, "WebSocket client disconnected");
      clients.delete(clientId);
    });
    ws.on("error", (error) => {
      logger2.error({ err: error, clientId }, "WebSocket error");
    });
  });
  fastify.get("/events", async (request, reply) => {
    const auth = await extractAuth2(
      request.headers.authorization,
      request.headers["x-api-key"]
    );
    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*"
    });
    const redis = getRedisSubClient();
    const channel = `user:${auth.userId}`;
    const messageHandler = (ch, message) => {
      if (ch === channel) {
        reply.raw.write(`data: ${message}

`);
      }
    };
    redis.subscribe(channel);
    redis.on("message", messageHandler);
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 3e4);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      redis.unsubscribe(channel);
      redis.off("message", messageHandler);
    });
  });
};
function subscribeToChannel(client, channel) {
  if (client.subscriptions.has(channel)) return;
  const redis = getRedisSubClient();
  redis.subscribe(channel);
  client.subscriptions.add(channel);
  redis.on("message", (ch, message) => {
    if (ch === channel && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}
async function handleClientMessage(client, message) {
  switch (message.type) {
    case "ping":
      client.ws.send(JSON.stringify({ type: "pong" }));
      break;
    case "subscribe":
      const { channel } = message.data;
      if (channel.startsWith(`user:${client.userId}`) || channel.startsWith("public:")) {
        subscribeToChannel(client, channel);
        client.ws.send(
          JSON.stringify({ type: "subscribed", data: { channel } })
        );
      } else {
        client.ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Cannot subscribe to this channel" }
          })
        );
      }
      break;
    case "task:start":
    case "task:continue":
    case "task:cancel":
      const redis = getRedisPubClient();
      await redis.publish(
        "tasks:commands",
        JSON.stringify({
          type: message.type,
          userId: client.userId,
          clientId: client.sessionId,
          data: message.data
        })
      );
      break;
    default:
      client.ws.send(
        JSON.stringify({
          type: "error",
          data: { message: `Unknown message type: ${message.type}` }
        })
      );
  }
}

// src/index.ts
var logger3 = createLogger3({ service: "gateway" });
async function main() {
  const port = parseInt(getEnv("PORT", "3001"), 10);
  const host = getEnv("HOST", "0.0.0.0");
  const app = Fastify({
    logger: false,
    // We use our own logger
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID()
  });
  await app.register(cors, {
    origin: getEnv("CORS_ORIGIN", "*"),
    credentials: true
  });
  await app.register(helmet, {
    contentSecurityPolicy: false
    // We handle this in Next.js
  });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      return request.headers["x-api-key"]?.toString() || request.headers["authorization"]?.toString() || request.ip;
    }
  });
  await app.register(websocket, {
    options: {
      maxPayload: 1048576
      // 1MB
    }
  });
  await app.register(authPlugin);
  await app.register(healthRoutes);
  await app.register(proxyRoutes, { prefix: "/v1" });
  await app.register(websocketRoutes, { prefix: "/v1" });
  app.setErrorHandler((error, request, reply) => {
    logger3.error({ err: error, requestId: request.id }, "Request error");
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      data: null,
      meta: {
        requestId: request.id,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      error: {
        code: error.code || "INTERNAL_ERROR",
        message: statusCode === 500 ? "Internal server error" : error.message
      }
    });
  });
  app.addHook("onRequest", async (request) => {
    logger3.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      ip: request.ip
    }, "Incoming request");
  });
  app.addHook("onResponse", async (request, reply) => {
    logger3.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime
    }, "Request completed");
  });
  try {
    await app.listen({ port, host });
    logger3.info({ port, host }, "Gateway service started");
  } catch (err) {
    logger3.error(err, "Failed to start server");
    process.exit(1);
  }
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger3.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}
main();
//# sourceMappingURL=index.js.map