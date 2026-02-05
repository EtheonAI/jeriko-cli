import type { FastifyInstance } from "fastify";
import { db, connectorDefinitions, userConnectors, eq, and } from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { getUserId, logger } from "../lib/helpers.js";

interface ComposioTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  appName?: string;
  [key: string]: unknown;
}

export async function toolRoutes(app: FastifyInstance) {
  // Get ALL tools across user's connected apps — called by agent service
  app.get<{ Params: { userId: string } }>("/users/:userId/tools", async (request, reply) => {
    const { userId } = request.params;
    try {
      // Get user's connected integrations
      const integrations = await db
        .select({
          connector: userConnectors,
          definition: connectorDefinitions,
        })
        .from(userConnectors)
        .innerJoin(
          connectorDefinitions,
          eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
        )
        .where(and(eq(userConnectors.userId, userId), eq(userConnectors.status, "connected")));

      if (integrations.length === 0) {
        return { tools: [] };
      }

      // Extract app names from connected integrations
      const appNames = integrations.map((i) => i.definition.type);

      // Fetch tools from Composio for these apps
      const composio = getComposioClient();
      let tools: ComposioTool[] = [];

      try {
        const result = await composio.actions.list({
          apps: appNames.join(","),
        });
        tools = result.items.map((action) => ({
          name: action.name,
          description: action.description,
          parameters: action.parameters,
          appName: action.appName,
        }));
      } catch (composioError) {
        logger.warn(
          { error: composioError, apps: appNames },
          "Failed to fetch tools from Composio, returning empty"
        );
        return { tools: [] };
      }

      // Map to a consistent shape
      const mappedTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description ?? "",
        parameters: tool.parameters ?? {},
        appName: tool.appName ?? extractAppFromToolName(tool.name),
        source: "composio" as const,
      }));

      logger.info(
        { userId, apps: appNames.length, tools: mappedTools.length },
        "Tools fetched for user"
      );

      return { tools: mappedTools };
    } catch (error) {
      logger.error(error, "Failed to fetch user tools");
      return reply.status(500).send({ error: "Failed to fetch user tools" });
    }
  });

  // List tools for a single integration — called by frontend
  app.get<{ Params: { id: string } }>("/integrations/:id/tools", async (request, reply) => {
    const { id } = request.params;
    try {
      // Look up integration with its definition
      const [result] = await db
        .select({
          connector: userConnectors,
          definition: connectorDefinitions,
        })
        .from(userConnectors)
        .innerJoin(
          connectorDefinitions,
          eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
        )
        .where(eq(userConnectors.id, id))
        .limit(1);

      if (!result) {
        return reply.status(404).send({ error: "Integration not found" });
      }

      if (result.connector.status !== "connected") {
        return reply.status(400).send({ error: "Integration is not connected" });
      }

      const composio = getComposioClient();
      const actionsResult = await composio.actions.list({
        apps: result.definition.type,
      });

      const tools = actionsResult.items.map((action) => ({
        name: action.name,
        description: action.description ?? "",
        parameters: action.parameters ?? {},
        appName: action.appName ?? result.definition.type,
      }));

      return { tools };
    } catch (error) {
      logger.error(error, "Failed to fetch integration tools");
      return reply.status(500).send({ error: "Failed to fetch integration tools" });
    }
  });

  // Execute a Composio tool — called by agent service during tool loop
  app.post("/tools/execute", async (request, reply) => {
    try {
      const userId = getUserId(request);
      const body = request.body as {
        toolName: string;
        arguments: Record<string, unknown>;
      };

      if (!body.toolName) {
        return reply.status(400).send({ error: "Missing toolName" });
      }

      // Determine the app from the tool name (e.g., "GITHUB_CREATE_ISSUE" → "github")
      const appName = extractAppFromToolName(body.toolName);

      // Verify user has this app connected and get the Composio connection ID
      let connectedAccountId: string | undefined;

      if (appName) {
        const [definition] = await db
          .select()
          .from(connectorDefinitions)
          .where(eq(connectorDefinitions.type, appName))
          .limit(1);

        if (definition) {
          const [integration] = await db
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

          if (!integration) {
            return reply.status(403).send({
              error: `User does not have ${appName} connected`,
            });
          }

          // Extract Composio connection ID from metadata
          const metadata = integration.metadata as Record<string, unknown> | null;
          connectedAccountId = metadata?.composioConnectionId as string | undefined;
        }
      }

      // Execute via Composio actions API
      const composio = getComposioClient();
      const result = await composio.actions.execute({
        actionName: body.toolName,
        requestBody: {
          connectedAccountId,
          input: body.arguments,
          appName: appName || undefined,
        },
      });

      logger.info({ userId, tool: body.toolName }, "Tool executed");

      return {
        success: !result.error,
        result: result.data ?? {},
        error: result.error ?? undefined,
      };
    } catch (error) {
      logger.error(error, "Failed to execute tool");
      const message = error instanceof Error ? error.message : "Failed to execute tool";
      return reply.status(500).send({
        success: false,
        error: message,
      });
    }
  });
}

/**
 * Extract the app name from a Composio tool name.
 * Convention: "GITHUB_CREATE_ISSUE" → "github"
 */
function extractAppFromToolName(toolName: string): string {
  const parts = toolName.toLowerCase().split("_");
  return parts[0] ?? toolName.toLowerCase();
}
