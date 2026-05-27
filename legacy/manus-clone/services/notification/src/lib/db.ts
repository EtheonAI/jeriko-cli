import { eq, and, desc, sql } from "drizzle-orm";

export let db: any;
export let notifications: any;
export let notificationPreferences: any;
export let pushSubscriptions: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  notifications = resolved.notifications;
  notificationPreferences = resolved.notificationPreferences;
  pushSubscriptions = resolved.pushSubscriptions;
}

export { eq, and, desc, sql };
