# Runtime Mapping to Inngest

## Decision

Use Inngest as durable execution substrate.

Do not create one Inngest function per user workflow. Create a small static set of platform functions.

## Static functions

- `workflow.scheduler.tick`
- `workflow.event_router`
- `workflow.run`
- `workflow.approval.resume`
- `workflow.worker.callback`
- `workflow.reflection`
- `notification.dispatch`
- `usage.rollup`
- `watchdog.stuck_runs`
- `cleanup.old_runs`

## `.flow` task mapping

| `.flow` type | Inngest/runtime mapping |
|---|---|
| `ai_task` | `step.run` → Model/Worker Router |
| `tool_call` | `step.run` → Tool Router |
| `sandbox_command` | `step.run` → Vercel Sandbox |
| `human_review` | create approval + `step.waitForSignal` |
| `wait_for_event` | `step.waitForEvent` |
| `sleep` | `step.sleep` / `step.sleepUntil` |
| `foreach` | controlled fan-out + `step.run` |
| `parallel` | controlled parallel branches |
| `emit_event` | event store + `step.sendEvent` |
| `invoke_workflow` | `step.invoke` or emit `workflow/run.requested` |
| `memory_patch` | `step.run` → Patch Worker |
| `flow_patch` | `step.run` → Patch Worker |
| `verify` | `step.run` → Verifier |
| `issue_card` | `step.run` → issue store |

## Trigger architecture

Do not use one cron per trigger.

```text
.flow schedule trigger
→ workflow_triggers table
→ workflow.scheduler.tick
→ workflow/run.requested
→ workflow.run
```

## Event architecture

```text
webhook/app event
→ /api/events/ingest
→ EventContextPacket
→ workflow.event_router
→ matching workflow_triggers
→ workflow/run.requested
```

## In-run wait

```text
task wait_for_event
→ step.waitForEvent
→ matching EventContextPacket resumes run
```

## Approval

```text
human_review
→ create approval_request
→ step.waitForSignal
→ approval endpoint sends signal
→ run resumes
```

## Concurrency

Use:

- per-org concurrency key
- per-workflow concurrency key
- per-tool throttles
- per-worker/model concurrency
- foreach max parallelism

## Idempotency

Every external action needs:

- idempotency key
- tool_call row
- retry-safe behavior

Idempotency key format:

```text
org_id:workflow_id:run_id:task_id:attempt
```
