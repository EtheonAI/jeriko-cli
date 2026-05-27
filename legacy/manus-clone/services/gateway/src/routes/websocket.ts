import { FastifyPluginAsync } from "fastify";
import { WebSocket } from "ws";
import {
  createLogger,
  getRedisPubClient,
  subscribe,
  publish,
} from "@repo/service-utils";

const logger = createLogger({ service: "gateway-websocket" });

// ─── Connection metrics ────────────────────────────────────────────
export const metrics = {
  connectionsTotal: 0,
  connectionsCurrent: 0,
  messagesIn: 0,
  messagesOut: 0,
  errors: 0,
};

// ─── Client registry ───────────────────────────────────────────────

interface WebSocketClient {
  clientId: string;
  userId: string;
  ws: WebSocket;
  channels: Set<string>;
  unsubscribers: Map<string, () => void>; // channel → unsubscribe fn
  connectedAt: number;
  lastPongAt: number;
}

const clients = new Map<string, WebSocketClient>();

/** Get all connected clients (for graceful shutdown) */
export function getClients(): Map<string, WebSocketClient> {
  return clients;
}

/** Get count of connected clients */
export function getConnectionCount(): number {
  return clients.size;
}

// ─── Allowed channel patterns ──────────────────────────────────────

function isChannelAllowed(channel: string, userId: string): boolean {
  // User's own channel (auto-subscribed)
  if (channel === `user:${userId}`) return true;
  // Public broadcast
  if (channel.startsWith("public:")) return true;
  // Session-scoped channels — allowed (session auth checked at API level)
  if (channel.startsWith("session:")) return true;
  // Device status channels
  if (channel.startsWith("device:") && channel.includes(userId)) return true;
  return false;
}

// ─── Send helper with backpressure ─────────────────────────────────

function safeSend(client: WebSocketClient, payload: string): boolean {
  if (client.ws.readyState !== WebSocket.OPEN) return false;

  // Check backpressure: if buffered amount is > 1MB, drop non-critical messages
  if (client.ws.bufferedAmount > 1048576) {
    logger.warn(
      { clientId: client.clientId, buffered: client.ws.bufferedAmount },
      "Backpressure: dropping message"
    );
    metrics.errors++;
    return false;
  }

  client.ws.send(payload);
  metrics.messagesOut++;
  return true;
}

function safeSendJSON(client: WebSocketClient, message: { type: string; data?: unknown }): boolean {
  return safeSend(client, JSON.stringify(message));
}

// ─── Channel subscription with proper lifecycle ────────────────────

function subscribeClient(client: WebSocketClient, channel: string): boolean {
  if (client.channels.has(channel)) return true; // Already subscribed

  if (!isChannelAllowed(channel, client.userId)) {
    safeSendJSON(client, {
      type: "error",
      data: { message: `Not authorized for channel: ${channel}` },
    });
    return false;
  }

  const unsubscribe = subscribe(channel, (message: unknown) => {
    // Forward Redis messages to client's WebSocket
    safeSend(client, typeof message === "string" ? message : JSON.stringify(message));
  });

  client.channels.add(channel);
  client.unsubscribers.set(channel, unsubscribe);

  logger.debug({ clientId: client.clientId, channel }, "Client subscribed to channel");
  return true;
}

function unsubscribeClient(client: WebSocketClient, channel: string): boolean {
  const unsubscribe = client.unsubscribers.get(channel);
  if (!unsubscribe) return false;

  unsubscribe(); // Calls redis.unsubscribe if last listener
  client.channels.delete(channel);
  client.unsubscribers.delete(channel);

  logger.debug({ clientId: client.clientId, channel }, "Client unsubscribed from channel");
  return true;
}

function cleanupClient(client: WebSocketClient): void {
  // Unsubscribe from all channels
  for (const [, unsubscribe] of client.unsubscribers) {
    try {
      unsubscribe();
    } catch {
      // Best effort cleanup
    }
  }
  client.channels.clear();
  client.unsubscribers.clear();
  clients.delete(client.clientId);
  metrics.connectionsCurrent--;
}

// ─── Per-client rate limiting ─────────────────────────────────────

const MAX_MESSAGES_PER_SECOND = 30;
const MAX_MESSAGE_SIZE = 65536; // 64KB

interface ClientRateLimit {
  count: number;
  windowStart: number;
}

const clientRateLimits = new Map<string, ClientRateLimit>();

function isClientRateLimited(clientId: string): boolean {
  const now = Date.now();
  let rl = clientRateLimits.get(clientId);

  if (!rl || now - rl.windowStart >= 1000) {
    rl = { count: 1, windowStart: now };
    clientRateLimits.set(clientId, rl);
    return false;
  }

  rl.count++;
  return rl.count > MAX_MESSAGES_PER_SECOND;
}

// ─── Client message handler ────────────────────────────────────────

async function handleClientMessage(
  client: WebSocketClient,
  message: { type: string; data?: unknown }
): Promise<void> {
  metrics.messagesIn++;

  // Per-client rate limiting
  if (isClientRateLimited(client.clientId)) {
    safeSendJSON(client, {
      type: "error",
      data: { message: "Rate limited — too many messages" },
    });
    return;
  }

  switch (message.type) {
    case "ping":
      safeSendJSON(client, { type: "pong", data: { ts: Date.now() } });
      break;

    case "subscribe": {
      const { channel } = (message.data ?? {}) as { channel?: string };
      if (!channel || typeof channel !== "string") {
        safeSendJSON(client, { type: "error", data: { message: "Missing channel" } });
        break;
      }
      if (subscribeClient(client, channel)) {
        safeSendJSON(client, { type: "subscribed", data: { channel } });
      }
      break;
    }

    case "unsubscribe": {
      const { channel } = (message.data ?? {}) as { channel?: string };
      if (!channel || typeof channel !== "string") {
        safeSendJSON(client, { type: "error", data: { message: "Missing channel" } });
        break;
      }
      if (unsubscribeClient(client, channel)) {
        safeSendJSON(client, { type: "unsubscribed", data: { channel } });
      }
      break;
    }

    case "task:start":
    case "task:continue":
    case "task:cancel": {
      const redis = getRedisPubClient();
      await redis.publish(
        "tasks:commands",
        JSON.stringify({
          type: message.type,
          userId: client.userId,
          clientId: client.clientId,
          data: message.data,
        })
      );
      break;
    }

    default:
      // Forward other message types to user's channel for service consumption
      safeSendJSON(client, {
        type: "error",
        data: { message: `Unknown message type: ${message.type}` },
      });
  }
}

