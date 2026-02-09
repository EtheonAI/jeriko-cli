# services/notification — Testing Rules

## What This Is
Notification delivery: Knock email, Web Push, in-app notifications. 364 LOC.

## What to Test

### Delivery Channels (P0)
1. Email notification → Knock API called with correct template + data
2. Web Push → push subscription used, payload correct
3. In-app → stored in DB, retrievable via API

### User Preferences (P1)
1. User opts out of email → no email sent
2. User opts out of push → no push sent
3. Preference changes take effect immediately

### Batching (P2)
1. Multiple notifications in short window → batched
2. Batch timer fires → single digest sent

### Error Handling
1. Knock API failure → retry with backoff
2. Invalid push subscription → remove subscription
3. DB error → log and continue (don't block)

## Mock Knock
```typescript
vi.mock("@knocklabs/node", () => ({
  Knock: vi.fn(() => ({
    workflows: { trigger: vi.fn().mockResolvedValue({ id: "wf-1" }) },
    users: { identify: vi.fn() },
  })),
}));
```
