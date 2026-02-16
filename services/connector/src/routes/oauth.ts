import type { FastifyInstance } from "fastify";
import { createId, getEnv } from "@repo/service-utils";
import { db, connectorDefinitions, userConnectors, eq, and } from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { getUserId, logger } from "../lib/helpers.js";

// In-memory cache for auth config IDs (toolkit → authConfigId)
const authConfigCache = new Map<string, string>();

/**
 * Get or create a Composio auth config for a given toolkit.
 * Accepts an optional pre-fetched definition to avoid redundant DB queries.
 */
async function getAuthConfigId(
  toolkit: string,
  prefetchedDefinition?: { oauthConfig: unknown; id: string } | null
): Promise<string> {
  // 1. Check env override for white-label: COMPOSIO_AUTH_CONFIG_GITHUB=ac_xxxx
  const envKey = `COMPOSIO_AUTH_CONFIG_${toolkit.toUpperCase()}`;
  const envValue = process.env[envKey];
  if (envValue) return envValue;

  // 2. Check in-memory cache
  const cached = authConfigCache.get(toolkit);
  if (cached) return cached;

  // 3. Check DB (stored in connector_definitions.oauthConfig) — reuse prefetched if available
  const definition = prefetchedDefinition ?? (
    await db
      .select({ oauthConfig: connectorDefinitions.oauthConfig, id: connectorDefinitions.id })
      .from(connectorDefinitions)
      .where(eq(connectorDefinitions.type, toolkit))
      .limit(1)
  )[0];

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
    authConfigId = items[0]!.id;
  } else {
    const authConfig = await composio.authConfigs.create(toolkit.toUpperCase(), {
      type: "use_composio_managed_auth",
    });
    authConfigId = authConfig.id;
  }

  // Cache in memory
  authConfigCache.set(toolkit, authConfigId);

  // Persist to DB for future restarts (fire-and-forget)
  if (definition) {
    db.update(connectorDefinitions)
      .set({
        oauthConfig: { ...(oauthConfig ?? {}), composioAuthConfigId: authConfigId } as typeof connectorDefinitions.$inferInsert.oauthConfig,
      })
      .where(eq(connectorDefinitions.id, definition.id))
      .catch(() => {});
  }

  return authConfigId;
}

