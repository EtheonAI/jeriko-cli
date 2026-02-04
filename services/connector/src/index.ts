import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "connector" });

async function main() {
  const port = parseInt(getEnv("PORT", "4009"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "connector" };
  });

  // List available connectors
  app.get("/connectors", async (request, reply) => {
    return {
      connectors: [
        { id: "google-drive", name: "Google Drive", type: "storage", status: "available" },
        { id: "github", name: "GitHub", type: "code", status: "available" },
        { id: "slack", name: "Slack", type: "communication", status: "available" },
        { id: "notion", name: "Notion", type: "productivity", status: "available" },
        { id: "confluence", name: "Confluence", type: "productivity", status: "available" },
      ],
    };
  });

  // Get user's connected integrations
  app.get("/users/:userId/integrations", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // TODO: Fetch from database
    return { integrations: [] };
  });

  // Start OAuth flow for connector
  app.get("/connectors/:connectorId/oauth/start", async (request, reply) => {
    const { connectorId } = request.params as { connectorId: string };
    const { redirectUri, userId } = request.query as {
      redirectUri: string;
      userId: string;
    };

    // TODO: Generate OAuth URL
    const state = crypto.randomUUID();
    const authUrl = `https://oauth.example.com/${connectorId}/authorize?state=${state}`;

    return { authUrl, state };
  });

  // OAuth callback
  app.get("/connectors/:connectorId/oauth/callback", async (request, reply) => {
    const { connectorId } = request.params as { connectorId: string };
    const { code, state } = request.query as { code: string; state: string };

    // TODO: Exchange code for tokens and save
    const integrationId = crypto.randomUUID();

    return { integrationId, status: "connected" };
  });

  // Disconnect integration
  app.delete("/integrations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Revoke tokens and delete from database
    return { deleted: true };
  });

  // Sync integration data
  app.post("/integrations/:id/sync", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Queue sync job
    const syncId = crypto.randomUUID();

    logger.info({ integrationId: id, syncId }, "Sync started");

    return { syncId, status: "syncing" };
  });

  // Get sync status
  app.get("/integrations/:id/sync/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch sync status
    return { status: "idle", lastSyncAt: null };
  });

  // Get integration data
  app.get("/integrations/:id/data", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { type, cursor, limit } = request.query as {
      type?: string;
      cursor?: string;
      limit?: number;
    };

    // TODO: Fetch synced data
    return { items: [], cursor: null };
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
    }, "Incoming request");
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info({
      requestId: request.id,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, "Request completed");
  });

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Connector service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

main();
