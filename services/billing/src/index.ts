import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import Stripe from "stripe";
import { createLogger, getEnv, createId, dispatchWebhookEvent } from "@repo/service-utils";
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
  sql,
  gte,
  lte,
} from "@repo/database";

const logger = createLogger({ service: "billing" });

const stripe = new Stripe(getEnv("STRIPE_SECRET_KEY", ""), {
  apiVersion: "2025-09-30.clover" as Stripe.LatestApiVersion,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

async function grantCredits(
  userId: string,
  amount: number,
  type: "subscription_grant" | "purchase" | "refund" | "adjustment" | "bonus",
  referenceType?: string,
  referenceId?: string,
  description?: string,
  periodDates?: { periodStart: Date; periodEnd: Date }
): Promise<void> {
  const [existing] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  const currentBalance = existing?.balance ?? 0;
  const newBalance = currentBalance + amount;

  if (existing) {
    const updates: Record<string, unknown> = { balance: newBalance };

    if (type === "subscription_grant" && periodDates) {
      updates.periodCredits = amount;
      updates.periodCreditsUsed = 0;
      updates.periodStart = periodDates.periodStart;
      updates.periodEnd = periodDates.periodEnd;
    } else if (type === "purchase") {
      updates.purchasedCredits = sql`${creditBalances.purchasedCredits} + ${amount}`;
    }

    await db.update(creditBalances).set(updates).where(eq(creditBalances.userId, userId));
  } else {
    const values: Record<string, unknown> = {
      id: createId(),
      userId,
      balance: newBalance,
    };

    if (type === "subscription_grant" && periodDates) {
      values.periodCredits = amount;
      values.periodCreditsUsed = 0;
      values.periodStart = periodDates.periodStart;
      values.periodEnd = periodDates.periodEnd;
    } else if (type === "purchase") {
      values.purchasedCredits = amount;
    }

    await db.insert(creditBalances).values(values as typeof creditBalances.$inferInsert);
  }

  await db.insert(creditTransactions).values({
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

async function triggerAutoTopup(userId: string, packageId: string) {
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

// ─── Server ───────────────────────────────────────────────────────────────────

async function main() {
  const port = parseInt(getEnv("PORT", "4008"), 10);
  const host = getEnv("HOST", "0.0.0.0");

  const app = Fastify({
    logger: false,
    requestIdHeader: "x-request-id",
    genReqId: () => crypto.randomUUID(),
  });

  // Register raw body plugin for Stripe webhook signature verification
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });

  // ─── Health Check ─────────────────────────────────────────────────────────

  app.get("/health", async () => {
    return { status: "ok", service: "billing" };
  });

  // ─── Get Subscription Plans ───────────────────────────────────────────────

  app.get("/plans", async (request, reply) => {
    try {
      const plans = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.isActive, true))
        .orderBy(subscriptionPlans.sortOrder);
      return { plans };
    } catch (error) {
      logger.error(error, "Failed to fetch plans");
      return reply.status(500).send({ error: "Failed to fetch plans" });
    }
  });

  // ─── Get User Subscription ────────────────────────────────────────────────

  app.get("/users/:userId/subscription", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const [subscription] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.userId, userId))
        .limit(1);
      if (!subscription) {
        return { userId, plan: "free", status: "active" };
      }
      return subscription;
    } catch (error) {
      logger.error(error, "Failed to fetch subscription");
      return reply.status(500).send({ error: "Failed to fetch subscription" });
    }
  });

  // ─── Create Subscription ──────────────────────────────────────────────────

  app.post("/subscriptions", async (request, reply) => {
    const {
      userId,
      planId,
      paymentMethodId,
      interval = "monthly",
    } = request.body as {
      userId: string;
      planId: string;
      paymentMethodId?: string;
      interval?: "monthly" | "yearly";
    };

    try {
      // Look up the plan to get Stripe price ID
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, planId))
        .limit(1);
      if (!plan) {
        return reply.status(404).send({ error: "Plan not found" });
      }

      const stripePriceId =
        interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;
      if (!stripePriceId) {
        return reply.status(400).send({ error: "Plan does not have a Stripe price configured" });
      }

      // Get or create Stripe customer
      const customerId = await getOrCreateStripeCustomer(userId);
      if (!customerId) {
        return reply.status(404).send({ error: "User not found" });
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

      // Insert subscription into DB
      const [subscription] = await db
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
      await db
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
          { periodStart, periodEnd }
        );
      }

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

      return {
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
      };
    } catch (error) {
      logger.error(error, "Failed to create subscription");
      return reply.status(500).send({ error: "Failed to create subscription" });
    }
  });

  // ─── Cancel Subscription ──────────────────────────────────────────────────

  app.post("/subscriptions/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { immediate = false } = (request.body as { immediate?: boolean }) || {};

    try {
      // Look up the subscription to get Stripe ID
      const [existing] = await db
        .select()
        .from(userSubscriptions)
        .where(eq(userSubscriptions.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Subscription not found" });
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

      return { id: updated!.id, status: immediate ? "canceled" : "cancel_at_period_end" };
    } catch (error) {
      logger.error(error, "Failed to cancel subscription");
      return reply.status(500).send({ error: "Failed to cancel subscription" });
    }
  });

  // ─── Get Credit Balance ───────────────────────────────────────────────────

  app.get("/users/:userId/credits", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    try {
      const [balance] = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);
      if (!balance) {
        return { userId, balance: 0, used: 0 };
      }
      return { userId, balance: balance.balance, used: balance.periodCreditsUsed };
    } catch (error) {
      logger.error(error, "Failed to fetch credit balance");
      return reply.status(500).send({ error: "Failed to fetch credit balance" });
    }
  });

  // ─── Purchase Credits ─────────────────────────────────────────────────────

  app.post("/credits/purchase", async (request, reply) => {
    const { userId, packageId, paymentMethodId } = request.body as {
      userId: string;
      packageId: string;
      paymentMethodId?: string;
    };

    try {
      const [pkg] = await db
        .select()
        .from(creditPackages)
        .where(eq(creditPackages.id, packageId))
        .limit(1);
      if (!pkg) {
        return reply.status(404).send({ error: "Credit package not found" });
      }

      // Get or create Stripe customer
      const customerId = await getOrCreateStripeCustomer(userId);
      if (!customerId) {
        return reply.status(404).send({ error: "User not found" });
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
        return reply.status(400).send({ error: "No payment method available" });
      }

      const creditsToAdd = pkg.credits + (pkg.bonusCredits || 0);

      // Create and confirm payment intent
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
        return reply.status(402).send({
          error: "Payment requires further action",
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

      return {
        credits: creditsToAdd,
        balance: balance?.balance ?? creditsToAdd,
        status: "completed",
        stripePaymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error(error, "Failed to purchase credits");
      if (error instanceof Stripe.errors.StripeCardError) {
        return reply.status(402).send({ error: error.message, code: error.code });
      }
      return reply.status(500).send({ error: "Failed to purchase credits" });
    }
  });

  // ─── Record Usage ─────────────────────────────────────────────────────────

  app.post("/usage", async (request, reply) => {
    const { userId, type, amount, metadata } = request.body as {
      userId: string;
      type: string;
      amount: number;
      metadata?: Record<string, unknown>;
    };

    try {
      const [record] = await db
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
      await db
        .update(creditBalances)
        .set({
          balance: sql`${creditBalances.balance} - ${amount}`,
          periodCreditsUsed: sql`${creditBalances.periodCreditsUsed} + ${amount}`,
        })
        .where(eq(creditBalances.userId, userId));

      // Check auto top-up threshold
      const [updatedBalance] = await db
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .limit(1);

      if (
        updatedBalance?.autoTopupEnabled &&
        updatedBalance.autoTopupPackageId &&
        updatedBalance.balance <= (updatedBalance.autoTopupThreshold || 0)
      ) {
        triggerAutoTopup(userId, updatedBalance.autoTopupPackageId).catch((err) =>
          logger.error({ err, userId }, "Auto top-up failed")
        );
      }

      return { id: record!.id, recorded: true };
    } catch (error) {
      logger.error(error, "Failed to record usage");
      return reply.status(500).send({ error: "Failed to record usage" });
    }
  });

  // ─── Get Usage History ────────────────────────────────────────────────────

  app.get("/users/:userId/usage", async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const { from, to, type } = request.query as {
      from?: string;
      to?: string;
      type?: string;
    };

    try {
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

      return { usage: records, total: records.length };
    } catch (error) {
      logger.error(error, "Failed to fetch usage history");
      return reply.status(500).send({ error: "Failed to fetch usage history" });
    }
  });

  // ─── Stripe Webhook Handler ───────────────────────────────────────────────

  app.post("/webhooks/stripe", { config: { rawBody: true } }, async (request: any, reply) => {
    const signature = request.headers["stripe-signature"] as string;
    const webhookSecret = getEnv("STRIPE_WEBHOOK_SECRET", "");

    if (!webhookSecret) {
      logger.error("STRIPE_WEBHOOK_SECRET not configured");
      return reply.status(500).send({ error: "Webhook secret not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);
    } catch (err) {
      logger.error({ err }, "Stripe webhook signature verification failed");
      return reply.status(400).send({ error: "Invalid signature" });
    }

    try {
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

            // Upsert subscription
            const [existingSub] = await db
              .select()
              .from(userSubscriptions)
              .where(eq(userSubscriptions.userId, userId))
              .limit(1);

            if (existingSub) {
              await db
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
              await db.insert(userSubscriptions).values({
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
            await db
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
                { periodStart, periodEnd }
              );
            }
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

          // Upsert invoice record
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

          const [existingInvoice] = await db
            .select()
            .from(invoices)
            .where(eq(invoices.stripeInvoiceId, invoice.id))
            .limit(1);

          if (existingInvoice) {
            await db.update(invoices).set(invoiceData).where(eq(invoices.id, existingInvoice.id));
          } else {
            await db.insert(invoices).values({ id: createId(), ...invoiceData });
          }

          // On subscription renewal, grant monthly credits
          if (invoice.billing_reason === "subscription_cycle" && stripeSubId) {
            const [sub] = await db
              .select({ planId: userSubscriptions.planId })
              .from(userSubscriptions)
              .where(eq(userSubscriptions.stripeSubscriptionId, stripeSubId))
              .limit(1);

            if (sub) {
              const [plan] = await db
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
                  { periodStart, periodEnd }
                );
              }
            }
          }
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

          await db
            .update(userSubscriptions)
            .set({
              status: mapStripeStatus(subscription.status),
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
            })
            .where(eq(userSubscriptions.id, existing.id));

          await db
            .update(users)
            .set({ stripeCurrentPeriodEnd: periodEnd })
            .where(eq(users.id, existing.userId));
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

          await db
            .update(userSubscriptions)
            .set({ status: "canceled", canceledAt: new Date() })
            .where(eq(userSubscriptions.id, existing.id));

          await db
            .update(users)
            .set({
              stripeSubscriptionId: null,
              stripePriceId: null,
              stripeCurrentPeriodEnd: null,
            })
            .where(eq(users.id, existing.userId));
          break;
        }

        default:
          logger.warn({ eventType: event.type }, "Unhandled Stripe event type");
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Failed to process Stripe webhook event");
      return reply.status(500).send({ error: "Webhook processing failed" });
    }

    return { received: true };
  });

  // ─── Request Logging ──────────────────────────────────────────────────────

  app.addHook("onRequest", async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "Incoming request"
    );
  });

  app.addHook("onResponse", async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      "Request completed"
    );
  });

  // ─── Start Server ─────────────────────────────────────────────────────────

  try {
    await app.listen({ port, host });
    logger.info({ port, host }, "Billing service started");
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, async () => {
      logger.info({ signal }, "Received shutdown signal");
      await app.close();
      process.exit(0);
    });
  }
}

main();
