import type { WebSocket } from "@fastify/websocket";
import { logger } from "./helpers.js";

interface DeviceConnection {
  socket: WebSocket;
  userId: string;
  connectedAt: Date;
}

const connections = new Map<string, DeviceConnection>();

export function register(deviceId: string, socket: WebSocket, userId: string): void {
  // Close existing connection if any
  const existing = connections.get(deviceId);
  if (existing) {
    try {
      existing.socket.close();
    } catch {}
  }

  connections.set(deviceId, { socket, userId, connectedAt: new Date() });
  logger.info({ deviceId, userId }, "Device connected");
}

export function unregister(deviceId: string): void {
  const conn = connections.get(deviceId);
  if (conn) {
    try {
      conn.socket.close();
    } catch {}
    connections.delete(deviceId);
    logger.info({ deviceId }, "Device disconnected");
  }
}

export function sendToDevice(deviceId: string, message: unknown): boolean {
  const conn = connections.get(deviceId);
  if (!conn || conn.socket.readyState !== 1) {
    return false;
  }
  conn.socket.send(JSON.stringify(message));
  return true;
}

export function isConnected(deviceId: string): boolean {
  const conn = connections.get(deviceId);
  return !!conn && conn.socket.readyState === 1;
}

export function getByUser(userId: string): string[] {
  const deviceIds: string[] = [];
  for (const [deviceId, conn] of connections) {
    if (conn.userId === userId) {
      deviceIds.push(deviceId);
    }
  }
  return deviceIds;
}

export function getAll(): Map<string, DeviceConnection> {
  return connections;
}
