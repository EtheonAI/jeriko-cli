import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";
import {
  db,
  users,
  subscriptionPlans,
  userSubscriptions,
  creditPackages,
  creditBalances,
  creditTransactions,
  usageRecords,
  paymentMethods,
  invoices,
  eq,
  and,
  desc,
  gte,
  lte,
  sql,
} from "@repo/database";
import { stripe } from "@repo/payments";
import { getOrCreateStripeCustomer } from "@/lib/stripe/helpers";
import { createId } from "@paralleldrive/cuid2";
import { TRPCError } from "@trpc/server";

export const billingRouter = createTRPCRouter({
  // List subscription plans (public)
  listPlans: publicProcedure.query(async () => {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);

    return plans;
  }),

  // Get user's plan limits (concurrent sessions, parallel subtasks, etc.)
  getPlanLimits: protectedProcedure.query(async ({ ctx }) => {
    const [sub] = await db
      .select({
        planId: userSubscriptions.planId,
        status: userSubscriptions.status,
      })
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, ctx.user.id))
      .limit(1);

    if (!sub || sub.status !== "active") {
      return {
        maxConcurrentSessions: 1,
        maxParallelSubtasks: 5,
        maxScheduledTasks: 1,
        maxStepsPerSession: 15,
        dailyRefreshCredits: 300,
        planType: "free" as const,
        planName: "Rubic Light",
      };
    }

    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, sub.planId))
      .limit(1);

    if (!plan) {
      return {
        maxConcurrentSessions: 1,
        maxParallelSubtasks: 5,
        maxScheduledTasks: 1,
        maxStepsPerSession: 15,
        dailyRefreshCredits: 300,
        planType: "free" as const,
        planName: "Rubic Light",
      };
    }

    return {
      maxConcurrentSessions: plan.maxConcurrentSessions,
      maxParallelSubtasks: plan.maxParallelSubtasks,
      maxScheduledTasks: plan.maxScheduledTasks,
      maxStepsPerSession: plan.maxStepsPerSession,
      dailyRefreshCredits: plan.dailyRefreshCredits,
      planType: plan.type,
      planName: plan.name,
    };
  }),

  // Get detailed credit breakdown (daily, monthly, purchased, starter)
  getCreditBreakdown: protectedProcedure.query(async ({ ctx }) => {
    const [balance] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, ctx.user.id))
      .limit(1);

    if (!balance) {
      return {
        total: 0,
        daily: { available: 0, used: 0, total: 0, refreshAmount: 300 },
        monthly: { available: 0, used: 0, total: 0 },
        purchased: { available: 0, used: 0, total: 0 },
        starter: { available: 0, used: 0, total: 0 },
        autoTopupEnabled: false,
      };
    }

    return {
      total: balance.balance,
      daily: {
        available: Math.max(0, balance.dailyCredits - balance.dailyCreditsUsed),
        used: balance.dailyCreditsUsed,
        total: balance.dailyCredits,
        refreshAmount: balance.dailyRefreshAmount,
      },
      monthly: {
        available: Math.max(0, balance.periodCredits - balance.periodCreditsUsed),
        used: balance.periodCreditsUsed,
        total: balance.periodCredits,
      },
      purchased: {
        available: Math.max(0, balance.purchasedCredits - balance.purchasedCreditsUsed),
        used: balance.purchasedCreditsUsed,
        total: balance.purchasedCredits,
      },
      starter: {
        available: Math.max(0, balance.starterCredits - balance.starterCreditsUsed),
        used: balance.starterCreditsUsed,
        total: balance.starterCredits,
      },
      autoTopupEnabled: balance.autoTopupEnabled,
    };
  }),


  // Get user's current subscription
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    const [subscription] = await db
      .select({
        subscription: userSubscriptions,
        plan: subscriptionPlans,
      })
      .from(userSubscriptions)
      .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
      .where(eq(userSubscriptions.userId, ctx.user.id))
      .limit(1);

    return subscription || null;
  }),

  // Get credit balance
  getCreditBalance: protectedProcedure.query(async ({ ctx }) => {
    const [balance] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, ctx.user.id))
      .limit(1);

    if (!balance) {
      // Return default balance if not found
      return {
        balance: 0,
        periodCredits: 0,
        periodCreditsUsed: 0,
        purchasedCredits: 0,
        autoTopupEnabled: false,
      };
    }

    return balance;
  }),

  // List credit packages
  listCreditPackages: publicProcedure.query(async () => {
    const packages = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.isActive, true))
      .orderBy(creditPackages.sortOrder);

    return packages;
  }),

  // Get credit transactions
  getCreditTransactions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        type: z
          .enum([
            "subscription_grant",
            "purchase",
            "usage",
            "refund",
            "adjustment",
            "bonus",
            "expiration",
          ])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(creditTransactions.userId, ctx.user.id)];

      if (input.type) {
        conditions.push(eq(creditTransactions.type, input.type));
      }

      const transactions = await db
        .select()
        .from(creditTransactions)
        .where(and(...conditions))
        .orderBy(desc(creditTransactions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return transactions;
    }),

  // Get usage records
  getUsageRecords: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        type: z.enum(["chat", "agent", "connector", "storage", "api"]).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(usageRecords.userId, ctx.user.id)];

      if (input.type) {
        conditions.push(eq(usageRecords.type, input.type));
      }

      if (input.startDate) {
        conditions.push(gte(usageRecords.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(usageRecords.createdAt, input.endDate));
      }

      const records = await db
        .select()
        .from(usageRecords)
        .where(and(...conditions))
        .orderBy(desc(usageRecords.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return records;
    }),

  // Get usage summary for current period
  getUsageSummary: protectedProcedure.query(async ({ ctx }) => {
    const [balance] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, ctx.user.id))
      .limit(1);

    if (!balance || !balance.periodStart || !balance.periodEnd) {
      return {
        total: 0,
        byType: {},
        periodStart: null,
        periodEnd: null,
      };
    }

    const usageByType = await db
      .select({
        type: usageRecords.type,
        total: sql<number>`sum(${usageRecords.credits})`,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.userId, ctx.user.id),
          gte(usageRecords.createdAt, balance.periodStart),
          lte(usageRecords.createdAt, balance.periodEnd)
        )
      )
      .groupBy(usageRecords.type);

    const byType: Record<string, number> = {};
    let total = 0;
    for (const u of usageByType) {
      byType[u.type] = u.total;
      total += u.total;
    }

    return {
      total,
      byType,
      periodStart: balance.periodStart,
      periodEnd: balance.periodEnd,
    };
  }),

  // Update auto top-up settings
  updateAutoTopup: protectedProcedure
    .input(
      z.object({
        enabled: z.boolean(),
        threshold: z.number().min(0).optional(),
        packageId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, ctx.user.id))
        .limit(1);

      if (existing) {
        const [balance] = await db
          .update(creditBalances)
          .set({
            autoTopupEnabled: input.enabled,
            autoTopupThreshold: input.threshold,
            autoTopupPackageId: input.packageId,
          })
          .where(eq(creditBalances.userId, ctx.user.id))
          .returning();
        return balance;
      }

      const id = createId();
      const [balance] = await db
        .insert(creditBalances)
        .values({
          id,
          userId: ctx.user.id,
          autoTopupEnabled: input.enabled,
          autoTopupThreshold: input.threshold,
          autoTopupPackageId: input.packageId,
        })
        .returning();

      return balance;
    }),

  // List payment methods
  listPaymentMethods: protectedProcedure.query(async ({ ctx }) => {
    const methods = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, ctx.user.id))
      .orderBy(desc(paymentMethods.isDefault), desc(paymentMethods.createdAt));

    return methods;
  }),

  // Set default payment method
  setDefaultPaymentMethod: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify ownership
      const [existing] = await db
        .select()
        .from(paymentMethods)
        .where(and(eq(paymentMethods.id, input.id), eq(paymentMethods.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment method not found",
        });
      }

      // Clear other defaults
      await db
        .update(paymentMethods)
        .set({ isDefault: false })
        .where(eq(paymentMethods.userId, ctx.user.id));

      // Set new default
      const [method] = await db
        .update(paymentMethods)
        .set({ isDefault: true })
        .where(eq(paymentMethods.id, input.id))
        .returning();

      return method;
    }),

  // Delete payment method
  deletePaymentMethod: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(paymentMethods)
        .where(and(eq(paymentMethods.id, input.id), eq(paymentMethods.userId, ctx.user.id)))
        .limit(1);

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Payment method not found",
        });
      }

      // Detach from Stripe (may already be detached)
      if (existing.stripePaymentMethodId) {
        try {
          await stripe.paymentMethods.detach(existing.stripePaymentMethodId);
        } catch {
          // Payment method may already be detached in Stripe
        }
      }

      await db.delete(paymentMethods).where(eq(paymentMethods.id, input.id));

      return { success: true };
    }),

  // List invoices
  listInvoices: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        status: z.enum(["draft", "open", "paid", "void", "uncollectible"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(invoices.userId, ctx.user.id)];

      if (input.status) {
        conditions.push(eq(invoices.status, input.status));
      }

      const items = await db
        .select()
        .from(invoices)
        .where(and(...conditions))
        .orderBy(desc(invoices.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return items;
    }),

  // Get a single invoice
  getInvoice: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(and(eq(invoices.id, input.id), eq(invoices.userId, ctx.user.id)))
        .limit(1);

      if (!invoice) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
      }

      return invoice;
    }),

  // Create checkout session for subscription
  createSubscriptionCheckout: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        interval: z.enum(["monthly", "yearly"]),
        successUrl: z.string(),
        cancelUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get plan
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, input.planId))
        .limit(1);

      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan not found" });
      }

      const priceId =
        input.interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

      if (!priceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Plan does not have a Stripe price configured",
        });
      }

      const customerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        ctx.user.email,
        ctx.user.name
      );

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          userId: ctx.user.id,
          planId: input.planId,
          interval: input.interval,
        },
        subscription_data: {
          metadata: {
            userId: ctx.user.id,
            planId: input.planId,
          },
        },
      });

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    }),

  // Create checkout session for credit package
  createCreditPurchaseCheckout: protectedProcedure
    .input(
      z.object({
        packageId: z.string(),
        successUrl: z.string(),
        cancelUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get package
      const [pkg] = await db
        .select()
        .from(creditPackages)
        .where(eq(creditPackages.id, input.packageId))
        .limit(1);

      if (!pkg) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Credit package not found",
        });
      }

      if (!pkg.stripePriceId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Credit package does not have a Stripe price configured",
        });
      }

      const customerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        ctx.user.email,
        ctx.user.name
      );

      const totalCredits = pkg.credits + (pkg.bonusCredits ?? 0);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: {
          userId: ctx.user.id,
          packageId: input.packageId,
          credits: String(totalCredits),
          type: "credit_purchase",
        },
      });

      return {
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    }),

  // Cancel subscription
  cancelSubscription: protectedProcedure
    .input(
      z.object({
        cancelAtPeriodEnd: z.boolean().default(true),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, ctx.user.id))
        .limit(1);

      if (!subscription) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No active subscription",
        });
      }

      // Cancel in Stripe
      if (subscription.stripeSubscriptionId) {
        if (input.cancelAtPeriodEnd) {
          await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
            cancel_at_period_end: true,
          });
        } else {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        }
      }

      const [updated] = await db
        .update(userSubscriptions)
        .set({
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          canceledAt: input.cancelAtPeriodEnd ? null : new Date(),
          cancellationReason: input.reason,
          status: input.cancelAtPeriodEnd ? subscription.status : "canceled",
        })
        .where(eq(userSubscriptions.id, subscription.id))
        .returning();

      return updated;
    }),

  // Reactivate subscription
  reactivateSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, ctx.user.id))
      .limit(1);

    if (!subscription) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No subscription found",
      });
    }

    if (!subscription.cancelAtPeriodEnd) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Subscription is not set to cancel",
      });
    }

    // Reactivate in Stripe
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    }

    const [updated] = await db
      .update(userSubscriptions)
      .set({
        cancelAtPeriodEnd: false,
        cancellationReason: null,
      })
      .where(eq(userSubscriptions.id, subscription.id))
      .returning();

    return updated;
  }),

  // Get billing portal URL
  getBillingPortalUrl: protectedProcedure
    .input(z.object({ returnUrl: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await db
        .select({ stripeCustomerId: users.stripeCustomerId })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!user?.stripeCustomerId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No Stripe customer found. Please subscribe to a plan first.",
        });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: input.returnUrl,
      });

      return {
        url: session.url,
      };
    }),
});
