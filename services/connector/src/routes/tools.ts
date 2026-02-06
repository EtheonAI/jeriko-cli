import type { FastifyInstance } from "fastify";
import { db, connectorDefinitions, userConnectors, eq, and } from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { getUserId, logger } from "../lib/helpers.js";

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

      // Extract toolkit names from connected integrations
      const toolkitNames = integrations.map((i) => i.definition.type.toUpperCase());

      // Fetch tools from Composio for these toolkits (new SDK)
      const composio = getComposioClient();
      try {
        const tools = await composio.tools.get(userId, {
          toolkits: toolkitNames,
        });

        const mappedTools = (
          tools as Array<{
            name?: string;
            description?: string;
            inputParameters?: Record<string, unknown>;
            slug?: string;
          }>
        ).map((tool) => ({
          name: tool.slug ?? tool.name ?? "",
          description: tool.description ?? "",
          parameters: tool.inputParameters ?? {},
          appName: extractAppFromToolName(tool.slug ?? tool.name ?? ""),
          source: "composio" as const,
        }));

        logger.info(
          { userId, toolkits: toolkitNames.length, tools: mappedTools.length },
          "Tools fetched for user"
        );

        return { tools: mappedTools };
      } catch (composioError) {
        logger.warn(
          { error: composioError, toolkits: toolkitNames },
          "Failed to fetch tools from Composio, returning empty"
        );
        return { tools: [] };
      }
    } catch (error) {
      logger.error(error, "Failed to fetch user tools");
      return reply.status(500).send({ error: "Failed to fetch user tools" });
    }
  });

  // List tools for a single integration — called by frontend
  app.get<{ Params: { id: string } }>("/integrations/:id/tools", async (request, reply) => {
    const { id } = request.params;
    try {
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
      const userId = result.connector.userId;
      const toolkitName = result.definition.type.toUpperCase();

      const tools = await composio.tools.get(userId, {
        toolkits: [toolkitName],
      });

      const mappedTools = (
        tools as Array<{
          name?: string;
          description?: string;
          inputParameters?: Record<string, unknown>;
          slug?: string;
        }>
      ).map((tool) => ({
        name: tool.slug ?? tool.name ?? "",
        description: tool.description ?? "",
        parameters: tool.inputParameters ?? {},
        appName: result.definition.type,
      }));

      return { tools: mappedTools };
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

      const appName = extractAppFromToolName(body.toolName);

      // Verify user has this app connected
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
        }
      }

      // Execute via new Composio SDK
      const composio = getComposioClient();
      const result = await composio.tools.execute(body.toolName, {
        userId,
        arguments: body.arguments,
      });

      logger.info({ userId, tool: body.toolName }, "Tool executed");

      return {
        success: !(result as { error?: string }).error,
        result: (result as { data?: Record<string, unknown> }).data ?? result ?? {},
        error: (result as { error?: string }).error ?? undefined,
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
