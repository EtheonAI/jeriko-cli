# Scale, Triggers, Events, Cron, and ECP Architecture Addendum

_Date: 2026-05-23_

## 1. Final decision

The platform should not create one cron/job/function per user workflow trigger.

The correct architecture is:

```text
.flow defines logical triggers
→ compiler extracts trigger definitions
→ triggers are stored as DB rows
→ one/few platform scheduler functions scan due triggers
→ scheduler emits workflow/run.requested events
→ one generic Inngest executor runs the compiled .flow job
```

This keeps the system scalable, cheap, and maintainable.

## 2. Why not one Vercel Cron per workflow?

Vercel Cron is useful but not the right primitive for dynamic user workflows. Vercel Cron has a project-level limit of 100 cron jobs, and Hobby accounts only support daily cron while Pro/Enterprise support per-minute precision. Cron jobs also invoke Vercel Functions and count against function usage.

This means:

```text
1 workflow with 40 crons = already too much for Vercel Cron architecture.
10 users with 40 crons each = impossible with per-trigger Vercel Cron.
```

Therefore:

```text
Vercel Cron = optional backup/maintenance only.
Inngest + DB trigger registry = real dynamic scheduler.
```

## 3. Why Inngest fits

Use Inngest because it provides the durable execution substrate:

- scheduled functions
- cron with timezones
- jitter
- fan-out
- step.run
- step.sleep / sleepUntil
- step.waitForEvent
- step.waitForSignal
- step.invoke
- step.sendEvent
- retries
- observability
- flow control
- concurrency
- throttling
- rate limiting
- debounce
- priority

Inngest scheduled functions support timezone-aware cron and a fan-out pattern where one scheduled function loads many records and emits events for another function to handle actual work. That pattern maps directly to our workflow scheduler.

## 4. Three scheduling layers

### Layer A — Platform scheduled functions

Static Inngest functions created in code:

```text
workflow.scheduler.tick
usage.rollup.daily
cleanup.old_runs
watchdog.stuck_runs
gmail.watch.renewal
tool.connection.healthcheck
```

These are not user-created. They are platform maintenance/execution functions.

### Layer B — Dynamic user workflow schedules

User/AI-defined schedules from `.flow` are stored as DB rows:

```text
workflow_triggers
```

Examples:

```yaml
trigger:
  type: schedule
  cron: "0 10 * * MON-FRI"
  timezone: "America/Los_Angeles"
  jitter: "5m"
```

The scheduler tick finds due rows and emits workflow runs.

### Layer C — In-run waits and delays

When a workflow is already running and needs to wait:

```text
wait 4 hours after a post
wait for user approval
wait for Gmail reply
wait until a timestamp
```

Use Inngest step primitives:

```text
step.sleep
step.sleepUntil
step.waitForEvent
step.waitForSignal
```

These should not become DB cron rows.

## 5. Static Inngest function inventory

We need a small static function set.

### 5.1 `workflow.scheduler.tick`

Runs every minute or configured interval.

Responsibilities:

- claim due schedule triggers from DB
- enforce plan limits
- enforce credits
- apply jitter/misfire rules
- emit `workflow/run.requested`
- advance `next_run_at`

### 5.2 `workflow.event_router`

Triggered by normalized events.

Responsibilities:

- receive EventContextPacket
- store event
- match against `workflow_triggers`
- enforce rate limits
- emit workflow run events
- wake waiting tasks if needed

### 5.3 `workflow.run`

The generic executor.

Responsibilities:

- load compiled `.flow` runtime JSON
- execute the requested job
- dispatch task types
- write events
- save artifacts
- create task reports
- create issue cards
- trigger reflection when needed

### 5.4 `workflow.approval.resume`

Handles approval events.

Responsibilities:

- receive approval/rejection/edit
- store decision
- send Inngest signal/event
- resume waiting run
- update approval cards

### 5.5 `workflow.worker.callback`

Handles async worker callbacks.

Use when a worker runs outside the immediate process or returns later.

Responsibilities:

- verify signed callback
- store task report
- store artifact refs
- emit EventContextPacket
- resume dependent tasks if needed

### 5.6 `workflow.reflection`

Creates run reflection packets.

Responsibilities:

- summarize task reports/events/issues/costs
- decide whether main AI should wake
- generate patch proposals if needed

### 5.7 `notification.dispatch`

Sends notifications.

Responsibilities:

- route in-app/email/Slack/SMS/webhook notifications
- enforce per-chat notification preferences
- digest or realtime delivery

### 5.8 `usage.rollup`

Billing metering.

Responsibilities:

- aggregate usage events
- update credit ledger
- detect abuse/cost spikes

### 5.9 `watchdog.stuck_runs`

Reliability maintenance.

Responsibilities:

- find stuck runs
- find expired approvals
- detect waiting tasks past timeout
- create issue cards
- optionally pause unhealthy workflows

### 5.10 `cleanup.old_runs`

Retention and storage management.

Responsibilities:

- archive old event logs
- delete expired artifacts
- enforce plan retention

