# Billing Service Instructions

## Overview

The billing service (`services/billing/`) handles subscription management, credit tracking, usage recording, and Stripe payment processing. The billing domain is split across TWO codebases:

1. **Billing microservice** (`services/billing/src/index.ts`) - 154 lines, all stubs with TODO comments
2. **Billing tRPC router** (`apps/app/lib/trpc/routers/billing.router.ts`) - 534 lines, has REAL Drizzle queries for reads but stubs for Stripe integration

The tRPC router is the more complete codebase. The microservice needs to be built out to match.

**Port:** 4008 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify
**Status:** All 8 endpoints are stubs returning hardcoded data. No Stripe integration. No database queries.

---

## Current File Structure

### Billing Microservice

```
services/billing/src/
  index.ts              # 154 lines - 8 endpoints, all TODO stubs
```

### Billing tRPC Router (reference implementation)

```
apps/app/lib/trpc/routers/
  billing.router.ts     # 534 lines - 16 procedures with real Drizzle queries
```

### Database Schema

```
packages/database/src/schema/
  billing.ts            # 403 lines - 8 tables with full type exports
```

### Payments Package

```
packages/payments/      # Stripe client wrapper (needs to be used)
```

---

## Current Billing Microservice Endpoints

| Method                            | Path | Status                                       | What It Returns |
| --------------------------------- | ---- | -------------------------------------------- | --------------- |
| `GET /plans`                      | STUB | Hardcoded 3 plans (free/pro/enterprise)      |
| `GET /users/:userId/subscription` | STUB | Returns `{ plan: "free", status: "active" }` |
| `POST /subscriptions`             | STUB | Returns random UUID as subscription ID       |
| `POST /subscriptions/:id/cancel`  | STUB | Returns `{ status: "cancelled" }`            |
| `GET /users/:userId/credits`      | STUB | Returns `{ balance: 100, used: 0 }`          |
| `POST /credits/purchase`          | STUB | Returns random transaction ID                |
| `POST /usage`                     | STUB | Returns `{ recorded: true }`                 |
| `GET /users/:userId/usage`        | STUB | Returns `{ usage: [], total: 0 }`            |
| `POST /webhooks/stripe`           | STUB | Logs receipt, returns `{ received: true }`   |

---

## What the tRPC Router Already Has (Reference)

The tRPC router at `apps/app/lib/trpc/routers/billing.router.ts` has WORKING Drizzle queries for:

| Procedure                 | Type     | Database Tables Used                               |
| ------------------------- | -------- | -------------------------------------------------- |
| `listPlans`               | query    | `subscriptionPlans` - SELECT WHERE isActive = true |
| `getSubscription`         | query    | `userSubscriptions` JOIN `subscriptionPlans`       |
| `getCreditBalance`        | query    | `creditBalances` WHERE userId                      |
| `listCreditPackages`      | query    | `creditPackages` WHERE isActive = true             |
| `getCreditTransactions`   | query    | `creditTransactions` with type filter, pagination  |
| `getUsageRecords`         | query    | `usageRecords` with type/date filters, pagination  |
| `getUsageSummary`         | query    | `usageRecords` GROUP BY type, SUM credits          |
| `updateAutoTopup`         | mutation | `creditBalances` UPDATE/INSERT                     |
| `listPaymentMethods`      | query    | `paymentMethods` ordered by isDefault              |
| `setDefaultPaymentMethod` | mutation | `paymentMethods` UPDATE                            |
| `deletePaymentMethod`     | mutation | `paymentMethods` DELETE                            |
| `listInvoices`            | query    | `invoices` with status filter, pagination          |
| `getInvoice`              | query    | `invoices` by ID                                   |
| `cancelSubscription`      | mutation | `userSubscriptions` UPDATE (Stripe TODO)           |
| `reactivateSubscription`  | mutation | `userSubscriptions` UPDATE (Stripe TODO)           |

**Procedures with Stripe TODOs** (lines 400, 411, 519):

- `createSubscriptionCheckout` (line 378) - Gets plan from DB but returns empty `checkoutUrl`
- `createCreditPurchaseCheckout` (line 411) - Gets package from DB but returns empty `checkoutUrl`
- `getBillingPortalUrl` (line 519) - Returns empty `url`

---

## Database Tables

All defined in `packages/database/src/schema/billing.ts`:

### `subscription_plans`

Plan definitions (free, pro, max, enterprise). Key columns:

- `priceMonthly`, `priceYearly` (in cents)
- `monthlyCredits` - Credits granted per billing period
- `stripePriceIdMonthly`, `stripePriceIdYearly`, `stripeProductId` - Stripe IDs
- `limits` (JSONB) - `maxSessions`, `maxAgents`, `maxStorage`, `maxTeamMembers`, `maxProjects`
- `features` (JSONB) - String array of feature flags

