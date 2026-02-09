# services/webhook — Testing Rules

## What This Is
Webhook event dispatch: HMAC signatures, retry logic, idempotency. 289 LOC.

## What to Test

### HMAC Verification (P0)
1. Valid signature → accepted
2. Invalid signature → rejected
3. Missing signature → rejected
4. Different secret → rejected

### Event Dispatch (P0)
1. Event triggers webhook delivery to registered URL
2. Payload matches expected schema
3. Headers include signature, timestamp, event type

### Retry Logic (P1)
1. First delivery fails (timeout) → retry
2. Second delivery fails → retry
3. Max retries exceeded → mark as failed
4. Exponential backoff between retries

### Idempotency (P0)
1. Same event ID processed once
2. Duplicate event ID → skip (not error)
3. Idempotency key stored and checked

### Error Handling
1. Invalid URL → mark failed immediately (no retry)
2. DNS resolution failure → retry
3. Connection timeout → retry

## Gotcha
- Neon HTTP driver does NOT support `db.transaction()` — webhook dispatch uses transactions. Must use alternative pattern.
