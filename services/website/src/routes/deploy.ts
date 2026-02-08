import { FastifyPluginAsync } from "fastify";
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  createId,
} from "@repo/service-utils";
import { db, websites as websitesTable, websiteCrawlJobs, eq, and, desc } from "../lib/db.js";

const logger = createLogger({ service: "website-deploy" });

function getUserId(request: { headers: Record<string, string | string[] | undefined> }): string {
  const userId = request.headers["x-user-id"] as string | undefined;
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

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      // In production, this would spin up a WebContainer or E2B sandbox
      logger.info({ websiteId: id, userId }, "Preview requested");

      return reply.send(
        successResponse(
          {
            status: "starting",
            previewUrl: null,
            message: "Preview environment starting...",
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to start preview");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to start preview" },
            request.id
          )
        );
    }
  });

  // Get preview status
  fastify.get("/websites/:id/preview/status", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      return reply.send(
        successResponse(
          {
            status: "ready",
            previewUrl: `https://preview-${id}.rubic.dev`,
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to get preview status");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get preview status" },
            request.id
          )
        );
    }
  });

  // Deploy to production
  fastify.post("/websites/:id/deploy", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const body = (request.body as { platform?: string }) || {};

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const platform = body.platform || "vercel";

      // Use crawl jobs table to track deployments
      const [deployment] = await db
        .insert(websiteCrawlJobs)
        .values({
          id: createId(),
          websiteId: id,
          status: "queued",
          config: { platform, deployedBy: userId },
        })
        .returning();

      logger.info(
        { websiteId: id, deploymentId: deployment!.id, platform, userId },
        "Deployment started"
      );

      return reply.status(202).send(
        successResponse(
          {
            deploymentId: deployment!.id,
            status: "queued",
            message: "Deployment started",
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to deploy");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to deploy" },
            request.id
          )
        );
    }
  });

  // Get deployment status
  fastify.get("/websites/:id/deployments/:deploymentId", async (request, reply) => {
    getUserId(request);
    const { deploymentId } = request.params as { id: string; deploymentId: string };

    try {
      const [deployment] = await db
        .select()
        .from(websiteCrawlJobs)
        .where(eq(websiteCrawlJobs.id, deploymentId))
        .limit(1);

      if (!deployment) {
        return reply
          .status(404)
          .send(
            errorResponse(
              { code: ErrorCodes.NOT_FOUND, message: "Deployment not found" },
              request.id
            )
          );
      }

      return reply.send(successResponse(deployment, request.id));
    } catch (error) {
      logger.error(error, "Failed to get deployment");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get deployment" },
            request.id
          )
        );
    }
  });

  // List deployments
  fastify.get("/websites/:id/deployments", async (request, reply) => {
    getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const deployments = await db
        .select()
        .from(websiteCrawlJobs)
        .where(eq(websiteCrawlJobs.websiteId, id))
        .orderBy(desc(websiteCrawlJobs.createdAt));

      return reply.send(successResponse(deployments, request.id));
    } catch (error) {
      logger.error(error, "Failed to list deployments");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list deployments" },
            request.id
          )
        );
    }
  });

  // Configure custom domain
  fastify.post("/websites/:id/domain", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const { domain } = request.body as { domain: string };

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, id), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      await db
        .update(websitesTable)
        .set({
          domain,
          metadata: {
            ...((website.metadata as object) || {}),
            customDomainStatus: "pending_verification",
          },
        })
        .where(eq(websitesTable.id, id));

      logger.info({ websiteId: id, domain, userId }, "Custom domain configuration requested");

      return reply.send(
        successResponse(
          {
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
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to configure domain");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to configure domain" },
            request.id
          )
        );
    }
  });
};
