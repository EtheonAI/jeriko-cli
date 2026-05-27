# Scale, Trigger, Event, and ECP Checklist

Date: 2026-05-23

Source:

- [`../_source/v3-scale-triggers-ecp/scale_trigger_event_ecp_tasks_v3.csv`](../_source/v3-scale-triggers-ecp/scale_trigger_event_ecp_tasks_v3.csv)

## P0 Scheduling

- [ ] `TRG-001` DB-backed trigger registry: create `workflow_triggers`; compile step writes trigger rows.
- [ ] `TRG-002` Inngest scheduler tick: static scheduled function scans due triggers and emits `workflow/run.requested`.
- [ ] `TRG-005` Trigger dedupe keys: use `workflow_id + trigger_id + scheduled_for` idempotency key.

## P1 Scheduling

- [ ] `TRG-003` Trigger misfire policy: support `skip`, `run_once`, `catch_up_limited`, and `ask_user`.
- [ ] `TRG-004` Trigger jitter: spread scheduled runs across a bounded jitter window.

## P0 Events

- [ ] `EVT-001` Event ingestion endpoint: normalize Gmail, Stripe, Shopify, and webhook events into EventContextPackets.
- [ ] `EVT-002` Event router: match EventContextPackets against `workflow_triggers.match_rules`.
- [ ] `EVT-003` Internal ECP schema: define EventContextPacket for app, workflow, task, and worker context.
- [ ] `EVT-004` TaskReport schema: every task run stores structured worker output.

## P1 Events

- [ ] `EVT-005` Context Router: route events to tasks, workflows, UI, and main AI according to `.flow`.
- [ ] `EVT-006` Run Reflection Packet: send compressed context to main AI only when reflection rules trigger.

## P1 Static Functions

- [ ] `FN-001` `workflow.run`: one generic executor loads compiled `.flow` runtime JSON and dispatches task types.
- [ ] `FN-002` `workflow.approval.resume`: approval decisions resume waiting runs.
- [ ] `FN-003` `workflow.worker.callback`: signed callbacks store task reports and artifacts.
- [ ] `FN-004` `workflow.reflection`: generate reflection packets and patch proposals only when configured.
- [ ] `FN-005` `notification.dispatch`: route per-workflow notifications.
- [ ] `FN-006` `usage.rollup`: aggregate usage into credit ledger and billing records.
- [ ] `FN-007` `watchdog.stuck_runs`: find stuck or timed-out runs and create issue cards.

## P2 Scale Controls

- [ ] `SCL-001` Per-org concurrency limit: limit active runs and active steps per org.
- [ ] `SCL-002` Per-tool rate limits: throttle by provider, connected account, and org.
- [ ] `SCL-003` Event storm protection: pause abnormal webhook sources and create issue cards.
- [ ] `SCL-004` Bounded foreach: every foreach requires `max_items` and `max_parallelism`.

## P2 Billing Controls

- [ ] `BIL-001` Credit metering by primitive: run start, AI task, tool call, sandbox seconds, image generation, reflection, event volume.
- [ ] `BIL-002` Trigger limits by plan: active triggers, minimum intervals, runs per day.
