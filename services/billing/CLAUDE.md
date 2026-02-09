# services/billing — Testing Rules

## What This Is
Billing: Stripe integration, usage tracking, quota enforcement. 343 LOC, 4 Stripe TODOs remaining.

## What to Test

### Usage Tracking (P0)
1. Token usage recorded per request
2. Usage aggregated per billing period
3. Usage reset at period boundary

### Quota Enforcement (P0)
1. Under quota → request allowed
2. At quota → request blocked with clear error
3. Quota check is fast (cached, not DB query per request)

### Stripe Integration (P1 — when TODOs are filled)
1. Webhook signature verification
2. `checkout.session.completed` → activate subscription
3. `invoice.payment_failed` → suspend account
4. `customer.subscription.deleted` → deactivate

### Plans (P1)
1. Free tier limits enforced
2. Pro tier limits enforced
3. Plan upgrade → immediate access to new limits
4. Plan downgrade → effective at period end

## Mock Stripe
```typescript
vi.mock("stripe", () => ({
  default: vi.fn(() => ({
    webhooks: { constructEvent: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    subscriptions: { retrieve: vi.fn() },
  })),
}));
```
