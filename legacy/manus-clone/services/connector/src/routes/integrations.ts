import type { FastifyInstance } from "fastify";
import { db, connectorDefinitions, userConnectors, eq, and, desc, isNull } from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { logger } from "../lib/helpers.js";

export async function integrationRoutes(app: FastifyInstance) {
  // List user's integrations with definition details
  app.get<{ Params: { userId: string } }>("/users/:userId/integrations", async (request, reply) => {
    const { userId } = request.params;
    const projectId = (request.query as Record<string, string>).projectId as string | undefined;

    const projectFilter = projectId
      ? eq(userConnectors.projectId, projectId)
      : isNull(userConnectors.projectId);

    try {
      const integrations = await db
        .select({
          integration: userConnectors,
          definition: connectorDefinitions,
        })
        .from(userConnectors)
        .innerJoin(
          connectorDefinitions,
          eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
        )
        .where(and(eq(userConnectors.userId, userId), projectFilter))
        .orderBy(desc(userConnectors.createdAt));

      return { integrations };
    } catch (error) {
      logger.error(error, "Failed to fetch integrations");
      return reply.status(500).send({ error: "Failed to fetch integrations" });
    }
  });

  // Revoke and delete an integration
  app.delete<{ Params: { id: string } }>("/integrations/:id", async (request, reply) => {
    const { id } = request.params;
    try {
      // Look up the integration to get Composio connection ID
      const [integration] = await db
        .select()
        .from(userConnectors)
        .where(eq(userConnectors.id, id))
        .limit(1);

      if (!integration) {
        return reply.status(404).send({ error: "Integration not found" });
      }

      // Revoke in Composio if we have a connection ID
      const metadata = integration.metadata as Record<string, unknown> | null;
      const composioConnectionId = metadata?.composioConnectionId as string | undefined;

      if (composioConnectionId) {
        try {
          const composio = getComposioClient();
          await composio.connectedAccounts.delete(composioConnectionId);
        } catch (revokeError) {
          // Log but don't block deletion — connection may already be gone
          logger.warn(
            { composioConnectionId, error: revokeError },
            "Failed to revoke Composio connection"
          );
        }
      }

      // Delete from DB
      await db.delete(userConnectors).where(eq(userConnectors.id, id));

      logger.info({ integrationId: id }, "Integration deleted");
      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to disconnect integration");
      return reply.status(500).send({ error: "Failed to disconnect integration" });
    }
  });
}
