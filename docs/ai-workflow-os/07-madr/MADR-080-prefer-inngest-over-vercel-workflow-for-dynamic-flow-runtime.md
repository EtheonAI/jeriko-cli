# MADR-080: Prefer Inngest over Vercel Workflow for the dynamic `.flow` runtime

Status: Accepted

Date: 2026-05-27

## Context

Jeriko needs a full workflow OS runtime, not only durable code functions.

Core requirements:

- dynamic user-defined schedules and cron-like triggers;
- external connector events and webhooks;
- human approvals;
- subagent callbacks/reporting;
- event fan-out;
- cancellations;
- long waits/sleeps;
- retries and idempotent steps;
- per-org/per-tool/per-provider concurrency;
- run/event observability;
- self-hosting or migration path.

Vercel Workflow/WDK is attractive because it is Vercel-native, durable, streaming-friendly, and built for TypeScript/AI agents. Inngest is attractive because it is event-driven durable execution with cron/scheduled functions, events, waits, fan-out, concurrency, cancellation, observability, and self-hosting.

The product source format is `.flow`, not TypeScript workflow code. `.flow` compiles into an execution plan interpreted by a generic runtime.

## Decision

Prefer Inngest over Vercel Workflow for the MVP dynamic `.flow` runtime.

Use managed Inngest first, as accepted in MADR-079.

Keep Vercel Workflow as a tracked evaluation path, not the default runtime.

Keep `@repo/flow` provider-neutral and implement provider-specific runtime execution in an adapter layer later.

## Why

Inngest fits the product architecture more directly:

- scheduled functions and event-triggered functions are first-class;
- a static scheduled function can claim due `workflow_triggers` rows and fan out run events;
- `step.sendEvent()` fits event-router and subagent delegation;
- `step.waitForEvent()` fits approvals and external callbacks;
- `cancelOn` and cancellation system events fit durable cancellation;
- keyed/scoped concurrency fits per-tenant and per-provider limits;
- self-hosting is documented with Docker, Postgres/Redis, metrics, and Helm.

Vercel Workflow is strong, but the current WDK model is better for code-authored workflows:

- workflows use `"use workflow"` directives and deterministic replay boundaries;
- step code uses `"use step"`;
- workflow functions are started programmatically with `start()`;
- hooks/webhooks are excellent for per-run suspension/resume;
- Vercel World is zero-config but currently has regional/data residency notes;
- Vercel Workflow is still beta.

For Jeriko, `.flow` is the authoring layer. The runtime should interpret compiled data. Inngest's event/function model maps better to that interpreter.

## Consequences

Positive:

- We can implement dynamic triggers without one Vercel Cron or one function per user workflow.
- The runtime can remain a small static inventory: scheduler, event router, generic executor, approval resume, connector callback, reflection, usage, watchdog, cleanup.
- Concurrency and cancellation policies can be represented as platform runtime policy.
- Self-hosting remains realistic if we need control later.

Negative:

- We will not get Vercel Workflow's tightest Vercel-native DX by default.
- We must maintain an adapter boundary and avoid leaking Inngest details into `.flow`.
- Vercel Workflow may become better later and require a migration/evaluation pass.

## Alternatives Considered

### Use Vercel Workflow now

Deferred. It is compelling, especially for durable agents and Vercel-native apps, but it needs proof for dynamic trigger routing, event fan-out, cancellation, concurrency policy, run export/visibility, and `.flow` interpreter fit.

### Use both in MVP

Rejected. Two durable runtimes would fragment observability, cancellation, billing, retries, run state, and incident response.

### Self-host Inngest from day one

Rejected. Useful exit path, but too much infrastructure ownership before workflow product proof.

### Build custom runtime

Rejected. It would duplicate mature runtime primitives before the product semantics are validated.

## Evidence

- Inngest docs describe event-driven durable execution with background/scheduled jobs, steps, queueing, scaling, concurrency, throttling, rate limiting, and observability.
- Inngest scheduled functions support cron.
- Inngest `step.sendEvent()` supports fan-out, subagent delegation, cancellation, and waking functions waiting for events.
- Inngest `step.waitForEvent()` supports waits for approval/external events with timeouts.
- Inngest `cancelOn` cancels running/sleeping functions on matching events between atomic steps.
- Inngest concurrency docs support keyed/scoped limits and exclude sleeping/waiting runs from active concurrency.
- Inngest self-hosting docs support Docker, external Postgres/Redis, Prometheus metrics, and Helm.
- Vercel Workflow docs show beta status and fully managed Vercel execution.
- WDK docs show `start()`, hooks/webhooks, sleep, retries, observability, and Vercel World.
- Vercel Cron docs show cron jobs are static config/function configuration, require redeploy for changes, and can deliver duplicates; existing repo research already rejects one cron per user trigger.

## Validation Checklist

- [ ] Keep `@repo/flow` free of `inngest`, `workflow`, queues, and provider SDK imports.
- [ ] Define a provider-neutral runtime adapter interface before implementing Inngest.
- [ ] Implement static Inngest function inventory only after `.flow` execution plans exist.
- [ ] Use DB-backed `workflow_triggers`, not one cron/function per user trigger.
- [ ] Add run/event/cancellation/idempotency/concurrency tests before real side effects.
- [ ] Re-evaluate Vercel Workflow after `.flow` MVP if its beta status, dynamic trigger, and interpreter-fit questions are resolved.
