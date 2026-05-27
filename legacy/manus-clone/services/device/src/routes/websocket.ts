import { FastifyPluginAsync } from "fastify";
import { db, eq, devices, deviceCommands } from "../lib/db.js";
import { publish } from "@repo/service-utils";
import { logger } from "../lib/helpers.js";
import * as connections from "../lib/connections.js";

interface WsMessage {
  type: string;
  deviceId?: string;
  commandId?: string;
  status?: string;
  result?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/v1/ws", { websocket: true }, (socket, request) => {
    const userId = request.headers["x-user-id"] as string;
    const deviceId = (request.query as { deviceId?: string }).deviceId;

    if (!userId || !deviceId) {
      socket.close(4001, "Missing userId or deviceId");
      return;
    }

    // Register the connection
    connections.register(deviceId, socket, userId);

    // Mark device as online
    db.update(devices)
      .set({
        status: "online",
        lastHeartbeat: new Date(),
        connectionId: request.id,
        updatedAt: new Date(),
      })
      .where(eq(devices.id, deviceId))
      .then(() => {
        publish(`user:${userId}`, {
          type: "device:status",
          data: { deviceId, status: "online", lastHeartbeat: new Date().toISOString() },
        });
      })
      .catch((err: unknown) => logger.error(err, "Failed to update device status on connect"));

    socket.on("message", async (raw) => {
      try {
        const msg: WsMessage = JSON.parse(raw.toString());

        switch (msg.type) {
          case "command_result": {
            if (!msg.commandId) break;

            const updateData: Record<string, unknown> = {
              status: msg.status === "error" ? "failed" : "completed",
              completedAt: new Date(),
            };
            if (msg.result) updateData.result = msg.result;
            if (msg.error) updateData.error = msg.error;

            await db
              .update(deviceCommands)
              .set(updateData as any)
              .where(eq(deviceCommands.id, msg.commandId));

            await publish(`user:${userId}`, {
              type: "device:command:update",
              data: {
                deviceId,
                commandId: msg.commandId,
                status: updateData.status,
                result: msg.result,
                error: msg.error,
              },
            });
            break;
          }

          case "heartbeat": {
            await db
              .update(devices)
              .set({ lastHeartbeat: new Date(), status: "online", updatedAt: new Date() })
              .where(eq(devices.id, deviceId));
            break;
          }

          case "status": {
            const newStatus = msg.status as string;
            if (["online", "offline", "busy", "error"].includes(newStatus)) {
              await db
                .update(devices)
                .set({ status: newStatus as any, updatedAt: new Date() })
                .where(eq(devices.id, deviceId));

              await publish(`user:${userId}`, {
                type: "device:status",
                data: { deviceId, status: newStatus },
              });
            }
            break;
          }

          case "error": {
            logger.error({ deviceId, error: msg.error }, "Device reported error");
            await db
              .update(devices)
              .set({ status: "error", updatedAt: new Date() })
              .where(eq(devices.id, deviceId));

            await publish(`user:${userId}`, {
              type: "device:status",
              data: { deviceId, status: "error" },
            });
            break;
          }

          default:
            logger.warn({ deviceId, type: msg.type }, "Unknown message type from device");
        }
      } catch (error) {
        logger.error(error, "Failed to process WebSocket message");
      }
    });

    socket.on("close", () => {
      connections.unregister(deviceId);

      db.update(devices)
        .set({ status: "offline", connectionId: null, updatedAt: new Date() })
        .where(eq(devices.id, deviceId))
        .then(() => {
          publish(`user:${userId}`, {
            type: "device:status",
            data: { deviceId, status: "offline" },
          });
        })
        .catch((err: unknown) => logger.error(err, "Failed to update device status on disconnect"));
    });

    socket.on("error", (err) => {
      logger.error({ deviceId, error: err.message }, "WebSocket error");
    });
  });
};
