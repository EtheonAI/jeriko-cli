# Scale, Triggers, Events, and ECP Architecture

Date: 2026-05-23

Validated source:

- [`../09-research/2026-05-23-scale-triggers-events-ecp-validation.md`](../09-research/2026-05-23-scale-triggers-events-ecp-validation.md)
- [`../_source/v3-scale-triggers-ecp/`](../_source/v3-scale-triggers-ecp/)

## Decision

`.flow` defines logical triggers. It does not create platform cron jobs or runtime functions.

Target pipeline:

```text
.flow source
-> parser/validator
-> compiler extracts triggers
-> workflow_triggers rows
-> workflow.scheduler.tick / workflow.event_router
-> workflow/run.requested
-> generic workflow.run executor
-> EventContextPackets, task reports, artifacts, issue cards, reflection packets
```

This gives the product user-friendly triggers while keeping the runtime scalable.

## Three Scheduling Layers

### Layer A: Static Platform Schedules

Small fixed set of code-defined scheduled functions:

- `workflow.scheduler.tick`
- `usage.rollup`
- `cleanup.old_runs`
- `watchdog.stuck_runs`
- `connection.healthcheck`
- provider-specific renewal jobs such as Gmail watch renewal

These are platform operations. Users do not create these.

### Layer B: Dynamic User Workflow Triggers

User/AI-authored `.flow` triggers are stored as data:

```text
workflow_triggers
```

Supported trigger families:

- `manual`
- `schedule`
- `app_event`
- `workflow_event`
- `webhook`

The scheduler and event router decide when to emit `workflow/run.requested`.

### Layer C: In-Run Waits and Delays

When a run is already active, use durable wait primitives:

- sleep for a duration
- sleep until a timestamp
- wait for approval
- wait for callback
- wait for app/workflow event

These are run state, not new trigger rows.

## Static Function Inventory

### `workflow.scheduler.tick`

Runs every configured interval.

Responsibilities:

- claim due `workflow_triggers`
- enforce org plan limits and credit checks
- apply jitter and misfire policy
- dedupe by trigger/run key
- emit `workflow/run.requested`
- advance `next_run_at`

### `workflow.event_router`

Triggered by normalized events.

Responsibilities:

- receive EventContextPacket
- persist event
- match `workflow_triggers.event_type`
- apply `match_rules`
- enforce rate limits and event storm controls
- emit `workflow/run.requested`
- wake waiting runs when relevant

### `workflow.run`

Generic executor.

Responsibilities:

- load compiled `.flow` runtime JSON
- execute the requested job
- dispatch task primitives
- write task reports and events
- store artifacts
- create issue cards
- meter usage
- request reflection only when rules require

### `workflow.approval.resume`

Responsibilities:

- store approval decision
- resume waiting run
- update approval card
- emit approval EventContextPacket

### `workflow.worker.callback`

Responsibilities:

- verify signed callback
- store TaskReport
- store artifact references
- emit EventContextPacket
- resume dependent work

### `workflow.reflection`

Responsibilities:

- compress run events/task reports/costs/issues into Run Reflection Packet
- wake main AI only when reflection rules fire
- produce FlowPatch proposals

### Support Functions

- `notification.dispatch`
- `usage.rollup`
- `watchdog.stuck_runs`
- `cleanup.old_runs`

## Trigger Registry

Minimum target schema:

```text
workflow_triggers
  id
  org_id
  workflow_id
  workflow_version_id
  job_id
  trigger_type
  event_type
  match_rules
  cron_expr
  timezone
  next_run_at
  last_run_at
  status
  min_interval_seconds
  jitter_seconds
  max_runs_per_day
  concurrency_key
  misfire_policy
  dedupe_key
  created_at
  updated_at
```

Required behavior:

- due-row claim must be atomic
- retries must not duplicate runs
- trigger ownership must always include `org_id`
- trigger matching must be deterministic and bounded
- schedule catch-up must be bounded by plan and policy

## EventContextPacket

Internal-only v0 envelope:

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
  "payload": {},
  "artifacts": [],
  "quality": {},
  "routing": {
    "notify_ui": true,
    "notify_tasks": ["approval"],
    "notify_main_ai": false
  },
  "cost": {
    "credits": 8
  }
}
```

Rules:

- store raw provider webhook payload separately when needed
- route normalized ECP to workflows, tasks, UI, and reflection
- do not wake main AI for every ECP
- include correlation and causation IDs for traceability
- include artifact refs, not large artifact bodies

## TaskReport

Every worker returns a TaskReport:

- task id
- worker id
- status
- summary
- inputs used
- outputs created
- emitted events
- tools used
- model used
- token/cost usage
- confidence
- issues
- suggested patches

TaskReports power the UI side panel, issue cards, analytics, worker routing, and reflection packets.

## Run Reflection Packet

The main AI receives compressed run context only when reflection rules fire:

- repeated failure
- verifier failed
- approval rejected
- user edited output heavily
- cost exceeded estimate
- workflow stuck
- scheduled review
- user asks what happened

Default rule:

```text
worker -> EventContextPacket -> Context Router -> task/UI/workflow
worker -> TaskReport -> run record
run -> Reflection Packet -> main AI only if needed
```

## API Surface

Dynamic user workflows do not create routes.

Static endpoints:

- `POST /api/workflows/compile`
- `POST /api/workflows`
- `POST /api/workflows/:id/run`
- `POST /api/workflows/:id/pause`
- `POST /api/workflows/:id/resume`
- `POST /api/workflows/:id/cancel`
- `GET /api/runs/:id`
- `GET /api/runs/:id/events`
- `POST /api/events/ingest`
- `POST /api/webhooks/:provider`
- `POST /api/approvals/:id/decision`
- `POST /api/workers/callback`
- `GET /api/artifacts/:id`
- `POST /api/connections/:provider`
- `POST /api/inngest`

## Scale Guardrails

Required:

- per-org concurrency
- per-tool/provider rate limits
- bounded foreach and parallelism
- trigger min intervals
- active trigger limits by plan
- max runs per day
- event source dedupe
- event storm detection
- idempotency keys for external actions
- artifact bodies outside Postgres
- compressed context routing

Forbidden:

- one cron per user trigger
- one function per user workflow
- unbounded foreach
- unbounded external event fanout
- raw logs to main AI by default
- external actions without approval
- generated code outside sandbox
