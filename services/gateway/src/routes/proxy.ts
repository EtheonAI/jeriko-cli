import { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { errorResponse, ErrorCodes, createLogger } from "@repo/service-utils";
import { CircuitBreaker } from "@repo/service-utils/circuit-breaker";

const logger = createLogger({ service: "gateway-proxy" });

const GATEWAY_SECRET = process.env.GATEWAY_SECRET || "";

interface ServiceConfig {
  url: string;
  timeout?: number;
}

const services: Record<string, ServiceConfig> = {
  tasks: { url: process.env.TASK_SERVICE_URL || "http://localhost:4002" },
  agents: { url: process.env.AGENT_SERVICE_URL || "http://localhost:8000" },
  devices: { url: process.env.DEVICE_SERVICE_URL || "http://localhost:4003" },
  files: { url: process.env.FILE_SERVICE_URL || "http://localhost:4005" },
  websites: { url: process.env.WEBSITE_SERVICE_URL || "http://localhost:4004" },
  billing: { url: process.env.BILLING_SERVICE_URL || "http://localhost:4008" },
  notifications: { url: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4006" },
  webhooks: { url: process.env.WEBHOOK_SERVICE_URL || "http://localhost:4007" },
  connectors: { url: process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009" },
  search: { url: process.env.SEARCH_SERVICE_URL || "http://localhost:4013" },
  projects: { url: process.env.PROJECT_SERVICE_URL || "http://localhost:4010" },
  knowledge: { url: process.env.KNOWLEDGE_SERVICE_URL || "http://localhost:4011" },
  sandbox: { url: process.env.SANDBOX_SERVICE_URL || "http://localhost:4012" },
};

// One circuit breaker per downstream service
const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(serviceName: string): CircuitBreaker {
  let cb = circuitBreakers.get(serviceName);
  if (!cb) {
    cb = new CircuitBreaker(serviceName, {
      failureThreshold: 5,
      resetTimeoutMs: 30_000,
      failureWindowMs: 60_000,
      onStateChange: (from: string, to: string, name: string) => {
        logger.warn({ service: name, from, to }, `Circuit breaker state change: ${from} → ${to}`);
      },
    });
    circuitBreakers.set(serviceName, cb);
  }
  return cb;
}

async function proxyRequest(
  serviceUrl: string,
  path: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown,
  timeout: number = 30000
): Promise<{ status: number; data: unknown }> {
  const url = `${serviceUrl}${path}`;

  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });

  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

/** Get circuit breaker states and stats for all services (used by health aggregation) */
export function getServiceStates(): Record<string, { url: string; circuitState: string; stats?: ReturnType<CircuitBreaker["getStats"]> }> {
  const states: Record<string, { url: string; circuitState: string; stats?: ReturnType<CircuitBreaker["getStats"]> }> = {};
  for (const [name, config] of Object.entries(services)) {
    const cb = circuitBreakers.get(name);
    states[name] = {
      url: config.url,
      circuitState: cb ? cb.getState() : "closed",
      ...(cb && { stats: cb.getStats() }),
    };
  }
  return states;
}

/** Reject path traversal and protocol injection attempts */
function sanitizePath(path: string): string {
  // Block directory traversal
  if (path.includes("..") || path.includes("%2e%2e") || path.includes("%2E%2E")) {
    throw new Error("Path traversal detected");
  }
  // Block protocol injection
  if (/^https?:\/\//i.test(path) || path.includes("://")) {
    throw new Error("Protocol injection detected");
  }
  // Block null bytes
  if (path.includes("\0") || path.includes("%00")) {
    throw new Error("Null byte in path");
  }
  // Normalize double slashes
  return path.replace(/\/+/g, "/");
}

export const proxyRoutes: FastifyPluginAsync = async (fastify) => {
  // Generic proxy handler
  fastify.all("/:service/*", async (request, reply) => {
    const { service } = request.params as { service: string };
    const rawPath = (request.params as { "*": string })["*"];
    const serviceConfig = services[service];

    if (!serviceConfig) {
      return reply
        .status(404)
        .send(
          errorResponse(
            { code: ErrorCodes.NOT_FOUND, message: `Service '${service}' not found` },
            request.id
          )
        );
    }

    // Sanitize path to prevent traversal/injection
    let path: string;
    try {
      path = sanitizePath(rawPath);
    } catch (err) {
      return reply
        .status(400)
        .send(
          errorResponse(
            { code: "BAD_REQUEST", message: "Invalid request path" },
            request.id
          )
        );
    }

    // Allow unauthenticated health checks
    if (path === "health") {
      try {
        const result = await proxyRequest(
          serviceConfig.url,
          "/health",
          "GET",
          { "x-request-id": request.id },
          undefined,
          5000
        );
        return reply.status(result.status).send(result.data);
      } catch {
        return reply
          .status(503)
          .send(
            errorResponse(
              { code: "SERVICE_UNAVAILABLE", message: `Service '${service}' is unavailable` },
              request.id
            )
          );
      }
    }

    // Require auth for all other service requests
    const auth = requireAuth(request);

    // Build headers for downstream service — includes gateway secret for internal auth
    const downstreamHeaders: Record<string, string> = {
      "x-request-id": request.id,
      "x-user-id": auth.userId,
    };

    if (auth.email) {
      downstreamHeaders["x-user-email"] = auth.email;
    }

    // Stamp gateway secret so downstream services can verify the request came through the gateway
    if (GATEWAY_SECRET) {
      downstreamHeaders["x-gateway-secret"] = GATEWAY_SECRET;
    }

    // Use circuit breaker for downstream calls
    const cb = getCircuitBreaker(service);

    try {
      const result = await cb.execute(() =>
        proxyRequest(
          serviceConfig.url,
          `/${path}`,
          request.method,
          downstreamHeaders,
          request.body,
          serviceConfig.timeout,
        )
      );

      return reply.status(result.status).send(result.data);
    } catch (error) {
      logger.error({ err: error, service, path }, "Proxy request failed");

      // Circuit breaker open
      if (error instanceof Error && error.message.includes("circuit open")) {
        return reply
          .status(503)
          .send(
            errorResponse(
              { code: "SERVICE_UNAVAILABLE", message: `Service '${service}' is temporarily unavailable` },
              request.id
            )
          );
      }

      if (error instanceof Error && error.name === "TimeoutError") {
        return reply
          .status(504)
          .send(
            errorResponse(
              { code: "GATEWAY_TIMEOUT", message: "Downstream service timeout" },
              request.id
            )
          );
      }

      return reply
        .status(502)
        .send(
          errorResponse(
            { code: "BAD_GATEWAY", message: "Downstream service unavailable" },
            request.id
          )
        );
    }
  });

  // Direct auth endpoint (no proxy needed)
  fastify.post("/auth/token", async (request, reply) => {
    return reply
      .status(501)
      .send(
        errorResponse(
          { code: "NOT_IMPLEMENTED", message: "Use the Next.js auth endpoints" },
          request.id
        )
      );
  });
};
