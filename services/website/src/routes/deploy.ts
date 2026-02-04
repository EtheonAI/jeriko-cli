import { FastifyPluginAsync } from "fastify";
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  createId,
} from "@repo/service-utils";

const logger = createLogger({ service: "website-deploy" });

// In-memory deployments store
const deployments = new Map<string, {
  id: string;
  websiteId: string;
  platform: string;
  status: string;
  url: string | null;
  buildLogs: string[];
  createdAt: Date;
  completedAt: Date | null;
}>();

function getUserId(request: { headers: { "x-user-id"?: string } }): string {
  const userId = request.headers["x-user-id"];
  if (!userId) {
    const error = new Error("Unauthorized") as Error & { statusCode: number; code: string };
    error.statusCode = 401;
    error.code = ErrorCodes.UNAUTHORIZED;
    throw error;
  }
  return userId;
}

export const deployRoutes: FastifyPluginAsync = async (fastify) => {
  // Start preview
  fastify.post("/websites/:id/preview", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    // In production, this would spin up a WebContainer or E2B sandbox
    // For now, return a placeholder
    logger.info({ websiteId: id, userId }, "Preview requested");

    return reply.send(successResponse({
      status: "starting",
      previewUrl: null, // Would be set when preview is ready
      message: "Preview environment starting...",
    }, request.id));
  });

  // Get preview status
  fastify.get("/websites/:id/preview/status", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    // Placeholder response
    return reply.send(successResponse({
      status: "ready",
      previewUrl: `https://preview-${id}.rubic.dev`,
    }, request.id));
  });

  // Deploy to production
  fastify.post("/websites/:id/deploy", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const body = request.body as { platform?: string } || {};

    const platform = body.platform || "vercel";
    const deploymentId = createId();

    const deployment = {
      id: deploymentId,
      websiteId: id,
      platform,
      status: "queued",
      url: null,
      buildLogs: ["Deployment queued..."],
      createdAt: new Date(),
      completedAt: null,
    };

    deployments.set(deploymentId, deployment);

    logger.info({ websiteId: id, deploymentId, platform, userId }, "Deployment started");

    // In production, this would:
    // 1. Package files
    // 2. Call Vercel/Netlify API
    // 3. Return deployment status

    // Simulate deployment progress
    setTimeout(() => {
      const d = deployments.get(deploymentId);
      if (d) {
        d.status = "building";
        d.buildLogs.push("Installing dependencies...");
      }
    }, 1000);

    setTimeout(() => {
      const d = deployments.get(deploymentId);
      if (d) {
        d.buildLogs.push("Building application...");
      }
    }, 3000);

    setTimeout(() => {
      const d = deployments.get(deploymentId);
      if (d) {
        d.status = "ready";
        d.url = `https://${id}.vercel.app`;
        d.buildLogs.push("Deployment complete!");
        d.completedAt = new Date();
      }
    }, 5000);

    return reply.status(202).send(successResponse({
      deploymentId,
      status: "queued",
      message: "Deployment started",
    }, request.id));
  });

  // Get deployment status
  fastify.get("/websites/:id/deployments/:deploymentId", async (request, reply) => {
    const userId = getUserId(request);
    const { deploymentId } = request.params as { id: string; deploymentId: string };

    const deployment = deployments.get(deploymentId);
    if (!deployment) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Deployment not found" }, request.id)
      );
    }

    return reply.send(successResponse(deployment, request.id));
  });

  // List deployments
  fastify.get("/websites/:id/deployments", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    const websiteDeployments = Array.from(deployments.values())
      .filter(d => d.websiteId === id)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return reply.send(successResponse(websiteDeployments, request.id));
  });

  // Configure custom domain
  fastify.post("/websites/:id/domain", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const { domain } = request.body as { domain: string };

    logger.info({ websiteId: id, domain, userId }, "Custom domain configuration requested");

    // In production, this would:
    // 1. Verify domain ownership
    // 2. Configure DNS records
    // 3. Provision SSL certificate

    return reply.send(successResponse({
      domain,
      status: "pending_verification",
      dnsRecords: [
        {
          type: "CNAME",
          name: domain,
          value: "cname.vercel-dns.com",
        },
      ],
      message: "Please add the DNS records to verify domain ownership",
    }, request.id));
  });
};
