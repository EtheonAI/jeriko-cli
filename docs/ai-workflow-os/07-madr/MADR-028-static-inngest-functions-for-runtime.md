# MADR-028: Use Static Inngest Functions for Runtime Execution

Status: Accepted

## Context

The platform needs durable execution, waits, retries, approvals, callbacks, event routing, and observability. Those are runtime capabilities, but the number of user workflows and triggers is dynamic.

Primary-source validation:

- Inngest scheduled functions can run cron schedules and support timezone-aware cron syntax: <https://www.inngest.com/docs/guides/scheduled-functions>
- Inngest fan-out sends events to functions that run independently: <https://www.inngest.com/docs/guides/fan-out-jobs>
- Inngest concurrency limits active step execution and supports keyed limits: <https://www.inngest.com/docs/functions/concurrency>

## Decision

Use a small static function inventory:

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

## Consequences

- User workflows remain data and compiled runtime specs.
- Runtime code stays debuggable and testable.
- In-run waits use durable step primitives instead of creating new DB schedules.
- The generic executor becomes the core kernel and must stay small, typed, and heavily tested.

## Alternatives Considered

- Generate Inngest functions dynamically: rejected; too hard to deploy, audit, and version safely.
- Put all logic in one scheduler tick: rejected; scheduler should fan out and finish quickly.
- Build a custom queue first: rejected; not needed before proving the product kernel.

## Validation Checklist

- [ ] one generic executor can load a compiled workflow version.
- [ ] approval wait/resume path works.
- [ ] worker callback path verifies signatures.
- [ ] event router can trigger a workflow and wake a waiting run.
- [ ] concurrency keys exist for org/provider/tool limits.
- [ ] watchdog can detect stuck waits and expired approvals.
