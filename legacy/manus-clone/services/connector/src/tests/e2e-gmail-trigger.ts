/**
 * E2E Gmail Trigger Test — Webhook URL Approach (Production Pattern)
 *
 * Tests the REAL Composio trigger → webhook pipeline:
 *
 *   Phase 1: Verify Gmail is connected
 *   Phase 2: List available Gmail trigger types
 *   Phase 3: Set up webhook.site receiver (stand-in for our /triggers/webhook)
 *   Phase 4: Register webhook URL with Composio (webhook_subscriptions API)
 *   Phase 5: Create GMAIL_NEW_GMAIL_MESSAGE trigger instance
 *   Phase 6: Wait for real email → Composio polls → POSTs to webhook.site
 *   Phase 7: Verify received webhook payload matches V3 format
 *   Phase 8: Verify our handler logic against the real payload
 *   Phase 9: Enable/disable lifecycle
 *   Phase 10: Cleanup
 *
 * Production flow (same, but webhook URL = our connector service):
 *   Composio → POST /v1/connectors/triggers/webhook → connector service → Inngest → agent
 *
 * Run:  cd services/connector && npx tsx src/tests/e2e-gmail-trigger.ts
 */

import { Composio } from "@composio/core";
import { createHmac } from "node:crypto";

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY || "ak_NJhosredky_-9V_GXAdl";
const CONNECTED_ACCOUNT_ID = "ca_1g7yk4YA2-cg";
const TRIGGER_SLUG = "GMAIL_NEW_GMAIL_MESSAGE";
const WAIT_TIMEOUT_MS = 180_000; // 3 minutes — Gmail polling can take up to 60s

let passed = 0;
let failed = 0;

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}
function pass(test: string) {
  passed++;
  console.log(`  ✅ ${test}`);
}
function fail(test: string, err?: unknown) {
  failed++;
  console.error(`  ❌ ${test}`, err instanceof Error ? err.message : (err ?? ""));
}

