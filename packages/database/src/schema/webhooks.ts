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

// Webhook event types
export const webhookEventTypes = [
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
export type WebhookEventType = (typeof webhookEventTypes)[number];

// Webhook status
export const webhookStatuses = ["active", "inactive", "suspended"] as const;
export type WebhookStatus = (typeof webhookStatuses)[number];

// Webhooks table - webhook endpoint configurations
export const webhooks = pgTable("webhooks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id"),

  name: text("name").notNull(),
  description: text("description"),

  // Endpoint configuration
  url: text("url").notNull(),
  secret: text("secret").notNull(), // For HMAC signature verification

  // Event subscription
  events: jsonb("events").$type<WebhookEventType[]>().notNull().default([]),

  // Status
  status: text("status").$type<WebhookStatus>().notNull().default("active"),

  // Headers to include
  headers: jsonb("headers").$type<Record<string, string>>().default({}),

  // Retry configuration
  maxRetries: integer("max_retries").notNull().default(3),
  retryDelayMs: integer("retry_delay_ms").notNull().default(1000),
  timeoutMs: integer("timeout_ms").notNull().default(30000),

  // Rate limiting
  rateLimitPerMinute: integer("rate_limit_per_minute").default(60),

  // Stats
  totalDeliveries: integer("total_deliveries").notNull().default(0),
  successfulDeliveries: integer("successful_deliveries").notNull().default(0),
  failedDeliveries: integer("failed_deliveries").notNull().default(0),
  lastDeliveryAt: timestamp("last_delivery_at"),

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  user: one(users, {
    fields: [webhooks.userId],
    references: [users.id],
  }),
  deliveries: many(webhookDeliveries),
}));

// Webhook deliveries - delivery attempts and logs
export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  webhookId: text("webhook_id").notNull(),

  // Event details
  eventType: text("event_type").$type<WebhookEventType>().notNull(),
  eventId: text("event_id").notNull(), // Unique ID for deduplication
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

  // Delivery status
  status: text("status").$type<"pending" | "delivered" | "failed" | "retrying">().notNull().default("pending"),

  // Request details
  requestHeaders: jsonb("request_headers").$type<Record<string, string>>(),
  requestBody: text("request_body"),
  signature: text("signature"), // HMAC signature sent

  // Response details
  responseStatus: integer("response_status"),
  responseHeaders: jsonb("response_headers").$type<Record<string, string>>(),
  responseBody: text("response_body"),

  // Error handling
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),

  // Timing
  attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, {
    fields: [webhookDeliveries.webhookId],
    references: [webhooks.id],
  }),
}));

// Webhook events queue - events waiting to be delivered
export const webhookEvents = pgTable("webhook_events", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),

  // Event details
  eventType: text("event_type").$type<WebhookEventType>().notNull(),
  resourceType: text("resource_type").notNull(), // agent, project, file, etc.
  resourceId: text("resource_id").notNull(),

  // Event data
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),

  // Targeting
  userId: text("user_id"),
  organizationId: text("organization_id"),

  // Processing status
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at"),

  // Metadata
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
