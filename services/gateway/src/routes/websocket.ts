import { FastifyPluginAsync } from "fastify";
import { WebSocket } from "ws";
import {
  createLogger,
  getRedisClient,
  getRedisPubClient,
  getRedisSubClient,
  extractAuth,
} from "@repo/service-utils";

const logger = createLogger({ service: "gateway-websocket" });

interface WebSocketClient {
  userId: string;
  sessionId: string;
  ws: WebSocket;
  subscriptions: Set<string>;
}

// In-memory client registry (would use Redis in production cluster)
const clients = new Map<string, WebSocketClient>();

export const websocketRoutes: FastifyPluginAsync = async (fastify) => {
  // Main WebSocket endpoint for real-time streaming
  fastify.get("/stream", { websocket: true }, async (socket, request) => {
    const ws = socket as unknown as WebSocket;

    // Authenticate via query param or header
    const token =
      (request.query as { token?: string }).token ||
      request.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      ws.close(4001, "Authentication required");
      return;
    }

    const auth = await extractAuth(`Bearer ${token}`, undefined);
    if (!auth) {
      ws.close(4001, "Invalid authentication");
      return;
    }

    const clientId = crypto.randomUUID();
    const client: WebSocketClient = {
      userId: auth.userId,
      sessionId: clientId,
      ws,
      subscriptions: new Set(),
    };

    clients.set(clientId, client);
    logger.info({ clientId, userId: auth.userId }, "WebSocket client connected");

    // Subscribe to user's channel
    const userChannel = `user:${auth.userId}`;
    subscribeToChannel(client, userChannel);

    // Send connection success
    ws.send(
      JSON.stringify({
        type: "connected",
        data: { clientId, userId: auth.userId },
      })
    );

    // Handle incoming messages
    ws.on("message", async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await handleClientMessage(client, message);
      } catch (error) {
        logger.error({ err: error, clientId }, "Failed to process message");
        ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Invalid message format" },
          })
        );
      }
    });

    // Handle disconnect
    ws.on("close", () => {
      logger.info({ clientId, userId: auth.userId }, "WebSocket client disconnected");
      clients.delete(clientId);
    });

    ws.on("error", (error) => {
      logger.error({ err: error, clientId }, "WebSocket error");
    });
  });

  // SSE endpoint for simpler real-time updates
  fastify.get("/events", async (request, reply) => {
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

    const redis = getRedisSubClient();
    const channel = `user:${auth.userId}`;

    const messageHandler = (ch: string, message: string) => {
      if (ch === channel) {
        reply.raw.write(`data: ${message}\n\n`);
      }
    };

    redis.subscribe(channel);
    redis.on("message", messageHandler);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      reply.raw.write(": heartbeat\n\n");
    }, 30000);

    // Cleanup on disconnect
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      redis.unsubscribe(channel);
      redis.off("message", messageHandler);
    });
  });
};

function subscribeToChannel(client: WebSocketClient, channel: string) {
  if (client.subscriptions.has(channel)) return;

  const redis = getRedisSubClient();

  redis.subscribe(channel);
  client.subscriptions.add(channel);

  redis.on("message", (ch, message) => {
    if (ch === channel && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  });
}

async function handleClientMessage(
  client: WebSocketClient,
  message: { type: string; data?: unknown }
) {
  switch (message.type) {
    case "ping":
      client.ws.send(JSON.stringify({ type: "pong" }));
      break;

    case "subscribe":
      const { channel } = message.data as { channel: string };
      // Validate user can subscribe to this channel
      if (channel.startsWith(`user:${client.userId}`) || channel.startsWith("public:")) {
        subscribeToChannel(client, channel);
        client.ws.send(
          JSON.stringify({ type: "subscribed", data: { channel } })
        );
      } else {
        client.ws.send(
          JSON.stringify({
            type: "error",
            data: { message: "Cannot subscribe to this channel" },
          })
        );
      }
      break;

    case "task:start":
    case "task:continue":
    case "task:cancel":
      // Forward to task service via Redis pub/sub
      const redis = getRedisPubClient();
      await redis.publish(
        "tasks:commands",
        JSON.stringify({
          type: message.type,
          userId: client.userId,
          clientId: client.sessionId,
          data: message.data,
        })
      );
      break;

    default:
      client.ws.send(
        JSON.stringify({
          type: "error",
          data: { message: `Unknown message type: ${message.type}` },
        })
      );
  }
}

// Utility to broadcast to a user
export async function broadcastToUser(
  userId: string,
  message: { type: string; data: unknown }
) {
  const redis = getRedisPubClient();
  await redis.publish(`user:${userId}`, JSON.stringify(message));
}

// Utility to broadcast to all clients
export async function broadcastToAll(message: { type: string; data: unknown }) {
  const redis = getRedisPubClient();
  await redis.publish("public:broadcast", JSON.stringify(message));
}
