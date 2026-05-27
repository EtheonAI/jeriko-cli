# Vercel Workflow vs Inngest Runtime Comparison

Date: 2026-05-27

Scope: Durable runtime choice for AI Workflow OS `.flow` execution.

## Question

Which is better for Jeriko's complete workflow platform: Vercel Workflow or Inngest?

Requirements:

- user-authored `.flow` workflows;
- dynamic user schedules and cron-like triggers;
- external connector events and webhooks;
- human approvals;
- subagent callbacks and reporting;
- retries, waits, sleeps, and long-running runs;
- cancellation/abort;
- per-org/per-tool/per-provider concurrency controls;
- observability and run debugging;
- self-hosting or migration path if needed.

## Sources Checked

| Source                                                                                                       | Type              | Evidence Used                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://vercel.com/docs/workflow`                                                                           | Official docs     | Vercel Workflow is beta, managed, built on open-source Workflow DevKit, and uses Vercel Functions, Vercel Queues, and managed persistence for durable/resumable/observable functions.                    |
| `https://useworkflow.dev/docs/foundations/workflows-and-steps`                                               | Official WDK docs | Workflow functions use `"use workflow"` and deterministic replay; step functions use `"use step"` and have Node/npm access with automatic retries. Workflow code runs in a sandboxed/deterministic mode. |
| `https://useworkflow.dev/docs/foundations/starting-workflows`                                                | Official WDK docs | Workflows start through `start()` from `workflow/api`, return run IDs, expose status/return values, and can stream progress.                                                                             |
| `https://useworkflow.dev/docs/foundations/hooks`                                                             | Official WDK docs | Hooks/webhooks can pause workflows and resume them from user/external events, with deterministic tokens and iterable event streams.                                                                      |
| `https://useworkflow.dev/docs/ai/sleep-and-delays`                                                           | Official WDK docs | WDK `sleep()` supports durable suspension for seconds to months and can be exposed as an AI tool.                                                                                                        |
| `https://useworkflow.dev/docs/foundations/errors-and-retries`                                                | Official WDK docs | Step errors retry by default; `FatalError`, `RetryableError`, retry delays, and rollback patterns are supported.                                                                                         |
| `https://useworkflow.dev/docs/observability`                                                                 | Official WDK docs | Workflow runs/steps/webhooks/events/stream output can be inspected with CLI/Web UI and Vercel backend.                                                                                                   |
| `https://useworkflow.dev/docs/deploying`                                                                     | Official WDK docs | WDK supports local, Vercel, and pluggable World adapters for other infrastructure.                                                                                                                       |
| `https://useworkflow.dev/docs/deploying/world/vercel-world`                                                  | Official WDK docs | Vercel World is zero-config and fully managed, but currently has single-region/data-residency notes for `iad1`; workflow runs are pegged to the deployment that started them.                            |
| `https://vercel.com/docs/cron-jobs/manage-cron-jobs`                                                         | Official docs     | Vercel Cron jobs are static deployment config/function configuration; updates require redeploy; duplicate delivery can happen; local dev servers do not support cron invocation.                         |
| `https://vercel.com/docs/cron-jobs/usage-and-pricing`                                                        | Official docs     | Vercel Cron has plan limits and should not be used as one cron per user workflow trigger.                                                                                                                |
| `https://www.inngest.com/docs/`                                                                              | Official docs     | Inngest is event-driven durable execution for background and scheduled jobs with steps, queueing, scaling, concurrency, throttling, rate limiting, and observability.                                    |
| `https://www.inngest.com/docs/guides/scheduled-functions`                                                    | Official docs     | Inngest supports scheduled functions with cron syntax.                                                                                                                                                   |
| `https://www.inngest.com/docs/guides/sending-events-from-functions`                                          | Official docs     | `step.sendEvent()` supports fan-out, function triggering, subagent delegation, cancellation, and waking functions waiting for events.                                                                    |
| `https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event`                     | Official docs     | `step.waitForEvent()` supports external-event/human-in-the-loop waits with timeout behavior.                                                                                                             |
| `https://www.inngest.com/docs/guides/concurrency`                                                            | Official docs     | Inngest supports keyed/scoped concurrency and does not count sleeping/waiting runs as active step concurrency.                                                                                           |
| `https://www.inngest.com/docs/reference/typescript/functions/cancel-on`                                      | Official docs     | `cancelOn` cancels running/sleeping functions on matching events, between atomic steps.                                                                                                                  |
| `https://www.inngest.com/docs/reference/system-events/inngest-function-cancelled`                            | Official docs     | Inngest emits cancellation system events for cleanup/observability.                                                                                                                                      |
| `https://www.inngest.com/docs/self-hosting`                                                                  | Official docs     | Self-hosting is supported with Docker, external Postgres/Redis, metrics, and Helm, though direct support is not guaranteed without enterprise support.                                                   |
| `pnpm view inngest version peerDependencies engines`                                                         | Registry metadata | `inngest@4.4.0`, Node `>=20`, Zod v3/v4 support, broad framework support.                                                                                                                                |
| `pnpm view workflow version peerDependencies engines`                                                        | Registry metadata | `workflow@4.2.5`, peer `@opentelemetry/api@1`.                                                                                                                                                           |
| `pnpm view @workflow/next version peerDependencies engines`                                                  | Registry metadata | `@workflow/next@4.0.6`, peer `next >13`.                                                                                                                                                                 |
| `pnpm view @workflow/world-vercel version peerDependencies engines`                                          | Registry metadata | `@workflow/world-vercel@4.2.0`, peer `@opentelemetry/api@1`.                                                                                                                                             |
| [`2026-05-23-scale-triggers-events-ecp-validation.md`](./2026-05-23-scale-triggers-events-ecp-validation.md) | Repo research     | Dynamic user triggers must be DB rows routed through a small static scheduler/event layer; do not create one cron/function per user trigger.                                                             |

