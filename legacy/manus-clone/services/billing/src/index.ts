import rawBody from "fastify-raw-body";
import Stripe from "stripe";
import { createService, typedRoute, getEnv, createId, dispatchWebhookEvent, z } from "@repo/service-utils";
import { NotFoundError, ValidationError, AppError, AuthorizationError } from "@repo/service-utils/errors";
import {
  db,
  users,
  subscriptionPlans,
  userSubscriptions,
  creditPackages,
  creditBalances,
  creditTransactions,
  usageRecords,
  usageLedger,
  paymentMethods,
  invoices,
  eq,
  and,
  desc,
  sql,
  gte,
  lte,
  initDb,
} from "./lib/db.js";
import { checkCredits, meterStepFinish, meterToolCall, meterVmTime, getUserPlanLimits, initializeUserCredits, refreshDailyCreditsIfNeeded } from "./lib/metering.js";
import { PLAN_DEFINITIONS, TOOL_CREDIT_COSTS, getToolCreditCost } from "./lib/plans.js";

// ─── Stripe Client ───────────────────────────────────────────────────────────

const stripeKey = getEnv("STRIPE_SECRET_KEY", "");
const stripe = stripeKey
  ? new Stripe(stripeKey, { apiVersion: "2026-04-22.dahlia" })
  : (null as unknown as Stripe);

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

const UserIdParams = z.object({
  userId: z.string().min(1),
});

const IdParams = z.object({
  id: z.string().min(1),
});

const CreateSubscriptionBody = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  paymentMethodId: z.string().min(1).optional(),
  interval: z.enum(["monthly", "yearly"]).default("monthly"),
});

const CancelSubscriptionBody = z.object({
  immediate: z.boolean().default(false),
}).optional();

const PurchaseCreditsBody = z.object({
  userId: z.string().min(1),
  packageId: z.string().min(1),
  paymentMethodId: z.string().min(1).optional(),
});

const RecordUsageBody = z.object({
  userId: z.string().min(1),
  type: z.string().min(1),
  amount: z.number().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const UsageHistoryQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  type: z.string().optional(),
});

const CheckCreditsBody = z.object({
  userId: z.string().min(1),
  required: z.number().positive(),
});

const MeterStepBody = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  stepId: z.string().min(1),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  model: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const MeterToolBody = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  toolName: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const MeterVmTimeBody = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  sandboxId: z.string().min(1),
  durationMinutes: z.number().positive(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─── Custom Errors ───────────────────────────────────────────────────────────

class PaymentRequiredError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 402, "PAYMENT_REQUIRED", true, details);
  }
}

class WebhookConfigError extends AppError {
  constructor(message: string) {
    super(message, 500, "WEBHOOK_CONFIG_ERROR", true);
  }
}

class WebhookSignatureError extends AppError {
  constructor() {
    super("Invalid signature", 400, "INVALID_SIGNATURE", true);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrCreateStripeCustomer(userId: string): Promise<string | null> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return null;

  if (user.stripeCustomerId) return user.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { userId },
  });

  await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
  return customer.id;
}

/** Type for a Drizzle db or transaction — both support the same query methods. */
type DbOrTx = Pick<typeof db, "insert" | "update" | "select" | "delete">;

/** Core logic for granting credits — always runs inside a transaction context. */
async function grantCreditsInTx(
  tx: DbOrTx,
  userId: string,
  amount: number,
  type: "subscription_grant" | "purchase" | "refund" | "adjustment" | "bonus",
  referenceType?: string,
  referenceId?: string,
  description?: string,
  periodDates?: { periodStart: Date; periodEnd: Date }
): Promise<void> {
  // Atomic update — uses SQL addition to avoid read-then-write race condition
  const updateFields: Record<string, unknown> = {
    balance: sql`${creditBalances.balance} + ${amount}`,
  };

  if (type === "subscription_grant" && periodDates) {
    updateFields.periodCredits = amount;
    updateFields.periodCreditsUsed = 0;
    updateFields.periodStart = periodDates.periodStart;
    updateFields.periodEnd = periodDates.periodEnd;
  } else if (type === "purchase") {
    updateFields.purchasedCredits = sql`${creditBalances.purchasedCredits} + ${amount}`;
  }

  const [updated] = await tx
    .update(creditBalances)
    .set(updateFields)
    .where(eq(creditBalances.userId, userId))
    .returning();

  let newBalance: number;

  if (!updated) {
    // No existing record — insert new balance row
    const values: Record<string, unknown> = {
      id: createId(),
      userId,
      balance: amount,
    };

    if (type === "subscription_grant" && periodDates) {
      values.periodCredits = amount;
      values.periodCreditsUsed = 0;
      values.periodStart = periodDates.periodStart;
      values.periodEnd = periodDates.periodEnd;
    } else if (type === "purchase") {
      values.purchasedCredits = amount;
    }

    const [inserted] = await tx
      .insert(creditBalances)
      .values(values as typeof creditBalances.$inferInsert)
      .returning();
    newBalance = inserted!.balance;
  } else {
    newBalance = updated.balance;
  }

  await tx.insert(creditTransactions).values({
    id: createId(),
    userId,
    type,
    amount,
    balanceAfter: newBalance,
    referenceType,
    referenceId,
    description,
  });
}

