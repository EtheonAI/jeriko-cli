# Scale, Triggers, Events, and ECP Validation

Date researched: 2026-05-23

Source input:

- [`../_source/v3-scale-triggers-ecp/`](../_source/v3-scale-triggers-ecp/)

## Verdict

The v3 scale/trigger/ECP architecture is directionally correct and should be accepted into the target architecture with one precision change:

Do not argue from a single brittle cron limit number. Argue from the durable architectural constraint:

```text
User-defined workflow triggers are dynamic product data.
Vercel Cron and Inngest functions are static platform code/configuration.
Therefore dynamic user triggers must be stored as database rows and routed through a small static scheduler/event layer.
```

This keeps the platform from creating one cron job, route, or function per user workflow trigger.

## Primary Source Checks

### Vercel Cron

Source: <https://vercel.com/docs/cron-jobs/usage-and-pricing>

Claim checked: Vercel Cron is not the right primary primitive for dynamic user workflow schedules.

Evidence:

- Vercel Cron invokes Vercel Functions, so function usage and pricing apply to cron executions.
- Vercel documents finite per-project cron limits and plan-specific minimum intervals.
- Hobby has daily-frequency restrictions and lower timing precision than Pro/Enterprise.

Implementation impact:

- Use Vercel Cron only for static platform maintenance, backup ticks, or health checks.
- Do not create one Vercel Cron per `.flow` trigger.
- The dynamic scheduler must live in product data: `workflow_triggers`.

Open question:

- Vercel docs have shown different limit tables across pages and dates. The architecture must not depend on an exact public limit number.

### Inngest Scheduled Functions and Fan-Out

Sources:

- <https://www.inngest.com/docs/guides/scheduled-functions>
- <https://www.inngest.com/docs/guides/fan-out-jobs>

Claim checked: A small static Inngest scheduler can load many due records and fan out execution events.

Evidence:

- Inngest supports scheduled functions with cron syntax and timezone-aware schedules.
- Inngest documents the fan-out pattern where a scheduled function loads many records and sends events for other functions to handle.

Implementation impact:

- Define one static `workflow.scheduler.tick` function.
- It claims due rows from `workflow_triggers`, applies limits/dedupe, and sends `workflow/run.requested`.
- Actual work runs in the generic `workflow.run` executor, not inside the scheduler tick.

### Inngest Waits, Flow Control, and Concurrency

Sources:

- <https://www.inngest.com/docs/functions/concurrency>
- <https://www.inngest.com/docs/guides/concurrency>

Claim checked: In-run waits and approvals should use durable step primitives, not new cron rows.

Evidence:

- Inngest concurrency limits active step execution rather than every sleeping/waiting run.
- Inngest documents that sleeping/waiting/invoked steps do not execute SDK code while waiting.
- Concurrency keys can limit third-party API pressure and org/provider-specific work.

Implementation impact:

- Use DB trigger rows for external schedule/event entry points.
- Use Inngest wait/sleep/signals/events for in-run delays, approvals, and callback waits.
- Add `.flow` semantic limits for bounded foreach, max parallelism, max event volume, min schedule intervals, and per-org concurrency.

### Vercel Sandbox

Sources:

- <https://vercel.com/docs/vercel-sandbox/>
- <https://vercel.com/docs/vercel-sandbox/concepts>

Claim checked: Vercel Sandbox is the target for running generated or user-controlled code.

Evidence:

- Vercel Sandbox is designed for untrusted/user-generated code.
- It uses isolated Firecracker microVMs with private filesystem/process/network isolation.
- It is temporary by design and should not be used for permanent hosting or durable storage.

Implementation impact:

- Generated scripts and verifier commands should run in Vercel Sandbox behind a provider-neutral adapter.
- Sandbox output must be copied into object storage/artifact records.
- The workflow runtime should never treat sandbox filesystem state as durable product state.

### Next.js Bundle Analyzer During Package Upgrade

Source: <https://nextjs.org/docs/pages/guides/package-bundling>

Claim checked: Next 16 should not require the old `@next/bundle-analyzer` path as the default analyzer.

Evidence:

- Next.js 16.1+ documents an integrated Turbopack bundle analyzer via `next experimental-analyze`.
- The `@next/bundle-analyzer` plugin remains documented for Webpack.

Implementation impact:

- Use `next experimental-analyze` scripts for active Next 16 apps.
- Remove invalid/stale `@next/bundle-analyzer` entries from the reset base unless a Webpack-only app explicitly needs them.

## Accepted Architecture Changes

- Add DB-backed `workflow_triggers`.
- Add internal EventContextPacket as the normalized event envelope.
- Add task reports as worker outputs, not raw chat logs.
- Add run reflection packets as the only default main-AI wake path after execution starts.
- Add static Inngest function inventory for scheduler, event router, executor, approval resume, worker callback, reflection, notifications, usage rollup, watchdog, and cleanup.
- Add event storm controls, per-org concurrency, per-tool limits, trigger misfire policy, jitter, and dedupe keys as P0/P1 runtime requirements.

## Rejected Or Deferred

- Rejected: one Vercel Cron per user trigger.
- Rejected: one Inngest function per user workflow.
- Rejected: freeform worker-to-worker chat as the default context path.
- Deferred: public ECP protocol. Start internal only.
- Deferred: external workflow API until auth, rate limits, idempotency, and event signing exist.
