# P0 #4: Billing Service Stripe Integration

## Scope

Add full Stripe integration to the billing microservice (`services/billing/src/index.ts`). Currently 343 lines with 4 Stripe TODOs. The tRPC router and Next.js webhook handler are already complete — this makes the microservice self-sufficient for service-to-service billing.

## Changes

### 1. Upgrade Stripe dependency & add raw-body plugin

**File:** `services/billing/package.json`

- Update `stripe` from `^17.7.0` → `^19.1.0` (match `@repo/payments`)
- Add `@fastify/raw-body` for webhook signature verification

### 2. Rewrite `services/billing/src/index.ts`

All changes are in this single file. Add ~200 lines, modify 4 endpoints.

#### 2a. Add Stripe client + imports

- Create `Stripe` instance with `process.env.STRIPE_SECRET_KEY` and `apiVersion: "2025-09-30.clover"`
- Import `paymentMethods`, `invoices`, `users` from `@repo/database`
- Register `@fastify/raw-body` plugin on the Fastify instance

#### 2b. Add `grantCredits()` helper function

- Port pattern from `apps/app/lib/stripe/helpers.ts:38-102`
- Upserts `creditBalances`, handles `subscription_grant` (reset period) and `purchase` (increment purchased)
- Records transaction in `creditTransactions` ledger

#### 2c. Fix `POST /subscriptions` (line 71-110)

- Look up the plan from `subscriptionPlans` to get `stripePriceIdMonthly`/`stripePriceIdYearly`
- Get/create Stripe customer via `stripe.customers.create()` or lookup from `users.stripeCustomerId`
- Create Stripe subscription via `stripe.subscriptions.create({ customer, items: [{ price }], payment_behavior: 'default_incomplete', default_payment_method })`
- Store `stripeSubscriptionId` and `stripeCustomerId` in the DB insert
- Grant initial credits via `grantCredits()`

#### 2d. Fix `POST /subscriptions/:id/cancel` (line 113-133)

- Before DB update, look up `stripeSubscriptionId` from the subscription record
- Call `stripe.subscriptions.update(stripeSubId, { cancel_at_period_end: true })`
- Then update DB as currently done

#### 2e. Fix `POST /credits/purchase` (line 155-220)

- Look up the credit package to get `stripePriceId`
- Get Stripe customer ID from `users` table
- Get default payment method from `paymentMethods` table
- Create `stripe.paymentIntents.create({ amount, currency, customer, payment_method, off_session: true, confirm: true, metadata })`
- Only grant credits if payment succeeds
- Return `{ transactionId, credits, status, stripePaymentIntentId }`

#### 2f. Implement `POST /webhooks/stripe` (line 295-300)

- Enable raw body on this specific route via `{ config: { rawBody: true } }`
- Verify signature with `stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET)`
- Handle 4 event types (matching the Next.js handler pattern from `apps/app/app/api/webhooks/stripe/route.ts`):
  - `checkout.session.completed` → Create/update subscription in DB + grant credits
  - `invoice.paid` → Upsert invoice record + grant renewal credits
  - `customer.subscription.updated` → Sync status, period dates, cancelAtPeriodEnd
  - `customer.subscription.deleted` → Set status to "canceled"

#### 2g. Add auto-top-up check to `POST /usage` (line 223-257)

- After credit deduction, query updated balance
- If `autoTopupEnabled && balance <= autoTopupThreshold`, fire async `triggerAutoTopup()`
- `triggerAutoTopup()`: Get default payment method, create off-session payment intent, grant credits on success

## Files Modified

| File                            | Action                                       |
| ------------------------------- | -------------------------------------------- |
| `services/billing/package.json` | Update stripe version, add @fastify/raw-body |
| `services/billing/src/index.ts` | Implement all 4 Stripe TODOs + helpers       |

## Reused Code & Patterns

- **`grantCredits()` pattern** from `apps/app/lib/stripe/helpers.ts:38-102` — Same logic, adapted for service context
- **Webhook handler pattern** from `apps/app/app/api/webhooks/stripe/route.ts` — Same 4 events, same DB operations
- **`mapStripeStatus()` helper** from `apps/app/app/api/webhooks/stripe/route.ts:336-357`
- **Stripe API version** `"2025-09-30.clover"` from `packages/payments/index.ts:5`

## Verification

1. `pnpm --filter @rubic/billing install` — install new deps
2. `pnpm --filter @rubic/billing build` — confirm TypeScript compiles
3. Manual: Stripe CLI `stripe listen --forward-to localhost:4008/webhooks/stripe` to test webhook handler
4. Manual: Create test subscription via `POST /subscriptions` with Stripe test keys
