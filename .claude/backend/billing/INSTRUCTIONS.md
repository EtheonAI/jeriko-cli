# Billing Service Instructions

> VERIFIED against actual codebase -- Feb 2026 audit

## Overview

The billing domain is split across TWO codebases, both with real Drizzle DB queries:

1. **Billing microservice** (`services/billing/src/index.ts`) -- 343 lines, 9 endpoints with real Drizzle queries against 6 tables. Two Stripe TODOs remain (subscription creation and webhook verification).
2. **Billing tRPC router** (`apps/app/lib/trpc/routers/billing.router.ts`) -- 607 lines, 18 procedures with real Drizzle queries AND real Stripe API calls. Fully implemented including `stripe.checkout.sessions.create()`, `stripe.billingPortal.sessions.create()`, `stripe.subscriptions.update()`, `stripe.subscriptions.cancel()`, and `stripe.paymentMethods.detach()`.

**Port:** 4008 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify

---

## Current State (IMPLEMENTED)

### Billing Microservice (`services/billing/src/index.ts`)

Imports `db, subscriptionPlans, userSubscriptions, creditPackages, creditBalances, creditTransactions, usageRecords, eq, and, desc, sql, gte, lte` from `@repo/database`. All endpoints use real DB queries.

| Method                            | Path                          | Status      | What It Does                                                                                                       |
| --------------------------------- | ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET /health`                     | `/health`                     | IMPLEMENTED | Returns `{ status: "ok", service: "billing" }`                                                                     |
| `GET /plans`                      | `/plans`                      | IMPLEMENTED | Queries `subscriptionPlans` WHERE `isActive = true`, ordered by `sortOrder`                                        |
| `GET /users/:userId/subscription` | `/users/:userId/subscription` | IMPLEMENTED | Queries `userSubscriptions` by userId, falls back to `{ plan: "free", status: "active" }` if none found            |
| `POST /subscriptions`             | `/subscriptions`              | PARTIAL     | Inserts into `userSubscriptions` with real DB write + dispatches webhook. **TODO: Stripe subscription creation**   |
| `POST /subscriptions/:id/cancel`  | `/subscriptions/:id/cancel`   | PARTIAL     | Updates `userSubscriptions` (cancelAtPeriodEnd, canceledAt) with real DB write. **TODO: Cancel in Stripe**         |
| `GET /users/:userId/credits`      | `/users/:userId/credits`      | IMPLEMENTED | Queries `creditBalances` by userId, returns balance and periodCreditsUsed                                          |
| `POST /credits/purchase`          | `/credits/purchase`           | PARTIAL     | Queries `creditPackages`, updates/inserts `creditBalances`, records `creditTransactions`. **TODO: Stripe payment** |
| `POST /usage`                     | `/usage`                      | IMPLEMENTED | Inserts into `usageRecords`, deducts from `creditBalances` using `sql` template for atomic decrement               |
| `GET /users/:userId/usage`        | `/users/:userId/usage`        | IMPLEMENTED | Queries `usageRecords` with date range and type filters, ordered by `createdAt` desc                               |
| `POST /webhooks/stripe`           | `/webhooks/stripe`            | STUB        | Logs receipt, returns `{ received: true }`. No signature verification or event processing                          |

The service includes request/response logging hooks, graceful shutdown handling, and structured logging via `createLogger`.

### Billing tRPC Router (`apps/app/lib/trpc/routers/billing.router.ts`)

Imports `stripe` from `@repo/payments` and `getOrCreateStripeCustomer` from `@/lib/stripe/helpers`. 18 procedures, all with real Drizzle queries. Stripe integration is complete for all procedures.

| Procedure                      | Type     | Status      | Database Tables + Stripe Usage                                                                                           |
| ------------------------------ | -------- | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `listPlans`                    | query    | IMPLEMENTED | `subscriptionPlans` SELECT WHERE isActive = true                                                                         |
| `getSubscription`              | query    | IMPLEMENTED | `userSubscriptions` JOIN `subscriptionPlans`                                                                             |
| `getCreditBalance`             | query    | IMPLEMENTED | `creditBalances` WHERE userId, returns defaults if not found                                                             |
| `listCreditPackages`           | query    | IMPLEMENTED | `creditPackages` WHERE isActive = true                                                                                   |
| `getCreditTransactions`        | query    | IMPLEMENTED | `creditTransactions` with type filter + pagination                                                                       |
| `getUsageRecords`              | query    | IMPLEMENTED | `usageRecords` with type/date filters + pagination                                                                       |
| `getUsageSummary`              | query    | IMPLEMENTED | `usageRecords` GROUP BY type, SUM credits for current period                                                             |
| `updateAutoTopup`              | mutation | IMPLEMENTED | `creditBalances` UPDATE/INSERT                                                                                           |
| `listPaymentMethods`           | query    | IMPLEMENTED | `paymentMethods` ordered by isDefault                                                                                    |
| `setDefaultPaymentMethod`      | mutation | IMPLEMENTED | `paymentMethods` UPDATE (clears other defaults, sets new)                                                                |
| `deletePaymentMethod`          | mutation | IMPLEMENTED | `paymentMethods` DELETE + `stripe.paymentMethods.detach()`                                                               |
| `listInvoices`                 | query    | IMPLEMENTED | `invoices` with status filter + pagination                                                                               |
| `getInvoice`                   | query    | IMPLEMENTED | `invoices` by ID with ownership check                                                                                    |
| `createSubscriptionCheckout`   | mutation | IMPLEMENTED | Gets plan from DB, calls `getOrCreateStripeCustomer()`, calls `stripe.checkout.sessions.create()` with subscription mode |
| `createCreditPurchaseCheckout` | mutation | IMPLEMENTED | Gets package from DB, calls `getOrCreateStripeCustomer()`, calls `stripe.checkout.sessions.create()` with payment mode   |
| `cancelSubscription`           | mutation | IMPLEMENTED | DB update + `stripe.subscriptions.update()` or `stripe.subscriptions.cancel()`                                           |
| `reactivateSubscription`       | mutation | IMPLEMENTED | DB update + `stripe.subscriptions.update({ cancel_at_period_end: false })`                                               |
| `getBillingPortalUrl`          | mutation | IMPLEMENTED | Reads `users.stripeCustomerId`, calls `stripe.billingPortal.sessions.create()`                                           |

---

## What Needs Building

### 1. Stripe Webhook Handler in Microservice (CRITICAL)

The endpoint at `POST /webhooks/stripe` (line 295 in `services/billing/src/index.ts`) is still a stub. It needs signature verification and event processing. This is the key missing piece -- without it, Stripe events (subscription created, invoice paid, subscription cancelled) never sync back to the database.

**Requires:** `@fastify/raw-body` plugin for signature verification, `stripe` package.

```typescript
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-12-18.acacia",
});

