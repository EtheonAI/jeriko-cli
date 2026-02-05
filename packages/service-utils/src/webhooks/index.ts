import { createLogger } from "../logger/index.js";

const logger = createLogger({ service: "webhook-dispatch" });

const WEBHOOK_SERVICE_URL = process.env.WEBHOOK_SERVICE_URL || "http://localhost:4007";
const DISPATCH_TIMEOUT_MS = 5_000;

export async function dispatchWebhookEvent(event: {
  eventType: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  userId?: string;
  organizationId?: string;
}): Promise<void> {
  try {
    await fetch(`${WEBHOOK_SERVICE_URL}/internal/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn(
      { eventType: event.eventType, resourceId: event.resourceId, error: err },
      "Failed to dispatch webhook event (non-fatal)"
    );
  }
}
