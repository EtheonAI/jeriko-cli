import type { Database } from "@repo/database";

type DatabaseModule = typeof import("@repo/database");

export let db: Database;
export let webhooks: DatabaseModule["webhooks"];
export let webhookDeliveries: DatabaseModule["webhookDeliveries"];
export let webhookEvents: DatabaseModule["webhookEvents"];

export async function initDb() {
  const mod = await import("@repo/database");
  db = mod.db;
  webhooks = mod.webhooks;
  webhookDeliveries = mod.webhookDeliveries;
  webhookEvents = mod.webhookEvents;
}

export { eq, and, desc, sql } from "@repo/database";
