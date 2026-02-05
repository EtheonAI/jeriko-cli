import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";

const HUB_SERVICE_URL = process.env.DEVICE_SERVICE_URL
  ? process.env.DEVICE_SERVICE_URL.replace(/\/v1\/devices$/, "/v1/hubs")
  : "http://localhost:4001/v1/hubs";

async function fetchHubService<T>(
  endpoint: string,
  options: RequestInit = {},
  userId: string
): Promise<T> {
  const url = `${HUB_SERVICE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: { message: "Request failed" } }));
    const message =
      body?.error?.message || body?.message || `Hub service error: ${response.status}`;
    throw new TRPCError({
      code:
        response.status === 404
          ? "NOT_FOUND"
          : response.status === 400
            ? "BAD_REQUEST"
            : response.status === 403
              ? "FORBIDDEN"
              : "INTERNAL_SERVER_ERROR",
      message,
    });
  }

  const json = await response.json();
  return json.data as T;
}

export const smartHomeRouter = createTRPCRouter({
  // List user's hubs
  listHubs: protectedProcedure.query(async ({ ctx }) => {
    try {
      const hubs = await fetchHubService<Hub[]>("", {}, ctx.user.id);
      return hubs || [];
    } catch (error) {
      console.error("Hub service error:", error);
      return [];
    }
  }),

  // Register a new hub
  registerHub: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(["home_assistant"]).default("home_assistant"),
        config: z.object({
          url: z.string().url(),
          accessToken: z.string().min(1),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return fetchHubService<Hub>(
        "",
        {
          method: "POST",
          body: JSON.stringify(input),
        },
        ctx.user.id
      );
    }),

  // Delete a hub
  deleteHub: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await fetchHubService<void>(`/${input.id}`, { method: "DELETE" }, ctx.user.id);
      return { success: true };
    }),

  // Discover entities from HA
  discoverEntities: protectedProcedure
    .input(z.object({ hubId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return fetchHubService<DiscoverResult>(
        `/${input.hubId}/discover`,
        { method: "POST" },
        ctx.user.id
      );
    }),

  // List cached entities
  listEntities: protectedProcedure
    .input(
      z.object({
        hubId: z.string(),
        domain: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const params = input.domain ? `?domain=${input.domain}` : "";
      try {
        const entities = await fetchHubService<Entity[]>(
          `/${input.hubId}/entities${params}`,
          {},
          ctx.user.id
        );
        return entities || [];
      } catch (error) {
        console.error("Entity list error:", error);
        return [];
      }
    }),

  // Control an entity
  controlEntity: protectedProcedure
    .input(
      z.object({
        hubId: z.string(),
        entityId: z.string(),
        service: z.string(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return fetchHubService<EntityCommandResult>(
        `/${input.hubId}/entities/${encodeURIComponent(input.entityId)}/command`,
        {
          method: "POST",
          body: JSON.stringify({
            service: input.service,
            data: input.data,
          }),
        },
        ctx.user.id
      );
    }),

  // List scenes
  listScenes: protectedProcedure
    .input(z.object({ hubId: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        const scenes = await fetchHubService<Entity[]>(`/${input.hubId}/scenes`, {}, ctx.user.id);
        return scenes || [];
      } catch (error) {
        console.error("Scenes list error:", error);
        return [];
      }
    }),

  // Activate a scene
  activateScene: protectedProcedure
    .input(
      z.object({
        hubId: z.string(),
        entityId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return fetchHubService<{ entityId: string; activated: boolean }>(
        `/${input.hubId}/scenes/${encodeURIComponent(input.entityId)}/activate`,
        { method: "POST" },
        ctx.user.id
      );
    }),
});

// Types for hub service responses
interface Hub {
  id: string;
  userId: string;
  organizationId?: string | null;
  name: string;
  type: "home_assistant";
  status: "connected" | "disconnected" | "error";
  config?: { url: string; accessToken: string } | null;
  lastSyncAt?: string | null;
  entityCount: number;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface Entity {
  id: string;
  hubId: string;
  entityId: string;
  domain: string;
  name: string;
  areaId?: string | null;
  areaName?: string | null;
  state?: string | null;
  attributes?: Record<string, unknown> | null;
  lastUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EntityCommandResult {
  entityId: string;
  service: string;
  state: string;
  attributes: Record<string, unknown>;
}

interface DiscoverResult {
  entityCount: number;
  entities: Entity[];
}
