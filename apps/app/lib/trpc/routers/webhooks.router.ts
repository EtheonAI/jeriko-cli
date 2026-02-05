import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { db, webhooks, webhookDeliveries, eq, and, desc } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";
import { randomBytes, createHmac } from "crypto";

// Webhook event types
const webhookEventTypes = [
  "agent.session.created",
  "agent.session.completed",
  "agent.task.created",
  "agent.task.completed",
  "agent.task.failed",
  "project.created",
  "project.updated",
  "project.deleted",
  "file.uploaded",
  "file.processed",
  "connector.synced",
  "connector.error",
  "billing.subscription.created",
  "billing.subscription.updated",
  "billing.payment.succeeded",
  "billing.payment.failed",
] as const;

export const webhooksRouter = createTRPCRouter({
  // List user's webhooks
  list: protectedProcedure.query(async ({ ctx }) => {
    const items = await db
      .select()
      .from(webhooks)
      .where(eq(webhooks.userId, ctx.user.id))
      .orderBy(desc(webhooks.createdAt));

    return items;
  }),

  // Get a single webhook
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)))
      .limit(1);

    if (!webhook) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
    }

    return webhook;
  }),

  // Create a webhook
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        url: z.string().url(),
        events: z.array(z.enum(webhookEventTypes)).min(1),
        headers: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = createId();
      const secret = `whsec_${randomBytes(24).toString("hex")}`;

      const [webhook] = await db
        .insert(webhooks)
        .values({
          id,
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          url: input.url,
          events: input.events,
          headers: input.headers || {},
          secret,
          status: "active",
        })
        .returning();

      return webhook;
    }),

  // Update a webhook
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        url: z.string().url().optional(),
        events: z.array(z.enum(webhookEventTypes)).min(1).optional(),
        headers: z.record(z.string()).optional(),
        status: z.enum(["active", "inactive"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      // Verify ownership
      const [existing] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, id), eq(webhooks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const [webhook] = await db
        .update(webhooks)
        .set(updates)
        .where(eq(webhooks.id, id))
        .returning();

      return webhook;
    }),

  // Delete a webhook
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      await db.delete(webhooks).where(eq(webhooks.id, input.id));

      return { success: true };
    }),

  // Regenerate webhook secret
  regenerateSecret: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const newSecret = `whsec_${randomBytes(24).toString("hex")}`;

      const [webhook] = await db
        .update(webhooks)
        .set({ secret: newSecret })
        .where(eq(webhooks.id, input.id))
        .returning();

      return webhook;
    }),

  // Get webhook deliveries
  getDeliveries: protectedProcedure
    .input(
      z.object({
        webhookId: z.string(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify webhook ownership
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, ctx.user.id)))
        .limit(1);

      if (!webhook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const deliveries = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.webhookId, input.webhookId))
        .orderBy(desc(webhookDeliveries.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return deliveries;
    }),

  // Get available event types
  getEventTypes: protectedProcedure.query(() => {
    return webhookEventTypes.map((type) => ({
      value: type,
      label: type
        .split(".")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      category: type.split(".")[0],
    }));
  }),

  // Test webhook (send a test payload)
  test: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const [webhook] = await db
      .select()
      .from(webhooks)
      .where(and(eq(webhooks.id, input.id), eq(webhooks.userId, ctx.user.id)))
      .limit(1);

    if (!webhook) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
    }

    // Send test payload
    try {
      const testPayload = {
        event: "test",
        timestamp: new Date().toISOString(),
        data: {
          message: "This is a test webhook delivery",
          webhookId: webhook.id,
        },
      };

      const body = JSON.stringify(testPayload);
      const timestamp = Math.floor(Date.now() / 1000);
      const signedContent = `${timestamp}.${body}`;
      const signature = `v1=${createHmac("sha256", webhook.secret).update(signedContent).digest("hex")}`;

      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Id": webhook.id,
          "X-Webhook-Event": "test",
          "X-Webhook-Timestamp": String(timestamp),
          "X-Webhook-Signature": signature,
          ...((webhook.headers as Record<string, string>) || {}),
        },
        body,
      });

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }),

  // Get full delivery details
  getDeliveryDetails: protectedProcedure
    .input(z.object({ deliveryId: z.string(), webhookId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Verify webhook ownership
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, ctx.user.id)))
        .limit(1);

      if (!webhook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const [delivery] = await db
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.id, input.deliveryId),
            eq(webhookDeliveries.webhookId, input.webhookId)
          )
        )
        .limit(1);

      if (!delivery) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found" });
      }

      return delivery;
    }),

  // Retry a failed delivery
  retryDelivery: protectedProcedure
    .input(z.object({ deliveryId: z.string(), webhookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify webhook ownership
      const [webhook] = await db
        .select()
        .from(webhooks)
        .where(and(eq(webhooks.id, input.webhookId), eq(webhooks.userId, ctx.user.id)))
        .limit(1);

      if (!webhook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Webhook not found" });
      }

      const [delivery] = await db
        .select()
        .from(webhookDeliveries)
        .where(
          and(
            eq(webhookDeliveries.id, input.deliveryId),
            eq(webhookDeliveries.webhookId, input.webhookId)
          )
        )
        .limit(1);

      if (!delivery) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found" });
      }

      await db
        .update(webhookDeliveries)
        .set({
          status: "pending",
          nextRetryAt: new Date(),
          error: null,
          responseStatus: null,
          responseBody: null,
          responseHeaders: null,
        })
        .where(eq(webhookDeliveries.id, input.deliveryId));

      return { success: true };
    }),
});
