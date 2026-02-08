import { FastifyPluginAsync } from "fastify";
import { createHealthCheck, getRedisClient } from "@repo/service-utils";
import { getServiceStates } from "./proxy.js";
import { getConnectionCount, metrics as wsMetrics } from "./websocket.js";

/** All downstream services to health-check */
const ALL_SERVICES: Array<{ name: string; urlEnv: string; fallback: string }> = [
  { name: "task", urlEnv: "TASK_SERVICE_URL", fallback: "http://localhost:4002" },
  { name: "agent", urlEnv: "AGENT_SERVICE_URL", fallback: "http://localhost:8000" },
  { name: "device", urlEnv: "DEVICE_SERVICE_URL", fallback: "http://localhost:4003" },
  { name: "file", urlEnv: "FILE_SERVICE_URL", fallback: "http://localhost:4005" },
  { name: "website", urlEnv: "WEBSITE_SERVICE_URL", fallback: "http://localhost:4004" },
  { name: "billing", urlEnv: "BILLING_SERVICE_URL", fallback: "http://localhost:4008" },
  { name: "notification", urlEnv: "NOTIFICATION_SERVICE_URL", fallback: "http://localhost:4006" },
  { name: "webhook", urlEnv: "WEBHOOK_SERVICE_URL", fallback: "http://localhost:4007" },
  { name: "connector", urlEnv: "CONNECTOR_SERVICE_URL", fallback: "http://localhost:4009" },
  { name: "search", urlEnv: "SEARCH_SERVICE_URL", fallback: "http://localhost:4013" },
  { name: "project", urlEnv: "PROJECT_SERVICE_URL", fallback: "http://localhost:4010" },
  { name: "knowledge", urlEnv: "KNOWLEDGE_SERVICE_URL", fallback: "http://localhost:4011" },
  { name: "sandbox", urlEnv: "SANDBOX_SERVICE_URL", fallback: "http://localhost:4012" },
];

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Simple health check (for load balancers / k8s liveness)
  fastify.get("/health", async () => {
    return { status: "ok", service: "gateway" };
  });

  // Readiness check — verifies Redis connectivity
  fastify.get("/health/ready", async (_, reply) => {
    try {
      const redis = getRedisClient();
      await redis.ping();
      return { status: "ready", service: "gateway" };
    } catch {
      return reply.status(503).send({ status: "not_ready", service: "gateway" });
    }
  });

  // Liveness check
  fastify.get("/health/live", async () => {
    return { status: "ok" };
  });

  // Detailed health check with Redis + downstream services
  fastify.get("/health/detailed", async () => {
    const checks: { name: string; status: "pass" | "fail"; message?: string }[] = [];

    // Check Redis
    try {
      const redis = getRedisClient();
      await redis.ping();
      checks.push({ name: "redis", status: "pass" });
    } catch (error) {
      checks.push({
        name: "redis",
        status: "fail",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }

    return createHealthCheck("gateway", "0.0.1", checks);
  });

  // Aggregate health of all downstream services + circuit breaker states
  fastify.get("/health/services", async () => {
    const circuitStates = getServiceStates();
    const results: Record<string, {
      status: "ok" | "error" | "circuit_open";
      responseTimeMs?: number;
      error?: string;
      circuitState: string;
    }> = {};

    // Probe all services in parallel with 3s timeout
    const probes = ALL_SERVICES.map(async (svc) => {
      const url = process.env[svc.urlEnv] || svc.fallback;
      const circuitState = circuitStates[svc.name]?.circuitState || "unknown";
      const start = Date.now();

      try {
        const response = await fetch(`${url}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        results[svc.name] = {
          status: response.ok ? "ok" : "error",
          responseTimeMs: Date.now() - start,
          circuitState,
        };
      } catch (error) {
        results[svc.name] = {
          status: circuitState === "open" ? "circuit_open" : "error",
          responseTimeMs: Date.now() - start,
          error: error instanceof Error ? error.message : "Unknown error",
          circuitState,
        };
      }
    });

    await Promise.allSettled(probes);

    const healthy = Object.values(results).filter((r) => r.status === "ok").length;
    const total = Object.keys(results).length;

    return {
      status: healthy === total ? "all_healthy" : healthy > 0 ? "degraded" : "unhealthy",
      healthy,
      total,
      websocket: {
        connections: getConnectionCount(),
        messagesIn: wsMetrics.messagesIn,
        messagesOut: wsMetrics.messagesOut,
        errors: wsMetrics.errors,
      },
      services: results,
    };
  });

  // Readiness (legacy path)
  fastify.get("/ready", async (_, reply) => {
    try {
      const redis = getRedisClient();
      await redis.ping();
      return { status: "ready" };
    } catch {
      return reply.status(503).send({ status: "not_ready" });
    }
  });
};