## 6. API endpoint inventory

The app also needs static HTTP endpoints.

```text
POST /api/workflows/compile
POST /api/workflows
POST /api/workflows/:id/run
POST /api/workflows/:id/pause
POST /api/workflows/:id/resume
POST /api/workflows/:id/cancel
GET  /api/runs/:id
GET  /api/runs/:id/events            # SSE stream
POST /api/events/ingest              # external/app events
POST /api/webhooks/:provider         # Gmail/Stripe/Shopify/etc.
POST /api/approvals/:id/decision
POST /api/workers/callback
GET  /api/artifacts/:id
POST /api/connections/:provider
POST /api/billing/checkout
POST /api/billing/webhook
POST /api/inngest                    # Inngest serve endpoint
```

The key idea:

```text
Dynamic user workflows do not create new API routes.
They create DB records and compiled .flow runtime specs.
```

## 7. Trigger registry table

Recommended schema:

```sql
workflow_triggers
  id uuid primary key
  org_id uuid not null
  workflow_id uuid not null
  workflow_version_id uuid not null
  job_id text not null
  trigger_type text not null -- schedule, app_event, workflow_event, manual, webhook
  event_type text null
  match_rules jsonb null
  cron_expr text null
  timezone text null
  next_run_at timestamptz null
  last_run_at timestamptz null
  status text not null -- active, paused, disabled, errored
  min_interval_seconds int
  jitter_seconds int
  max_runs_per_day int
  concurrency_key text
  misfire_policy text -- skip, run_once, catch_up_limited, ask_user
  dedupe_key text
  created_at timestamptz
  updated_at timestamptz
```

## 8. Scheduled trigger flow

```text
1. AI writes .flow with schedules.
2. Parser validates .flow.
3. Compiler extracts schedule triggers.
4. Triggers are stored in workflow_triggers.
5. workflow.scheduler.tick runs.
6. Scheduler claims due rows with SKIP LOCKED.
7. Scheduler checks credits/limits.
8. Scheduler emits workflow/run.requested.
9. Inngest workflow.run executes the job.
10. Scheduler advances next_run_at.
```

## 9. App event/webhook flow

Example: Gmail, Stripe, Shopify, Slack, Twilio, HubSpot.

```text
1. App webhook hits /api/webhooks/:provider.
2. Endpoint verifies signature/authenticity.
3. Endpoint normalizes raw webhook into EventContextPacket.
4. Event is stored in workflow_events.
5. workflow.event_router matches triggers where event_type matches.
6. match_rules are applied.
7. Matching workflows receive workflow/run.requested.
8. If a running workflow is waiting for this event, Inngest waitForEvent/waitForSignal resumes it.
```

Important:

```text
App events and workflow events share the same event context model.
Cron is just another way to create an event.
```

## 10. ECP-style Event Context Protocol

We should implement ECP internally first.

Do not start with a public protocol. Start with a platform-internal event context model.

### EventContextPacket

```json
{
  "id": "ecp_123",
  "type": "artifact.image.generated",
  "schema_version": "0.1",
  "org_id": "org_123",
  "workflow_id": "wf_social",
  "workflow_version_id": "wfv_7",
  "run_id": "run_456",
  "job_id": "daily_content",
  "task_id": "generate_images",
  "worker_id": "image_worker",
  "source": {
    "kind": "subagent",
    "provider": "internal"
  },
  "correlation_id": "corr_abc",
  "causation_id": "evt_post_draft_ready",
  "summary": "Generated Instagram and LinkedIn images.",
  "payload": {
    "platforms": ["instagram", "linkedin"],
    "approval_required": true
  },
  "artifacts": [
    {
      "path": "artifacts/images/instagram.png",
      "type": "image",
      "related": "artifacts/posts/instagram.json",
      "status": "ready_for_review"
    }
  ],
  "quality": {
    "confidence": 0.88,
    "verifier_status": "passed"
  },
  "routing": {
    "notify_ui": true,
    "notify_tasks": ["approval", "schedule_posts"],
    "notify_main_ai": false
  },
  "cost": {
    "credits": 8
  }
}
```

### Why ECP matters

Without ECP:

```text
workers output files
other workers guess what happened
main AI may need raw logs
context becomes messy
```

With ECP:

```text
workers emit typed context
dependent tasks get exact info
UI updates live
main AI wakes only on reflection triggers
```

This is cheaper and more scalable than freeform worker-to-worker chat.

## 11. Worker-to-worker context

Workers should not chat freely by default.

Use:

```text
worker → EventContextPacket → Context Router → dependent worker
```

Example:

```text
image_worker emits artifact.image.generated
scheduler worker listens to artifact.image.generated
approval task waits for post.draft.ready + artifact.image.generated
```

`.flow` example:

```yaml
tasks:
  - id: generate_images
    type: ai_task
    worker: image_worker
    output:
      - artifacts/images/
    emit:
      - artifact.image.generated
    notify:
      ui: true
      tasks: [approval, schedule_posts]
      main_ai: false

  - id: schedule_posts
    type: tool_call
    uses: social.scheduler.create
    listens_to:
      - post.draft.ready
      - artifact.image.generated
      - approval.approved
```