// ─── Route registration ────────────────────────────────────────────

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  // Main WebSocket endpoint
  fastify.get("/stream", { websocket: true }, async (socket, request) => {
    const ws = socket as unknown as WebSocket;

    // Authenticate via Sec-WebSocket-Protocol (preferred), query param (legacy), or header
    // Protocol-based: client sends new WebSocket(url, ["access_token", jwt])
    const protocols = request.headers["sec-websocket-protocol"];
    let token: string | undefined;

    if (protocols) {
      const parts = (Array.isArray(protocols) ? protocols[0] : protocols).split(",").map((s: string) => s.trim());
      const tokenIdx = parts.indexOf("access_token");
      if (tokenIdx !== -1 && parts[tokenIdx + 1]) {
        token = parts[tokenIdx + 1];
      }
    }

    // Fallback to query param or Authorization header
    if (!token) {
      token =
        (request.query as { token?: string }).token ||
        request.headers.authorization?.replace("Bearer ", "");
    }

    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }

    // Lazy import to avoid circular deps
    const { extractAuth } = await import("@repo/service-utils");
    const auth = await extractAuth(`Bearer ${token}`, undefined);
    if (!auth) {
      ws.close(4001, "Invalid authentication");
      return;
    }

    const clientId = crypto.randomUUID();
    const now = Date.now();
    const client: WebSocketClient = {
      clientId,
      userId: auth.userId,
      ws,
      channels: new Set(),
      unsubscribers: new Map(),
      connectedAt: now,
      lastPongAt: now,
    };

    clients.set(clientId, client);
    metrics.connectionsTotal++;
    metrics.connectionsCurrent++;
    logger.info(
      { clientId, userId: auth.userId, total: metrics.connectionsCurrent },
      "WebSocket client connected"
    );

    // Auto-subscribe to user's personal channel
    subscribeClient(client, `user:${auth.userId}`);

    // Send connection success
    safeSendJSON(client, {
      type: "connected",
      data: { clientId, userId: auth.userId },
    });

    // Handle incoming messages with size limit and validation
    ws.on("message", async (data) => {
      try {
        const raw = data.toString();

        // Reject messages exceeding 64KB
        if (raw.length > MAX_MESSAGE_SIZE) {
          safeSendJSON(client, {
            type: "error",
            data: { message: "Message too large (max 64KB)" },
          });
          return;
        }

        const message = JSON.parse(raw);
        if (!message || typeof message.type !== "string") {
          safeSendJSON(client, {
            type: "error",
            data: { message: "Invalid message format: 'type' field required" },
          });
          return;
        }
        await handleClientMessage(client, message);
      } catch (error) {
        metrics.errors++;
        logger.error({ err: error, clientId }, "Failed to process message");
        safeSendJSON(client, {
          type: "error",
          data: { message: "Invalid message format" },
        });
      }
    });

    // Handle disconnect — clean up ALL subscriptions
    ws.on("close", (code, _reason) => {
      logger.info(
        { clientId, userId: auth.userId, code, total: metrics.connectionsCurrent - 1 },
        "WebSocket client disconnected"
      );
      cleanupClient(client);
    });

    ws.on("error", (error) => {
      metrics.errors++;
      logger.error({ err: error, clientId }, "WebSocket error");
    });
  });

  // SSE fallback endpoint
  fastify.get("/events", async (request, reply) => {
    const { extractAuth } = await import("@repo/service-utils");
    const auth = await extractAuth(
      request.headers.authorization,
      request.headers["x-api-key"] as string | undefined
    );

    if (!auth) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    const channel = `user:${auth.userId}`;

    // Use the new subscribe() that returns an unsubscribe function
    const unsubscribe = subscribe(channel, (message: unknown) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(message)}\n\n`);
      } catch {
        // Client may have disconnected
      }
    });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(": heartbeat\n\n");
      } catch {
        // Client disconnected
        clearInterval(heartbeat);
      }
    }, 30000);

    // Cleanup on disconnect — properly unsubscribe
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe(); // Clean Redis subscription
    });
  });
};

// ─── Broadcast utilities ───────────────────────────────────────────

export async function broadcastToUser(
  userId: string,
  message: { type: string; data: unknown }
): Promise<void> {
  await publish(`user:${userId}`, message);
}

export async function broadcastToAll(
  message: { type: string; data: unknown }
): Promise<void> {
  await publish("public:broadcast", message);
}

// ─── Graceful shutdown ─────────────────────────────────────────────

export function closeAllConnections(reason: string = "Server shutting down"): void {
  logger.info({ count: clients.size }, "Closing all WebSocket connections");
  for (const [, client] of clients) {
    try {
      safeSendJSON(client, { type: "server:shutdown", data: { reason } });
      cleanupClient(client);
      client.ws.close(1001, reason); // 1001 = Going Away
    } catch {
      // Best effort
    }
  }
  clients.clear();
}