### `user_subscriptions`

Active user subscriptions. Key columns:

- `stripeSubscriptionId`, `stripeCustomerId`
- `interval` ("monthly" | "yearly")
- `status` ("active" | "past_due" | "canceled" | "trialing" | "incomplete")
- `currentPeriodStart`, `currentPeriodEnd`
- `trialStart`, `trialEnd`
- `cancelAtPeriodEnd`, `canceledAt`, `cancellationReason`

### `credit_packages`

One-time credit purchase packages. Key columns:

- `credits`, `bonusCredits`, `price` (cents)
- `stripePriceId`, `stripeProductId`

### `credit_balances`

Per-user credit balance (one row per user). Key columns:

- `balance` - Total available credits
- `periodCredits`, `periodCreditsUsed` - Subscription credits for current period
- `purchasedCredits` - Credits from one-time purchases
- `autoTopupEnabled`, `autoTopupThreshold`, `autoTopupPackageId`

### `credit_transactions`

Ledger of all credit changes. Key columns:

- `type` ("subscription_grant" | "purchase" | "usage" | "refund" | "adjustment" | "bonus" | "expiration")
- `amount` - Positive for credit, negative for debit
- `balanceAfter` - Running balance after transaction
- `referenceType`, `referenceId` - Links to session, invoice, package, etc.

### `usage_records`

Detailed usage tracking. Key columns:

- `type` ("chat" | "agent" | "connector" | "storage" | "api")
- `credits` - Credits consumed
- `sessionId`, `agentId`
- `model`, `inputTokens`, `outputTokens`

### `payment_methods`

Stored payment methods. Key columns:

- `stripePaymentMethodId`, `type`, `brand`, `last4`, `expiryMonth`, `expiryYear`, `isDefault`

### `invoices`

Invoice records. Key columns:

- `stripeInvoiceId`, `number`, `status`
- `subtotal`, `tax`, `total`, `amountPaid`, `amountDue` (all in cents)
- `invoiceUrl`, `invoicePdfUrl`

---

## What Needs to Be Built in the Microservice

