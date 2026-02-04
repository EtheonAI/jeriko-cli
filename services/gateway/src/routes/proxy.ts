import { FastifyPluginAsync } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { successResponse, errorResponse, ErrorCodes, createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "gateway-proxy" });

interface ServiceConfig {
  url: string;
  timeout?: number;
}

const services: Record<string, ServiceConfig> = {
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
  sandbox: { url: process.env.SANDBOX_SERVICE_URL || "http://localhost:8081" },
};

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

export const proxyRoutes: FastifyPluginAsync = async (fastify) => {
  // Generic proxy handler
  fastify.all("/:service/*", async (request, reply) => {
    const { service } = request.params as { service: string };
    const path = (request.params as { "*": string })["*"];
    const serviceConfig = services[service];

    if (!serviceConfig) {
      return reply.status(404).send(
        errorResponse(
          { code: ErrorCodes.NOT_FOUND, message: `Service '${service}' not found` },
          request.id
        )
      );
    }

    // Require auth for all service requests
    const auth = requireAuth(request);

    // Build headers for downstream service
    const downstreamHeaders: Record<string, string> = {
      "x-request-id": request.id,
      "x-user-id": auth.userId,
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

  // Direct auth endpoint (no proxy needed)
  fastify.post("/auth/token", async (request, reply) => {
    // This would typically validate credentials and return a token
    // For now, we'll return a placeholder
    return reply.status(501).send(
      errorResponse(
        { code: "NOT_IMPLEMENTED", message: "Use the Next.js auth endpoints" },
        request.id
      )
    );
  });
};