export async function oauthRoutes(app: FastifyInstance) {
  // Start OAuth flow — returns authUrl for the frontend popup
  app.get<{ Params: { type: string } }>("/connectors/:type/oauth/start", async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { type } = request.params;

      // Parallel: look up definition + existing user connector at the same time
      const [[definition], [existing]] = await Promise.all([
        db
          .select()
          .from(connectorDefinitions)
          .where(eq(connectorDefinitions.type, type))
          .limit(1),
        db
          .select()
          .from(userConnectors)
          .innerJoin(
            connectorDefinitions,
            eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
          )
          .where(
            and(
              eq(userConnectors.userId, userId),
              eq(connectorDefinitions.type, type)
            )
          )
          .limit(1),
      ]);

      if (!definition) {
        return reply.status(404).send({ error: `Connector type '${type}' not found` });
      }

      // Reject non-OAuth connectors — they should use the API key or credentials flow
      if (definition.authType !== "oauth2") {
        return reply.status(400).send({
          error: `${definition.name} uses ${definition.authType} authentication, not OAuth. Please provide your API key directly.`,
          authType: definition.authType,
        });
      }

      // Upsert user_connector + get auth config ID in parallel
      const existingConnector = existing?.user_connectors;
      let connectorId: string;

      const authConfigPromise = getAuthConfigId(type, definition);

      if (existingConnector) {
        connectorId = existingConnector.id;
        await Promise.all([
          db
            .update(userConnectors)
            .set({ status: "pending" })
            .where(eq(userConnectors.id, existingConnector.id)),
          authConfigPromise,
        ]);
      } else {
        connectorId = createId();
        await Promise.all([
          db.insert(userConnectors).values({
            id: connectorId,
            userId,
            connectorDefinitionId: definition.id,
            status: "pending",
          }),
          authConfigPromise,
        ]);
      }

      const authConfigId = await authConfigPromise;

      // Initiate OAuth via Composio
      const composio = getComposioClient();
      const appUrl = getEnv("APP_URL", "http://localhost:3000");
      const callbackUrl = `${appUrl}/api/connectors/callback?type=${type}`;

      const connRequest = await composio.connectedAccounts.initiate(userId, authConfigId, {
        callbackUrl,
        allowMultiple: true,
      });

      // Store Composio connection request ID (fire-and-forget — don't block response)
      db.update(userConnectors)
        .set({
          metadata: {
            ...((existingConnector?.metadata as Record<string, unknown>) ?? {}),
            composioConnectionId: connRequest.id,
          },
        })
        .where(eq(userConnectors.id, connectorId))
        .catch(() => {});

      logger.info({ userId, type, connectorId, authConfigId }, "OAuth flow initiated");

      return { authUrl: connRequest.redirectUrl, connectorId };
    } catch (error) {
      logger.error(error, "Failed to start OAuth flow");
      const message = error instanceof Error ? error.message : "Failed to start OAuth flow";
      return reply.status(500).send({ error: message });
    }
  });

  // Check connection status — called by frontend after popup closes.
  // Uses Composio waitForConnection for pending connections (polls up to 15s).
  app.get<{ Params: { type: string } }>("/connectors/:type/status", async (request, reply) => {
    try {
      const userId = getUserId(request);
      const { type } = request.params;

      // Single join query instead of two separate queries
      const [result] = await db
        .select({
          connector: userConnectors,
        })
        .from(userConnectors)
        .innerJoin(
          connectorDefinitions,
          eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
        )
        .where(
          and(
            eq(userConnectors.userId, userId),
            eq(connectorDefinitions.type, type)
          )
        )
        .limit(1);

      if (!result) {
        return { status: "not_found" };
      }

      const connector = result.connector;

      // If still pending, wait for Composio to confirm the connection
      if (connector.status === "pending") {
        const metadata = connector.metadata as Record<string, unknown> | null;
        const composioConnectionId = metadata?.composioConnectionId as string | undefined;

        if (composioConnectionId) {
          const composio = getComposioClient();

          try {
            // waitForConnection polls Composio until status is ACTIVE (max 15s)
            const account = await composio.connectedAccounts.waitForConnection(
              composioConnectionId,
              15_000
            );

            // Update DB — connection is active
            await db
              .update(userConnectors)
              .set({
                status: "connected",
                metadata: {
                  ...metadata,
                  composioStatus: account.status,
                  composioConnectionId,
                },
              })
              .where(eq(userConnectors.id, connector.id));

            logger.info({ userId, type, composioConnectionId }, "Connector connected via waitForConnection");
            return { status: "connected" };
          } catch {
            // waitForConnection timed out or failed — try a single get() check
            try {
              const account = await composio.connectedAccounts.get(composioConnectionId);
              const composioStatus = (account as { status?: string }).status;

              if (composioStatus === "ACTIVE") {
                await db
                  .update(userConnectors)
                  .set({
                    status: "connected",
                    metadata: { ...metadata, composioStatus, composioConnectionId },
                  })
                  .where(eq(userConnectors.id, connector.id));
                return { status: "connected" };
              }

              if (composioStatus === "FAILED" || composioStatus === "EXPIRED") {
                await db
                  .update(userConnectors)
                  .set({
                    status: "error",
                    metadata: { ...metadata, composioStatus, composioConnectionId },
                  })
                  .where(eq(userConnectors.id, connector.id));
                return { status: "error" };
              }

              // Still INITIATED or INITIALIZING — keep pending
              return { status: "pending" };
            } catch {
              // Composio unreachable — keep current status
              return { status: connector.status };
            }
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
