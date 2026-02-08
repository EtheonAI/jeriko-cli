import { eq, and, desc, sql } from "drizzle-orm";

export let db: any;
export let webhooks: any;
export let webhookDeliveries: any;
export let webhookEvents: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  webhooks = resolved.webhooks;
  webhookDeliveries = resolved.webhookDeliveries;
  webhookEvents = resolved.webhookEvents;
}

export { eq, and, desc, sql };
