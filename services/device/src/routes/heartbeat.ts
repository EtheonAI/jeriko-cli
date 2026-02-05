import { FastifyPluginAsync } from "fastify";
import { db, eq, and, sql, devices } from "../lib/db.js";
import { successResponse, errorResponse, ErrorCodes } from "@repo/service-utils";
import { logger, getUserId } from "../lib/helpers.js";

const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export const heartbeatRoutes: FastifyPluginAsync = async (fastify) => {
  // Receive heartbeat from device
  fastify.post("/v1/devices/:id/heartbeat", async (request, reply) => {
    const userId = getUserId(request);
    const { id: deviceId } = request.params as { id: string };

    try {
      const now = new Date();

      const [updated] = await db
        .update(devices)
        .set({
          lastHeartbeat: now,
          status: "online",
          updatedAt: now,
        })
        .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
        .returning();

      if (!updated) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Device not found" }, request.id)
          );
      }

      return reply.send(successResponse({ status: "ok" }, request.id));
    } catch (error) {
      logger.error(error, "Failed to process heartbeat");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to process heartbeat" },
            request.id
          )
        );
    }
  });
};

// Periodically mark stale devices as offline
export function startStaleDeviceChecker(): NodeJS.Timeout {
  return setInterval(async () => {
    try {
      const threshold = new Date(Date.now() - STALE_THRESHOLD_MS);

      const stale = await db
        .update(devices)
        .set({ status: "offline", updatedAt: new Date() })
        .where(and(eq(devices.status, "online"), sql`${devices.lastHeartbeat} < ${threshold}`))
        .returning({ id: devices.id });

      if (stale.length > 0) {
        logger.info(
          { count: stale.length, deviceIds: stale.map((d) => d.id) },
          "Marked stale devices offline"
        );
      }
    } catch (error) {
      logger.error(error, "Failed to check stale devices");
    }
  }, 60_000);
}
