import { FastifyPluginAsync } from "fastify";
import { createHealthCheck, getRedisClient } from "@repo/service-utils";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  // Simple health check
  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  // Detailed health check
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

    // Check downstream services
    const services = [
      { name: "task", url: process.env.TASK_SERVICE_URL },
      { name: "agent", url: process.env.AGENT_SERVICE_URL },
      { name: "device", url: process.env.DEVICE_SERVICE_URL },
    ];

    for (const service of services) {
      if (!service.url) {
        checks.push({ name: service.name, status: "fail", message: "URL not configured" });
        continue;
      }

      try {
        const response = await fetch(`${service.url}/health`, {
          signal: AbortSignal.timeout(5000),
        });
        checks.push({
          name: service.name,
          status: response.ok ? "pass" : "fail",
          message: response.ok ? undefined : `HTTP ${response.status}`,
        });
      } catch (error) {
        checks.push({
          name: service.name,
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return createHealthCheck("gateway", "0.0.1", checks);
  });

  // Readiness check
  fastify.get("/ready", async () => {
    try {
      const redis = getRedisClient();
      await redis.ping();
      return { status: "ready" };
    } catch {
      const error = new Error("Service not ready") as Error & { statusCode: number };
      error.statusCode = 503;
      throw error;
    }
  });
};