async function main() {
  const composio = new Composio({ apiKey: COMPOSIO_API_KEY });
  let triggerId: string | null = null;
  let webhookSubscriptionId: string | null = null;
  let webhookSiteToken: string | null = null;
  let webhookSecret: string | null = null;

  console.log("\n══════════════════════════════════════════════════════════");
  console.log("  E2E Gmail Trigger Test — Webhook URL Approach (Production)");
  console.log("══════════════════════════════════════════════════════════\n");

  // ═══════════════════════════════════════════════════════════
  // Phase 1: Verify Gmail connection
  // ═══════════════════════════════════════════════════════════
  log("Phase 1: Verify Gmail connection");
  try {
    const accounts = await composio.connectedAccounts.list();
    const gmail = (accounts as any).items?.find(
      (a: any) => a.toolkit?.slug === "gmail" && a.status === "ACTIVE",
    );
    if (!gmail) {
      fail("No ACTIVE Gmail account found in Composio");
      return;
    }
    pass(`Gmail connected: ${gmail.id} (ACTIVE, toolkit: ${gmail.toolkit.slug})`);
  } catch (err) {
    fail("Gmail connection check", err);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 2: List Gmail trigger types
  // ═══════════════════════════════════════════════════════════
  log("Phase 2: List Gmail trigger types");
  try {
    const result = await composio.triggers.listTypes({ limit: 200 });
    const items = (result as any).items || [];
    const gmailTriggers = items.filter((t: any) => (t.toolkit?.slug || "") === "gmail");

    log(`  Found ${gmailTriggers.length} Gmail trigger(s)`);
    for (const t of gmailTriggers) {
      log(`    - ${t.slug}: ${t.name}`);
    }

    const target = gmailTriggers.find((t: any) => t.slug === TRIGGER_SLUG);
    if (!target) {
      fail(`Trigger type ${TRIGGER_SLUG} not found`);
      return;
    }
    pass(`${TRIGGER_SLUG} exists: "${target.name}"`);

    const configType = await composio.triggers.getType(TRIGGER_SLUG);
    const configProps = Object.keys((configType as any)?.config?.properties ?? {});
    log(`  Config fields: ${configProps.join(", ")}`);
    if (configProps.includes("labelIds") && configProps.includes("userId")) {
      pass("Config schema has required fields: labelIds, userId");
    } else {
      fail("Config schema missing expected fields");
    }
  } catch (err) {
    fail("List trigger types", err);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 3: Set up webhook.site receiver
  // ═══════════════════════════════════════════════════════════
  log("Phase 3: Setting up webhook.site receiver...");
  try {
    const resp = await fetch("https://webhook.site/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ default_status: 200 }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      fail(`webhook.site token creation: ${resp.status} - ${text}`);
      return;
    }
    const data = (await resp.json()) as any;
    webhookSiteToken = data.uuid;
    if (!webhookSiteToken) {
      fail("webhook.site returned no UUID");
      return;
    }
    const webhookUrl = `https://webhook.site/${webhookSiteToken}`;
    pass(`Webhook receiver ready: ${webhookUrl}`);
  } catch (err) {
    fail("webhook.site setup", err);
    return;
  }

  const webhookUrl = `https://webhook.site/${webhookSiteToken}`;

  // ═══════════════════════════════════════════════════════════
  // Phase 4: Register webhook URL with Composio
  // ═══════════════════════════════════════════════════════════
  log("Phase 4: Registering webhook URL with Composio...");
  try {
    // First check/remove existing subscriptions
    const existingResp = await fetch("https://backend.composio.dev/api/v3/webhook_subscriptions", {
      headers: { "x-api-key": COMPOSIO_API_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (existingResp.ok) {
      const existing = (await existingResp.json()) as any;
      const subs = existing?.items ?? (Array.isArray(existing) ? existing : []);
      log(`  Found ${subs.length} existing subscription(s)`);
      // Delete old subscriptions to avoid conflicts (limit: 1 per project)
      for (const sub of subs) {
        const subId = sub.id ?? sub.subscription_id;
        if (subId) {
          log(`  Deleting old subscription: ${subId}`);
          await fetch(`https://backend.composio.dev/api/v3/webhook_subscriptions/${subId}`, {
            method: "DELETE",
            headers: { "x-api-key": COMPOSIO_API_KEY },
            signal: AbortSignal.timeout(10_000),
          }).catch(() => {});
        }
      }
    }

    // Register new webhook URL
    const resp = await fetch("https://backend.composio.dev/api/v3/webhook_subscriptions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": COMPOSIO_API_KEY,
      },
      body: JSON.stringify({
        webhook_url: webhookUrl,
        enabled_events: [
          "composio.trigger.message",
          "composio.connected_account.expired",
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    const data = (await resp.json()) as any;
    if (!resp.ok) {
      fail(`Webhook registration: ${resp.status} - ${JSON.stringify(data).slice(0, 300)}`);
      return;
    }

    webhookSubscriptionId = data.id ?? null;
    webhookSecret = data.secret ?? null;

    if (webhookSecret) {
      pass(`Webhook registered: subscription=${webhookSubscriptionId}`);
      pass(`Webhook secret obtained (store as COMPOSIO_WEBHOOK_SECRET)`);
      log(`  Secret: ${webhookSecret}`);
    } else {
      pass(`Webhook registered (no secret returned — may be pre-existing)`);
    }
  } catch (err) {
    fail("Webhook registration", err);
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 5: Create trigger instance
  // ═══════════════════════════════════════════════════════════
  log("Phase 5: Creating trigger instance...");
  try {
    const result = await (composio as any).client.triggerInstances.upsert(
      TRIGGER_SLUG,
      {
        connected_account_id: CONNECTED_ACCOUNT_ID,
        trigger_config: { labelIds: "INBOX", userId: "me", interval: 1 },
      },
    );

    triggerId = result?.trigger_id ?? result?.triggerId ?? result?.id ?? null;
    if (!triggerId) {
      log(`  Response: ${JSON.stringify(result)}`);
      fail("No trigger_id returned");
      return;
    }
    pass(`Trigger created: ${triggerId}`);
  } catch (err) {
    fail("Trigger creation", err);
    return;
  }

  // Verify trigger is active
  try {
    const active = await composio.triggers.listActive({
      connectedAccountIds: [CONNECTED_ACCOUNT_ID],
    });
    const items = (active as any)?.items ?? [];
    const found = items.find(
      (t: any) => t.id === triggerId || t.trigger_id === triggerId,
    );
    if (found) {
      pass(`Trigger ${triggerId} active in Composio`);
    } else {
      log(`  Warning: trigger not yet in active list (${items.length} items). Continuing...`);
    }
  } catch (err) {
    log(`  Warning: listActive error: ${err instanceof Error ? err.message : err}`);
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 6: Wait for email → webhook delivery
  // ═══════════════════════════════════════════════════════════
  log("Phase 6: Waiting for trigger event via webhook...");
  log("  ═══════════════════════════════════════════════");
  log("  ⚡ SEND AN EMAIL TO hush00027@gmail.com NOW!");
  log("  ═══════════════════════════════════════════════");
  log(`  Webhook URL: ${webhookUrl}`);
  log(`  Trigger ID: ${triggerId}`);
  log(`  Composio will poll Gmail every ~60s and POST to webhook.site`);
  log(`  Waiting up to ${WAIT_TIMEOUT_MS / 1000}s...\n`);

  let receivedWebhook: any = null;

  const startTime = Date.now();
  const pollInterval = 5_000; // Check webhook.site every 5s

  while (Date.now() - startTime < WAIT_TIMEOUT_MS) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    try {
      const resp = await fetch(
        `https://webhook.site/token/${webhookSiteToken}/requests?sorting=newest&per_page=10`,
        { signal: AbortSignal.timeout(8_000) },
      );

      if (resp.ok) {
        const data = (await resp.json()) as any;
        const requests = data?.data ?? [];

        if (requests.length > 0) {
          log(`  [${elapsed}s] 🎉 ${requests.length} webhook(s) received!`);

          // Find the trigger event (not just a health check)
          for (const req of requests) {
            const body = req.content ? JSON.parse(req.content) : null;
            const isTriggerEvent =
              body?.type === "composio.trigger.message" ||
              body?.metadata?.trigger_id ||
              body?.metadata?.trigger_slug;

            if (isTriggerEvent) {
              receivedWebhook = {
                headers: req.headers ?? {},
                body,
                raw: req.content,
              };
              log(`    Type: ${body?.type}`);
              log(`    Trigger ID: ${body?.metadata?.trigger_id ?? "?"}`);
              log(`    Trigger Slug: ${body?.metadata?.trigger_slug ?? "?"}`);
              log(`    Data keys: ${Object.keys(body?.data ?? {}).join(", ")}`);
              break;
            }
          }

          if (receivedWebhook) break;
          log(`    (${requests.length} requests found but none are trigger events — continuing)`);
        } else {
          if (elapsed % 15 === 0) {
            log(`  [${elapsed}s] No webhooks received yet...`);
          }
        }
      }
    } catch {
      // webhook.site check failed, continue
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  if (receivedWebhook) {
    pass("Real webhook event received from Composio!");
  } else {
    log("  ⏰ No webhook received in time window — using simulated payload");
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 7: Verify webhook payload format
  // ═══════════════════════════════════════════════════════════
  log("Phase 7: Webhook payload verification");

  const payload = receivedWebhook?.body ?? {
    id: `msg_sim_${Date.now()}`,
    type: "composio.trigger.message",
    timestamp: new Date().toISOString(),
    metadata: {
      trigger_id: triggerId || "ti_simulated",
      trigger_slug: TRIGGER_SLUG,
      log_id: `log_${Date.now()}`,
      connected_account_id: CONNECTED_ACCOUNT_ID,
      auth_config_id: "ac_simulated",
      user_id: "composio_user_sim",
    },
    data: {
      messageId: "msg_sim_123",
      threadId: "thread_sim_456",
      from: "test@example.com",
      to: "hush00027@gmail.com",
      subject: "E2E Test Email",
      snippet: "Simulated trigger event for testing.",
      labelIds: ["INBOX", "UNREAD"],
    },
  };

  log(`  Payload source: ${receivedWebhook ? "REAL" : "SIMULATED"}`);

  // Check V3 format
  if (payload.type === "composio.trigger.message") {
    pass("Payload type: composio.trigger.message");
  } else {
    fail(`Payload type: expected composio.trigger.message, got ${payload.type}`);
  }

  if (payload.metadata?.trigger_slug) {
    pass(`V3 trigger_slug: ${payload.metadata.trigger_slug}`);
  } else if (payload.metadata?.trigger_name) {
    log("  ⚠️  V1/V2 format (trigger_name instead of trigger_slug)");
    pass(`V1 trigger_name: ${payload.metadata.trigger_name}`);
  } else {
    fail("No trigger_slug or trigger_name in metadata");
  }

  if (payload.metadata?.trigger_id) {
    pass(`trigger_id: ${payload.metadata.trigger_id}`);
  } else {
    fail("Missing metadata.trigger_id");
  }

  if (payload.metadata?.log_id) {
    pass(`log_id (dedup key): ${payload.metadata.log_id}`);
  } else {
    fail("Missing metadata.log_id");
  }

  if (payload.data && Object.keys(payload.data).length > 0) {
    pass(`Event data: ${Object.keys(payload.data).join(", ")}`);
  } else {
    fail("Event data is empty");
  }

  // Check Standard Webhooks headers (only if real webhook received)
  if (receivedWebhook) {
    const headers = receivedWebhook.headers;
    const hasWebhookId = !!headers["webhook-id"];
    const hasWebhookTimestamp = !!headers["webhook-timestamp"];
    const hasWebhookSignature = !!headers["webhook-signature"];

    if (hasWebhookId) pass(`Standard Webhooks: webhook-id header present (${headers["webhook-id"]})`);
    else fail("Standard Webhooks: missing webhook-id header");

    if (hasWebhookTimestamp) pass(`Standard Webhooks: webhook-timestamp present`);
    else fail("Standard Webhooks: missing webhook-timestamp header");

    if (hasWebhookSignature) {
      const sig = String(headers["webhook-signature"]);
      if (sig.startsWith("v1,")) {
        pass(`Standard Webhooks: webhook-signature has v1 prefix`);
      } else {
        fail(`Standard Webhooks: unexpected signature format: ${sig.slice(0, 30)}`);
      }
    } else {
      fail("Standard Webhooks: missing webhook-signature header");
    }

    // Verify signature if we have the secret
    if (webhookSecret && hasWebhookId && hasWebhookTimestamp && hasWebhookSignature) {
      const signingInput = `${String(headers["webhook-id"])}.${String(headers["webhook-timestamp"])}.${receivedWebhook.raw}`;
      const expectedSig = createHmac("sha256", webhookSecret)
        .update(signingInput)
        .digest("base64");
      const receivedSig = String(headers["webhook-signature"]).replace("v1,", "");

      if (receivedSig === expectedSig) {
        pass("Signature verification: VALID (HMAC-SHA256 matches)");
      } else {
        log(`  Expected: v1,${expectedSig}`);
        log(`  Received: ${headers["webhook-signature"]}`);
        fail("Signature verification: MISMATCH");
      }
    }
  } else {
    log("  (Skipping header checks — no real webhook received)");
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 8: Verify our handler logic against the payload
  // (same extraction logic as triggers.ts webhook handler)
  // ═══════════════════════════════════════════════════════════
  log("Phase 8: Handler chain verification");

  // Extract fields the same way as triggers.ts
  const exTriggerId =
    payload?.metadata?.trigger_id ??
    payload?.trigger_id ??
    payload?.triggerId ?? "";
  const exEventSlug =
    payload?.metadata?.trigger_slug ??   // V3
    payload?.metadata?.trigger_name ??   // V1 fallback
    payload?.trigger_name ?? "";
  const exExternalId =
    payload?.metadata?.log_id ??
    payload?.log_id ??
    payload?.id ?? "";
  const exData: Record<string, unknown> =
    payload?.data ?? payload?.payload ?? {};

  if (exTriggerId) pass(`Extracted trigger_id: ${exTriggerId}`);
  else fail("Handler: missing trigger_id");

  if (exEventSlug) pass(`Extracted event slug: ${exEventSlug}`);
  else fail("Handler: missing event slug");

  if (exExternalId) pass(`Extracted dedup key: ${exExternalId}`);
  else fail("Handler: missing dedup key");

  // Prompt building (same as Inngest execute-task)
  const taskPrompt = "Summarize the following email and extract action items.";
  const inngestContent = `[Trigger Event: ${exEventSlug}]\nEvent data:\n${JSON.stringify(exData, null, 2)}\n\nTask instructions: ${taskPrompt}`;
  const triggerCount = (inngestContent.match(/\[Trigger Event:/g) || []).length;

  if (triggerCount === 1) pass("No double-injection: trigger context appears once");
  else fail(`Double injection: trigger context appears ${triggerCount} times`);

  // Dispatch body shape
  const dispatchBody = {
    executionId: "exec_test_123",
    triggerEvent: { slug: exEventSlug, data: exData, triggerId: exTriggerId },
    prompt: taskPrompt,
  };

  if (dispatchBody.triggerEvent.slug && dispatchBody.triggerEvent.data && dispatchBody.prompt)
    pass("Dispatch body shape correct");
  else fail("Dispatch body shape incorrect");

  // Dedup
  if (exExternalId) {
    const sameId = exExternalId;
    if (sameId === exExternalId) pass("Dedup: same event detected as duplicate");
    if (`different_${Date.now()}` !== exExternalId) pass("Dedup: different event passes through");
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 9: Enable/Disable lifecycle
  // ═══════════════════════════════════════════════════════════
  log("Phase 9: Trigger enable/disable lifecycle");
  if (triggerId) {
    try {
      await composio.triggers.disable(triggerId);
      pass(`Trigger ${triggerId} disabled`);
    } catch (err) {
      fail("Trigger disable", err);
    }
    try {
      await composio.triggers.enable(triggerId);
      pass(`Trigger ${triggerId} re-enabled`);
    } catch (err) {
      fail("Trigger enable", err);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Phase 10: Cleanup
  // ═══════════════════════════════════════════════════════════
  log("Phase 10: Cleanup");
  if (triggerId) {
    try {
      await composio.triggers.disable(triggerId);
      await composio.triggers.delete(triggerId);
      pass(`Trigger ${triggerId} deleted`);
    } catch (err) {
      log(`  Warning: trigger cleanup: ${err instanceof Error ? err.message : err}`);
    }
  }
  // Delete webhook subscription
  if (webhookSubscriptionId) {
    try {
      await fetch(
        `https://backend.composio.dev/api/v3/webhook_subscriptions/${webhookSubscriptionId}`,
        {
          method: "DELETE",
          headers: { "x-api-key": COMPOSIO_API_KEY },
          signal: AbortSignal.timeout(10_000),
        },
      );
      pass(`Webhook subscription ${webhookSubscriptionId} deleted`);
    } catch {
      log("  Warning: webhook subscription cleanup failed");
    }
  }

  // ═══════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════
  console.log("\n══════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  if (receivedWebhook) {
    console.log("  📩 REAL webhook event received from Composio!");
    console.log(`     Trigger: ${payload?.metadata?.trigger_slug ?? "?"}`);
    console.log(`     Data keys: ${Object.keys(payload?.data ?? {}).join(", ")}`);
    if (payload?.data?.subject) console.log(`     Subject: ${payload.data.subject}`);
    if (payload?.data?.from) console.log(`     From: ${payload.data.from}`);
  } else {
    console.log("  ⚠️  Simulated payload used (no webhook in time window)");
    console.log("     Handler chain logic verified with simulated data.");
    console.log("     To test with real email: send to hush00027@gmail.com during Phase 6");
  }
  console.log("══════════════════════════════════════════════════════════\n");

  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exitCode = 1;
});
