import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import {
  db,
  notifications,
  notificationPreferences,
  pushSubscriptions,
  eq,
  and,
  desc,
  isNull,
  or,
  gt,
  sql,
} from "@repo/database";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";

export const notificationsRouter = createTRPCRouter({
  // List notifications for current user
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        unreadOnly: z.boolean().default(false),
        type: z
          .enum([
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
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(notifications.userId, ctx.user.id),
        eq(notifications.isDismissed, false),
        or(
          isNull(notifications.expiresAt),
          gt(notifications.expiresAt, new Date())
        ),
      ];

      if (input.unreadOnly) {
        conditions.push(eq(notifications.isRead, false));
      }

      if (input.type) {
        conditions.push(eq(notifications.type, input.type));
      }

      const items = await db
        .select()
        .from(notifications)
        .where(and(...conditions))
        .orderBy(desc(notifications.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get total count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(notifications)
        .where(and(...conditions));

      return {
        items,
        total: countResult?.count || 0,
        hasMore: input.offset + items.length < (countResult?.count || 0),
      };
    }),

  // Get unread count
  getUnreadCount: protectedProcedure.query(async ({ ctx }) => {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false),
          eq(notifications.isDismissed, false),
          or(
            isNull(notifications.expiresAt),
            gt(notifications.expiresAt, new Date())
          )
        )
      );

    return { count: result?.count || 0 };
  }),

  // Get unread counts by type
  getUnreadCountsByType: protectedProcedure.query(async ({ ctx }) => {
    const results = await db
      .select({
        type: notifications.type,
        count: sql<number>`count(*)`,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, ctx.user.id),
          eq(notifications.isRead, false),
          eq(notifications.isDismissed, false)
        )
      )
      .groupBy(notifications.type);

    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r.type] = r.count;
    }
    return counts;
  }),

  // Mark as read
  markAsRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [notification] = await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id)
          )
        )
        .returning();

      return notification;
    }),

  // Mark all as read
  markAllAsRead: protectedProcedure
    .input(
      z.object({
        type: z
          .enum([
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
          ])
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const conditions = [
        eq(notifications.userId, ctx.user.id),
        eq(notifications.isRead, false),
      ];

      if (input.type) {
        conditions.push(eq(notifications.type, input.type));
      }

      await db
        .update(notifications)
        .set({ isRead: true, readAt: new Date() })
        .where(and(...conditions));

      return { success: true };
    }),

  // Dismiss notification
  dismiss: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [notification] = await db
        .update(notifications)
        .set({ isDismissed: true, dismissedAt: new Date() })
        .where(
          and(
            eq(notifications.id, input.id),
            eq(notifications.userId, ctx.user.id)
          )
        )
        .returning();

      return notification;
    }),

  // Get notification preferences
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const [preferences] = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, ctx.user.id))
      .limit(1);

    // Return defaults if not set
    if (!preferences) {
      return {
        emailEnabled: true,
        emailDigest: "daily" as const,
        pushEnabled: true,
        inAppEnabled: true,
        inAppSound: true,
        quietHoursEnabled: false,
        typeSettings: null,
      };
    }

    return preferences;
  }),

  // Update notification preferences
  updatePreferences: protectedProcedure
    .input(
      z.object({
        emailEnabled: z.boolean().optional(),
        emailDigest: z
          .enum(["instant", "hourly", "daily", "weekly", "never"])
          .optional(),
        pushEnabled: z.boolean().optional(),
        inAppEnabled: z.boolean().optional(),
        inAppSound: z.boolean().optional(),
        quietHoursEnabled: z.boolean().optional(),
        quietHoursStart: z.string().optional(),
        quietHoursEnd: z.string().optional(),
        quietHoursTimezone: z.string().optional(),
        typeSettings: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(notificationPreferences)
        .where(eq(notificationPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        const [preferences] = await db
          .update(notificationPreferences)
          .set(input)
          .where(eq(notificationPreferences.userId, ctx.user.id))
          .returning();
        return preferences;
      }

      const id = createId();
      const [preferences] = await db
        .insert(notificationPreferences)
        .values({
          id,
          userId: ctx.user.id,
          ...input,
        })
        .returning();

      return preferences;
    }),

  // Register push subscription
  registerPushSubscription: protectedProcedure
    .input(
      z.object({
        endpoint: z.string(),
        p256dh: z.string(),
        auth: z.string(),
        userAgent: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if subscription already exists
      const [existing] = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.endpoint, input.endpoint)
          )
        )
        .limit(1);

      if (existing) {
        // Update last used
        const [subscription] = await db
          .update(pushSubscriptions)
          .set({ lastUsedAt: new Date() })
          .where(eq(pushSubscriptions.id, existing.id))
          .returning();
        return subscription;
      }

      const id = createId();
      const [subscription] = await db
        .insert(pushSubscriptions)
        .values({
          id,
          userId: ctx.user.id,
          ...input,
        })
        .returning();

      return subscription;
    }),

  // Unregister push subscription
  unregisterPushSubscription: protectedProcedure
    .input(z.object({ endpoint: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.userId, ctx.user.id),
            eq(pushSubscriptions.endpoint, input.endpoint)
          )
        );

      return { success: true };
    }),
});