## Comparison

| Capability                   | Inngest                                                                              | Vercel Workflow / WDK                                                                                                                     | Jeriko Fit                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Static cron/scheduler tick   | First-class scheduled functions with cron.                                           | Use Vercel Cron or app/API code to `start()` workflows; Vercel Cron is static config and redeploy-managed.                                | Inngest wins for scheduler/event-router runtime.                                      |
| Dynamic user schedules       | Store triggers in DB, static scheduled function claims due rows and fans out events. | Store triggers in DB, static Vercel Cron or another tick starts workflows; WDK itself is not a dynamic cron registry.                     | Inngest wins because scheduled functions and event fan-out are native.                |
| Event-triggered workflows    | First-class event triggers and typed events.                                         | Start workflows programmatically; hooks/webhooks resume existing runs.                                                                    | Inngest is better for event router/fan-out; WDK is strong for individual run hooks.   |
| Human approvals              | `waitForEvent` with timeout; event audit trail.                                      | Hooks/webhooks pause and resume workflows with tokens.                                                                                    | Both viable.                                                                          |
| External connector callbacks | Event router + `waitForEvent` + cancellation/events.                                 | Hooks/webhooks can resume runs; app must route external events to hooks/tokens.                                                           | Inngest fits event bus model better; WDK is clean per-run.                            |
| Fan-out                      | `step.sendEvent()` for bulk fan-out to independent functions.                        | Can start multiple workflows or use app code, but event fan-out is less central.                                                          | Inngest wins.                                                                         |
| Concurrency/rate limits      | Keyed/scoped concurrency, throttling/rate limiting model.                            | Vercel Queues/Functions underneath; WDK docs expose durable steps but not the same workflow-level keyed concurrency surface.              | Inngest wins for multi-tenant tool/provider control.                                  |
| Cancellation                 | `cancelOn`, REST/bulk cancellation, cancellation system events.                      | Hooks can stop loops; run control exists, but cancellation/equivalent semantics need proof for our runtime.                               | Inngest wins today.                                                                   |
| Retries/idempotency          | Automatic retries; idempotent steps emphasized.                                      | Step retries, `FatalError`, `RetryableError`, rollback patterns.                                                                          | Both viable.                                                                          |
| Long waits/sleeps            | Sleep/wait primitives; limits documented.                                            | `sleep()` durable suspension for seconds to months.                                                                                       | Both viable.                                                                          |
| Observability                | Dashboard, function/event logs, metrics; self-host Prometheus endpoint.              | CLI/Web UI, Vercel dashboard, encrypted workflow data.                                                                                    | Both viable; Vercel is nicer if fully Vercel-native.                                  |
| Self-host / exit path        | Official self-hosting with Docker, Postgres/Redis, Helm.                             | World adapters; Vercel World managed; Postgres/community worlds possible.                                                                 | Both have paths; Inngest self-host is more directly documented as platform self-host. |
| `.flow` interpreter fit      | Static generic executor can load compiled `.flow` plan and run steps by data.        | WDK wants workflow functions/directives and deterministic workflow code; `.flow` interpretation may fight the static-code compiler model. | Inngest fits the data-driven interpreter better today.                                |
| Maturity for this use case   | Purpose-built event-driven durable execution platform.                               | Promising Vercel-native beta durable workflow system.                                                                                     | Inngest wins for MVP reliability and completeness.                                    |

