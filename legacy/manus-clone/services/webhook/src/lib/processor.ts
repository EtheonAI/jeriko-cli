import { db, webhookDeliveries, sql } from "./db.js";
import { createLogger } from "@repo/service-utils";
import { processDelivery } from "./deliver.js";

const logger = createLogger({ service: "webhook-processor" });

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;

let intervalId: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

async function pollDeliveries(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const pendingDeliveries = await db
      .select({ id: webhookDeliveries.id })
      .from(webhookDeliveries)
      .where(
        sql`${webhookDeliveries.status} = 'pending'
          OR (${webhookDeliveries.status} = 'retrying' AND ${webhookDeliveries.nextRetryAt} <= NOW())`
      )
      .limit(BATCH_SIZE);

    if (pendingDeliveries.length > 0) {
      logger.info({ count: pendingDeliveries.length }, "Processing pending deliveries");
    }

    for (const delivery of pendingDeliveries) {
      try {
        await processDelivery(delivery.id);
      } catch (err) {
        logger.error({ deliveryId: delivery.id, error: err }, "Failed to process delivery");
      }
    }
  } catch (err) {
    logger.error({ error: err }, "Delivery polling error");
  } finally {
    isProcessing = false;
  }
}

export function startProcessor(): void {
  if (intervalId) return;
  logger.info(
    { intervalMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE },
    "Starting webhook delivery processor"
  );
  intervalId = setInterval(pollDeliveries, POLL_INTERVAL_MS);
}

export function stopProcessor(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("Stopped webhook delivery processor");
  }
}
