import webpush from "web-push";
import { db, pushSubscriptions, eq } from "./db.js";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "notification-push" });

let configured = false;

export function configurePush(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:support@rubic.dev";

  if (!publicKey || !privateKey) {
    logger.warn("VAPID keys not configured - web push disabled");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  logger.info("Web push configured with VAPID keys");
  return true;
}

export function isPushConfigured(): boolean {
  return configured;
}

interface PushPayload {
  title: string;
  body: string;
  data?: {
    url?: string;
    notificationId?: string;
    type?: string;
  };
}

/**
 * Send web push to a single subscription. Returns true if sent, false if subscription is stale.
 */
async function sendToSubscription(
  subscription: { id: string; endpoint: string; p256dh: string; auth: string },
  payload: PushPayload
): Promise<boolean> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error: any) {
    if (error.statusCode === 410 || error.statusCode === 404) {
      // Subscription expired or not found - remove it
      logger.info({ subscriptionId: subscription.id }, "Removing stale push subscription");
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, subscription.id));
      return false;
    }
    logger.error({ error, subscriptionId: subscription.id }, "Failed to send push notification");
    return false;
  }
}

/**
 * Send web push notification to all of a user's subscriptions.
 */
export async function sendWebPush(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!configured) {
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const success = await sendToSubscription(sub, payload);
      if (success) {
        sent++;
        // Update lastUsedAt
        await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, sub.id));
      } else {
        failed++;
      }
    })
  );

  return { sent, failed };
}