## Verdict

Inngest is better for Jeriko's full workflow OS **today**.

Vercel Workflow is better for:

- Vercel-native durable TypeScript functions;
- durable AI agents written directly as code;
- simple product workflows where the workflow source is code;
- streaming run output through the Vercel/WDK stack;
- tight Vercel dashboard integration.

Inngest is better for Jeriko because our product source is not code-first. It is `.flow`:

```text
.flow source
-> compiler/runtime plan
-> static scheduler/event-router/executor
-> dynamic user workflow runs
```

That design needs:

- event bus first;
- DB-backed dynamic trigger registry;
- static scheduled loader;
- event fan-out;
- run resume by external events;
- cancellation by event;
- per-org/tool/provider concurrency;
- self-hosting option.

Inngest maps to that model more directly.

## Runtime Decision

Keep the existing decision:

```text
Use managed Inngest first.
Keep @repo/flow provider-neutral.
Track Vercel Workflow as an evaluation path.
Keep self-hosted Inngest as the first serious exit path.
Do not build a custom queue.
```

## What Would Change The Decision Later

Re-evaluate Vercel Workflow if:

- Workflow exits beta with clear production limits/pricing;
- WDK supports our dynamic `.flow` interpreter without fighting the directive/compiler model;
- Vercel Workflow exposes enough cancellation, event fan-out, dynamic trigger, concurrency, and run export controls;
- Vercel Workflow proves cheaper/simpler with Vercel Sandbox and AI Gateway for our workload;
- the product becomes code-authored workflows instead of `.flow`-authored workflows.

Re-evaluate self-hosted Inngest if:

- customer data residency or compliance requires it;
- managed Inngest cost/concurrency limits become a blocker;
- we need private control-plane guarantees;
- we have enough usage to justify runtime operations.

## Required Runtime Architecture

Do not import `inngest` into `@repo/flow`.

Add a runtime adapter layer later:

```text
@repo/flow/runtime
  provider-neutral contracts

future @repo/runtime-inngest or app/server runtime adapter
  Inngest SDK
  static function inventory
  scheduler tick
  event router
  generic executor
  approval resume
  connector callback
  cancellation handler
```

The static scheduler remains:

```text
workflow.scheduler.tick
-> claim due workflow_triggers rows
-> dedupe/jitter/rate-limit
-> send workflow.run.requested events
```

The executor remains:

```text
workflow.run
-> load compiled workflow version
-> execute plan slices
-> emit events/artifacts/reports
-> wait for approvals/events where needed
```