/**
 * Grant credits to a user's balance and record the transaction.
 * When called with an existing transaction (tx), runs inside that transaction.
 * When called without, creates its own transaction for atomicity.
 */
async function grantCredits(
  userId: string,
  amount: number,
  type: "subscription_grant" | "purchase" | "refund" | "adjustment" | "bonus",
  referenceType?: string,
  referenceId?: string,
  description?: string,
  periodDates?: { periodStart: Date; periodEnd: Date },
  tx?: DbOrTx
): Promise<void> {
  if (tx) {
    // Already inside a transaction — run directly
    await grantCreditsInTx(tx, userId, amount, type, referenceType, referenceId, description, periodDates);
  } else {
    // No transaction provided — create one for atomicity
    await db.transaction(async (newTx) => {
      await grantCreditsInTx(newTx, userId, amount, type, referenceType, referenceId, description, periodDates);
    });
  }
}

function mapStripeStatus(
  status: Stripe.Subscription.Status
): "active" | "past_due" | "canceled" | "trialing" | "incomplete" {
  switch (status) {
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "trialing":
      return "trialing";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    case "unpaid":
    case "paused":
      return "past_due";
    default:
      return "active";
  }
}

async function triggerAutoTopup(userId: string, packageId: string, logger: { info: Function; error: Function }) {
  const [pkg] = await db
    .select()
    .from(creditPackages)
    .where(eq(creditPackages.id, packageId))
    .limit(1);
  if (!pkg || !pkg.stripePriceId) return;

  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)))
    .limit(1);
  if (!method) return;

  const customerId = await getOrCreateStripeCustomer(userId);
  if (!customerId) return;

  const creditsToAdd = pkg.credits + (pkg.bonusCredits || 0);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: pkg.price,
    currency: pkg.currency,
    customer: customerId,
    payment_method: method.stripePaymentMethodId,
    off_session: true,
    confirm: true,
    metadata: { userId, packageId, credits: String(creditsToAdd) },
  });

  if (paymentIntent.status === "succeeded") {
    await grantCredits(
      userId,
      creditsToAdd,
      "purchase",
      "package",
      packageId,
      `Auto top-up: ${pkg.name}`
    );
    logger.info({ userId, packageId, credits: creditsToAdd }, "Auto top-up succeeded");
  }
}

// ─── Server ──────────────────────────────────────────────────────────────────

