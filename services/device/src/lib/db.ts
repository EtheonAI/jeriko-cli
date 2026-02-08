import { eq, and, or, desc, asc, sql } from "drizzle-orm";
import { isNull } from "drizzle-orm";

// Database and schema references - populated by initDb()
export let db: any;
export let devices: any;
export let deviceSessions: any;
export let deviceCommands: any;
export let smartHomeHubs: any;
export let smartHomeEntities: any;

export async function initDb() {
  const mod = await import("@repo/database");
  const resolved = (mod as any).default ?? mod;
  db = resolved.db;
  devices = resolved.devices;
  deviceSessions = resolved.deviceSessions;
  deviceCommands = resolved.deviceCommands;
  smartHomeHubs = resolved.smartHomeHubs;
  smartHomeEntities = resolved.smartHomeEntities;
}

// Re-export drizzle helpers (direct dependency, no resolution issue)
export { eq, and, or, desc, asc, sql, isNull };

// Re-export types
export type {
  Device,
  NewDevice,
  DeviceSession,
  NewDeviceSession,
  DeviceCommand,
  NewDeviceCommand,
  SmartHomeHub,
  NewSmartHomeHub,
  SmartHomeEntity,
  NewSmartHomeEntity,
} from "@repo/database";
