import type { FastifyInstance } from "fastify";
import { db, connectorDefinitions, userConnectors, eq, and } from "../lib/db.js";
import { getComposioClient, resolveToolkitVersions, getToolkitVersion } from "../lib/composio.js";
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

        // Composio SDK returns OpenAI function-calling format:
        // [{ type: "function", function: { name, description, parameters } }]
        const mappedTools = (
          tools as Array<{
            type?: string;
            function?: {
              name?: string;
              description?: string;
              parameters?: Record<string, unknown>;
            };
            // Legacy fields (older SDK versions)
            name?: string;
            slug?: string;
            description?: string;
            inputParameters?: Record<string, unknown>;
          }>
        ).map((tool) => {
          const fn = tool.function;
          const name = fn?.name ?? tool.slug ?? tool.name ?? "";
          return {
            name,
            description: fn?.description ?? tool.description ?? "",
            parameters: fn?.parameters ?? tool.inputParameters ?? {},
            appName: extractAppFromToolName(name),
            source: "composio" as const,
          };
        });

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
          type?: string;
          function?: {
            name?: string;
            description?: string;
            parameters?: Record<string, unknown>;
          };
          name?: string;
          slug?: string;
          description?: string;
          inputParameters?: Record<string, unknown>;
        }>
      ).map((tool) => {
        const fn = tool.function;
        return {
          name: fn?.name ?? tool.slug ?? tool.name ?? "",
          description: fn?.description ?? tool.description ?? "",
          parameters: fn?.parameters ?? tool.inputParameters ?? {},
          appName: result.definition.type,
        };
      });

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

      // Execute via Composio SDK (v0.6.3+ requires pinned toolkit version)
      const composio = getComposioClient();
      await resolveToolkitVersions();
      const version = getToolkitVersion(appName);
      const result = await composio.tools.execute(body.toolName, {
        userId,
        arguments: body.arguments,
        ...(version ? { version } : { dangerouslySkipVersionCheck: true }),
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
