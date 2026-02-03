import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

export function getSocket(): TypedSocket | null {
  return socket;
}

export function connectSocket(): TypedSocket {
  if (socket?.connected) {
    return socket;
  }

  const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "";

  socket = io(socketUrl, {
    path: "/api/socket",
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  }) as TypedSocket;

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Helper functions for common operations
export function joinRoom(roomId: string): void {
  socket?.emit("room:join", roomId);
}

export function leaveRoom(roomId: string): void {
  socket?.emit("room:leave", roomId);
}

export function sendMessage(sessionId: string, content: string): void {
  socket?.emit("message:send", { sessionId, content });
}

export function setTyping(sessionId: string, isTyping: boolean): void {
  socket?.emit("message:typing", { sessionId, isTyping });
}

export function sendAgentCommand(
  agentId: string,
  command: string,
  payload?: Record<string, unknown>
): void {
  socket?.emit("agent:command", { agentId, command, payload });
}

export function updatePresence(status: string): void {
  socket?.emit("presence:update", { status });
}
