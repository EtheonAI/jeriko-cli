import type { FastifyInstance } from "fastify";
import { createId } from "@repo/service-utils";
import { db, userConnectors, connectorSyncLogs, eq, desc } from "../lib/db.js";
import { logger } from "../lib/helpers.js";

export async function syncRoutes(app: FastifyInstance) {
  // Trigger sync for an integration
  app.post<{ Params: { id: string } }>("/integrations/:id/sync", async (request, reply) => {
    const { id } = request.params;
    try {
      const [integration] = await db
        .select()
        .from(userConnectors)
        .where(eq(userConnectors.id, id))
        .limit(1);

      if (!integration) {
        return reply.status(404).send({ error: "Integration not found" });
      }

      if (integration.status !== "connected") {
        return reply.status(400).send({ error: "Integration is not connected" });
      }

      // Create sync log entry
      const syncId = createId();
      await db.insert(connectorSyncLogs).values({
        id: syncId,
        userConnectorId: id,
        status: "started",
      });

      // Update status to syncing
      await db.update(userConnectors).set({ status: "syncing" }).where(eq(userConnectors.id, id));

      logger.info({ integrationId: id, syncId }, "Sync started");

      // Fire-and-forget async sync (placeholder — real logic is P2)
      performSync(id, syncId).catch((err) => {
        logger.error({ integrationId: id, syncId, error: err }, "Sync failed");
      });

      return { syncId, status: "syncing" };
    } catch (error) {
      logger.error(error, "Failed to start sync");
      return reply.status(500).send({ error: "Failed to start sync" });
    }
  });

  // Get sync status for an integration
  app.get<{ Params: { id: string } }>("/integrations/:id/sync/status", async (request, reply) => {
    const { id } = request.params;
    try {
      const [integration] = await db
        .select()
        .from(userConnectors)
        .where(eq(userConnectors.id, id))
        .limit(1);

      if (!integration) {
        return reply.status(404).send({ error: "Integration not found" });
      }

      const [latestSync] = await db
        .select()
        .from(connectorSyncLogs)
        .where(eq(connectorSyncLogs.userConnectorId, id))
        .orderBy(desc(connectorSyncLogs.startedAt))
        .limit(1);

      return {
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
        latestSync: latestSync ?? null,
      };
    } catch (error) {
      logger.error(error, "Failed to fetch sync status");
      return reply.status(500).send({ error: "Failed to fetch sync status" });
    }
  });

  // Get sync history for an integration
  app.get<{ Params: { id: string } }>("/integrations/:id/sync/history", async (request, reply) => {
    const { id } = request.params;
    const { limit: limitParam } = request.query as { limit?: string };
    const limit = Math.min(parseInt(limitParam ?? "20", 10), 100);

    try {
      const logs = await db
        .select()
        .from(connectorSyncLogs)
        .where(eq(connectorSyncLogs.userConnectorId, id))
        .orderBy(desc(connectorSyncLogs.startedAt))
        .limit(limit);

      return { logs };
    } catch (error) {
      logger.error(error, "Failed to fetch sync history");
      return reply.status(500).send({ error: "Failed to fetch sync history" });
    }
  });
}

/**
 * Placeholder async sync — marks sync as complete after a short delay.
 * Real sync logic (fetching data from Composio) is a P2 task.
 */
async function performSync(integrationId: string, syncId: string) {
  // Simulate some work
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Mark sync as success
  await db
    .update(connectorSyncLogs)
    .set({
      status: "success",
      itemsSynced: 0,
      completedAt: new Date(),
    })
    .where(eq(connectorSyncLogs.id, syncId));

  // Update integration status back to connected
  await db
    .update(userConnectors)
    .set({
      status: "connected",
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
    })
    .where(eq(userConnectors.id, integrationId));

  logger.info({ integrationId, syncId }, "Sync completed (placeholder)");
}
