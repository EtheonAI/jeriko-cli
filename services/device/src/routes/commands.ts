import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { db, eq, and, desc, devices, deviceCommands } from "../lib/db.js";
import { createId, successResponse, errorResponse, ErrorCodes, publish } from "@repo/service-utils";
import { logger, getUserId } from "../lib/helpers.js";
import { validateCommand } from "../lib/safety.js";
import * as connections from "../lib/connections.js";

const SendCommandSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

const ToolExecutionSchema = z.object({
  tool_name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).default({}),
  device_id: z.string().min(1),
});

export const commandRoutes: FastifyPluginAsync = async (fastify) => {
  // Send command to device
  fastify.post("/v1/devices/:id/command", async (request, reply) => {
    const userId = getUserId(request);
    const { id: deviceId } = request.params as { id: string };
    const input = SendCommandSchema.parse(request.body);

    try {
      // Verify device ownership
      const [device] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
        .limit(1);

      if (!device) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Device not found" }, request.id)
          );
      }

      // Safety check for terminal commands
      if (input.type === "terminal" && input.payload.command) {
        const safety = validateCommand(
          input.payload.command as string,
          (device.capabilities as string[]) || []
        );

        if (!safety.allowed) {
          return reply
            .status(403)
            .send(
              errorResponse(
                { code: ErrorCodes.FORBIDDEN, message: safety.reason || "Command not allowed" },
                request.id
              )
            );
        }

        if (safety.requiresApproval) {
          // Insert with pending_approval status
          const commandId = createId();
          await db
            .insert(deviceCommands)
            .values({
              id: commandId,
              deviceId,
              type: input.type,
              payload: input.payload,
              status: "pending",
            })
            .returning();

          await publish(`user:${userId}`, {
            type: "device:command:approval_required",
            data: { deviceId, commandId, command: input.payload.command },
          });

          return reply.status(202).send(
            successResponse(
              {
                id: commandId,
                status: "approval_required",
                message: "This command requires user approval before execution",
              },
              request.id
            )
          );
        }
      }

      // Insert command record
      const commandId = createId();
      await db
        .insert(deviceCommands)
        .values({
          id: commandId,
          deviceId,
          type: input.type,
          payload: input.payload,
          status: "pending",
        })
        .returning();

      // Send to device via WebSocket
      const sent = connections.sendToDevice(deviceId, {
        type: "command",
        commandId,
        command: input.type,
        payload: input.payload,
      });

      if (!sent) {
        // Device not connected, update status
        await db
          .update(deviceCommands)
          .set({ status: "failed", error: "Device not connected" })
          .where(eq(deviceCommands.id, commandId));

        return reply.status(503).send(
          errorResponse(
            {
              code: ErrorCodes.SERVICE_UNAVAILABLE,
              message: "Device is not connected",
            },
            request.id
          )
        );
      }

      // Mark as executing
      await db
        .update(deviceCommands)
        .set({ status: "executing", startedAt: new Date() })
        .where(eq(deviceCommands.id, commandId));

      logger.info({ commandId, deviceId, type: input.type }, "Command sent to device");

      return reply.status(201).send(
        successResponse(
          {
            id: commandId,
            status: "executing",
          },
          request.id
        )
      );
    } catch (error) {
      logger.error(error, "Failed to send command");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to send command" },
            request.id
          )
        );
    }
  });

  // List commands for a device
  fastify.get("/v1/devices/:id/commands", async (request, reply) => {
    const userId = getUserId(request);
    const { id: deviceId } = request.params as { id: string };
    const query = request.query as { limit?: string };
    const limit = Math.min(parseInt(query.limit || "20", 10), 100);

    try {
      // Verify device ownership
      const [device] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.id, deviceId), eq(devices.userId, userId)))
        .limit(1);

      if (!device) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Device not found" }, request.id)
          );
      }

      const commands = await db
        .select()
        .from(deviceCommands)
        .where(eq(deviceCommands.deviceId, deviceId))
        .orderBy(desc(deviceCommands.createdAt))
        .limit(limit);

      return reply.send(successResponse(commands, request.id));
    } catch (error) {
      logger.error(error, "Failed to list commands");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to list commands" },
            request.id
          )
        );
    }
  });

  // Tool execution bridge (for agent service)
  fastify.post("/v1/tools/execute", async (request, reply) => {
    const userId = getUserId(request);
    const input = ToolExecutionSchema.parse(request.body);

    try {
      // Verify device ownership
      const [device] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.id, input.device_id), eq(devices.userId, userId)))
        .limit(1);

      if (!device) {
        return reply
          .status(404)
          .send(
            errorResponse({ code: ErrorCodes.NOT_FOUND, message: "Device not found" }, request.id)
          );
      }

      // Insert command
      const commandId = createId();
      await db.insert(deviceCommands).values({
        id: commandId,
        deviceId: input.device_id,
        type: input.tool_name,
        payload: input.arguments,
        status: "pending",
      });

      // Send to device
      const sent = connections.sendToDevice(input.device_id, {
        type: "tool_execute",
        commandId,
        toolName: input.tool_name,
        arguments: input.arguments,
      });

      if (!sent) {
        await db
          .update(deviceCommands)
          .set({ status: "failed", error: "Device not connected" })
          .where(eq(deviceCommands.id, commandId));

        return reply.status(503).send(
          errorResponse(
            {
              code: ErrorCodes.SERVICE_UNAVAILABLE,
              message: "Device is not connected",
            },
            request.id
          )
        );
      }

      await db
        .update(deviceCommands)
        .set({ status: "executing", startedAt: new Date() })
        .where(eq(deviceCommands.id, commandId));

      return reply
        .status(201)
        .send(successResponse({ id: commandId, status: "executing" }, request.id));
    } catch (error) {
      logger.error(error, "Failed to execute tool");
      return reply
        .status(500)
        .send(
          errorResponse(
            { code: ErrorCodes.INTERNAL_ERROR, message: "Failed to execute tool" },
            request.id
          )
        );
    }
  });
};
