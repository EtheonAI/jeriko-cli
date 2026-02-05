import type { FastifyInstance } from "fastify";
import { createId, getEnv } from "@repo/service-utils";
import { db, connectorDefinitions, userConnectors, eq, and } from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { getUserId, logger } from "../lib/helpers.js";

export async function oauthRoutes(app: FastifyInstance) {
  // Start OAuth flow — creates a pending user_connector, returns authUrl
  app.get<{ Params: { type: string } }>("/connectors/:type/oauth/start", async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { type } = request.params;

      // Look up the connector definition by type
      const [definition] = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.type, type))
        .limit(1);

      if (!definition) {
        return reply.status(404).send({ error: `Connector type '${type}' not found` });
      }

      // Check if user already has this connector connected
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(
          and(
            eq(userConnectors.userId, userId),
            eq(userConnectors.connectorDefinitionId, definition.id),
            eq(userConnectors.status, "connected")
          )
        )
        .limit(1);

      if (existing) {
        return reply.status(409).send({ error: "Connector already connected" });
      }

      // Create a pending user_connector record
      const connectorId = createId();
      await db.insert(userConnectors).values({
        id: connectorId,
        userId,
        connectorDefinitionId: definition.id,
        status: "pending",
      });

      // Initiate OAuth via Composio
      const composio = getComposioClient();
      const appUrl = getEnv("APP_URL", "http://localhost:3000");
      const redirectUrl = `${appUrl}/api/connectors/${type}/oauth/callback`;

      const connection = await composio.connectedAccounts.initiate({
        appName: type,
        entityId: userId,
        redirectUri: redirectUrl,
      });

      // Store Composio connection ID in metadata
      await db
        .update(userConnectors)
        .set({
          metadata: {
            composioConnectionId: connection.connectedAccountId,
            composioRedirectUrl: connection.redirectUrl,
          },
        })
        .where(eq(userConnectors.id, connectorId));

      const authUrl = connection.redirectUrl;

      logger.info({ userId, type, connectorId }, "OAuth flow initiated");

      return { authUrl, connectorId };
    } catch (error) {
      logger.error(error, "Failed to start OAuth flow");
      return reply.status(500).send({ error: "Failed to start OAuth flow" });
    }
  });

  // OAuth callback — verify connection, update user_connector status
  app.get<{ Params: { type: string } }>(
    "/connectors/:type/oauth/callback",
    async (request, reply) => {
      try {
        const { type } = request.params;
        const query = request.query as Record<string, string>;
        const connectionId = query.connected_account_id || query.connectionId;

        if (!connectionId) {
          return reply.status(400).send({ error: "Missing connection ID in callback" });
        }

        // Find the pending user_connector for this type
        const [definition] = await db
          .select()
          .from(connectorDefinitions)
          .where(eq(connectorDefinitions.type, type))
          .limit(1);

        if (!definition) {
          return reply.status(404).send({ error: "Connector type not found" });
        }

        // Verify connection status via Composio
        const composio = getComposioClient();
        const connectedAccount = (await composio.connectedAccounts.get({
          connectedAccountId: connectionId,
        })) as { status?: string; entityId?: string; [key: string]: unknown };

        const isActive =
          connectedAccount.status === "ACTIVE" || connectedAccount.status === "active";

        if (!isActive) {
          logger.warn(
            { connectionId, status: connectedAccount.status },
            "OAuth connection not active"
          );
        }

        // Find and update the pending user_connector
        // Match by definition ID and the entity (user) from Composio
        const entityId = connectedAccount.entityId ?? "";

        const [pendingConnector] = await db
          .select()
          .from(userConnectors)
          .where(
            and(
              eq(userConnectors.connectorDefinitionId, definition.id),
              eq(userConnectors.userId, entityId),
              eq(userConnectors.status, "pending")
            )
          )
          .limit(1);

        if (pendingConnector) {
          await db
            .update(userConnectors)
            .set({
              status: isActive ? "connected" : "error",
              metadata: {
                ...((pendingConnector.metadata as Record<string, unknown>) ?? {}),
                composioConnectionId: connectionId,
                composioStatus: connectedAccount.status,
              },
            })
            .where(eq(userConnectors.id, pendingConnector.id));
        }

        logger.info({ type, connectionId, entityId, isActive }, "OAuth callback processed");

        // Redirect to the app's integrations page
        const appUrl = getEnv("APP_URL", "http://localhost:3000");
        return reply.redirect(`${appUrl}/settings/integrations?connected=${type}`);
      } catch (error) {
        logger.error(error, "Failed to process OAuth callback");
        return reply.status(500).send({ error: "Failed to process OAuth callback" });
      }
    }
  );
}
