import { stripe, type Stripe } from "@repo/payments";
import { db, users, userSubscriptions, subscriptionPlans, invoices, eq } from "@repo/database";
import { grantCredits } from "@/lib/stripe/helpers";
import { createId } from "@paralleldrive/cuid2";
import { log } from "@repo/observability/log";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env";

export const POST = async (request: Request): Promise<Response> => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { message: "Webhook secret not configured", ok: false },
      { status: 500 }
    );
  }

  try {
    const body = await request.text();
    const headerPayload = await headers();
    const signature = headerPayload.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { message: "Missing stripe-signature header", ok: false },
        { status: 400 }
      );
    }

    const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        log.warn(`Unhandled Stripe event type: ${event.type}`);
    }

    return NextResponse.json({ received: true, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    log.error(`Stripe webhook error: ${message}`);
    return NextResponse.json({ message: "Webhook processing failed", ok: false }, { status: 500 });
  }
};

// ─── checkout.session.completed ───────────────────────────────────────────────

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  if (session.mode === "subscription") {
    await handleSubscriptionCheckout(session, userId);
  } else if (session.mode === "payment" && session.metadata?.type === "credit_purchase") {
    await handleCreditPurchaseCheckout(session, userId);
  }
}

async function handleSubscriptionCheckout(session: Stripe.Checkout.Session, userId: string) {
  const planId = session.metadata?.planId;
  const interval = session.metadata?.interval as "monthly" | "yearly" | undefined;
  const stripeSubscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

  if (!stripeSubscriptionId || !planId) return;

  // Retrieve the full subscription from Stripe
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const customerId =
    typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer.id;

  // Get plan to know how many credits to grant
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);

  const firstItem = stripeSub.items.data[0];
  const periodStart = firstItem ? new Date(firstItem.current_period_start * 1000) : new Date();
  const periodEnd = firstItem ? new Date(firstItem.current_period_end * 1000) : new Date();

  // Upsert user_subscriptions
  const [existing] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(userSubscriptions)
      .set({
        planId,
        stripeSubscriptionId,
        stripeCustomerId: customerId,
        interval: interval ?? "monthly",
        status: "active",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        cancellationReason: null,
      })
      .where(eq(userSubscriptions.id, existing.id));
  } else {
    await db.insert(userSubscriptions).values({
      id: createId(),
      userId,
      planId,
      stripeSubscriptionId,
      stripeCustomerId: customerId,
      interval: interval ?? "monthly",
      status: "active",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    });
  }

  // Sync Stripe fields on user
  await db
    .update(users)
    .set({
      stripeCustomerId: customerId,
      stripeSubscriptionId,
      stripePriceId: stripeSub.items.data[0]?.price.id ?? null,
      stripeCurrentPeriodEnd: periodEnd,
    })
    .where(eq(users.id, userId));

  // Grant initial subscription credits
  if (plan && plan.monthlyCredits > 0) {
    await grantCredits(
      userId,
      plan.monthlyCredits,
      "subscription_grant",
      "subscription",
      stripeSubscriptionId,
      `${plan.name} plan - initial credits`,
      { periodStart, periodEnd }
    );
  }
}

async function handleCreditPurchaseCheckout(session: Stripe.Checkout.Session, userId: string) {
  const credits = Number(session.metadata?.credits);
  const packageId = session.metadata?.packageId;

  if (!credits || Number.isNaN(credits)) return;

  await grantCredits(
    userId,
    credits,
    "purchase",
    "package",
    packageId ?? undefined,
    "Credit package purchase"
  );
}

// ─── invoice.paid ─────────────────────────────────────────────────────────────

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;

  if (!customerId) return;

  // Find user by Stripe customer ID
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!user) return;

  // Find subscription if linked (Stripe v19 Clover API: subscription is under parent.subscription_details)
  const subRef = invoice.parent?.subscription_details?.subscription;
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

  // Upsert invoice
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
    await db.insert(invoices).values({
      id: createId(),
      ...invoiceData,
    });
  }

  // On renewal, grant monthly credits
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
        const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : new Date();

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
}

// ─── customer.subscription.updated ────────────────────────────────────────────

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const [existing] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (!existing) return;

  const firstItem = subscription.items.data[0];
  const periodStart = firstItem ? new Date(firstItem.current_period_start * 1000) : new Date();
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

  // Sync period end to users table
  await db
    .update(users)
    .set({ stripeCurrentPeriodEnd: periodEnd })
    .where(eq(users.id, existing.userId));
}

// ─── customer.subscription.deleted ────────────────────────────────────────────

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const [existing] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id))
    .limit(1);

  if (!existing) return;

  await db
    .update(userSubscriptions)
    .set({
      status: "canceled",
      canceledAt: new Date(),
    })
    .where(eq(userSubscriptions.id, existing.id));

  // Clear Stripe fields from users table
  await db
    .update(users)
    .set({
      stripeSubscriptionId: null,
      stripePriceId: null,
      stripeCurrentPeriodEnd: null,
    })
    .where(eq(users.id, existing.userId));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