async function main() {
  await initDb();

  const { app, logger, start } = await createService({
    name: "billing",
    port: parseInt(process.env.PORT || "4008", 10),
    publicRoutes: ["/webhooks/stripe"],
  });

  // Register raw body plugin for Stripe webhook signature verification
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  // ─── Get Subscription Plans ──────────────────────────────────────────────

  app.get("/plans", typedRoute({}, async (_request, reply) => {
    const plans = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.sortOrder);

    return reply.success({ plans });
  }));

  // ─── Get User Subscription ───────────────────────────────────────────────

  app.get("/users/:userId/subscription", typedRoute({ params: UserIdParams }, async (request, reply) => {
    const { userId } = request.params;
    if (request.userId !== userId) throw new AuthorizationError();

    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      return reply.success({ userId, plan: "free", status: "active" });
    }

    return reply.success(subscription);
  }));

  // ─── Create Subscription ─────────────────────────────────────────────────

  app.post("/subscriptions", typedRoute({ body: CreateSubscriptionBody }, async (request, reply) => {
    const { planId, paymentMethodId, interval } = request.body;
    const userId = request.userId;

    // Look up the plan to get Stripe price ID
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId))
      .limit(1);

    if (!plan) {
      throw new NotFoundError("Plan");
    }

    const stripePriceId =
      interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

    if (!stripePriceId) {
      throw new ValidationError("Plan does not have a Stripe price configured");
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(userId);
    if (!customerId) {
      throw new NotFoundError("User");
    }

    // Create Stripe subscription
    const stripeSubscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: stripePriceId }],
      payment_behavior: "default_incomplete",
      ...(paymentMethodId && { default_payment_method: paymentMethodId }),
      metadata: { userId, planId, interval },
      expand: ["latest_invoice.payment_intent"],
    });

    const firstItem = stripeSubscription.items.data[0];
    const periodStart = firstItem ? new Date(firstItem.current_period_start * 1000) : new Date();
    const periodEnd = firstItem ? new Date(firstItem.current_period_end * 1000) : new Date();

    // Insert subscription, sync user, and grant credits in a single transaction
    const subscription = await db.transaction(async (tx) => {
      const [sub] = await tx
        .insert(userSubscriptions)
        .values({
          id: createId(),
          userId,
          planId,
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId: customerId,
          interval,
          status: mapStripeStatus(stripeSubscription.status),
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
        })
        .returning();

      // Sync Stripe fields to users table
      await tx
        .update(users)
        .set({
          stripeCustomerId: customerId,
          stripeSubscriptionId: stripeSubscription.id,
          stripePriceId: stripePriceId,
          stripeCurrentPeriodEnd: periodEnd,
        })
        .where(eq(users.id, userId));

      // Grant initial credits if subscription is active
      if (stripeSubscription.status === "active" && plan.monthlyCredits > 0) {
        await grantCredits(
          userId,
          plan.monthlyCredits,
          "subscription_grant",
          "subscription",
          stripeSubscription.id,
          `${plan.name} plan - initial credits`,
          { periodStart, periodEnd },
          tx
        );
      }

      return sub;
    });

    dispatchWebhookEvent({
      eventType: "billing.subscription.created",
      resourceType: "subscription",
      resourceId: subscription!.id,
      payload: {
        id: subscription!.id,
        planId,
        status: stripeSubscription.status,
        stripeSubscriptionId: stripeSubscription.id,
      },
      userId,
    });

    return reply.success({
      id: subscription!.id,
      userId,
      planId,
      status: stripeSubscription.status,
      stripeSubscriptionId: stripeSubscription.id,
      clientSecret:
        stripeSubscription.status === "incomplete"
          ? (
              stripeSubscription.latest_invoice as Stripe.Invoice & {
                payment_intent: Stripe.PaymentIntent;
              }
            )?.payment_intent?.client_secret
          : undefined,
    });
  }));

  // ─── Cancel Subscription ─────────────────────────────────────────────────

  app.post("/subscriptions/:id/cancel", typedRoute({ params: IdParams, body: CancelSubscriptionBody }, async (request, reply) => {
    const { id } = request.params;
    const immediate = request.body?.immediate ?? false;

    // Look up the subscription to get Stripe ID
    const [existing] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundError("Subscription");
    }

    if (existing.userId !== request.userId) {
      throw new AuthorizationError("Not authorized to cancel this subscription");
    }

    // Cancel in Stripe
    if (existing.stripeSubscriptionId) {
      if (immediate) {
        await stripe.subscriptions.cancel(existing.stripeSubscriptionId);
      } else {
        await stripe.subscriptions.update(existing.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }
    }

    // Update DB
    const [updated] = await db
      .update(userSubscriptions)
      .set({
        cancelAtPeriodEnd: !immediate,
        canceledAt: new Date(),
        ...(immediate && { status: "canceled" as const }),
      })
      .where(eq(userSubscriptions.id, id))
      .returning();

    return reply.success({ id: updated!.id, status: immediate ? "canceled" : "cancel_at_period_end" });
  }));

  // ─── Get Credit Balance ──────────────────────────────────────────────────

  app.get("/users/:userId/credits", typedRoute({ params: UserIdParams }, async (request, reply) => {
    const { userId } = request.params;
    if (request.userId !== userId) throw new AuthorizationError();

    const [balance] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);

    if (!balance) {
      return reply.success({ userId, balance: 0, used: 0 });
    }

    return reply.success({ userId, balance: balance.balance, used: balance.periodCreditsUsed });
  }));

  // ─── Purchase Credits ────────────────────────────────────────────────────

  app.post("/credits/purchase", typedRoute({ body: PurchaseCreditsBody }, async (request, reply) => {
    const { packageId, paymentMethodId } = request.body;
    const userId = request.userId;

    const [pkg] = await db
      .select()
      .from(creditPackages)
      .where(eq(creditPackages.id, packageId))
      .limit(1);

    if (!pkg) {
      throw new NotFoundError("Credit package");
    }

    // Get or create Stripe customer
    const customerId = await getOrCreateStripeCustomer(userId);
    if (!customerId) {
      throw new NotFoundError("User");
    }

    // Resolve payment method: use provided one, or get user's default
    let resolvedPaymentMethodId = paymentMethodId;
    if (!resolvedPaymentMethodId) {
      const [defaultMethod] = await db
        .select()
        .from(paymentMethods)
        .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)))
        .limit(1);
      resolvedPaymentMethodId = defaultMethod?.stripePaymentMethodId;
    }

    if (!resolvedPaymentMethodId) {
      throw new ValidationError("No payment method available");
    }

    const creditsToAdd = pkg.credits + (pkg.bonusCredits || 0);

    // Create and confirm payment intent
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: pkg.price,
        currency: pkg.currency,
        customer: customerId,
        payment_method: resolvedPaymentMethodId,
        off_session: true,
        confirm: true,
        metadata: { userId, packageId, credits: String(creditsToAdd) },
      });

      if (paymentIntent.status !== "succeeded") {
        throw new PaymentRequiredError("Payment requires further action", {
          clientSecret: paymentIntent.client_secret,
          status: paymentIntent.status,
        });
      }

      // Grant credits on successful payment
      await grantCredits(
        userId,
        creditsToAdd,
        "purchase",
        "package",
        packageId,
        `Purchased ${pkg.name}`
      );

      const [balance] = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);

      return reply.success({
        credits: creditsToAdd,
        balance: balance?.balance ?? creditsToAdd,
        status: "completed",
        stripePaymentIntentId: paymentIntent.id,
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof Stripe.errors.StripeCardError) {
        throw new PaymentRequiredError(error.message, { code: error.code });
      }
      throw error;
    }
  }));

  // ─── Record Usage ────────────────────────────────────────────────────────

  app.post("/usage", typedRoute({ body: RecordUsageBody }, async (request, reply) => {
    const { type, amount, metadata } = request.body;
    const userId = request.userId;

    // Insert usage record and deduct credits in a single transaction
    const { record, updatedBalance } = await db.transaction(async (tx) => {
      const [rec] = await tx
        .insert(usageRecords)
        .values({
          id: createId(),
          userId,
          type: type as any,
          credits: amount,
          metadata,
        })
        .returning();

      // Deduct from balance
      await tx
        .update(creditBalances)
        .set({
          balance: sql`${creditBalances.balance} - ${amount}`,
          periodCreditsUsed: sql`${creditBalances.periodCreditsUsed} + ${amount}`,
        })
        .where(eq(creditBalances.userId, userId));

      // Check auto top-up threshold
      const [bal] = await tx
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);

      return { record: rec, updatedBalance: bal };
    });

    if (
      updatedBalance?.autoTopupEnabled &&
      updatedBalance.autoTopupPackageId &&
      updatedBalance.balance <= (updatedBalance.autoTopupThreshold || 0)
    ) {
      triggerAutoTopup(userId, updatedBalance.autoTopupPackageId, logger).catch((err) =>
        logger.error({ err, userId }, "Auto top-up failed")
      );
    }

    return reply.success({ id: record!.id, recorded: true });
  }));

  // ─── Get Usage History ───────────────────────────────────────────────────

  app.get("/users/:userId/usage", typedRoute({ params: UserIdParams, query: UsageHistoryQuery }, async (request, reply) => {
    const { userId } = request.params;
    if (request.userId !== userId) throw new AuthorizationError();
    const { from, to, type } = request.query;

    const conditions = [eq(usageRecords.userId, userId)];
    if (from) {
      conditions.push(gte(usageRecords.createdAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(usageRecords.createdAt, new Date(to)));
    }
    if (type) {
      conditions.push(eq(usageRecords.type, type as any));
    }

    const records = await db
      .select()
      .from(usageRecords)
      .where(and(...conditions))
      .orderBy(desc(usageRecords.createdAt))
      .limit(100);

    return reply.success({ usage: records, total: records.length });
  }));

  // ─── Check Credits ───────────────────────────────────────────────────

  app.post("/credits/check", typedRoute({ body: CheckCreditsBody }, async (request, reply) => {
    const { userId, required } = request.body;

    const result = await checkCredits(userId, required);

    return reply.success(result);
  }));

  // ─── Meter Step Finish ───────────────────────────────────────────────

  app.post("/metering/step", typedRoute({ body: MeterStepBody }, async (request, reply) => {
    const { userId, sessionId, stepId, inputTokens, outputTokens, model, metadata } = request.body;

    await meterStepFinish({
      userId,
      sessionId,
      stepId,
      inputTokens,
      outputTokens,
      model,
      metadata,
    });

    return reply.success({ metered: true });
  }));

  // ─── Meter Tool Call ─────────────────────────────────────────────────

  app.post("/metering/tool", typedRoute({ body: MeterToolBody }, async (request, reply) => {
    const { userId, sessionId, toolName, metadata } = request.body;

    await meterToolCall({
      userId,
      sessionId,
      toolName,
      metadata,
    });

    return reply.success({ metered: true });
  }));

  // ─── Meter VM Time ──────────────────────────────────────────────────

  app.post("/metering/vm-time", typedRoute({ body: MeterVmTimeBody }, async (request, reply) => {
    const { userId, sessionId, sandboxId, durationMinutes, metadata } = request.body;

    await meterVmTime({
      userId,
      sessionId,
      sandboxId,
      durationMinutes,
      metadata,
    });

    return reply.success({ metered: true });
  }));

  // ─── Get Plan Limits ──────────────────────────────────────────────────

  const PlanLimitsParams = z.object({
    userId: z.string().min(1),
  });

  app.get("/users/:userId/plan-limits", typedRoute({ params: PlanLimitsParams }, async (request, reply) => {
    const { userId } = request.params;
    const limits = await getUserPlanLimits(userId);
    return reply.success(limits);
  }));

  // ─── Get Tool Credit Costs ────────────────────────────────────────────

  app.get("/tool-costs", typedRoute({}, async (_request, reply) => {
    return reply.success({ costs: TOOL_CREDIT_COSTS });
  }));

  // ─── Initialize User Credits (called on signup) ───────────────────────

  const InitCreditsBody = z.object({
    userId: z.string().min(1),
    starterCredits: z.number().optional(),
    dailyRefreshAmount: z.number().optional(),
  });

  app.post("/credits/initialize", typedRoute({ body: InitCreditsBody }, async (request, reply) => {
    const { userId, starterCredits, dailyRefreshAmount } = request.body;
    await initializeUserCredits(userId, starterCredits, dailyRefreshAmount);
    return reply.success({ initialized: true });
  }));

  // ─── Refresh Daily Credits ────────────────────────────────────────────

  const RefreshDailyBody = z.object({
    userId: z.string().min(1),
  });

  app.post("/credits/refresh-daily", typedRoute({ body: RefreshDailyBody }, async (request, reply) => {
    const { userId } = request.body;
    const refreshed = await refreshDailyCreditsIfNeeded(userId);
    return reply.success({ refreshed });
  }));

  // ─── Seed Plans (admin endpoint — seeds the 3 Manus-parity plans) ────

  app.post("/admin/seed-plans", typedRoute({}, async (_request, reply) => {
    const results = [];

    for (const planDef of PLAN_DEFINITIONS) {
      // Check if plan with this type already exists
      const [existing] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.type, planDef.type))
        .limit(1);

      if (existing) {
        // Update existing plan
        await db
          .update(subscriptionPlans)
          .set({
            name: planDef.name,
            description: planDef.description,
            priceMonthly: planDef.priceMonthly,
            priceYearly: planDef.priceYearly,
            discountYearlyPercent: planDef.discountYearlyPercent,
            monthlyCredits: planDef.monthlyCredits,
            starterCredits: planDef.starterCredits,
            dailyRefreshCredits: planDef.dailyRefreshCredits,
            maxConcurrentSessions: planDef.maxConcurrentSessions,
            maxParallelSubtasks: planDef.maxParallelSubtasks,
            maxScheduledTasks: planDef.maxScheduledTasks,
            maxStepsPerSession: planDef.maxStepsPerSession,
            features: planDef.features,
            limits: planDef.limits,
            isPopular: planDef.isPopular,
            sortOrder: planDef.sortOrder,
            isActive: true,
          })
          .where(eq(subscriptionPlans.id, existing.id));
        results.push({ type: planDef.type, action: "updated", id: existing.id });
      } else {
        // Insert new plan
        const [inserted] = await db
          .insert(subscriptionPlans)
          .values({
            id: createId(),
            name: planDef.name,
            type: planDef.type,
            description: planDef.description,
            priceMonthly: planDef.priceMonthly,
            priceYearly: planDef.priceYearly,
            discountYearlyPercent: planDef.discountYearlyPercent,
            monthlyCredits: planDef.monthlyCredits,
            starterCredits: planDef.starterCredits,
            dailyRefreshCredits: planDef.dailyRefreshCredits,
            maxConcurrentSessions: planDef.maxConcurrentSessions,
            maxParallelSubtasks: planDef.maxParallelSubtasks,
            maxScheduledTasks: planDef.maxScheduledTasks,
            maxStepsPerSession: planDef.maxStepsPerSession,
            features: planDef.features,
            limits: planDef.limits,
            isPopular: planDef.isPopular,
            sortOrder: planDef.sortOrder,
            isActive: true,
          })
          .returning();
        results.push({ type: planDef.type, action: "created", id: inserted!.id });
      }
    }

    logger.info({ results }, "Plans seeded successfully");
    return reply.success({ plans: results });
  }));

  // ─── Stripe Webhook Handler ──────────────────────────────────────────────

  app.post("/webhooks/stripe", { config: { rawBody: true } }, async (request: any, reply) => {
    const signature = request.headers["stripe-signature"] as string;
    const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET", "");

    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET not configured");
      throw new WebhookConfigError("Webhook secret not configured");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error({ err }, "Stripe webhook signature verification failed");
      throw new WebhookSignatureError();
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        if (!userId) break;

        if (session.mode === "subscription") {
          const planId = session.metadata?.planId;
          const interval = session.metadata?.interval as "monthly" | "yearly" | undefined;
          const stripeSubId =
            typeof session.subscription === "string"
              ? session.subscription
              : (session.subscription as any)?.id;

          if (!stripeSubId || !planId) break;

          const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
          const customerId =
            typeof stripeSub.customer === "string"
              ? stripeSub.customer
              : (stripeSub.customer as any).id;

          const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .limit(1);

          const firstItem = stripeSub.items.data[0];
          const periodStart = firstItem
            ? new Date(firstItem.current_period_start * 1000)
            : new Date();
          const periodEnd = firstItem
            ? new Date(firstItem.current_period_end * 1000)
            : new Date();

          // Upsert subscription, sync user, and grant credits in a single transaction
          await db.transaction(async (tx) => {
            const [existingSub] = await tx
              .select()
              .from(userSubscriptions)
              .where(eq(userSubscriptions.userId, userId))
              .limit(1);

            if (existingSub) {
              await tx
                .update(userSubscriptions)
                .set({
                  planId,
                  stripeSubscriptionId: stripeSubId,
                  stripeCustomerId: customerId,
                  interval: interval ?? "monthly",
                  status: "active",
                  currentPeriodStart: periodStart,
                  currentPeriodEnd: periodEnd,
                  cancelAtPeriodEnd: false,
                  canceledAt: null,
                  cancellationReason: null,
                })
                .where(eq(userSubscriptions.id, existingSub.id));
            } else {
              await tx.insert(userSubscriptions).values({
                id: createId(),
                userId,
                planId,
                stripeSubscriptionId: stripeSubId,
                stripeCustomerId: customerId,
                interval: interval ?? "monthly",
                status: "active",
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
              });
            }

            // Sync Stripe fields to users table
            await tx
              .update(users)
              .set({
                stripeCustomerId: customerId,
                stripeSubscriptionId: stripeSubId,
                stripePriceId: stripeSub.items.data[0]?.price.id ?? null,
                stripeCurrentPeriodEnd: periodEnd,
              })
              .where(eq(users.id, userId));

            // Grant initial credits
            if (plan && plan.monthlyCredits > 0) {
              await grantCredits(
                userId,
                plan.monthlyCredits,
                "subscription_grant",
                "subscription",
                stripeSubId,
                `${plan.name} plan - initial credits`,
                { periodStart, periodEnd },
                tx
              );
            }
          });
        } else if (session.mode === "payment" && session.metadata?.type === "credit_purchase") {
          const credits = Number(session.metadata?.credits);
          const packageId = session.metadata?.packageId;
          if (!credits || Number.isNaN(credits)) break;

          await grantCredits(
            userId,
            credits,
            "purchase",
            "package",
            packageId ?? undefined,
            "Credit package purchase"
          );
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as any)?.id;
        if (!customerId) break;

        // Find user by Stripe customer ID
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.stripeCustomerId, customerId))
          .limit(1);
        if (!user) break;

        // Find subscription if linked
        const subRef = (invoice as any).parent?.subscription_details?.subscription;
        const stripeSubId = typeof subRef === "string" ? subRef : subRef?.id;

        let subscriptionId: string | undefined;
        if (stripeSubId) {
          const [sub] = await db
            .select({ id: userSubscriptions.id })
            .from(userSubscriptions)
            .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubId))
            .limit(1);
          subscriptionId = sub?.id;
        }

        // Upsert invoice and grant renewal credits in a single transaction
        await db.transaction(async (tx) => {
          const invoiceData = {
            userId: user.id,
            subscriptionId: subscriptionId ?? null,
            stripeInvoiceId: invoice.id,
            number: invoice.number ?? null,
            status: "paid" as const,
            subtotal: invoice.subtotal,
            tax: invoice.total - invoice.subtotal,
            total: invoice.total,
            amountPaid: invoice.amount_paid,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            paidAt: new Date(),
            invoiceUrl: invoice.hosted_invoice_url ?? null,
            invoicePdfUrl: invoice.invoice_pdf ?? null,
          };

          const [existingInvoice] = await tx
            .select()
            .from(invoices)
            .where(eq(invoices.stripeInvoiceId, invoice.id))
            .limit(1);

          if (existingInvoice) {
            await tx.update(invoices).set(invoiceData).where(eq(invoices.id, existingInvoice.id));
          } else {
            await tx.insert(invoices).values({ id: createId(), ...invoiceData });
          }

          // On subscription renewal, grant monthly credits
          if (invoice.billing_reason === "subscription_cycle" && stripeSubId) {
            const [sub] = await tx
              .select({ planId: userSubscriptions.planId })
              .from(userSubscriptions)
              .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubId))
              .limit(1);

            if (sub) {
              const [plan] = await tx
                .select()
                .from(subscriptionPlans)
                .where(eq(subscriptionPlans.id, sub.planId))
                .limit(1);

              if (plan && plan.monthlyCredits > 0) {
                const periodStart = invoice.period_start
                  ? new Date(invoice.period_start * 1000)
                  : new Date();
                const periodEnd = invoice.period_end
                  ? new Date(invoice.period_end * 1000)
                  : new Date();

                await grantCredits(
                  user.id,
                  plan.monthlyCredits,
                  "subscription_grant",
                  "invoice",
                  invoice.id,
                  `${plan.name} plan - monthly renewal credits`,
                  { periodStart, periodEnd },
                  tx
                );
              }
            }
          }
        });
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const [existing] = await db
          .select()
          .from(userSubscriptions)
          .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
          .limit(1);

        if (!existing) break;

        const firstItem = subscription.items.data[0];
        const periodStart = firstItem
          ? new Date(firstItem.current_period_start * 1000)
          : new Date();
        const periodEnd = firstItem ? new Date(firstItem.current_period_end * 1000) : new Date();

        // Update subscription and user in a single transaction
        await db.transaction(async (tx) => {
          await tx
            .update(userSubscriptions)
            .set({
              status: mapStripeStatus(subscription.status),
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            })
            .where(eq(userSubscriptions.id, existing.id));

          await tx
            .update(users)
            .set({ stripeCurrentPeriodEnd: periodEnd })
            .where(eq(users.id, existing.userId));
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const [existing] = await db
          .select()
          .from(userSubscriptions)
          .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
          .limit(1);

        if (!existing) break;

        // Update subscription and clear user Stripe fields in a single transaction
        await db.transaction(async (tx) => {
          await tx
            .update(userSubscriptions)
            .set({ status: "canceled", canceledAt: new Date() })
            .where(eq(userSubscriptions.id, existing.id));

          await tx
            .update(users)
            .set({
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            })
            .where(eq(users.id, existing.userId));
        });
        break;
      }

      default:
        logger.warn({ eventType: event.type }, "Unhandled Stripe event type");
    }

    return reply.success({ received: true });
  });

  // ─── Start Server ────────────────────────────────────────────────────────

  await start();
}

main();
