import { FastifyPluginAsync } from "fastify";
import {
  successResponse,
  errorResponse,
  ErrorCodes,
  createLogger,
  createId,
} from "@repo/service-utils";

const logger = createLogger({ service: "website-database" });

// In-memory database store
const databases = new Map<string, {
  id: string;
  websiteId: string;
  provider: string;
  status: string;
  host: string | null;
  port: number | null;
  databaseName: string | null;
  username: string | null;
  connectionString: string | null;
  createdAt: Date;
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

export const databaseRoutes: FastifyPluginAsync = async (fastify) => {
  // Provision database
  fastify.post("/websites/:id/database", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };
    const body = request.body as { provider?: string } || {};

    const provider = body.provider || "tidb";
    const dbId = createId();

    // Check if database already exists
    const existing = Array.from(databases.values()).find(d => d.websiteId === websiteId);
    if (existing) {
      return reply.status(409).send(
        errorResponse({ code: "DATABASE_EXISTS", message: "Database already provisioned" }, request.id)
      );
    }

    const database = {
      id: dbId,
      websiteId,
      provider,
      status: "provisioning",
      host: null,
      port: null,
      databaseName: null,
      username: null,
      connectionString: null,
      createdAt: new Date(),
    };

    databases.set(dbId, database);

    logger.info({ websiteId, databaseId: dbId, provider, userId }, "Database provisioning started");

    // In production, this would call TiDB Cloud API
    // Simulate provisioning
    setTimeout(() => {
      const db = databases.get(dbId);
      if (db) {
        db.status = "ready";
        db.host = `gateway01.us-east-1.prod.aws.tidbcloud.com`;
        db.port = 4000;
        db.databaseName = `rubic_${websiteId.slice(0, 8)}`;
        db.username = `app_${websiteId.slice(0, 8)}`;
        // In production, password would be securely generated and encrypted
        db.connectionString = `mysql://${db.username}:****@${db.host}:${db.port}/${db.databaseName}?ssl=true`;
      }
    }, 3000);

    return reply.status(202).send(successResponse({
      databaseId: dbId,
      status: "provisioning",
      message: "Database provisioning started",
    }, request.id));
  });

  // Get database info
  fastify.get("/websites/:id/database", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };

    const database = Array.from(databases.values()).find(d => d.websiteId === websiteId);
    if (!database) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not found" }, request.id)
      );
    }

    // Don't expose full connection string in response
    return reply.send(successResponse({
      ...database,
      connectionString: database.status === "ready" ? "[HIDDEN - Use CLI to retrieve]" : null,
    }, request.id));
  });

  // Delete database
  fastify.delete("/websites/:id/database", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };

    const database = Array.from(databases.values()).find(d => d.websiteId === websiteId);
    if (!database) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not found" }, request.id)
      );
    }

    databases.delete(database.id);
    logger.info({ websiteId, databaseId: database.id, userId }, "Database deleted");

    return reply.send(successResponse({ success: true }, request.id));
  });

  // Create database branch (for preview deployments)
  fastify.post("/websites/:id/database/branch", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };
    const { branchName } = request.body as { branchName: string };

    const database = Array.from(databases.values()).find(d => d.websiteId === websiteId);
    if (!database) {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not found" }, request.id)
      );
    }

    logger.info({ websiteId, branchName, userId }, "Database branch creation requested");

    // In production, this would create a TiDB branch
    return reply.send(successResponse({
      branchName,
      status: "creating",
      message: "Database branch creation started",
    }, request.id));
  });

  // Execute SQL (for schema migrations)
  fastify.post("/websites/:id/database/execute", async (request, reply) => {
    const userId = getUserId(request);
    const { id: websiteId } = request.params as { id: string };
    const { sql } = request.body as { sql: string };

    const database = Array.from(databases.values()).find(d => d.websiteId === websiteId);
    if (!database || database.status !== "ready") {
      return reply.status(404).send(
        errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Database not ready" }, request.id)
      );
    }

    // Security: Validate SQL before execution
    const forbiddenKeywords = ["DROP DATABASE", "DROP USER", "GRANT", "REVOKE"];
    const upperSql = sql.toUpperCase();
    for (const keyword of forbiddenKeywords) {
      if (upperSql.includes(keyword)) {
        return reply.status(403).send(
          errorResponse({ code: "FORBIDDEN_SQL", message: `SQL contains forbidden keyword: ${keyword}` }, request.id)
        );
      }
    }

    logger.info({ websiteId, userId }, "SQL execution requested");

    // In production, this would execute against TiDB
    return reply.send(successResponse({
      executed: true,
      message: "SQL executed successfully (placeholder)",
    }, request.id));
  });
};
