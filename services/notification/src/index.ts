import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "notification" });

async function main() {
  const port = parseInt(getEnv("PORT", "4006"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "notification" };
  });

  // Send notification
  app.post("/send", async (request, reply) => {
    const { userId, type, title, message, data } = request.body as {
      userId: string;
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    };

    // TODO: Create notification in DB and send via push/email
    const notificationId = crypto.randomUUID();

    logger.info({ userId, type, notificationId }, "Notification sent");

    return { id: notificationId, status: "sent" };
  });

  // Get user notifications
  app.get("/users/:userId/notifications", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { limit = 50, cursor } = request.query as { limit?: number; cursor?: string };

    // TODO: Fetch from database
    return { notifications: [], cursor: null };
  });

  // Mark notification as read
  app.patch("/notifications/:id/read", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Update in database
    return { id, read: true };
  });

  // Register push subscription
  app.post("/push/subscribe", async (request, reply) => {
    const { userId, subscription } = request.body as {
      userId: string;
      subscription: PushSubscriptionJSON;
    };

    // TODO: Save subscription to database
    return { subscribed: true };
  });

  // Get notification preferences
  app.get("/users/:userId/preferences", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    // TODO: Fetch from database
    return { userId, preferences: {} };
  });

  // Update notification preferences
  app.put("/users/:userId/preferences", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const preferences = request.body as Record<string, boolean>;
    // TODO: Update in database
    return { userId, preferences, updated: true };
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info({
      requestId: request.id,
      method: request.method,
      url: request.url,
    }, "Incoming request");
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info({
      requestId: request.id,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, "Request completed");
  });

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Notification service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

main();
