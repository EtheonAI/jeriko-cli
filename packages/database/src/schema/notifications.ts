import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { users } from "./users";
import { organizations } from "./organizations";

/**
 * Notifications Schema
 * User notifications and preferences
 */

export type NotificationType =
  | "system"
  | "session"
  | "agent"
  | "team"
  | "billing"
  | "connector"
  | "task"
  | "mention"
  | "share"
  | "comment";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

// Notifications
export const notifications = pgTable("notifications", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: text("organization_id").references(() => organizations.id, {
    onDelete: "cascade",
  }),
  type: text("type", {
    enum: [
      "system",
      "session",
      "agent",
      "team",
      "billing",
      "connector",
      "task",
      "mention",
      "share",
      "comment",
    ],
  }).notNull(),
  priority: text("priority", {
    enum: ["low", "normal", "high", "urgent"],
  })
    .default("normal")
    .notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  // Action data
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  // Reference to related entity
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  // Status
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at", { mode: "date" }),
  isDismissed: boolean("is_dismissed").default(false).notNull(),
  dismissedAt: timestamp("dismissed_at", { mode: "date" }),
  // Metadata
  metadata: jsonb("metadata").$type<{
    icon?: string;
    avatar?: string;
    senderName?: string;
    senderId?: string;
    [key: string]: unknown;
  }>(),
  // Expiration
  expiresAt: timestamp("expires_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
}));

// Notification Preferences
export const notificationPreferences = pgTable("notification_preferences", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  // Email preferences
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  emailDigest: text("email_digest", {
    enum: ["instant", "hourly", "daily", "weekly", "never"],
  })
    .default("daily")
    .notNull(),
  // Push preferences
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  // In-app preferences
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  inAppSound: boolean("in_app_sound").default(true).notNull(),
  // Type-specific settings
  typeSettings: jsonb("type_settings").$type<
    Record<
      NotificationType,
      {
        email: boolean;
        push: boolean;
        inApp: boolean;
      }
    >
  >(),
  // Quiet hours
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false).notNull(),
  quietHoursStart: text("quiet_hours_start"), // HH:MM format
  quietHoursEnd: text("quiet_hours_end"),
  quietHoursTimezone: text("quiet_hours_timezone"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [notificationPreferences.userId],
      references: [users.id],
    }),
  })
);

// Push Subscriptions (for web push notifications)
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at", { mode: "date" }),
});

export const pushSubscriptionsRelations = relations(
  pushSubscriptions,
  ({ one }) => ({
    user: one(users, {
      fields: [pushSubscriptions.userId],
      references: [users.id],
    }),
  })
);

// Export types
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
