import { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    return {
      status: "ok",
      service: "orchestrator",
      version: "0.0.1",
    };
  });

  fastify.get("/health/ready", async () => {
    return {
      status: "ready",
      service: "orchestrator",
    };
  });

  fastify.get("/health/live", async () => {
    return {
      status: "ok",
      service: "orchestrator",
    };
  });
};
