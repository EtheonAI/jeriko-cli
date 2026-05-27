import { createService, typedRoute, createId, publish, z } from "@repo/service-utils";
import { NotFoundError, AuthorizationError, AuthenticationError } from "@repo/service-utils/errors";
import {
  db,
  notifications,
  notificationPreferences,
  pushSubscriptions,
  eq,
  and,
  desc,
  sql,
  initDb,
} from "./lib/db.js";
import { Knock } from "@knocklabs/node";
import { getActiveChannels, applyQuietHours, type ChannelPreferences } from "./lib/channels.js";
import { configurePush, sendWebPush } from "./lib/push.js";

// Initialize Knock conditionally
const knock = process.env.KNOCK_SECRET_API_KEY
  ? new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY })
  : null;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const UserIdParams = z.object({ userId: z.string().min(1) });
const IdParams = z.object({ id: z.string().min(1) });

const SendNotificationBody = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  priority: z.string().default("normal"),
  actionUrl: z.string().optional(),
  actionLabel: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

const NotificationsQuery = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const PushSubscribeBody = z.object({
  userId: z.string().min(1),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
});

const UpdatePreferencesBody = z.object({
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  inAppSound: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  await initDb();

  const { app, logger, start } = await createService({ name: "notification", port: parseInt(process.env.PORT || "4006", 10) });

  if (!knock) {
    logger.warn("KNOCK_SECRET_API_KEY not set - email delivery via Knock disabled");
  }

  // Configure web push (VAPID keys)
  configurePush();

  // ---------------------------------------------------------------------------
  // Send notification
  // ---------------------------------------------------------------------------
  app.post(
    "/send",
    typedRoute({ body: SendNotificationBody }, async (request, reply) => {
      const {
        userId,
        type,
        title,
        message,
        data,
        priority,
        actionUrl,
        actionLabel,
        entityType,
        entityId,
      } = request.body;

      if (!request.userId) throw new AuthenticationError();
      if (request.userId !== userId) throw new AuthorizationError();

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
        "Notification sent",
      );

      return reply.success({ id: notificationId, status: "sent", channels: deliveredChannels });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get user notifications
  // ---------------------------------------------------------------------------
  app.get(
    "/users/:userId/notifications",
    typedRoute({ params: UserIdParams, query: NotificationsQuery }, async (request, reply) => {
      const { userId } = request.params;
      const { limit, cursor } = request.query;

      if (!request.userId) throw new AuthenticationError();
      if (request.userId !== userId) throw new AuthorizationError();

      const conditions = [eq(notifications.userId, userId)];
      if (cursor) {
        conditions.push(
          sql`${notifications.createdAt} < (SELECT created_at FROM notifications WHERE id = ${cursor})`,
        );
      }

      const results = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(limit + 1);

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore ? items[items.length - 1]!.id : null;

      return reply.success({ notifications: items, cursor: nextCursor });
    }),
  );

  // ---------------------------------------------------------------------------
  // Mark notification as read
  // ---------------------------------------------------------------------------
  app.patch(
    "/notifications/:id/read",
    typedRoute({ params: IdParams }, async (request, reply) => {
      const { id } = request.params;

      if (!request.userId) throw new AuthenticationError();

      const [updated] = await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(eq(notifications.id, id), eq(notifications.userId, request.userId)))
        .returning();

      if (!updated) throw new NotFoundError("Notification");

      // Publish read event via WebSocket
      try {
        await publish(`user:${updated.userId}`, {
          type: "notification:read",
          data: { id: updated.id },
        });
      } catch (err) {
        logger.error(err, "Failed to publish notification:read event");
      }

      return reply.success({ id: updated.id, read: true });
    }),
  );

  // ---------------------------------------------------------------------------
  // Register push subscription
  // ---------------------------------------------------------------------------
  app.post(
    "/push/subscribe",
    typedRoute({ body: PushSubscribeBody }, async (request, reply) => {
      const { userId, subscription } = request.body;

      if (!request.userId) throw new AuthenticationError();
      if (request.userId !== userId) throw new AuthorizationError();

      await db.insert(pushSubscriptions).values({
        id: createId(),
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      });

      return reply.success({ subscribed: true });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get notification preferences
  // ---------------------------------------------------------------------------
  app.get(
    "/users/:userId/preferences",
    typedRoute({ params: UserIdParams }, async (request, reply) => {
      const { userId } = request.params;

      if (!request.userId) throw new AuthenticationError();
      if (request.userId !== userId) throw new AuthorizationError();

      const [prefs] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, userId))
        .limit(1);

      return reply.success({ userId, preferences: prefs || {} });
    }),
  );

  // ---------------------------------------------------------------------------
  // Update notification preferences
  // ---------------------------------------------------------------------------
  app.put(
    "/users/:userId/preferences",
    typedRoute({ params: UserIdParams, body: UpdatePreferencesBody }, async (request, reply) => {
      const { userId } = request.params;

      if (!request.userId) throw new AuthenticationError();
      if (request.userId !== userId) throw new AuthorizationError();

      const preferences = request.body;

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
        return reply.success({ userId, preferences: updated, updated: true });
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
        return reply.success({ userId, preferences: created, updated: true });
      }
    }),
  );

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  await start();
}

main();