## 12. Context routing to main AI

The main AI should not receive every event.

Main AI wakes when:

```text
run completed_with_issues
task failed repeatedly
approval rejected
user edited output heavily
verifier failed
cost exceeded estimate
workflow got stuck
weekly improvement cycle fires
user asks "what happened?"
```

Main AI should receive a compressed Run Reflection Packet, not raw logs.

## 13. Run Reflection Packet

```json
{
  "workflow_id": "wf_social",
  "run_id": "run_456",
  "status": "completed_with_issues",
  "summary": "Created 3 posts and 2 images. LinkedIn image failed validation.",
  "completed_tasks": 8,
  "failed_tasks": 1,
  "issues": [
    {
      "task_id": "generate_images.linkedin",
      "impact": "medium",
      "reason": "Wrong dimensions",
      "suggested_patch": "Add linkedin_dimensions_check"
    }
  ],
  "cost": {
    "credits": 24,
    "ai_tasks": 5,
    "tool_calls": 4,
    "sandbox_seconds": 18
  },
  "patch_opportunities": [
    {
      "target": "workflow.flow",
      "change": "Add LinkedIn image dimension verifier."
    },
    {
      "target": "instructions/image.md",
      "change": "Always use 1200x627 for LinkedIn."
    }
  ]
}
```

## 14. Scale model

This can scale if we follow these rules:

### Do

```text
store triggers as DB rows
use one scheduler tick
use generic executor
meter every step
limit concurrency
rate-limit event sources
dedupe event IDs
use idempotency keys
use bounded foreach
store artifacts outside DB
route compressed context only
wake main AI only when needed
```

### Do not

```text
create one cron per user trigger
create one Inngest function per workflow
send raw logs to main AI
allow unlimited foreach
allow unlimited free schedules
allow external actions without approval
run custom code outside sandbox
```

## 15. Cost model

Inngest pricing matters because executions are counted by function runs and step executions.

Plan around:

```text
workflow run = 1 function execution
each task/step = additional execution
events processed = separate usage
```

Therefore, our billing should track:

```text
workflow runs
step count
events processed
AI tasks
model tokens
tool calls
sandbox seconds
image generation
artifact storage
notification sends
```

User-facing billing should use credits.

## 16. Credit charging model

Recommended charging:

```text
workflow run started: 1 credit
ai_task: model-based credits
tool_call: 0.1–1 credit
sandbox_command: seconds/resource based
image generation: pass-through + margin
event processed over plan limit: small credit
notification delivery: small credit for SMS/webhook/email volume
reflection packet/main AI wake: credits based on model used
```

## 17. Plan limits

Example:

### Free / Beta

```text
1 active workflow
5 active triggers
20 credits
manual runs only or 1 scheduled workflow
low event volume
```

### Starter

```text
3 active workflows
10 active triggers
150 credits/month
1 concurrent run
limited artifacts
```

### Pro

```text
10 active workflows
100 active triggers
600 credits/month
5 concurrent runs
more artifacts
scheduled runs
```

### Operator

```text
25 active workflows
500 active triggers
1500 credits/month
15 concurrent runs
higher event volume
```

### Business

```text
custom triggers
custom event limits
team approvals
audit logs
shared credits
```

## 18. Event storm controls

Every event source needs limits.

Controls:

```text
max events per minute per org
max events per minute per source
max workflow runs per trigger per day
dedupe window
debounce window
rate-limit threshold
auto-pause suspicious source
issue card on event storm
```

If a webhook goes crazy:

```text
pause source
create issue card
notify owner
do not spawn unlimited runs
```

## 19. Concurrency controls

Controls:

```text
per-org concurrent runs
per-workflow concurrent runs
per-job concurrent runs
per-tool concurrency
per-sandbox concurrency
per-worker/model concurrency
foreach max parallelism
```

Use Inngest flow control where possible.

## 20. Cheapness strategy

The app stays cheap because:

```text
AI writes .flow once
runtime executes deterministic steps
tool calls do not require AI
sandbox commands do not require AI
approvals do not require AI
event routing does not require AI
main AI wakes only on reflection triggers
```

The expensive parts are:

```text
initial workflow compilation
ai_task workers
image generation
script generation
reflection/patching
complex analysis
```

Charge credits for those.

## 21. Final decision

Use:

```text
Inngest scheduled functions:
  platform scheduler tick and maintenance

Database:
  dynamic user-defined triggers

Inngest events:
  workflow run requests, app events, workflow events, approval signals, worker callbacks

Inngest steps:
  task execution, waits, approvals, subworkflow invocation

Vercel Sandbox:
  custom code/scripts

ECP/internal Event Context Layer:
  worker-to-worker and app-to-workflow context

Vercel Cron:
  optional backup only, not core scheduler
```

This is clean, scalable, and senior.
