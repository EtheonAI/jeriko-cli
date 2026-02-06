import Fastify from "fastify";
import { createLogger, getEnv, createId } from "@repo/service-utils";
import { db, webhooks, webhookDeliveries, webhookEvents, eq, and, desc, sql } from "@repo/database";
import { processDelivery } from "./lib/deliver.js";
import { startProcessor, stopProcessor } from "./lib/processor.js";

const logger = createLogger({ service: "webhook" });

async function main() {
  const port = parseInt(getEnv("PORT", "4007"), 10);
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

    try {
      const generatedSecret = secret || crypto.randomUUID();
      const userId = requireUserId(request, reply);
      if (!userId) return;

      const [webhook] = await db
        .insert(webhooks)
        .values({
          id: createId(),
          name,
          url,
          events: events as any,
          secret: generatedSecret,
          userId,
          status: "active",
        })
        .returning();

      return {
        id: webhook!.id,
        name: webhook!.name,
        url: webhook!.url,
        events: webhook!.events,
        secret: generatedSecret,
        status: webhook!.status,
      };
    } catch (error) {
      logger.error(error, "Failed to create webhook");
      return reply.status(500).send({ error: "Failed to create webhook" });
    }
  });

  // List webhooks
  app.get("/webhooks", async (request, reply) => {
    try {
      const userId = requireUserId(request, reply);
      if (!userId) return;
      const results = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.userId, userId))
        .orderBy(desc(webhooks.createdAt));
      return { webhooks: results };
    } catch (error) {
      logger.error(error, "Failed to list webhooks");
      return reply.status(500).send({ error: "Failed to list webhooks" });
    }
  });

  // Get webhook
  app.get("/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const userId = requireUserId(request, reply);
      if (!userId) return;
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
        .limit(1);
      if (!webhook) {
        return reply.status(404).send({ error: "Webhook not found" });
      }
      return webhook;
    } catch (error) {
      logger.error(error, "Failed to fetch webhook");
      return reply.status(500).send({ error: "Failed to fetch webhook" });
    }
  });

  // Update webhook
  app.patch("/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as Record<string, unknown>;
    try {
      const userId = requireUserId(request, reply);
      if (!userId) return;
      const [updated] = await db
        .update(webhooks)
        .set(updates as any)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
        .returning();
      if (!updated) {
        return reply.status(404).send({ error: "Webhook not found" });
      }
      return updated;
    } catch (error) {
      logger.error(error, "Failed to update webhook");
      return reply.status(500).send({ error: "Failed to update webhook" });
    }
  });

  // Delete webhook
  app.delete("/webhooks/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const userId = requireUserId(request, reply);
      if (!userId) return;
      const [deleted] = await db
        .delete(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
        .returning();
      if (!deleted) {
        return reply.status(404).send({ error: "Webhook not found" });
      }
      return { deleted: true };
    } catch (error) {
      logger.error(error, "Failed to delete webhook");
      return reply.status(500).send({ error: "Failed to delete webhook" });
    }
  });

  // Get webhook deliveries
  app.get("/webhooks/:id/deliveries", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const userId = requireUserId(request, reply);
      if (!userId) return;
      const [webhook] = await db
        .select({ id: webhooks.id })
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, userId)))
        .limit(1);
      if (!webhook) {
        return reply.status(404).send({ error: "Webhook not found" });
      }
      const results = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, id))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50);
      return { deliveries: results };
    } catch (error) {
      logger.error(error, "Failed to fetch deliveries");
      return reply.status(500).send({ error: "Failed to fetch deliveries" });
    }
  });

  // Retry webhook delivery
  app.post("/deliveries/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const userId = requireUserId(request, reply);
      if (!userId) return;
      const [delivery] = await db
        .select()
        .from(webhookDeliveries)
        .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
        .where(and(eq(webhookDeliveries.id, id), eq(webhooks.userId, userId)))
        .limit(1);
      if (!delivery) {
        return reply.status(404).send({ error: "Delivery not found" });
      }
      await db
        .update(webhookDeliveries)
        .set({ status: "pending", nextRetryAt: new Date() })
        .where(eq(webhookDeliveries.id, id));
      return { id, retrying: true };
    } catch (error) {
      logger.error(error, "Failed to retry delivery");
      return reply.status(500).send({ error: "Failed to retry delivery" });
    }
  });

  // Internal: Queue event for delivery
  app.post("/internal/dispatch", async (request, reply) => {
    const { eventType, resourceType, resourceId, payload, userId, organizationId } =
      request.body as {
        eventType: string;
        resourceType: string;
        resourceId: string;
        payload: Record<string, unknown>;
        userId?: string;
        organizationId?: string;
      };

    try {
      const [event] = await db
        .insert(webhookEvents)
        .values({
          id: createId(),
          eventType: eventType as any,
          resourceType,
          resourceId,
          payload,
          userId,
          organizationId,
        })
        .returning();

      // Find matching webhooks and create deliveries
      const matchingWebhooks = await db
        .select()
        .from(webhooks)
        .where(
          and(
            eq(webhooks.status, "active"),
            sql`${webhooks.events}::jsonb @> ${JSON.stringify([eventType])}::jsonb`
          )
        );

      const deliveryIds: string[] = [];
      for (const webhook of matchingWebhooks) {
        const deliveryId = createId();
        await db.insert(webhookDeliveries).values({
          id: deliveryId,
          webhookId: webhook.id,
          eventType: eventType as any,
          eventId: event!.id,
          payload,
          status: "pending",
        });
        deliveryIds.push(deliveryId);
      }

      // Mark event as processed
      await db
        .update(webhookEvents)
        .set({ processed: true, processedAt: new Date() })
        .where(eq(webhookEvents.id, event!.id));

      // Fire-and-forget immediate delivery attempts
      for (const deliveryId of deliveryIds) {
        processDelivery(deliveryId).catch((err) => {
          logger.error({ deliveryId, error: err }, "Immediate delivery attempt failed");
        });
      }

      logger.info(
        { eventType, resourceId, eventId: event!.id, matchedWebhooks: matchingWebhooks.length },
        "Event dispatched"
      );

      return { eventId: event!.id, status: "queued" };
    } catch (error) {
      logger.error(error, "Failed to dispatch event");
      return reply.status(500).send({ error: "Failed to dispatch event" });
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

  try {
    await app.listen({ port, host });
    startProcessor();
    logger.info({ port, host }, "Webhook service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      stopProcessor();
      await app.close();
      process.exit(0);
    });
  }
}

main();
