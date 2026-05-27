import { FastifyPluginAsync } from "fastify";
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  createId,
} from "@repo/service-utils";
import { db, websites as websitesTable, eq, and } from "../lib/db.js";

const logger = createLogger({ service: "website-database" });

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

export const databaseRoutes: FastifyPluginAsync = async (fastify) => {
  // Provision database
  fastify.post("/websites/:id/database", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };
    const body = (request.body as { provider?: string }) || {};

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, websiteId), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const existingMeta = (website.metadata as Record<string, unknown>) || {};
      if (existingMeta.databaseId) {
        return reply
          .status(409)
          .send(
            errorResponse(
              { code: "DATABASE_EXISTS", message: "Database already provisioned" },
              request.id
            )
          );
      }

      const provider = body.provider || "tidb";
      const dbId = createId();

      // Store database info in website metadata
      await db
        .update(websitesTable)
        .set({
          metadata: {
            ...existingMeta,
            databaseId: dbId,
            databaseProvider: provider,
            databaseStatus: "provisioning",
          },
        })
        .where(eq(websitesTable.id, websiteId));

      logger.info(
        { websiteId, databaseId: dbId, provider, userId },
        "Database provisioning started"
      );

      return reply.status(202).send(
        successResponse(
          {
            databaseId: dbId,
            status: "provisioning",
            message: "Database provisioning started",
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to provision database");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to provision database" },
            request.id
          )
        );
    }
  });

  // Get database info
  fastify.get("/websites/:id/database", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, websiteId), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const meta = (website.metadata as Record<string, unknown>) || {};
      if (!meta.databaseId) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not found" }, request.id)
          );
      }

      return reply.send(
        successResponse(
          {
            id: meta.databaseId,
            websiteId,
            provider: meta.databaseProvider,
            status: meta.databaseStatus,
            host: meta.databaseHost || null,
            port: meta.databasePort || null,
            databaseName: meta.databaseName || null,
            connectionString:
              meta.databaseStatus === "ready" ? "[HIDDEN - Use CLI to retrieve]" : null,
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to get database info");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get database info" },
            request.id
          )
        );
    }
  });

  // Delete database
  fastify.delete("/websites/:id/database", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, websiteId), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const meta = (website.metadata as Record<string, unknown>) || {};
      if (!meta.databaseId) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not found" }, request.id)
          );
      }

      // Remove database info from metadata
      const {
        databaseId,
        databaseProvider,
        databaseStatus,
        databaseHost,
        databasePort,
        databaseName,
        ...restMeta
      } = meta;

      await db
        .update(websitesTable)
        .set({ metadata: restMeta })
        .where(eq(websitesTable.id, websiteId));

      logger.info({ websiteId, databaseId: meta.databaseId, userId }, "Database deleted");

      return reply.send(successResponse({ success: true }, request.id));
    } catch (error) {
      logger.error(error, "Failed to delete database");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to delete database" },
            request.id
          )
        );
    }
  });

  // Create database branch (for preview deployments)
  fastify.post("/websites/:id/database/branch", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };
    const { branchName } = request.body as { branchName: string };

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, websiteId), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const meta = (website.metadata as Record<string, unknown>) || {};
      if (!meta.databaseId) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not found" }, request.id)
          );
      }

      logger.info({ websiteId, branchName, userId }, "Database branch creation requested");

      // In production, this would create a TiDB branch
      return reply.send(
        successResponse(
          {
            branchName,
            status: "creating",
            message: "Database branch creation started",
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to create database branch");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to create branch" },
            request.id
          )
        );
    }
  });

  // Execute SQL (for schema migrations)
  fastify.post("/websites/:id/database/execute", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };
    const { sql: sqlQuery } = request.body as { sql: string };

    try {
      const [website] = await db
        .select()
        .from(websitesTable)
        .where(and(eq(websitesTable.id, websiteId), eq(websitesTable.userId, userId)))
        .limit(1);

      if (!website) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Website not found" }, request.id)
          );
      }

      const meta = (website.metadata as Record<string, unknown>) || {};
      if (!meta.databaseId || meta.databaseStatus !== "ready") {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not ready" }, request.id)
          );
      }

      // Security: Validate SQL before execution
      const forbiddenKeywords = ["DROP DATABASE", "DROP USER", "GRANT", "REVOKE"];
      const upperSql = sqlQuery.toUpperCase();
      for (const keyword of forbiddenKeywords) {
        if (upperSql.includes(keyword)) {
          return reply
            .status(403)
            .send(
              errorResponse(
                { code: "FORBIDDEN_SQL", message: `SQL contains forbidden keyword: ${keyword}` },
                request.id
              )
            );
        }
      }

      logger.info({ websiteId, userId }, "SQL execution requested");

      // In production, this would execute against TiDB
      return reply.send(
        successResponse(
          {
            executed: true,
            message: "SQL executed successfully (placeholder)",
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to execute SQL");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to execute SQL" },
            request.id
          )
        );
    }
  });
};
