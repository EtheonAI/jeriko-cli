import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, eq, and, devices, deviceSessions } from "../lib/db.js";
import { createId, successResponse, errorResponse, ErrorCodes } from "@repo/service-utils";
import { logger, getUserId } from "../lib/helpers.js";
import * as connections from "../lib/connections.js";

const RegisterDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["browser", "desktop", "mobile", "server"]),
  capabilities: z.array(z.string()).optional().default([]),
  config: z.record(z.unknown()).optional().default({}),
  browserType: z.string().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});

const UpdateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  capabilities: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const deviceRoutes: FastifyPluginAsync = async (fastify) => {
  // Register a new device
  fastify.post("/v1/devices", async (request, reply) => {
    const userId = getUserId(request);
    const input = RegisterDeviceSchema.parse(request.body);

    try {
      const deviceId = createId();

      const [device] = await db
        .insert(devices)
        .values({
          id: deviceId,
          userId,
          name: input.name,
          type: input.type,
          status: "offline",
          capabilities: input.capabilities,
          config: input.config,
          browserType: input.browserType,
          metadata: input.metadata,
        })
        .returning();

      logger.info({ deviceId, userId }, "Device registered");

      return reply.status(201).send(successResponse(device, request.id));
    } catch (error) {
      logger.error(error, "Failed to register device");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to register device" },
            request.id
          )
        );
    }
  });

  // List user's devices
  fastify.get("/v1/devices", async (request, reply) => {
    const userId = getUserId(request);

    try {
      const userDevices = await db.select().from(devices).where(eq(devices.userId, userId));

      // Enrich with connection status
      const enriched = userDevices.map((d) => ({
        ...d,
        isConnected: connections.isConnected(d.id),
      }));

      return reply.send(successResponse(enriched, request.id));
    } catch (error) {
      logger.error(error, "Failed to list devices");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list devices" },
            request.id
          )
        );
    }
  });

  // Get single device
  fastify.get("/v1/devices/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      const [device] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.id, id), eq(devices.userId, userId)))
        .limit(1);

      if (!device) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Device not found" }, request.id)
          );
      }

      return reply.send(
        successResponse(
          {
            ...device,
            isConnected: connections.isConnected(device.id),
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to get device");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to get device" },
            request.id
          )
        );
    }
  });

  // Update device
  fastify.patch("/v1/devices/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };
    const input = UpdateDeviceSchema.parse(request.body);

    try {
      const updateValues: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name) updateValues.name = input.name;
      if (input.capabilities) updateValues.capabilities = input.capabilities;
      if (input.config) updateValues.config = input.config;
      if (input.metadata) updateValues.metadata = input.metadata;

      const [updated] = await db
        .update(devices)
        .set(updateValues as any)
        .where(and(eq(devices.id, id), eq(devices.userId, userId)))
        .returning();

      if (!updated) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Device not found" }, request.id)
          );
      }

      return reply.send(successResponse(updated, request.id));
    } catch (error) {
      logger.error(error, "Failed to update device");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to update device" },
            request.id
          )
        );
    }
  });

  // Delete device
  fastify.delete("/v1/devices/:id", async (request, reply) => {
    const userId = getUserId(request);
    const { id } = request.params as { id: string };

    try {
      // Close WebSocket connection
      connections.unregister(id);

      // End active sessions
      await db
        .update(deviceSessions)
        .set({ status: "ended", endedAt: new Date() })
        .where(eq(deviceSessions.deviceId, id));

      // Delete the device
      const [deleted] = await db
        .delete(devices)
        .where(and(eq(devices.id, id), eq(devices.userId, userId)))
        .returning();

      if (!deleted) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Device not found" }, request.id)
          );
      }

      logger.info({ deviceId: id, userId }, "Device unregistered");

      return reply.send(successResponse({ deleted: true }, request.id));
    } catch (error) {
      logger.error(error, "Failed to delete device");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to delete device" },
            request.id
          )
        );
    }
  });
};
