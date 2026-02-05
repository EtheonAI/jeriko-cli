import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  connectorDefinitions,
  userConnectors,
  connectorSyncLogs,
  eq,
  and,
  desc,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";

export const connectorsRouter = createTRPCRouter({
  // List all available connector definitions
  listDefinitions: protectedProcedure.query(async () => {
    const definitions = await db
      .select()
      .from(connectorDefinitions)
      .where(eq(connectorDefinitions.isEnabled, true))
      .orderBy(connectorDefinitions.category, connectorDefinitions.name);

    return definitions;
  }),

  // List user's installed connectors
  list: protectedProcedure.query(async ({ ctx }) => {
    const connectors = await db
      .select({
        connector: userConnectors,
        definition: connectorDefinitions,
      })
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
      )
      .where(eq(userConnectors.userId, ctx.user.id))
      .orderBy(desc(userConnectors.createdAt));

    return connectors;
  }),

  // Get a single connector by ID
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [connector] = await db
      .select({
        connector: userConnectors,
        definition: connectorDefinitions,
      })
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
      )
      .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
      .limit(1);

    if (!connector) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
    }

    return connector;
  }),

  // Install a connector
  install: protectedProcedure
    .input(
      z.object({
        connectorDefinitionId: z.string(),
        organizationId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if connector definition exists
      const [definition] = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.id, input.connectorDefinitionId))
        .limit(1);

      if (!definition) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Connector definition not found",
        });
      }

      // Check if already installed
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(
          and(
            eq(userConnectors.userId, ctx.user.id),
            eq(userConnectors.connectorDefinitionId, input.connectorDefinitionId)
          )
        )
        .limit(1);

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Connector already installed",
        });
      }

      const id = createId();
      const [connector] = await db
        .insert(userConnectors)
        .values({
          id,
          userId: ctx.user.id,
          connectorDefinitionId: input.connectorDefinitionId,
          organizationId: input.organizationId,
          status: "pending",
        })
        .returning();

      return connector;
    }),

  // Update connector config
  updateConfig: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        config: z.record(z.unknown()).optional(),
        syncEnabled: z.boolean().optional(),
        syncInterval: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const [connector] = await db
        .update(userConnectors)
        .set(updates)
        .where(eq(userConnectors.id, id))
        .returning();

      return connector;
    }),

  // Save OAuth tokens
  saveTokens: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        accessToken: z.string(),
        refreshToken: z.string().optional(),
        tokenExpiresAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...tokenData } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const [connector] = await db
        .update(userConnectors)
        .set({
          ...tokenData,
          status: "connected",
        })
        .where(eq(userConnectors.id, id))
        .returning();

      return connector;
    }),

  // Disconnect a connector
  disconnect: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const [connector] = await db
        .update(userConnectors)
        .set({
          status: "disconnected",
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        })
        .where(eq(userConnectors.id, input.id))
        .returning();

      return connector;
    }),

  // Uninstall a connector
  uninstall: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(userConnectors)
        .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      await db.delete(userConnectors).where(eq(userConnectors.id, input.id));

      return { success: true };
    }),

  // Trigger sync
  sync: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [existing] = await db
      .select()
      .from(userConnectors)
      .where(and(eq(userConnectors.id, input.id), eq(userConnectors.userId, ctx.user.id)))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
    }

    if (existing.status !== "connected") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Connector is not connected",
      });
    }

    // Create sync log
    const logId = createId();
    await db.insert(connectorSyncLogs).values({
      id: logId,
      userConnectorId: input.id,
      status: "started",
    });

    // Update connector status
    await db
      .update(userConnectors)
      .set({ status: "syncing" })
      .where(eq(userConnectors.id, input.id));

    // TODO: Trigger actual sync job via queue/worker

    return { syncLogId: logId };
  }),

  // Initialize OAuth via connector service (Composio)
  initializeOAuth: protectedProcedure
    .input(
      z.object({
        type: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const connectorServiceUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

      const response = await fetch(`${connectorServiceUrl}/connectors/${input.type}/oauth/start`, {
        headers: {
          "x-user-id": ctx.user.id,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new TRPCError({
          code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
          message: (error as { error?: string }).error || "Failed to initialize OAuth",
        });
      }

      const data = (await response.json()) as {
        authUrl: string;
        connectorId: string;
      };
      return data;
    }),

  // Get tools for an integration via connector service (Composio)
  getTools: protectedProcedure
    .input(
      z.object({
        integrationId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const connectorServiceUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

      const response = await fetch(
        `${connectorServiceUrl}/integrations/${input.integrationId}/tools`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new TRPCError({
          code: response.status === 404 ? "NOT_FOUND" : "INTERNAL_SERVER_ERROR",
          message: (error as { error?: string }).error || "Failed to fetch tools",
        });
      }

      const data = (await response.json()) as {
        tools: Array<{
          name: string;
          description: string;
          parameters: Record<string, unknown>;
          appName: string;
        }>;
      };
      return data.tools;
    }),

  // Get sync history
  getSyncHistory: protectedProcedure
    .input(
      z.object({
        connectorId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify ownership
      const [connector] = await db
        .select()
        .from(userConnectors)
        .where(
          and(eq(userConnectors.id, input.connectorId), eq(userConnectors.userId, ctx.user.id))
        )
        .limit(1);

      if (!connector) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Connector not found" });
      }

      const logs = await db
        .select()
        .from(connectorSyncLogs)
        .where(eq(connectorSyncLogs.userConnectorId, input.connectorId))
        .orderBy(desc(connectorSyncLogs.startedAt))
        .limit(input.limit);

      return logs;
    }),
});
