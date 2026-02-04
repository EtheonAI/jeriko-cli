import Fastify from "fastify";
import { createLogger, getEnv } from "@repo/service-utils";

const logger = createLogger({ service: "webhook" });

// Generate HMAC signature for webhook payload
function generateSignature(payload: string, secret: string): string {
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);
  const data = encoder.encode(payload);
  // In production, use crypto.subtle.sign with HMAC-SHA256
  return `sha256=${Buffer.from(data).toString("hex").slice(0, 64)}`;
}

async function main() {
  const port = parseInt(getEnv("PORT", "4007"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Health check
  app.get("/health", async () => {
    return { status: "ok", service: "webhook" };
  });

  // Create webhook
  app.post("/webhooks", async (request, reply) => {
    const { name, url, events, secret } = request.body as {
      name: string;
      url: string;
      events: string[];
      secret?: string;
    };

    const webhookId = crypto.randomUUID();
    const generatedSecret = secret || crypto.randomUUID();

    // TODO: Save to database

    return {
      id: webhookId,
      name,
      url,
      events,
      secret: generatedSecret,
      status: "active",
    };
  });

  // List webhooks
  app.get("/webhooks", async (request, reply) => {
    // TODO: Fetch from database
    return { webhooks: [] };
  });

  // Get webhook
  app.get("/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { id, status: "not_found" };
  });

  // Update webhook
  app.patch("/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Record<string, unknown>;
    // TODO: Update in database
    return { id, ...updates, updated: true };
  });

  // Delete webhook
  app.delete("/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Delete from database
    return { deleted: true };
  });

  // Get webhook deliveries
  app.get("/webhooks/:id/deliveries", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Fetch from database
    return { deliveries: [] };
  });

  // Retry webhook delivery
  app.post("/deliveries/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };
    // TODO: Queue retry
    return { id, retrying: true };
  });

  // Internal: Queue event for delivery
  app.post("/internal/dispatch", async (request, reply) => {
    const { eventType, resourceType, resourceId, payload, userId, organizationId } = request.body as {
      eventType: string;
      resourceType: string;
      resourceId: string;
      payload: Record<string, unknown>;
      userId?: string;
      organizationId?: string;
    };

    const eventId = crypto.randomUUID();

    // TODO: Find matching webhooks and queue deliveries
    logger.info({ eventType, resourceId, eventId }, "Event dispatched");

    return { eventId, status: "queued" };
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
    logger.info({ port, host }, "Webhook service started");
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
