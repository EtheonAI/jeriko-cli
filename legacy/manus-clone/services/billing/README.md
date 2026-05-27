# Billing Service

Credit-based usage billing for Jeriko, matching the Manus.im pricing model.

## Plans

| | Jeriko Light (Free) | Jeriko Pro ($39/mo) | Jeriko Max ($199/mo) |
|---|---|---|---|
| Monthly Credits | 0 | 3,900 | 19,900 |
| Starter Credits | 1,000 (never expire) | 1,000 | 1,000 |
| Daily Refresh | 300/day | 300/day | 300/day |
| Concurrent Sessions | 1 | 3 | 10 |
| Parallel Subtasks | 5 | 10 | 20 |
| Scheduled Tasks | 1 | 3 | 10 |
| Steps per Session | 15 | 30 | 50 |
| Yearly Discount | - | 17% | 17% |

## Credit Types & Consumption Order

Credits are consumed in this order (daily first, starter last):

1. **Daily credits** - 300/day for all plans. Expire at midnight UTC. Auto-refreshed on first use each day.
2. **Monthly credits** - Granted at subscription billing cycle. Expire at period end.
3. **Purchased credits** - Buy via credit packages. Never expire.
4. **Starter credits** - 1,000 granted at signup. Never expire.

## What Costs Credits

### LLM Token Usage (per step)
- **Input tokens**: 1 credit per 1,000 tokens (rounded up)
- **Output tokens**: 3 credits per 1,000 tokens (rounded up)
- Example: 2,000 input + 800 output = 2 + 3 = **5 credits**

### Sandbox VM Time
- **2 credits per minute** of active sandbox time
- Billed from sandbox creation to last use (idle time excluded)
- Metered when sandbox is destroyed or cleaned up

### Tool Calls (fixed per-tool costs)

| Tool | Credits | Notes |
|---|---|---|
| `browser_navigate` | 3 | VM + page rendering |
| `browser_click/type/scroll` | 1 | Simple browser actions |
| `browser_screenshot` | 2 | VM + capture |
| `file_read/write/list/delete/move` | 1 | Sandbox I/O |
| `file_edit` | 2 | Parse + write |
| `shell_exec` / `terminal_exec` | 3 | VM compute |
| `web_search` | 5 | Third-party API |
| `image_generation` | 10 | DALL-E / Gemini API |
| `create_slides` | 8 | Compute + API |
| `deploy_website` | 5 | VM + third-party |
| `send_email` | 5 | Third-party |
| `text_editor` | 2 | Manus-style editor |
| `sandbox_create` | 5 | VM allocation |
| Composio tools (gmail\_, slack\_, etc.) | 3 | Third-party connector |
| `show_plan`, `message_user` | 0 | UI only |
| `parallel_tasks` | 0 | Parent free; subtasks billed individually |
| Unknown tools | 1 | Default |

### Parallel Subtasks
Each subtask inside `parallel_tasks` is metered separately:
- **Text/code/research subtasks**: LLM token cost (same formula as above)
- **Image generation subtasks**: 10 credits per image (DALL-E or Gemini)
- The `parallel_tasks` parent tool itself is free (0 credits)
- Number of subtasks capped by plan (Light: 5, Pro: 10, Max: 20)

## Credit States

| State | Condition | Behavior |
|---|---|---|
| `ok` | Balance >= 3x required | Normal operation |
| `warning` | Balance >= required but < 3x | Show low-credit warning |
| `soft_block` | Balance > 0 but < required | Block new sessions, allow in-progress |
| `hard_block` | Balance <= 0 | Block all operations |

## API Endpoints

### Credit Operations
- `POST /credits/check` - Check if user has sufficient credits
- `POST /credits/initialize` - Initialize credits for new user (1000 starter + 300 daily)
- `POST /credits/purchase` - Purchase credit package via Stripe
- `POST /credits/refresh-daily` - Trigger daily credit refresh
- `GET /users/:userId/credits` - Get current balance

