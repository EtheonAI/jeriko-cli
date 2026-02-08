import { createLogger } from "../logger/index.js";

const logger = createLogger({ service: "webhook-dispatch" });

const WEBHOOK_SERVICE_URL = process.env.WEBHOOK_SERVICE_URL || "http://localhost:4007";
const DISPATCH_TIMEOUT_MS = 5_000;

/**
 * Dispatch a webhook event to the webhook service.
 * Includes gateway secret for internal auth. Fire-and-forget (non-fatal on failure).
 */
export async function dispatchWebhookEvent(event: {
  eventType: string;
  resourceType: string;
  resourceId: string;
  payload: Record<string, unknown>;
  userId?: string;
  organizationId?: string;
}): Promise<void> {
  const gatewaySecret = process.env.GATEWAY_SECRET;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": crypto.randomUUID(),
  };

  if (gatewaySecret) {
    headers["x-gateway-secret"] = gatewaySecret;
  }

  try {
    const response = await fetch(`${WEBHOOK_SERVICE_URL}/internal/dispatch`, {
      method: "POST",
      headers,
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.warn(
        { eventType: event.eventType, resourceId: event.resourceId, status: response.status },
        "Webhook dispatch returned non-200 (non-fatal)"
      );
    }
  } catch (err) {
    logger.warn(
      { eventType: event.eventType, resourceId: event.resourceId, error: err },
      "Failed to dispatch webhook event (non-fatal)"
    );
  }
}
