import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, eq, and, smartHomeHubs, smartHomeEntities } from "../lib/db.js";
import { createId, successResponse, errorResponse, ErrorCodes } from "@repo/service-utils";
import { logger, getUserId } from "../lib/helpers.js";
import { HomeAssistantClient } from "../lib/homeassistant.js";

const SUPPORTED_DOMAINS = [
  "light",
  "climate",
  "sensor",
  "switch",
  "media_player",
  "lock",
  "scene",
  "cover",
] as const;

const RegisterHubSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["home_assistant"]).default("home_assistant"),
  config: z.object({
    url: z.string().url(),
    accessToken: z.string().min(1),
  }),
});

const CommandSchema = z.object({
  service: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

export const hubRoutes: FastifyPluginAsync = async (fastify) => {
  // Register a new hub
  fastify.post("/v1/hubs", async (request, reply) => {
    const userId = getUserId(request);
    const input = RegisterHubSchema.parse(request.body);

    try {
      // Test connection to HA
      const client = new HomeAssistantClient(input.config.url, input.config.accessToken);
      const test = await client.testConnection();

      if (!test.ok) {
        return reply.status(400).send(
          errorResponse(
            {
              code: ErrorCodes.VALIDATION_ERROR,
              message: "Could not connect to Home Assistant. Check URL and access token.",
            },
            request.id
          )
        );
      }

      const hubId = createId();
      const [hub] = await db
        .insert(smartHomeHubs)
        .values({
          id: hubId,
          userId,
          name: input.name,
          type: input.type,
          status: "connected",
          config: input.config,
          metadata: test.version ? { haVersion: test.version } : {},
        })
        .returning();

      logger.info({ hubId, userId }, "Smart home hub registered");

      return reply.status(201).send(successResponse(hub, request.id));
    } catch (error) {
      logger.error(error, "Failed to register hub");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to register hub" },
            request.id
          )
        );
    }
  });

  // List user's hubs
  fastify.get("/v1/hubs", async (request, reply) => {
    const userId = getUserId(request);

    try {
      const hubs = await db.select().from(smartHomeHubs).where(eq(smartHomeHubs.userId, userId));

      return reply.send(successResponse(hubs, request.id));
    } catch (error) {
      logger.error(error, "Failed to list hubs");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list hubs" },
            request.id
          )
        );
    }
  });

  // Get single hub
  fastify.get("/v1/hubs/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [hub] = await db
        .select()
        .from(smartHomeHubs)
        .where(and(eq(smartHomeHubs.id, id), eq(smartHomeHubs.userId, userId)))
        .limit(1);

      if (!hub) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Hub not found" }, request.id)
          );
      }

      return reply.send(successResponse(hub, request.id));
    } catch (error) {
      logger.error(error, "Failed to get hub");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get hub" },
            request.id
          )
        );
    }
  });

  // Delete hub + associated entities
  fastify.delete("/v1/hubs/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      // Entities cascade-delete via FK
      const [deleted] = await db
        .delete(smartHomeHubs)
        .where(and(eq(smartHomeHubs.id, id), eq(smartHomeHubs.userId, userId)))
        .returning();

      if (!deleted) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Hub not found" }, request.id)
          );
      }

      logger.info({ hubId: id, userId }, "Hub deleted");
      return reply.send(successResponse({ deleted: true }, request.id));
    } catch (error) {
      logger.error(error, "Failed to delete hub");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to delete hub" },
            request.id
          )
        );
    }
  });

  // Discover entities from HA
  fastify.post("/v1/hubs/:id/discover", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [hub] = await db
        .select()
        .from(smartHomeHubs)
        .where(and(eq(smartHomeHubs.id, id), eq(smartHomeHubs.userId, userId)))
        .limit(1);

      if (!hub || !hub.config) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Hub not found" }, request.id)
          );
      }

      const config = hub.config as { url: string; accessToken: string };
      const client = new HomeAssistantClient(config.url, config.accessToken);

      const states = await client.getStates();

      // Filter to supported domains
      const supported = states.filter((s) => {
        const domain = s.entity_id.split(".")[0];
        return SUPPORTED_DOMAINS.includes(domain as any);
      });

      // Delete existing entities for this hub, then insert fresh
      await db.delete(smartHomeEntities).where(eq(smartHomeEntities.hubId, id));

      const entities = supported.map((s) => {
        const domain = s.entity_id.split(".")[0] as (typeof SUPPORTED_DOMAINS)[number];
        const friendlyName =
          (s.attributes.friendly_name as string) ||
          s.entity_id.split(".")[1]?.replace(/_/g, " ") ||
          s.entity_id;
        return {
          id: createId(),
          hubId: id,
          entityId: s.entity_id,
          domain,
          name: friendlyName,
          areaId: (s.attributes.area_id as string) || null,
          areaName: (s.attributes.area_name as string) || null,
          state: s.state,
          attributes: s.attributes,
          lastUpdatedAt: new Date(s.last_updated),
        };
      });

      if (entities.length > 0) {
        await db.insert(smartHomeEntities).values(entities);
      }

      // Update hub
      await db
        .update(smartHomeHubs)
        .set({
          status: "connected",
          entityCount: entities.length,
          lastSyncAt: new Date(),
        })
        .where(eq(smartHomeHubs.id, id));

      logger.info({ hubId: id, entityCount: entities.length }, "Entities discovered");

      return reply.send(successResponse({ entityCount: entities.length, entities }, request.id));
    } catch (error) {
      // Mark hub as error
      await db
        .update(smartHomeHubs)
        .set({ status: "error" })
        .where(eq(smartHomeHubs.id, id))
        .catch(() => {});

      logger.error(error, "Failed to discover entities");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to discover entities" },
            request.id
          )
        );
    }
  });

  // List cached entities
  fastify.get("/v1/hubs/:id/entities", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const { domain } = request.query as { domain?: string };

    try {
      // Verify hub ownership
      const [hub] = await db
        .select()
        .from(smartHomeHubs)
        .where(and(eq(smartHomeHubs.id, id), eq(smartHomeHubs.userId, userId)))
        .limit(1);

      if (!hub) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Hub not found" }, request.id)
          );
      }

      let query = db
        .select()
        .from(smartHomeEntities)
        .where(
          domain
            ? and(eq(smartHomeEntities.hubId, id), eq(smartHomeEntities.domain, domain))
            : eq(smartHomeEntities.hubId, id)
        );

      const entities = await query;

      return reply.send(successResponse(entities, request.id));
    } catch (error) {
      logger.error(error, "Failed to list entities");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list entities" },
            request.id
          )
        );
    }
  });

  // Control an entity
  fastify.post("/v1/hubs/:id/entities/:entityId/command", async (request, reply) => {
    const userId = getUserId(request);
    const { id, entityId } = request.params as { id: string; entityId: string };
    const input = CommandSchema.parse(request.body);

    try {
      const [hub] = await db
        .select()
        .from(smartHomeHubs)
        .where(and(eq(smartHomeHubs.id, id), eq(smartHomeHubs.userId, userId)))
        .limit(1);

      if (!hub || !hub.config) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Hub not found" }, request.id)
          );
      }

      // Find the entity to get its domain
      const [entity] = await db
        .select()
        .from(smartHomeEntities)
        .where(and(eq(smartHomeEntities.hubId, id), eq(smartHomeEntities.entityId, entityId)))
        .limit(1);

      if (!entity) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Entity not found" }, request.id)
          );
      }

      const config = hub.config as { url: string; accessToken: string };
      const client = new HomeAssistantClient(config.url, config.accessToken);

      const serviceData = {
        entity_id: entityId,
        ...(input.data || {}),
      };

      const result = await client.callService(entity.domain, input.service, serviceData);

      // Update cached state from the response
      const updatedState = result.find((s) => s.entity_id === entityId);
      if (updatedState) {
        await db
          .update(smartHomeEntities)
          .set({
            state: updatedState.state,
            attributes: updatedState.attributes,
            lastUpdatedAt: new Date(updatedState.last_updated),
          })
          .where(and(eq(smartHomeEntities.hubId, id), eq(smartHomeEntities.entityId, entityId)));
      }

      logger.info({ hubId: id, entityId, service: input.service }, "Entity command sent");

      return reply.send(
        successResponse(
          {
            entityId,
            service: input.service,
            state: updatedState?.state || entity.state,
            attributes: updatedState?.attributes || entity.attributes,
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to control entity");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to control entity" },
            request.id
          )
        );
    }
  });

  // List scene entities
  fastify.get("/v1/hubs/:id/scenes", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [hub] = await db
        .select()
        .from(smartHomeHubs)
        .where(and(eq(smartHomeHubs.id, id), eq(smartHomeHubs.userId, userId)))
        .limit(1);

      if (!hub) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Hub not found" }, request.id)
          );
      }

      const scenes = await db
        .select()
        .from(smartHomeEntities)
        .where(and(eq(smartHomeEntities.hubId, id), eq(smartHomeEntities.domain, "scene")));

      return reply.send(successResponse(scenes, request.id));
    } catch (error) {
      logger.error(error, "Failed to list scenes");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list scenes" },
            request.id
          )
        );
    }
  });

  // Activate a scene
  fastify.post("/v1/hubs/:id/scenes/:entityId/activate", async (request, reply) => {
    const userId = getUserId(request);
    const { id, entityId } = request.params as { id: string; entityId: string };

    try {
      const [hub] = await db
        .select()
        .from(smartHomeHubs)
        .where(and(eq(smartHomeHubs.id, id), eq(smartHomeHubs.userId, userId)))
        .limit(1);

      if (!hub || !hub.config) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Hub not found" }, request.id)
          );
      }

      const config = hub.config as { url: string; accessToken: string };
      const client = new HomeAssistantClient(config.url, config.accessToken);

      await client.callService("scene", "turn_on", { entity_id: entityId });

      logger.info({ hubId: id, entityId }, "Scene activated");

      return reply.send(successResponse({ entityId, activated: true }, request.id));
    } catch (error) {
      logger.error(error, "Failed to activate scene");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to activate scene" },
            request.id
          )
        );
    }
  });
};