### 1. Stripe Client Setup

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});
```

Or use the `@repo/payments` package if it exports a configured Stripe instance.

### 2. GET /plans - Fetch from Database

Replace the hardcoded plans array:

```typescript
app.get("/plans", async (request, reply) => {
  const plans = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.isActive, true))
    .orderBy(subscriptionPlans.sortOrder);
  return { plans };
});
```

### 3. GET /users/:userId/subscription - Fetch from Database

```typescript
app.get("/users/:userId/subscription", async (request, reply) => {
  const { userId } = request.params as { userId: string };
  const [subscription] = await db
    .select({
      subscription: userSubscriptions,
      plan: subscriptionPlans,
    })
    .from(userSubscriptions)
    .innerJoin(subscriptionPlans, eq(userSubscriptions.planId, subscriptionPlans.id))
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);

  if (!subscription) {
    return { userId, plan: null, status: "none" };
  }
  return subscription;
});
```

### 4. POST /subscriptions - Create Stripe Subscription

```typescript
app.post("/subscriptions", async (request, reply) => {
  const { userId, planId, interval, successUrl, cancelUrl } = request.body;

  // 1. Get plan from DB
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, planId))
    .limit(1);

  // 2. Get or create Stripe customer
  let stripeCustomerId = existingSubscription?.stripeCustomerId;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      metadata: { userId, rubicUserId: userId },
    });
    stripeCustomerId = customer.id;
  }

  // 3. Create Stripe checkout session
  const priceId = interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, planId },
  });

  return { checkoutUrl: session.url, sessionId: session.id };
});
```

### 5. POST /credits/purchase - Create Stripe Checkout for Credit Package

```typescript
app.post("/credits/purchase", async (request, reply) => {
  const { userId, packageId, successUrl, cancelUrl } = request.body;

  const [pkg] = await db
    .select()
    .from(creditPackages)
    .where(eq(creditPackages.id, packageId))
    .limit(1);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: pkg.stripePriceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { userId, packageId, credits: String(pkg.credits + (pkg.bonusCredits || 0)) },
  });

  return { checkoutUrl: session.url, sessionId: session.id };
});
```

### 6. POST /usage - Record Usage and Deduct Credits (CRITICAL)

This endpoint is called by the agent/task services after every LLM call.

```typescript
app.post("/usage", async (request, reply) => {
  const { userId, type, amount, metadata } = request.body;

  // 1. Record usage
  await db.insert(usageRecords).values({
    userId,
    type,
    credits: amount,
    model: metadata?.model,
    inputTokens: metadata?.inputTokens,
    outputTokens: metadata?.outputTokens,
    sessionId: metadata?.sessionId,
    agentId: metadata?.agentId,
  });

  // 2. Deduct credits from balance
  const [balance] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  if (!balance) {
    // Create balance record
    await db.insert(creditBalances).values({
      userId,
      balance: -amount,
      periodCreditsUsed: amount,
    });
  } else {
    await db
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} - ${amount}`,
        periodCreditsUsed: sql`${creditBalances.periodCreditsUsed} + ${amount}`,
      })
      .where(eq(creditBalances.userId, userId));
  }

  // 3. Record credit transaction
  const newBalance = (balance?.balance || 0) - amount;
  await db.insert(creditTransactions).values({
    userId,
    type: "usage",
    amount: -amount,
    balanceAfter: newBalance,
    referenceType: "session",
    referenceId: metadata?.sessionId,
    description: `${type} usage: ${amount} credits`,
  });

  // 4. Check auto top-up threshold
  if (balance?.autoTopupEnabled && newBalance <= (balance.autoTopupThreshold || 0)) {
    // Trigger auto top-up (async, don't block response)
    triggerAutoTopup(userId, balance.autoTopupPackageId).catch((err) =>
      logger.error({ err, userId }, "Auto top-up failed")
    );
  }

  return { id: createId(), recorded: true, newBalance };
});
```

### 7. POST /webhooks/stripe - Stripe Webhook Handler (CRITICAL)

```typescript
app.post(
  "/webhooks/stripe",
  {
    config: { rawBody: true }, // Need raw body for signature verification
  },
  async (request, reply) => {
    const signature = request.headers["stripe-signature"] as string;
    const rawBody = request.rawBody; // Requires @fastify/raw-body plugin

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      logger.error({ err }, "Stripe webhook signature verification failed");
      return reply.status(400).send({ error: "Invalid signature" });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const { userId, planId, packageId, credits } = session.metadata || {};

        if (session.mode === "subscription") {
          // Create or update subscription in DB
          const stripeSubscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await db.insert(userSubscriptions).values({
            userId,
            planId,
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: session.customer as string,
            status: "active",
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          });

          // Grant initial credits
          const [plan] = await db
            .select()
            .from(subscriptionPlans)
            .where(eq(subscriptionPlans.id, planId))
            .limit(1);
          if (plan) {
            await grantCredits(userId, plan.monthlyCredits, "subscription_grant", "plan", planId);
          }
        } else if (session.mode === "payment" && packageId) {
          // Credit package purchase
          const totalCredits = parseInt(credits || "0");
          await grantCredits(userId, totalCredits, "purchase", "package", packageId);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // Save invoice to DB
        await db.insert(invoices).values({
          userId: invoice.metadata?.userId || "",
          stripeInvoiceId: invoice.id,
          number: invoice.number,
          status: "paid",
          subtotal: invoice.subtotal,
          tax: invoice.tax || 0,
          total: invoice.total,
          amountPaid: invoice.amount_paid,
          amountDue: invoice.amount_due,
          paidAt: new Date(),
          invoiceUrl: invoice.hosted_invoice_url,
          invoicePdfUrl: invoice.invoice_pdf,
        });

        // On subscription renewal, grant monthly credits
        if (invoice.subscription) {
          const [sub] = await db
            .select()
            .from(userSubscriptions)
            .where(eq(userSubscriptions.stripeSubscriptionId, invoice.subscription as string))
            .limit(1);
          if (sub) {
            const [plan] = await db
              .select()
              .from(subscriptionPlans)
              .where(eq(subscriptionPlans.id, sub.planId))
              .limit(1);
            if (plan) {
              // Reset period credits
              await db
                .update(creditBalances)
                .set({
                  periodCredits: plan.monthlyCredits,
                  periodCreditsUsed: 0,
                  periodStart: new Date(),
                  periodEnd: sub.currentPeriodEnd,
                })
                .where(eq(creditBalances.userId, sub.userId));

              await grantCredits(
                sub.userId,
                plan.monthlyCredits,
                "subscription_grant",
                "plan",
                plan.id
              );
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await db
          .update(userSubscriptions)
          .set({
            status: subscription.status as any,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          })
          .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await db
          .update(userSubscriptions)
          .set({
            status: "canceled",
            canceledAt: new Date(),
          })
          .where(eq(userSubscriptions.stripeSubscriptionId, subscription.id));
        break;
      }
    }

    return { received: true };
  }
);
```

### 8. Helper: Grant Credits

```typescript
async function grantCredits(
  userId: string,
  amount: number,
  type: "subscription_grant" | "purchase" | "bonus",
  referenceType: string,
  referenceId: string
) {
  // Update balance
  const [balance] = await db
    .select()
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId))
    .limit(1);

  const newBalance = (balance?.balance || 0) + amount;

  if (balance) {
    await db
      .update(creditBalances)
      .set({
        balance: sql`${creditBalances.balance} + ${amount}`,
        purchasedCredits:
          type === "purchase"
            ? sql`${creditBalances.purchasedCredits} + ${amount}`
            : creditBalances.purchasedCredits,
      })
      .where(eq(creditBalances.userId, userId));
  } else {
    await db.insert(creditBalances).values({
      userId,
      balance: amount,
      purchasedCredits: type === "purchase" ? amount : 0,
    });
  }

  // Record transaction
  await db.insert(creditTransactions).values({
    userId,
    type,
    amount,
    balanceAfter: newBalance,
    referenceType,
    referenceId,
    description: `${type}: +${amount} credits`,
  });
}
```

### 9. Auto Top-Up Logic

```typescript
async function triggerAutoTopup(userId: string, packageId: string | null) {
  if (!packageId) return;

  const [pkg] = await db
    .select()
    .from(creditPackages)
    .where(eq(creditPackages.id, packageId))
    .limit(1);
  if (!pkg || !pkg.stripePriceId) return;

  // Get user's default payment method
  const [method] = await db
    .select()
    .from(paymentMethods)
    .where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)))
    .limit(1);
  if (!method) return;

  // Get Stripe customer ID
  const [sub] = await db
    .select()
    .from(userSubscriptions)
    .where(eq(userSubscriptions.userId, userId))
    .limit(1);
  if (!sub?.stripeCustomerId) return;

  // Create payment intent for the credit package
  const paymentIntent = await stripe.paymentIntents.create({
    amount: pkg.price,
    currency: pkg.currency,
    customer: sub.stripeCustomerId,
    payment_method: method.stripePaymentMethodId,
    off_session: true,
    confirm: true,
    metadata: { userId, packageId, credits: String(pkg.credits + (pkg.bonusCredits || 0)) },
  });

  if (paymentIntent.status === "succeeded") {
    await grantCredits(
      userId,
      pkg.credits + (pkg.bonusCredits || 0),
      "purchase",
      "package",
      packageId
    );
    logger.info({ userId, packageId, credits: pkg.credits }, "Auto top-up succeeded");
  }
}
```

---

## What Needs to Be Built in the tRPC Router

Three mutations at `apps/app/lib/trpc/routers/billing.router.ts` need Stripe integration:

### Line 378: `createSubscriptionCheckout`

```typescript
// Replace the TODO with:
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const priceId = input.interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

const session = await stripe.checkout.sessions.create({
  customer: stripeCustomerId, // Get from existing subscription or create new customer
  mode: "subscription",
  line_items: [{ price: priceId!, quantity: 1 }],
  success_url: input.successUrl,
  cancel_url: input.cancelUrl,
  metadata: { userId: ctx.user.id, planId: input.planId },
});

return { checkoutUrl: session.url!, sessionId: session.id };
```

### Line 411: `createCreditPurchaseCheckout`

```typescript
const session = await stripe.checkout.sessions.create({
  mode: "payment",
  line_items: [{ price: pkg.stripePriceId!, quantity: 1 }],
  success_url: input.successUrl,
  cancel_url: input.cancelUrl,
  metadata: {
    userId: ctx.user.id,
    packageId: input.packageId,
    credits: String(pkg.credits + (pkg.bonusCredits || 0)),
  },
});

return { checkoutUrl: session.url!, sessionId: session.id };
```

### Line 519: `getBillingPortalUrl`

```typescript
const [sub] = await db
  .select()
  .from(userSubscriptions)
  .where(eq(userSubscriptions.userId, ctx.user.id))
  .limit(1);

if (!sub?.stripeCustomerId) {
  throw new TRPCError({ code: "NOT_FOUND", message: "No billing account" });
}

const session = await stripe.billingPortal.sessions.create({
  customer: sub.stripeCustomerId,
  return_url: input.returnUrl,
});

return { url: session.url };
```

---

## Environment Variables

| Variable                | Default               | Description                   |
| ----------------------- | --------------------- | ----------------------------- |
| `PORT`                  | `4008`                | Billing service port          |
| `STRIPE_SECRET_KEY`     | None                  | Stripe secret key             |
| `STRIPE_WEBHOOK_SECRET` | None                  | Stripe webhook signing secret |
| `DATABASE_URL`          | (from @repo/database) | PostgreSQL connection         |
