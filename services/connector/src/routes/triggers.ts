import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  db,
  connectorDefinitions,
  userConnectors,
  scheduledTasks,
  triggerEvents,
  taskExecutions,
  eq,
  and,
} from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { getUserId, logger } from "../lib/helpers.js";
import { createId } from "@repo/service-utils";

// ─── Raw body symbol for webhook signature verification ──────────
// Standard Webhooks signs over the exact raw bytes. We capture them
// via a preParsing hook so JSON.stringify round-trip doesn't break sigs.
const kRawBody = Symbol("rawBody");

declare module "fastify" {
  interface FastifyRequest {
    [kRawBody]?: string;
  }
}

// ─── Routes ────────────────────────────────────────────────────────

export async function triggerRoutes(app: FastifyInstance) {
  // Capture raw body for the webhook route (needed for signature verification)
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.url === "/triggers/webhook" && request.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of payload) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const raw = Buffer.concat(chunks).toString("utf8");
      (request as any)[kRawBody] = raw;
      // Return a new readable stream so Fastify can still parse the body
      const { Readable } = await import("node:stream");
      return Readable.from([raw]);
    }
    return payload;
  });
  // ── List available trigger types for user's connected apps ──
  app.get("/triggers/types", async (request) => {
    const userId = getUserId(request);

    // Get user's connected integrations
    const integrations = await db
      .select({
        connector: userConnectors,
        definition: connectorDefinitions,
      })
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id),
      )
      .where(and(eq(userConnectors.userId, userId), eq(userConnectors.status, "connected")));

    if (integrations.length === 0) {
      return { triggers: [] };
    }

    const composio = getComposioClient();
    const toolkitNames = integrations.map(
      (i: { definition: { type: string } }) => i.definition.type.toUpperCase(),
    );

    try {
      // Fetch triggers for connected apps
      const allTriggers: Array<{
        slug: string;
        appName: string;
        description: string;
        configSchema?: Record<string, unknown>;
        payloadSchema?: Record<string, unknown>;
      }> = [];

      for (const toolkit of toolkitNames) {
        try {
          const result = await composio.triggers.listTypes({
            toolkitSlugs: [toolkit.toLowerCase()],
            limit: 100,
          });
          const triggers = (result as any)?.items ?? [];

          for (const t of triggers) {
            // Only include triggers for this specific toolkit
            if ((t.toolkit?.slug || "").toLowerCase() === toolkit.toLowerCase()) {
              allTriggers.push({
                slug: t.slug ?? t.name ?? "",
                appName: (t.toolkit?.slug ?? toolkit).toLowerCase(),
                description: t.description ?? t.name ?? "",
                configSchema: t.config?.properties ?? t.config,
                payloadSchema: t.payload?.properties ?? t.payload,
              });
            }
          }
        } catch (err) {
          logger.warn({ toolkit, error: err }, "Failed to list triggers for toolkit");
        }
      }

      return { triggers: allTriggers };
    } catch (error) {
      logger.error(error, "Failed to list trigger types");
      return { triggers: [] };
    }
  });

  // ── Get trigger type config/payload schema ──
  app.get<{ Params: { slug: string } }>("/triggers/types/:slug", async (request, reply) => {
    const { slug } = request.params;

    try {
      const composio = getComposioClient();
      const triggerType = await composio.triggers.getType(slug);

      if (!triggerType) {
        return reply.status(404).send({ error: "Trigger type not found" });
      }

      return {
        slug: (triggerType as any).slug ?? slug,
        appName: (triggerType as any).toolkit?.slug?.toLowerCase() ?? "",
        description: (triggerType as any).description ?? "",
        configSchema: (triggerType as any).config ?? {},
        payloadSchema: (triggerType as any).payload ?? {},
      };
    } catch (error) {
      logger.error({ slug, error }, "Failed to get trigger type");
      return reply.status(500).send({ error: "Failed to get trigger type" });
    }
  });

  // ── Create (subscribe) a Composio trigger instance ──
  app.post("/triggers/subscribe", async (request, reply) => {
    const userId = getUserId(request);
    const body = request.body as {
      triggerSlug: string;
      triggerConfig?: Record<string, unknown>;
      scheduledTaskId?: string;
    };

    if (!body.triggerSlug) {
      return reply.status(400).send({ error: "Missing triggerSlug" });
    }

    try {
      const composio = getComposioClient();

      // Find user's connected account for this trigger's app
      const triggerAppPrefix = body.triggerSlug.split("_")[0]?.toLowerCase() ?? "";

      const [definition] = await db
        .select()
        .from(connectorDefinitions)
        .where(eq(connectorDefinitions.type, triggerAppPrefix))
        .limit(1);

      let connectedAccountId: string | undefined;
      if (definition) {
        const [integration] = await db
          .select()
          .from(userConnectors)
          .where(
            and(
              eq(userConnectors.userId, userId),
              eq(userConnectors.connectorDefinitionId, definition.id),
              eq(userConnectors.status, "connected"),
            ),
          )
          .limit(1);

        connectedAccountId =
          (integration?.metadata as Record<string, unknown> | null)?.composioConnectionId as
            | string
            | undefined;
      }

      if (!connectedAccountId) {
        return reply.status(400).send({
          error: `App "${triggerAppPrefix}" is not connected. Connect the app first in Applications.`,
          code: "APP_NOT_CONNECTED",
        });
      }

      // Create trigger via Composio API
      // SDK create(userId, slug, body) requires a Composio user_id. Use the
      // internal client directly with connected_account_id.
      const result = await (composio as any).client.triggerInstances.upsert(
        body.triggerSlug,
        {
          connected_account_id: connectedAccountId,
          trigger_config: body.triggerConfig ?? {},
        },
      );

      const triggerId: string = result?.trigger_id ?? result?.triggerId ?? result?.id ?? "";

      logger.info(
        { userId, triggerSlug: body.triggerSlug, triggerId },
        "Composio trigger subscribed",
      );

      return { triggerId };
    } catch (error) {
      logger.error({ error, triggerSlug: body.triggerSlug }, "Failed to subscribe trigger");
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Failed to subscribe trigger",
      });
    }
  });

  // ── List user's active triggers ──
  app.get("/triggers/active", async (request) => {
    const userId = getUserId(request);

    try {
      // Find tasks with active triggers for this user
      const tasks = await db
        .select({
          id: scheduledTasks.id,
          name: scheduledTasks.name,
          composioTriggerId: scheduledTasks.composioTriggerId,
          triggerAppName: scheduledTasks.triggerAppName,
          triggerEventSlug: scheduledTasks.triggerEventSlug,
          triggerEnabled: scheduledTasks.triggerEnabled,
          lastTriggerAt: scheduledTasks.lastTriggerAt,
        })
        .from(scheduledTasks)
        .where(
          and(
            eq(scheduledTasks.userId, userId),
            eq(scheduledTasks.triggerEnabled, true),
          ),
        );

      return { triggers: tasks };
    } catch (error) {
      logger.error(error, "Failed to list active triggers");
      return { triggers: [] };
    }
  });

  // ── Disable a trigger ──
  app.patch<{ Params: { triggerId: string } }>(
    "/triggers/:triggerId/disable",
    async (request, reply) => {
      const userId = getUserId(request);
      const { triggerId } = request.params;

      try {
        const composio = getComposioClient();
        await composio.triggers.disable(triggerId);

        // Update any tasks using this trigger
        await db
          .update(scheduledTasks)
          .set({ triggerEnabled: false })
          .where(
            and(
              eq(scheduledTasks.composioTriggerId, triggerId),
              eq(scheduledTasks.userId, userId),
            ),
          );

        logger.info({ userId, triggerId }, "Trigger disabled");
        return { success: true };
      } catch (error) {
        logger.error({ triggerId, error }, "Failed to disable trigger");
        return reply.status(500).send({ error: "Failed to disable trigger" });
      }
    },
  );

  // ── Enable a trigger ──
  app.patch<{ Params: { triggerId: string } }>(
    "/triggers/:triggerId/enable",
    async (request, reply) => {
      const userId = getUserId(request);
      const { triggerId } = request.params;

      try {
        const composio = getComposioClient();
        await composio.triggers.enable(triggerId);

        // Update any tasks using this trigger
        await db
          .update(scheduledTasks)
          .set({ triggerEnabled: true })
          .where(
            and(
              eq(scheduledTasks.composioTriggerId, triggerId),
              eq(scheduledTasks.userId, userId),
            ),
          );

        logger.info({ userId, triggerId }, "Trigger enabled");
        return { success: true };
      } catch (error) {
        logger.error({ triggerId, error }, "Failed to enable trigger");
        return reply.status(500).send({ error: "Failed to enable trigger" });
      }
    },
  );

  // ── Delete a trigger permanently ──
  app.delete<{ Params: { triggerId: string } }>(
    "/triggers/:triggerId",
    async (request, reply) => {
      const userId = getUserId(request);
      const { triggerId } = request.params;

      try {
        const composio = getComposioClient();
        await composio.triggers.delete(triggerId);

        // Clear trigger info from any tasks using it
        await db
          .update(scheduledTasks)
          .set({
            triggerEnabled: false,
            composioTriggerId: null,
          })
          .where(
            and(
              eq(scheduledTasks.composioTriggerId, triggerId),
              eq(scheduledTasks.userId, userId),
            ),
          );

        logger.info({ userId, triggerId }, "Trigger deleted");
        return { success: true };
      } catch (error) {
        logger.error({ triggerId, error }, "Failed to delete trigger");
        return reply.status(500).send({ error: "Failed to delete trigger" });
      }
    },
  );

  // ── PUBLIC: Receive Composio webhook ──
  // Composio V3 uses Standard Webhooks format:
  //   Headers: webhook-id, webhook-timestamp, webhook-signature (v1,<base64>)
  //   Payload: { id, type, timestamp, metadata: { trigger_slug, trigger_id, log_id, ... }, data: {...} }
  app.post("/triggers/webhook", async (request, reply) => {
    const rawBody = (request as any)[kRawBody] as string | undefined;
    if (!rawBody) {
      logger.warn("No raw body captured for webhook — cannot verify signature");
      return reply.status(400).send({ error: "Missing body" });
    }

    // Standard Webhooks headers
    const webhookId = request.headers["webhook-id"] as string | undefined;
    const webhookTimestamp = request.headers["webhook-timestamp"] as string | undefined;
    const webhookSignature = request.headers["webhook-signature"] as string | undefined;

    // Verify signature using SDK if secret is configured
    const secret = process.env.COMPOSIO_WEBHOOK_SECRET;
    if (secret) {
      if (!webhookSignature || !webhookId || !webhookTimestamp) {
        logger.warn("Missing Standard Webhooks headers (webhook-id/timestamp/signature)");
        return reply.status(401).send({ error: "Missing webhook signature headers" });
      }

      try {
        const composio = getComposioClient();
        // SDK verifyWebhook handles Standard Webhooks signature verification
        // and returns the parsed + normalized payload
        const result = await composio.triggers.verifyWebhook({
          id: webhookId,
          payload: rawBody,
          timestamp: webhookTimestamp,
          signature: webhookSignature,
          secret,
          tolerance: 300, // 5 minute tolerance
        });

        logger.info(
          { version: result.version, triggerSlug: result.payload?.triggerSlug },
          "Webhook signature verified via SDK",
        );
      } catch (verifyErr) {
        logger.warn({ error: verifyErr }, "Invalid Composio webhook signature");
        return reply.status(401).send({ error: "Invalid signature" });
      }
    } else {
      logger.warn("COMPOSIO_WEBHOOK_SECRET not set — skipping signature verification");
    }

    // Parse the payload (Fastify already parsed it, but use raw for safety)
    const payload = typeof request.body === "object" ? request.body : JSON.parse(rawBody);

    // Extract trigger metadata — V3 format uses trigger_slug (NOT trigger_name)
    // Also handle V1/V2 formats for backwards compatibility
    const triggerId: string =
      (payload as any)?.metadata?.trigger_id ??
      (payload as any)?.trigger_id ??
      (payload as any)?.triggerId ?? "";
    const eventSlug: string =
      (payload as any)?.metadata?.trigger_slug ??   // V3 format (correct)
      (payload as any)?.metadata?.trigger_name ??   // V1 fallback
      (payload as any)?.trigger_name ??
      (payload as any)?.triggerName ?? "";
    const externalEventId: string =
      (payload as any)?.metadata?.log_id ??
      (payload as any)?.log_id ??
      (payload as any)?.id ?? "";
    const eventData: Record<string, unknown> =
      (payload as any)?.data ?? (payload as any)?.payload ?? payload ?? {};

    if (!triggerId) {
      logger.warn({ payload: Object.keys((payload as any) ?? {}) }, "Webhook missing trigger_id");
      return reply.status(400).send({ error: "Missing trigger_id" });
    }

    logger.info({ triggerId, eventSlug, externalEventId }, "Composio webhook received");

    try {
      // Find the scheduled task that uses this trigger
      const [task] = await db
        .select()
        .from(scheduledTasks)
        .where(eq(scheduledTasks.composioTriggerId, triggerId))
        .limit(1);

      if (!task) {
        logger.warn({ triggerId }, "No task found for trigger — orphan webhook");
        return reply.status(200).send({ status: "ignored", reason: "no_matching_task" });
      }

      // Check task is enabled and not paused
      if (!task.isEnabled || task.status === "paused" || task.status === "cancelled") {
        logger.info({ taskId: task.id, status: task.status }, "Task disabled/paused — skipping");
        return reply.status(200).send({ status: "ignored", reason: "task_disabled" });
      }

      // Dedup: check if we already processed this event
      if (externalEventId && task.lastTriggerEventId === externalEventId) {
        logger.info({ taskId: task.id, externalEventId }, "Duplicate trigger event — skipping");
        return reply.status(200).send({ status: "ignored", reason: "duplicate" });
      }

      // Check end conditions
      if (task.endDate && new Date(task.endDate) <= new Date()) {
        return reply.status(200).send({ status: "ignored", reason: "past_end_date" });
      }
      if (task.maxRuns != null && (task.runCount ?? 0) >= task.maxRuns) {
        return reply.status(200).send({ status: "ignored", reason: "max_runs_exceeded" });
      }

      // Insert trigger_events audit record
      const triggerEventId = createId();
      await db.insert(triggerEvents).values({
        id: triggerEventId,
        scheduledTaskId: task.id,
        composioTriggerId: triggerId,
        eventSlug,
        externalEventId: externalEventId || null,
        payload: eventData,
        processed: false,
      });

      // Create execution record
      const executionId = createId();
      await db.insert(taskExecutions).values({
        id: executionId,
        scheduledTaskId: task.id,
        status: "pending",
      });

      // Update audit record with execution link
      await db
        .update(triggerEvents)
        .set({ executionId })
        .where(eq(triggerEvents.id, triggerEventId));

      // Update task trigger tracking
      await db
        .update(scheduledTasks)
        .set({
          lastTriggerAt: new Date(),
          lastTriggerEventId: externalEventId || null,
        })
        .where(eq(scheduledTasks.id, task.id));

      // Dispatch execution via task service / Inngest
      const taskServiceUrl = process.env.TASK_SERVICE_URL || "http://localhost:4002";
      const gatewaySecret = process.env.GATEWAY_SECRET || "";

      // Send the RAW task prompt — Inngest execute-task handles prepending trigger context
      const prompt =
        (task.payload as Record<string, unknown> | null)?.prompt ??
        task.description ??
        task.name ??
        "";

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": task.userId,
      };
      if (gatewaySecret) {
        headers["x-gateway-secret"] = gatewaySecret;
      }

      // Call the task service trigger endpoint to dispatch via Inngest
      try {
        const resp = await fetch(`${taskServiceUrl}/scheduled-tasks/${task.id}/trigger-event`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            executionId,
            triggerEvent: {
              slug: eventSlug,
              data: eventData,
              triggerId,
            },
            prompt,
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!resp.ok) {
          logger.warn(
            { taskId: task.id, status: resp.status },
            "Task service trigger-event returned error",
          );
        }
      } catch (dispatchErr) {
        logger.error(
          { taskId: task.id, error: dispatchErr },
          "Failed to dispatch trigger execution",
        );
      }

      // Send notification to user via Knock (in-app + push + email)
      try {
        const notificationUrl =
          process.env.NOTIFICATION_SERVICE_URL || "http://localhost:4006";
        const notifHeaders: Record<string, string> = {
          "Content-Type": "application/json",
          "x-user-id": task.userId,
        };
        if (gatewaySecret) {
          notifHeaders["x-gateway-secret"] = gatewaySecret;
        }

        await fetch(`${notificationUrl}/send`, {
          method: "POST",
          headers: notifHeaders,
          body: JSON.stringify({
            userId: task.userId,
            type: "task",
            title: `Trigger fired: ${task.triggerAppName ?? eventSlug}`,
            message: `Your ${eventSlug} trigger activated. Task "${task.name}" is executing.`,
            priority: "normal",
            actionUrl: `/tasks/${task.id}`,
            entityType: "scheduledTask",
            entityId: task.id,
          }),
          signal: AbortSignal.timeout(5_000),
        }).catch(() => {}); // Non-fatal
      } catch {
        // Notification is non-fatal
      }

      logger.info(
        { taskId: task.id, executionId, triggerId, eventSlug },
        "Trigger event dispatched for execution",
      );

      return reply.status(200).send({
        status: "dispatched",
        taskId: task.id,
        executionId,
        triggerEventId,
      });
    } catch (error) {
      logger.error({ triggerId, error }, "Failed to process webhook");
      return reply.status(500).send({ error: "Internal error processing webhook" });
    }
  });

  // ── Internal: One-time Composio webhook subscription setup ──
  // Registers a URL-based webhook with Composio. After registration, all trigger
  // events for this org are POSTed to the URL with Standard Webhooks headers.
  // The returned `secret` must be stored as COMPOSIO_WEBHOOK_SECRET env var.
  app.post("/triggers/webhook/register", async (request, reply) => {
    const body = request.body as { webhookUrl: string };

    if (!body.webhookUrl) {
      return reply.status(400).send({ error: "Missing webhookUrl" });
    }

    try {
      const apiKey = process.env.COMPOSIO_API_KEY;
      // Composio V3 webhook subscription API
      const resp = await fetch("https://backend.composio.dev/api/v3/webhook_subscriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey ?? "",
        },
        body: JSON.stringify({
          webhook_url: body.webhookUrl,
          enabled_events: [
            "composio.trigger.message",
            "composio.connected_account.expired",
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "Unknown error");
        throw new Error(`Composio webhook registration failed: ${resp.status} - ${errText}`);
      }

      const result = await resp.json() as Record<string, unknown>;

      logger.info({ webhookUrl: body.webhookUrl }, "Composio webhook subscription registered");

      // IMPORTANT: The returned `secret` MUST be stored as COMPOSIO_WEBHOOK_SECRET
      // for Standard Webhooks signature verification to work.
      return {
        success: true,
        secret: (result as any)?.secret ?? null,
        subscriptionId: (result as any)?.id ?? null,
        message: "Store the `secret` as COMPOSIO_WEBHOOK_SECRET env var",
      };
    } catch (error) {
      logger.error({ error }, "Failed to register Composio webhook");
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Failed to register webhook",
      });
    }
  });
}

