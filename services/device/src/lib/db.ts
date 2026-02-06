import { eq, and, or, desc, asc, sql, isNull } from "drizzle-orm";

// Database and schema references - populated by initDb()
export let db: any;
export let devices: any;
export let deviceSessions: any;
export let deviceCommands: any;
export let smartHomeHubs: any;
export let smartHomeEntities: any;

export async function initDb() {
  const mod = await import("@repo/database");
  db = mod.db;
  devices = mod.devices;
  deviceSessions = mod.deviceSessions;
  deviceCommands = mod.deviceCommands;
  smartHomeHubs = mod.smartHomeHubs;
  smartHomeEntities = mod.smartHomeEntities;
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
