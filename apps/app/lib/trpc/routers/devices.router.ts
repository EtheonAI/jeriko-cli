import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { TRPCError } from "@trpc/server";

// Device service URL - proxied through gateway
const DEVICE_SERVICE_URL = process.env.DEVICE_SERVICE_URL || "http://localhost:4001/v1/devices";

async function fetchDeviceService<T>(
  endpoint: string,
  options: RequestInit = {},
  userId: string
): Promise<T> {
  const url = `${DEVICE_SERVICE_URL}${endpoint}`;

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
      body?.error?.message || body?.message || `Device service error: ${response.status}`;
    throw new TRPCError({
      code:
        response.status === 404
          ? "NOT_FOUND"
          : response.status === 403
            ? "FORBIDDEN"
            : "INTERNAL_SERVER_ERROR",
      message,
    });
  }

  const json = await response.json();
  // Unwrap service response envelope: { data, meta, error }
  return json.data as T;
}

export const devicesRouter = createTRPCRouter({
  // List user's devices
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      const devices = await fetchDeviceService<Device[]>("", {}, ctx.user.id);
      return devices || [];
    } catch (error) {
      // Return empty array if service unavailable
      console.error("Device service error:", error);
      return [];
    }
  }),

  // Get a single device
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return fetchDeviceService<Device>(`/${input.id}`, {}, ctx.user.id);
  }),

  // Register a new device
  register: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        type: z.enum(["browser", "desktop", "mobile", "server"]),
        platform: z.string().optional(),
        capabilities: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return fetchDeviceService<Device>(
        "",
        {
          method: "POST",
          body: JSON.stringify({
            ...input,
            userId: ctx.user.id,
          }),
        },
        ctx.user.id
      );
    }),

  // Update device
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(255).optional(),
        capabilities: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      return fetchDeviceService<Device>(
        `/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        },
        ctx.user.id
      );
    }),

  // Unregister a device
  unregister: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await fetchDeviceService<void>(`/${input.id}`, { method: "DELETE" }, ctx.user.id);
      return { success: true };
    }),

  // Send command to device
  sendCommand: protectedProcedure
    .input(
      z.object({
        deviceId: z.string(),
        type: z.string(),
        payload: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return fetchDeviceService<CommandResult>(
        `/${input.deviceId}/command`,
        {
          method: "POST",
          body: JSON.stringify({
            type: input.type,
            payload: input.payload,
          }),
        },
        ctx.user.id
      );
    }),

  // Get device connection status
  getStatus: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const device = await fetchDeviceService<Device>(`/${input.id}`, {}, ctx.user.id);
      return {
        isOnline: device.status === "online",
        status: device.status,
        lastHeartbeat: device.lastHeartbeat,
      };
    }),
});

// Types for device service responses
interface Device {
  id: string;
  userId: string;
  name: string;
  type: "browser" | "desktop" | "mobile" | "server";
  status: "online" | "offline" | "busy" | "error";
  platform?: string;
  connectionId?: string;
  lastHeartbeat?: string;
  ipAddress?: string;
  userAgent?: string;
  capabilities?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface CommandResult {
  id: string;
  status: "pending" | "executing" | "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}
