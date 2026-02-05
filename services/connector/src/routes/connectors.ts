import type { FastifyInstance } from "fastify";
import { createId } from "@repo/service-utils";
import { db, connectorDefinitions, eq } from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { logger } from "../lib/helpers.js";

export async function connectorRoutes(app: FastifyInstance) {
  // List enabled connector definitions
  app.get("/connectors", async (_request, reply) => {
    try {
      const connectors = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.isEnabled, true))
        .orderBy(connectorDefinitions.category, connectorDefinitions.name);

      return { connectors };
    } catch (error) {
      logger.error(error, "Failed to list connectors");
      return reply.status(500).send({ error: "Failed to list connectors" });
    }
  });

  // Get single connector definition by type
  app.get<{ Params: { type: string } }>("/connectors/:type", async (request, reply) => {
    try {
      const [connector] = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.type, request.params.type))
        .limit(1);

      if (!connector) {
        return reply.status(404).send({ error: "Connector type not found" });
      }

      return { connector };
    } catch (error) {
      logger.error(error, "Failed to get connector");
      return reply.status(500).send({ error: "Failed to get connector" });
    }
  });

  // Sync Composio app catalog into connector_definitions
  app.post("/connectors/sync-catalog", async (_request, reply) => {
    try {
      const composio = getComposioClient();
      const apps = await composio.apps.list();

      let upserted = 0;
      for (const app of apps) {
        const appName = app.key;
        const displayName = app.name;
        const description = app.description ?? "";

        const category = inferCategory(appName);

        await db
          .insert(connectorDefinitions)
          .values({
            id: createId(),
            type: appName.toLowerCase(),
            name: displayName,
            description,
            category,
            authType: "oauth2",
            isEnabled: true,
          })
          .onConflictDoUpdate({
            target: connectorDefinitions.type,
            set: {
              name: displayName,
              description,
              updatedAt: new Date(),
            },
          });

        upserted++;
      }

      logger.info({ upserted }, "Catalog sync complete");
      return { upserted };
    } catch (error) {
      logger.error(error, "Failed to sync catalog");
      return reply.status(500).send({ error: "Failed to sync catalog" });
    }
  });
}

function inferCategory(
  appName: string
): "communication" | "storage" | "productivity" | "development" | "crm" | "analytics" | "other" {
  const name = appName.toLowerCase();
  if (["gmail", "slack", "discord", "teams", "email"].some((k) => name.includes(k)))
    return "communication";
  if (["drive", "dropbox", "onedrive", "s3", "box", "sharepoint"].some((k) => name.includes(k)))
    return "storage";
  if (["github", "gitlab", "bitbucket", "linear", "jira"].some((k) => name.includes(k)))
    return "development";
  if (["salesforce", "hubspot", "pipedrive"].some((k) => name.includes(k))) return "crm";
  if (["analytics", "segment", "mixpanel", "amplitude"].some((k) => name.includes(k)))
    return "analytics";
  if (
    ["notion", "calendar", "confluence", "asana", "trello", "todoist"].some((k) => name.includes(k))
  )
    return "productivity";
  return "other";
}
