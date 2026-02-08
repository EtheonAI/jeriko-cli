/**
 * Test helpers — creates an isolated Fastify+WebSocket server
 * and provides state management for the mocks defined in setup.ts.
 *
 * Uses a per-WebSocket message queue to eliminate race conditions
 * between connection "open" and server-sent "connected" messages.
 */
import Fastify, { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { WebSocket } from "ws";

// ─── Global test state (shared with mock in setup.ts) ────────────

interface TestState {
  mockAuthResult: { userId: string; email?: string } | null;
  channelCallbacks: Map<string, Set<(msg: unknown) => void>>;
  mockPubCalls: Array<{ channel: string; message: string }>;
}

function getState(): TestState {
  if (!(globalThis as Record<string, unknown>).__wsTestState) {
    (globalThis as Record<string, unknown>).__wsTestState = {
      mockAuthResult: null,
      channelCallbacks: new Map(),
      mockPubCalls: [],
    };
  }
  return (globalThis as Record<string, unknown>).__wsTestState as TestState;
}

export function setAuthResult(result: { userId: string; email?: string } | null) {
  getState().mockAuthResult = result;
}

export function simulateRedisMessage(channel: string, data: unknown) {
  const cbs = getState().channelCallbacks.get(channel);
  if (!cbs) return;
  for (const cb of cbs) {
    cb(data);
  }
}

export function getChannelCallbacks() {
  return getState().channelCallbacks;
}

export function getMockPubCalls() {
  return getState().mockPubCalls;
}

export function clearMockState() {
  const s = getState();
  s.channelCallbacks.clear();
  s.mockPubCalls.length = 0;
}

// ─── Server builder ──────────────────────────────────────────────

export async function createTestServer(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    genReqId: () => crypto.randomUUID(),
  });

  await app.register(websocket, {
    options: { maxPayload: 1048576 },
  });

  const { websocketRoutes } = await import("../routes/websocket.js");
  await app.register(websocketRoutes, { prefix: "/v1" });

  await app.ready();
  return app;
}

// ─── Per-WebSocket message queue ─────────────────────────────────
//
// Eliminates the race between ws "open" and the server's initial
// "connected" message by buffering all incoming messages from the
// moment the socket is created.

export interface WsMessage {
  type: string;
  data?: unknown;
}

type Resolver = (msg: WsMessage) => void;

const msgQueues = new WeakMap<WebSocket, WsMessage[]>();
const msgResolvers = new WeakMap<WebSocket, Resolver[]>();

function initQueue(ws: WebSocket): void {
  const queue: WsMessage[] = [];
  const resolvers: Resolver[] = [];
  msgQueues.set(ws, queue);
  msgResolvers.set(ws, resolvers);

  ws.on("message", (data) => {
    try {
      const msg: WsMessage = JSON.parse(data.toString());
      if (resolvers.length > 0) {
        resolvers.shift()!(msg);
      } else {
        queue.push(msg);
      }
    } catch {
      // Non-JSON frames are silently queued as error objects
      const errMsg: WsMessage = { type: "__parse_error", data: data.toString() };
      if (resolvers.length > 0) {
        resolvers.shift()!(errMsg);
      } else {
        queue.push(errMsg);
      }
    }
  });
}

// ─── WebSocket client helpers ────────────────────────────────────

export function connectWs(
  port: number,
  token: string = "valid-test-token",
  path: string = "/v1/stream"
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    initQueue(ws); // Start buffering BEFORE "open" fires
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
    setTimeout(() => reject(new Error("WebSocket connection timeout")), 5000);
  });
}

export function waitForMessage(ws: WebSocket, timeout = 3000): Promise<WsMessage> {
  const queue = msgQueues.get(ws);
  const resolvers = msgResolvers.get(ws);

  return new Promise((resolve, reject) => {
    // Consume from buffer if available
    if (queue && queue.length > 0) {
      resolve(queue.shift()!);
      return;
    }

    const timer = setTimeout(() => {
      if (resolvers) {
        const idx = resolvers.indexOf(wrapped);
        if (idx !== -1) resolvers.splice(idx, 1);
      }
      reject(new Error("Timeout waiting for message"));
    }, timeout);

    function wrapped(msg: WsMessage) {
      clearTimeout(timer);
      resolve(msg);
    }

    if (resolvers) {
      resolvers.push(wrapped);
    } else {
      // Fallback for WebSockets not created by connectWs
      ws.once("message", (data) => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(data.toString()));
        } catch {
          reject(new Error(`Invalid JSON: ${data.toString()}`));
        }
      });
    }
  });
}

export function waitForClose(ws: WebSocket, timeout = 3000): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Timeout waiting for close")), timeout);
    ws.once("close", (code, reason) => {
      clearTimeout(timer);
      resolve({ code, reason: reason.toString() });
    });
  });
}

export function collectMessages(ws: WebSocket, count: number, timeout = 5000): Promise<WsMessage[]> {
  const queue = msgQueues.get(ws);
  const resolvers = msgResolvers.get(ws);

  return new Promise((resolve) => {
    const messages: WsMessage[] = [];

    // Drain buffered messages first
    if (queue) {
      while (queue.length > 0 && messages.length < count) {
        messages.push(queue.shift()!);
      }
      if (messages.length >= count) {
        resolve(messages);
        return;
      }
    }

    const remaining = count - messages.length;
    let received = 0;
    const ownResolvers: Resolver[] = [];

    const timer = setTimeout(() => {
      // Remove any of our pending resolvers that weren't consumed
      if (resolvers) {
        for (const r of ownResolvers) {
          const idx = resolvers.indexOf(r);
          if (idx !== -1) resolvers.splice(idx, 1);
        }
      }
      resolve(messages);
    }, timeout);

    function onMsg(msg: WsMessage) {
      messages.push(msg);
      received++;
      if (received >= remaining) {
        clearTimeout(timer);
        resolve(messages);
      }
    }

    if (resolvers) {
      for (let i = 0; i < remaining; i++) {
        ownResolvers.push(onMsg);
        resolvers.push(onMsg);
      }
    } else {
      // Fallback for non-queued WebSockets
      ws.on("message", (data) => {
        try {
          messages.push(JSON.parse(data.toString()));
        } catch { /* skip invalid */ }
        if (messages.length >= count) {
          clearTimeout(timer);
          ws.removeAllListeners("message");
          resolve(messages);
        }
      });
    }
  });
}

export function sendJson(ws: WebSocket, message: WsMessage) {
  ws.send(JSON.stringify(message));
}

export function getPort(app: FastifyInstance): number {
  const addr = app.server.address();
  if (typeof addr === "object" && addr) return addr.port;
  throw new Error("Server not listening");
}
