import Fastify from "fastify";
import { createLogger, getEnv, createId, publish } from "@repo/service-utils";
import {
  db,
  notifications,
  notificationPreferences,
  pushSubscriptions,
  eq,
  and,
  desc,
  sql,
} from "@repo/database";
import { Knock } from "@knocklabs/node";
import { getActiveChannels, applyQuietHours, type ChannelPreferences } from "./lib/channels.js";
import { configurePush, sendWebPush } from "./lib/push.js";

const logger = createLogger({ service: "notification" });

// Initialize Knock conditionally
const knock = process.env.KNOCK_SECRET_API_KEY
  ? new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY })
  : null;

if (!knock) {
  logger.warn("KNOCK_SECRET_API_KEY not set - email delivery via Knock disabled");
}

async function main() {
  const port = parseInt(getEnv("PORT", "4006"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  const requireUserId = (request: any, reply: any): string | null => {
    const userId = request.headers["x-user-id"] as string | undefined;
    if (!userId) {
      reply.status(401).send({ error: "Unauthorized" });
      return null;
    }
    return userId;
  };

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "notification" };
  });

  // Send notification
  app.post("/send", async (request, reply) => {
    const {
      userId,
      type,
      title,
      message,
      data,
      priority = "normal",
      actionUrl,
      actionLabel,
      entityType,
      entityId,
    } = request.body as {
      userId: string;
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
      priority?: string;
      actionUrl?: string;
      actionLabel?: string;
      entityType?: string;
      entityId?: string;
    };

    try {
      const authUserId = requireUserId(request, reply);
      if (!authUserId) return;
      if (authUserId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      // 1. Fetch user preferences
      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      const channelPrefs: ChannelPreferences = prefs || null;

      // 2. Determine active channels and apply quiet hours
      let channels = getActiveChannels(channelPrefs, type);
      channels = applyQuietHours(channels, channelPrefs, priority);

      // 3. Save to DB
      const [notification] = await db
        .insert(notifications)
        .values({
          id: createId(),
          userId,
          type: type as any,
          priority: priority as any,
          title,
          message,
          actionUrl,
          actionLabel,
          entityType,
          entityId,
          metadata: data,
        })
        .returning();

      const notificationId = notification!.id;
      const deliveredChannels: string[] = [];

      // 4. In-app: Publish WebSocket event via Redis
      if (channels.inApp) {
        try {
          await publish(`user:${userId}`, {
            type: "notification:new",
            data: {
              id: notificationId,
              type,
              priority,
              title,
              message,
              actionUrl,
              actionLabel,
              metadata: data,
              createdAt: notification!.createdAt?.toISOString() || new Date().toISOString(),
            },
          });
          deliveredChannels.push("inApp");
        } catch (err) {
          logger.error(err, "Failed to publish WebSocket notification");
        }
      }

      // 5. Push: Send web push notifications
      if (channels.push) {
        try {
          const pushResult = await sendWebPush(userId, {
            title,
            body: message,
            data: {
              url: actionUrl,
              notificationId,
              type,
            },
          });
          if (pushResult.sent > 0) {
            deliveredChannels.push("push");
          }
          logger.info({ userId, pushResult }, "Web push delivery result");
        } catch (err) {
          logger.error(err, "Failed to send web push");
        }
      }

      // 6. Email: Trigger Knock workflow
      if (channels.email && knock) {
        const emailDigest = prefs?.emailDigest || "daily";
        try {
          if (emailDigest === "instant") {
            await knock.workflows.trigger("notification", {
              recipients: [userId],
              data: { title, message, actionUrl, type, priority },
            });
            deliveredChannels.push("email");
          }
          // For other digest frequencies, Knock handles batching via workflow config
        } catch (err) {
          logger.error(err, "Failed to trigger Knock workflow");
        }
      }

      logger.info(
        { userId, type, notificationId, channels: deliveredChannels },
        "Notification sent"
      );

      return { id: notificationId, status: "sent", channels: deliveredChannels };
    } catch (error) {
      logger.error(error, "Failed to send notification");
      return reply.status(500).send({ error: "Failed to send notification" });
    }
  });

  // Get user notifications
  app.get("/users/:userId/notifications", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { limit = 50, cursor } = request.query as { limit?: number; cursor?: string };

    try {
      const authUserId = requireUserId(request, reply);
      if (!authUserId) return;
      if (authUserId !== userId) {
        return reply.status(403).send({ error: "Forbidden" });
      }
      const pageLimit = Math.min(limit, 100);
      const conditions = [eq(notifications.userId, userId)];
      if (cursor) {
        conditions.push(
          sql`${notifications.createdAt} < (SELECT created_at FROM notifications WHERE id = ${cursor})`
        );
      }

      const results = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(pageLimit + 1);

      const hasMore = results.length > pageLimit;
      const items = hasMore ? results.slice(0, pageLimit) : results;
      const nextCursor = hasMore ? items[items.length - 1]!.id : null;

      return { notifications: items, cursor: nextCursor };
    } catch (error) {
      logger.error(error, "Failed to fetch notifications");
      return reply.status(500).send({ error: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.patch("/notifications/:id/read", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const authUserId = requireUserId(request, reply);
      if (!authUserId) return;
      const [updated] = await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.userId, authUserId)))
        .returning();
      if (!updated) {
        return reply.status(404).send({ error: "Notification not found" });
      }

      // Publish read event via WebSocket
      try {
        await publish(`user:${updated.userId}`, {
          type: "notification:read",
          data: { id: updated.id },
        });
      } catch (err) {
        logger.error(err, "Failed to publish notification:read event");
      }

      return { id: updated.id, read: true };
    } catch (error) {
      logger.error(error, "Failed to mark notification as read");
      return reply.status(500).send({ error: "Failed to update notification" });
    }
  });

  // Register push subscription
  app.post("/push/subscribe", async (request, reply) => {
    const { userId, subscription } = request.body as {
      userId: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
    };

    try {
      await db.insert(pushSubscriptions).values({
        id: createId(),
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });
      return { subscribed: true };
    } catch (error) {
      logger.error(error, "Failed to save push subscription");
      return reply.status(500).send({ error: "Failed to save push subscription" });
    }
  });

  // Get notification preferences
  app.get("/users/:userId/preferences", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);
      return { userId, preferences: prefs || {} };
    } catch (error) {
      logger.error(error, "Failed to fetch notification preferences");
      return reply.status(500).send({ error: "Failed to fetch preferences" });
    }
  });

  // Update notification preferences
  app.put("/users/:userId/preferences", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const preferences = request.body as Record<string, boolean>;
    try {
      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(notificationPreferences)
          .set({
            emailEnabled: preferences.emailEnabled ?? existing.emailEnabled,
            pushEnabled: preferences.pushEnabled ?? existing.pushEnabled,
            inAppEnabled: preferences.inAppEnabled ?? existing.inAppEnabled,
            inAppSound: preferences.inAppSound ?? existing.inAppSound,
          })
          .where(eq(notificationPreferences.userId, userId))
          .returning();
        return { userId, preferences: updated, updated: true };
      } else {
        const [created] = await db
          .insert(notificationPreferences)
          .values({
            id: createId(),
            userId,
            emailEnabled: preferences.emailEnabled ?? true,
            pushEnabled: preferences.pushEnabled ?? true,
            inAppEnabled: preferences.inAppEnabled ?? true,
            inAppSound: preferences.inAppSound ?? true,
          })
          .returning();
        return { userId, preferences: created, updated: true };
      }
    } catch (error) {
      logger.error(error, "Failed to update notification preferences");
      return reply.status(500).send({ error: "Failed to update preferences" });
    }
  });

  // Request logging
  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  // Configure web push (VAPID keys)
  configurePush();

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
