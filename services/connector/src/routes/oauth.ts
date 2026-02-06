import type { FastifyInstance } from "fastify";
import { createId, getEnv } from "@repo/service-utils";
import { db, connectorDefinitions, userConnectors, eq, and } from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { getUserId, logger } from "../lib/helpers.js";

// In-memory cache for auth config IDs (toolkit → authConfigId)
const authConfigCache = new Map<string, string>();

/**
 * Get or create a Composio auth config for a given toolkit.
 * Uses env-var overrides for white-label (custom OAuth apps),
 * falls back to Composio managed auth.
 */
async function getAuthConfigId(toolkit: string): Promise<string> {
  // 1. Check env override for white-label: COMPOSIO_AUTH_CONFIG_GITHUB=ac_xxxx
  const envKey = `COMPOSIO_AUTH_CONFIG_${toolkit.toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue) return envValue;

  // 2. Check in-memory cache
  const cached = authConfigCache.get(toolkit);
  if (cached) return cached;

  // 3. Check DB (stored in connector_definitions.oauthConfig)
  const [definition] = await db
    .select()
    .from(connectorDefinitions)
    .where(eq(connectorDefinitions.type, toolkit))
    .limit(1);

  const oauthConfig = definition?.oauthConfig as Record<string, unknown> | null;
  if (oauthConfig?.composioAuthConfigId) {
    const id = oauthConfig.composioAuthConfigId as string;
    authConfigCache.set(toolkit, id);
    return id;
  }

  // 4. List existing auth configs for this toolkit first, create only if none found
  const composio = getComposioClient();
  let authConfigId: string;

  const existing = await composio.authConfigs.list({ toolkit: toolkit.toUpperCase() });
  const items = (existing as { items?: Array<{ id: string }> }).items ?? [];
  if (items.length > 0) {
    // Use the first existing auth config
    authConfigId = items[0]!.id;
  } else {
    // No auth config exists — create a managed one
    const authConfig = await composio.authConfigs.create(toolkit.toUpperCase(), {
      type: "use_composio_managed_auth",
    });
    authConfigId = authConfig.id;
  }

  // Cache in memory
  authConfigCache.set(toolkit, authConfigId);

  // Persist to DB for future restarts
  if (definition) {
    await db
      .update(connectorDefinitions)
      .set({
        oauthConfig: { ...(oauthConfig ?? {}), composioAuthConfigId: authConfigId },
      })
      .where(eq(connectorDefinitions.id, definition.id));
  }

  return authConfigId;
}

export async function oauthRoutes(app: FastifyInstance) {
  // Start OAuth flow — returns authUrl for the frontend popup
  app.get<{ Params: { type: string } }>("/connectors/:type/oauth/start", async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { type } = request.params;

      // Look up the connector definition
      const [definition] = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.type, type))
        .limit(1);

      if (!definition) {
        return reply.status(404).send({ error: `Connector type '${type}' not found` });
      }

      // Upsert a pending user_connector record
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(
          and(
            eq(userConnectors.userId, userId),
            eq(userConnectors.connectorDefinitionId, definition.id)
          )
        )
        .limit(1);

      let connectorId: string;
      if (existing) {
        connectorId = existing.id;
        // Reset to pending for re-auth
        await db
          .update(userConnectors)
          .set({ status: "pending" })
          .where(eq(userConnectors.id, existing.id));
      } else {
        connectorId = createId();
        await db.insert(userConnectors).values({
          id: connectorId,
          userId,
          connectorDefinitionId: definition.id,
          status: "pending",
        });
      }

      // Get or create a Composio auth config for this toolkit
      const authConfigId = await getAuthConfigId(type);

      // Initiate OAuth via Composio (new SDK API)
      const composio = getComposioClient();
      const appUrl = getEnv("APP_URL", "http://localhost:3000");
      const callbackUrl = `${appUrl}/api/connectors/callback?type=${type}`;

      const connRequest = await composio.connectedAccounts.initiate(userId, authConfigId, {
        callbackUrl,
      });

      // Store Composio connection request ID in metadata
      await db
        .update(userConnectors)
        .set({
          metadata: {
            ...((existing?.metadata as Record<string, unknown>) ?? {}),
            composioConnectionId: connRequest.id,
          },
        })
        .where(eq(userConnectors.id, connectorId));

      logger.info({ userId, type, connectorId, authConfigId }, "OAuth flow initiated");

      return { authUrl: connRequest.redirectUrl, connectorId };
    } catch (error) {
      logger.error(error, "Failed to start OAuth flow");
      const message = error instanceof Error ? error.message : "Failed to start OAuth flow";
      return reply.status(500).send({ error: message });
    }
  });

  // Check connection status — called by frontend after popup closes
  app.get<{ Params: { type: string } }>("/connectors/:type/status", async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { type } = request.params;

      const [definition] = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.type, type))
        .limit(1);

      if (!definition) {
        return reply.status(404).send({ error: "Connector type not found" });
      }

      const [connector] = await db
        .select()
        .from(userConnectors)
        .where(
          and(
            eq(userConnectors.userId, userId),
            eq(userConnectors.connectorDefinitionId, definition.id)
          )
        )
        .limit(1);

      if (!connector) {
        return { status: "not_found" };
      }

      // If still pending, check Composio for status update
      if (connector.status === "pending") {
        const metadata = connector.metadata as Record<string, unknown> | null;
        const composioConnectionId = metadata?.composioConnectionId as string | undefined;

        if (composioConnectionId) {
          try {
            const composio = getComposioClient();
            const account = await composio.connectedAccounts.get(composioConnectionId);
            const isActive = account.status === "ACTIVE";

            if (isActive) {
              await db
                .update(userConnectors)
                .set({
                  status: "connected",
                  metadata: { ...metadata, composioStatus: account.status },
                })
                .where(eq(userConnectors.id, connector.id));

              return { status: "connected" };
            }
          } catch {
            // Composio check failed — keep current status
          }
        }
      }

      return { status: connector.status };
    } catch (error) {
      logger.error(error, "Failed to check connection status");
      return reply.status(500).send({ error: "Failed to check status" });
    }
  });
}
