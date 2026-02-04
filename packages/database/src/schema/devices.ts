import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { users } from "./users";

// Device type enum values
export const deviceTypes = ["browser", "desktop", "mobile", "server"] as const;
export type DeviceType = (typeof deviceTypes)[number];

// Device status enum values
export const deviceStatuses = ["online", "offline", "busy", "error"] as const;
export type DeviceStatus = (typeof deviceStatuses)[number];

// Devices table - represents controlled devices (browsers, desktops, etc.)
export const devices = pgTable("devices", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id"),

  name: text("name").notNull(),
  type: text("type").$type<DeviceType>().notNull().default("browser"),
  status: text("status").$type<DeviceStatus>().notNull().default("offline"),

  // Connection details
  connectionId: text("connection_id"), // WebSocket/MQTT connection ID
  lastHeartbeat: timestamp("last_heartbeat"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  // Device capabilities and config
  capabilities: jsonb("capabilities").$type<string[]>().default([]),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),

  // Browser-specific
  browserType: text("browser_type"), // chromium, firefox, webkit
  browserVersion: text("browser_version"),
  viewport: jsonb("viewport").$type<{ width: number; height: number }>(),

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const devicesRelations = relations(devices, ({ one, many }) => ({
  user: one(users, {
    fields: [devices.userId],
    references: [users.id],
  }),
  sessions: many(deviceSessions),
  commands: many(deviceCommands),
}));

// Device sessions - active control sessions
export const deviceSessions = pgTable("device_sessions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  deviceId: text("device_id").notNull(),
  agentSessionId: text("agent_session_id"), // Link to agent session if controlled by agent
  userId: text("user_id").notNull(),

  status: text("status").$type<"active" | "paused" | "ended">().notNull().default("active"),

  // Session timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),

  // Session state
  currentUrl: text("current_url"),
  currentTitle: text("current_title"),
  screenshot: text("screenshot"), // Base64 or URL to latest screenshot

  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const deviceSessionsRelations = relations(deviceSessions, ({ one, many }) => ({
  device: one(devices, {
    fields: [deviceSessions.deviceId],
    references: [devices.id],
  }),
  user: one(users, {
    fields: [deviceSessions.userId],
    references: [users.id],
  }),
  commands: many(deviceCommands),
}));

// Device commands - commands sent to devices
export const deviceCommands = pgTable("device_commands", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  deviceId: text("device_id").notNull(),
  sessionId: text("session_id"),

  // Command details
  type: text("type").notNull(), // navigate, click, type, screenshot, etc.
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

  // Execution status
  status: text("status").$type<"pending" | "executing" | "completed" | "failed">().notNull().default("pending"),
  result: jsonb("result").$type<Record<string, unknown>>(),
  error: text("error"),

  // Timing
  queuedAt: timestamp("queued_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),

  // Retry handling
  retryCount: integer("retry_count").notNull().default(0),
  maxRetries: integer("max_retries").notNull().default(3),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deviceCommandsRelations = relations(deviceCommands, ({ one }) => ({
  device: one(devices, {
    fields: [deviceCommands.deviceId],
    references: [devices.id],
  }),
  session: one(deviceSessions, {
    fields: [deviceCommands.sessionId],
    references: [deviceSessions.id],
  }),
}));

// Type exports
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type DeviceSession = typeof deviceSessions.$inferSelect;
export type NewDeviceSession = typeof deviceSessions.$inferInsert;
export type DeviceCommand = typeof deviceCommands.$inferSelect;
export type NewDeviceCommand = typeof deviceCommands.$inferInsert;