### Metering
- `POST /metering/step` - Meter an LLM step (token usage)
- `POST /metering/tool` - Meter a tool call
- `POST /metering/vm-time` - Meter sandbox VM time

### Plans & Limits
- `GET /plans` - List active subscription plans
- `GET /users/:userId/plan-limits` - Get user's plan limits
- `GET /users/:userId/subscription` - Get user's subscription
- `GET /tool-costs` - List all tool credit costs

### Subscriptions
- `POST /subscriptions` - Create subscription (Stripe)
- `POST /subscriptions/:id/cancel` - Cancel subscription
- `POST /webhooks/stripe` - Stripe webhook handler

### Admin
- `POST /admin/seed-plans` - Seed the 3 plan definitions

## Architecture

```
Orchestrator                  Billing Service              Database
    |                              |                          |
    |-- POST /credits/check ------>|                          |
    |<---- ok/warning/block -------|                          |
    |                              |                          |
    |  (agent loop runs)           |                          |
    |                              |                          |
    |-- POST /metering/step ------>|-- UPDATE credit_balances -->|
    |   {tokens, model}           |-- INSERT usage_ledger ----->|
    |                              |-- INSERT credit_transactions->|
    |                              |                          |
    |-- POST /metering/tool ------>|  (same flow)             |
    |   {toolName}                |                          |
    |                              |                          |
    |  (sandbox destroyed)         |                          |
    |-- POST /metering/vm-time --->|  (same flow)             |
    |   {durationMinutes}         |                          |
```

### Metering Flow
1. Orchestrator calls `POST /credits/check` before starting a session
2. If `hard_block` → return 402 to client
3. During session, `onStepFinish` callback fires after each LLM completion
4. Orchestrator calls `POST /metering/step` with token counts (retry, not fire-and-forget)
5. For each tool call, orchestrator calls `POST /metering/tool`
6. Parallel subtasks: each subtask LLM call + image gen metered individually
7. On sandbox destroy, orchestrator calls `POST /metering/vm-time` with duration
8. Billing service deducts credits using consumption order, writes immutable ledger

### Reliability
- Metering calls use **retry with 2 attempts** (1s delay between)
- Non-retryable errors (4xx) fail immediately
- If billing service is down, credit checks return null (allow by default)
- Plan limits return free-tier defaults on failure

## Database Tables

- `subscription_plans` - Plan definitions (Light, Pro, Max)
- `user_subscriptions` - User → plan mapping, Stripe sync
- `credit_balances` - Per-user balance with daily/monthly/purchased/starter breakdown
- `credit_transactions` - Credit grants, purchases, deductions
- `usage_records` - Per-session usage aggregation
- `usage_ledger` - **Immutable** append-only metering log (never updated, never deleted)
- `credit_packages` - Purchasable credit add-ons
- `payment_methods` - Stripe payment methods
- `invoices` - Billing invoices

## Running

```bash
# Development
cd services/billing
env $(grep -v '^#' .env | xargs) npx tsx src/index.ts

# Seed plans
curl -X POST http://localhost:4008/admin/seed-plans

# Run migration (if DB was set up with db:push)
DATABASE_URL="postgresql://..." npx tsx packages/database/scripts/billing-migration.ts
```

## Tests

```bash
# Run all billing tests (101 tests across 4 files)
npx vitest run services/billing/src/tests/

# Individual test suites
npx vitest run services/billing/src/tests/billing-jeriko-parity.test.ts   # 51 tests - plan definitions, credit math
npx vitest run services/billing/src/tests/metering.test.ts                # 21 tests - ledger, step/tool metering
npx vitest run services/billing/src/tests/billing-e2e-flow.test.ts        # 22 tests - full session flow, VM time
npx vitest run services/billing/src/tests/billing.test.ts                 # 7 tests  - service basics
```
