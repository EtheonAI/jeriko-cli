import crypto from "node:crypto";
import { db, webhooks, webhookDeliveries, webhookEvents, eq, sql } from "@repo/database";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "webhook-deliver" });

export function generateSignature(payload: string, secret: string, timestamp: number): string {
  const signedContent = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedContent).digest("hex");
  return `v1=${hmac}`;
}

interface DeliveryResult {
  success: boolean;
  responseStatus?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
  durationMs: number;
}

export async function deliverWebhook(opts: {
  url: string;
  payload: Record<string, unknown>;
  secret: string;
  eventType: string;
  deliveryId: string;
  webhookId: string;
  timeoutMs: number;
  customHeaders?: Record<string, string>;
}): Promise<DeliveryResult> {
  const start = Date.now();
  const body = JSON.stringify(opts.payload);
  const timestamp = Math.floor(start / 1000);
  const signature = generateSignature(body, opts.secret, timestamp);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Id": opts.webhookId,
    "X-Webhook-Delivery": opts.deliveryId,
    "X-Webhook-Event": opts.eventType,
    "X-Webhook-Timestamp": String(timestamp),
    "X-Webhook-Signature": signature,
    ...(opts.customHeaders || {}),
  };

  try {
    const response = await fetch(opts.url, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(opts.timeoutMs),
    });

    const responseBody = await response.text().catch(() => "");
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      success: response.ok,
      responseStatus: response.status,
      responseBody: responseBody.slice(0, 10_000),
      responseHeaders,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
      durationMs: Date.now() - start,
    };
  }
}

export async function processDelivery(deliveryId: string): Promise<void> {
  const [delivery] = await db
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, deliveryId))
    .limit(1);

  if (!delivery) {
    logger.warn({ deliveryId }, "Delivery not found");
    return;
  }

  const [webhook] = await db
    .select()
    .from(webhooks)
    .where(eq(webhooks.id, delivery.webhookId))
    .limit(1);

  if (!webhook) {
    logger.warn({ deliveryId, webhookId: delivery.webhookId }, "Parent webhook not found");
    await db
      .update(webhookDeliveries)
      .set({ status: "failed", error: "Webhook not found", completedAt: new Date() })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  if (webhook.status !== "active") {
    logger.info({ deliveryId, webhookId: webhook.id }, "Webhook is inactive, skipping delivery");
    return;
  }

  const result = await deliverWebhook({
    url: webhook.url,
    payload: delivery.payload as Record<string, unknown>,
    secret: webhook.secret,
    eventType: delivery.eventType,
    deliveryId: delivery.id,
    webhookId: webhook.id,
    timeoutMs: webhook.timeoutMs,
    customHeaders: (webhook.headers as Record<string, string>) || undefined,
  });

  const now = new Date();

  if (result.success) {
    await db
      .update(webhookDeliveries)
      .set({
        status: "delivered",
        responseStatus: result.responseStatus,
        responseBody: result.responseBody,
        responseHeaders: result.responseHeaders,
        requestHeaders: {
          "Content-Type": "application/json",
          "X-Webhook-Id": webhook.id,
          "X-Webhook-Delivery": delivery.id,
          "X-Webhook-Event": delivery.eventType,
        },
        requestBody: JSON.stringify(delivery.payload),
        durationMs: result.durationMs,
        completedAt: now,
      })
      .where(eq(webhookDeliveries.id, deliveryId));

    await db
      .update(webhooks)
      .set({
        totalDeliveries: sql`${webhooks.totalDeliveries} + 1`,
        successfulDeliveries: sql`${webhooks.successfulDeliveries} + 1`,
        lastDeliveryAt: now,
      })
      .where(eq(webhooks.id, webhook.id));

    logger.info(
      { deliveryId, webhookId: webhook.id, status: result.responseStatus },
      "Delivery succeeded"
    );
  } else {
    const retryCount = delivery.retryCount + 1;
    const hasRetriesLeft = retryCount < webhook.maxRetries;

    if (hasRetriesLeft) {
      const backoffMs = webhook.retryDelayMs * Math.pow(2, delivery.retryCount);
      const nextRetryAt = new Date(Date.now() + backoffMs);

      await db
        .update(webhookDeliveries)
        .set({
          status: "retrying",
          retryCount,
          nextRetryAt,
          error: result.error || `HTTP ${result.responseStatus}`,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody,
          responseHeaders: result.responseHeaders,
          durationMs: result.durationMs,
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      logger.info(
        { deliveryId, webhookId: webhook.id, retryCount, nextRetryAt },
        "Delivery failed, scheduling retry"
      );
    } else {
      await db
        .update(webhookDeliveries)
        .set({
          status: "failed",
          retryCount,
          error: result.error || `HTTP ${result.responseStatus}`,
          responseStatus: result.responseStatus,
          responseBody: result.responseBody,
          responseHeaders: result.responseHeaders,
          durationMs: result.durationMs,
          completedAt: now,
        })
        .where(eq(webhookDeliveries.id, deliveryId));

      await db
        .update(webhooks)
        .set({
          totalDeliveries: sql`${webhooks.totalDeliveries} + 1`,
          failedDeliveries: sql`${webhooks.failedDeliveries} + 1`,
          lastDeliveryAt: now,
        })
        .where(eq(webhooks.id, webhook.id));

      logger.warn(
        { deliveryId, webhookId: webhook.id, error: result.error },
        "Delivery failed, retries exhausted"
      );
    }
  }
}
