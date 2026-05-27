# MADR-027: Use DB-Backed Trigger Registry

Status: Accepted

## Context

User workflows can define many schedules, app-event triggers, workflow-event triggers, and manual/webhook triggers. Creating one Vercel Cron, route, or Inngest function per logical trigger would tie product data to platform configuration and would not scale across users.

Primary-source validation:

- Vercel Cron has finite per-project limits and invokes Vercel Functions: <https://vercel.com/docs/cron-jobs/usage-and-pricing>
- Inngest supports scheduled functions and event fan-out patterns: <https://www.inngest.com/docs/guides/scheduled-functions>

## Decision

Store user-defined triggers in `workflow_triggers`.

Use a small static scheduler/event-router layer:

```text
.flow trigger
-> compiler
-> workflow_triggers row
-> workflow.scheduler.tick or workflow.event_router
-> workflow/run.requested
-> workflow.run
```

## Consequences

- Dynamic user schedules do not require deploy-time cron config changes.
- Trigger matching can be audited, versioned, paused, rate-limited, and billed.
- The scheduler must implement atomic due-row claiming, dedupe keys, jitter, misfire policy, and plan limits.

## Alternatives Considered

- One Vercel Cron per user trigger: rejected; finite project-level cron slots and function usage do not fit dynamic per-user triggers.
- One Inngest function per workflow: rejected; function inventory should be platform code, not user data.
- External scheduler SaaS per trigger: deferred; adds another control plane before the kernel exists.

## Validation Checklist

- [ ] `workflow_triggers` table exists.
- [ ] compiler extracts triggers from `.flow`.
- [ ] scheduler claims due rows atomically.
- [ ] duplicate ticks do not duplicate runs.
- [ ] paused/disabled workflows do not emit runs.
- [ ] trigger limits are enforced by plan.
