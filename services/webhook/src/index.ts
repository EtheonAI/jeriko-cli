import { createService, typedRoute, createId, z } from "@repo/service-utils";
import { NotFoundError, AuthenticationError } from "@repo/service-utils/errors";
import { db, webhooks, webhookDeliveries, webhookEvents, eq, and, desc, sql, initDb } from "./lib/db.js";
import { processDelivery } from "./lib/deliver.js";
import { startProcessor, stopProcessor } from "./lib/processor.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const IdParams = z.object({ id: z.string().min(1) });

const CreateWebhookBody = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().optional(),
});

const UpdateWebhookBody = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

const DispatchBody = z.object({
  eventType: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function main() {
  await initDb();

  const { app, logger, start } = await createService({
    name: "webhook",
    port: parseInt(process.env.PORT || "4007", 10),
    publicRoutes: ["/internal/"],
    onShutdown: [stopProcessor],
  });

  // ---------------------------------------------------------------------------
  // Create webhook
  // ---------------------------------------------------------------------------
  app.post(
    "/webhooks",
    typedRoute({ body: CreateWebhookBody }, async (request, reply) => {
      if (!request.userId) throw new AuthenticationError();

      const { name, url, events, secret } = request.body;
      const generatedSecret = secret || crypto.randomUUID();

      const [webhook] = await db
        .insert(webhooks)
        .values({
          id: createId(),
          name,
          url,
          events: events as any,
          secret: generatedSecret,
          userId: request.userId,
          status: "active",
        })
        .returning();

      return reply.success({
        id: webhook!.id,
        name: webhook!.name,
        url: webhook!.url,
        events: webhook!.events,
        secret: generatedSecret,
        status: webhook!.status,
      });
    }),
  );

  // ---------------------------------------------------------------------------
  // List webhooks
  // ---------------------------------------------------------------------------
  app.get(
    "/webhooks",
    typedRoute({}, async (request, reply) => {
      if (!request.userId) throw new AuthenticationError();

      const results = await db
        .select()
        .from(webhooks)
        .where(eq(webhooks.userId, request.userId))
        .orderBy(desc(webhooks.createdAt));

      return reply.success({ webhooks: results });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get webhook
  // ---------------------------------------------------------------------------
  app.get(
    "/webhooks/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      if (!request.userId) throw new AuthenticationError();

      const { id } = request.params;

      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, request.userId)))
        .limit(1);

      if (!webhook) throw new NotFoundError("Webhook");

      return reply.success(webhook);
    }),
  );

  // ---------------------------------------------------------------------------
  // Update webhook
  // ---------------------------------------------------------------------------
  app.patch(
    "/webhooks/:id",
    typedRoute({ params: IdParams, body: UpdateWebhookBody }, async (request, reply) => {
      if (!request.userId) throw new AuthenticationError();

      const { id } = request.params;

      const [updated] = await db
        .update(webhooks)
        .set(request.body as any)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, request.userId)))
        .returning();

      if (!updated) throw new NotFoundError("Webhook");

      return reply.success(updated);
    }),
  );

  // ---------------------------------------------------------------------------
  // Delete webhook
  // ---------------------------------------------------------------------------
  app.delete(
    "/webhooks/:id",
    typedRoute({ params: IdParams }, async (request, reply) => {
      if (!request.userId) throw new AuthenticationError();

      const { id } = request.params;

      const [deleted] = await db
        .delete(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, request.userId)))
        .returning();

      if (!deleted) throw new NotFoundError("Webhook");

      return reply.success({ deleted: true });
    }),
  );

  // ---------------------------------------------------------------------------
  // Get webhook deliveries
  // ---------------------------------------------------------------------------
  app.get(
    "/webhooks/:id/deliveries",
    typedRoute({ params: IdParams }, async (request, reply) => {
      if (!request.userId) throw new AuthenticationError();

      const { id } = request.params;

      // Verify webhook belongs to user
      const [webhook] = await db
        .select({ id: webhooks.id })
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, request.userId)))
        .limit(1);

      if (!webhook) throw new NotFoundError("Webhook");

      const results = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, id))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(50);

      return reply.success({ deliveries: results });
    }),
  );

  // ---------------------------------------------------------------------------
  // Retry webhook delivery
  // ---------------------------------------------------------------------------
  app.post(
    "/deliveries/:id/retry",
    typedRoute({ params: IdParams }, async (request, reply) => {
      if (!request.userId) throw new AuthenticationError();

      const { id } = request.params;

      const [delivery] = await db
        .select()
        .from(webhookDeliveries)
        .innerJoin(webhooks, eq(webhookDeliveries.webhookId, webhooks.id))
        .where(and(eq(webhookDeliveries.id, id), eq(webhooks.userId, request.userId)))
        .limit(1);

      if (!delivery) throw new NotFoundError("Delivery");

      await db
        .update(webhookDeliveries)
        .set({ status: "pending", nextRetryAt: new Date() })
        .where(eq(webhookDeliveries.id, id));

      return reply.success({ id, retrying: true });
    }),
  );

  // ---------------------------------------------------------------------------
  // Internal: Queue event for delivery (no user auth required — service-to-service)
  // ---------------------------------------------------------------------------
  app.post(
    "/internal/dispatch",
    typedRoute({ body: DispatchBody }, async (request, reply) => {
      const { eventType, resourceType, resourceId, payload, userId, organizationId } =
        request.body;

      // Insert event, create deliveries, and mark processed in a single transaction
      const { event, deliveryIds, matchedCount } = await db.transaction(async (tx) => {
        const [evt] = await tx
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
        const matchingWebhooks = await tx
          .select()
          .from(webhooks)
          .where(
            and(
              eq(webhooks.status, "active"),
              sql`${webhooks.events}::jsonb @> ${JSON.stringify([eventType])}::jsonb`,
            ),
          );

        const ids: string[] = [];
        for (const webhook of matchingWebhooks) {
          const deliveryId = createId();
          await tx.insert(webhookDeliveries).values({
            id: deliveryId,
            webhookId: webhook.id,
            eventType: eventType as any,
            eventId: evt!.id,
            payload,
            status: "pending",
          });
          ids.push(deliveryId);
        }

        // Mark event as processed
        await tx
          .update(webhookEvents)
          .set({ processed: true, processedAt: new Date() })
          .where(eq(webhookEvents.id, evt!.id));

        return { event: evt, deliveryIds: ids, matchedCount: matchingWebhooks.length };
      });

      // Fire-and-forget immediate delivery attempts (outside transaction)
      for (const deliveryId of deliveryIds) {
        processDelivery(deliveryId).catch((err) => {
          logger.error({ deliveryId, error: err }, "Immediate delivery attempt failed");
        });
      }

      logger.info(
        { eventType, resourceId, eventId: event!.id, matchedWebhooks: matchedCount },
        "Event dispatched",
      );

      return reply.success({ eventId: event!.id, status: "queued" });
    }),
  );

  // ---------------------------------------------------------------------------
  // Start (processor begins after listen)
  // ---------------------------------------------------------------------------
  startProcessor();
  await start();
}

main();