// Register raw body plugin for webhook signature verification
await app.register(import("@fastify/raw-body"), {
  field: "rawBody",
  global: false,
  encoding: "utf8",
  runFirst: true,
});

app.post("/webhooks/stripe", { config: { rawBody: true } }, async (request, reply) => {
  const signature = request.headers["stripe-signature"] as string;
  const rawBody = request.rawBody;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
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
});
```

### 2. Stripe Integration in Microservice Subscription Creation

At line 79 in `services/billing/src/index.ts`, `POST /subscriptions` inserts directly into the DB without going through Stripe. It should create a Stripe checkout session instead, and let the webhook handler create the DB record on `checkout.session.completed`.

Alternatively, if this endpoint is only used for internal/direct subscription creation (bypassing Stripe), it can stay as-is and the tRPC router handles all user-facing Stripe flows. Decide based on architecture preference.

### 3. Credit Auto-Top-Up Logic

The `POST /usage` endpoint deducts credits but does not check for auto-top-up threshold. Add after the balance deduction:

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

Then in the `POST /usage` handler, after deducting credits:

```typescript
// Check auto top-up threshold
const [updatedBalance] = await db
  .select()
  .from(creditBalances)
  .where(eq(creditBalances.userId, userId))
  .limit(1);

if (
  updatedBalance?.autoTopupEnabled &&
  updatedBalance.balance <= (updatedBalance.autoTopupThreshold || 0)
) {
  triggerAutoTopup(userId, updatedBalance.autoTopupPackageId).catch((err) =>
    logger.error({ err, userId }, "Auto top-up failed")
  );
}
```

### 4. Grant Credits Helper

Needed for the webhook handler and auto-top-up:

```typescript
async function grantCredits(
  userId: string,
  amount: number,
  type: "subscription_grant" | "purchase" | "bonus",
  referenceType: string,
  referenceId: string
) {
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

---

## Database Tables

All defined in `packages/database/src/schema/billing.ts`:

### `subscription_plans`

Plan definitions (free, pro, max, enterprise). Key columns:

- `priceMonthly`, `priceYearly` (in cents)
- `monthlyCredits` -- Credits granted per billing period
- `stripePriceIdMonthly`, `stripePriceIdYearly`, `stripeProductId` -- Stripe IDs
- `limits` (JSONB) -- `maxSessions`, `maxAgents`, `maxStorage`, `maxTeamMembers`, `maxProjects`
- `features` (JSONB) -- String array of feature flags

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

- `balance` -- Total available credits
- `periodCredits`, `periodCreditsUsed` -- Subscription credits for current period
- `purchasedCredits` -- Credits from one-time purchases
- `autoTopupEnabled`, `autoTopupThreshold`, `autoTopupPackageId`

### `credit_transactions`

Ledger of all credit changes. Key columns:

- `type` ("subscription_grant" | "purchase" | "usage" | "refund" | "adjustment" | "bonus" | "expiration")
- `amount` -- Positive for credit, negative for debit
- `balanceAfter` -- Running balance after transaction
- `referenceType`, `referenceId` -- Links to session, invoice, package, etc.

### `usage_records`

Detailed usage tracking. Key columns:

- `type` ("chat" | "agent" | "connector" | "storage" | "api")
- `credits` -- Credits consumed
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

## File Structure

### Billing Microservice

```
services/billing/src/
  index.ts              # 343 lines - 9 endpoints with real Drizzle queries
```

### Billing tRPC Router

```
apps/app/lib/trpc/routers/
  billing.router.ts     # 607 lines - 18 procedures with real Drizzle queries + Stripe API calls
```

### Database Schema

```
packages/database/src/schema/
  billing.ts            # 8 tables with full type exports
```

### Payments Package

```
packages/payments/      # Stripe client wrapper, imported by tRPC router as `@repo/payments`
```

### Stripe Helpers

```
apps/app/lib/stripe/
  helpers.ts            # getOrCreateStripeCustomer() used by tRPC router
```

---

## Environment Variables

| Variable                | Default               | Description                   |
| ----------------------- | --------------------- | ----------------------------- |
| `PORT`                  | `4008`                | Billing service port          |
| `STRIPE_SECRET_KEY`     | None                  | Stripe secret key             |
| `STRIPE_WEBHOOK_SECRET` | None                  | Stripe webhook signing secret |
| `DATABASE_URL`          | (from @repo/database) | PostgreSQL connection         |
