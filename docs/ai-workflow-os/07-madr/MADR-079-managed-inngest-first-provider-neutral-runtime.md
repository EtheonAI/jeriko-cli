# MADR-079: Use managed Inngest first behind a provider-neutral runtime boundary

Status: Accepted

Date: 2026-05-27

## Context

The product needs durable workflow execution for `.flow`: schedules, dynamic events, human approvals, retries, waits, connector callbacks, subagent callbacks, cancellation, observability, and concurrency controls.

We may eventually self-host Inngest or use Vercel Workflow, but choosing an operations-heavy runtime too early would slow the platform before the `.flow` kernel, database schema, tool policy, and app UI are proven.

Current repo state:

- `@repo/flow/runtime` is provider-neutral and exposes `start`, `resume`, and `cancel`.
- MADR-028 already chooses static Inngest function inventory instead of one function per user workflow.
- No active runtime adapter has been implemented yet.

## Decision

Use managed Inngest first for MVP workflow execution.

Keep the durable runtime behind a provider-neutral adapter boundary. `@repo/flow` must not import the Inngest SDK, Vercel Workflow SDK, queues, database clients, or provider SDKs.

Accepted provider posture:

```text
MVP/default: managed Inngest
Exit path: self-hosted Inngest
Evaluation path: Vercel Workflow / WDK
Rejected now: custom durable queue/runtime
```

## Consequences

Positive:

- We get durable steps, retries, waits, schedules, event routing, cancellation, concurrency, logs, and dashboard visibility without operating runtime infrastructure.
- We can validate workflow product behavior before deciding whether runtime cost/control justifies self-hosting.
- The provider-neutral contract keeps us from hard-locking `.flow` semantics to Inngest implementation details.
- Self-hosted Inngest remains possible because official docs support it with Docker, external Postgres/Redis, metrics, and Helm.

Negative:

- Managed Inngest has limits around payload size, run state size, step count, event payload size, timeouts, and plan concurrency.
- Provider-neutral adapters add one small translation layer.
- Some future Inngest-specific features may not map cleanly to Vercel Workflow or another runtime.

## Alternatives Considered

### Self-host Inngest from day one

Rejected for MVP. It creates operational work around Postgres, Redis, queue/state persistence, metrics, scaling, backups, upgrades, and incident response before product-market proof.

### Use Vercel Workflow as the default now

Deferred. Vercel Workflow is promising and Vercel-native, but it is beta and still needs validation against dynamic user-defined triggers, external connector callbacks, cancellation, `.flow` interpreter shape, run/event visibility, and expected autonomous workflow volume.

### Build a custom durable queue/runtime

Rejected. The platform risk is workflow semantics, policy, artifacts, sandbox, connectors, and UX. A custom runtime would duplicate retries, waits, scheduling, event fan-out, cancellation, replay, observability, and concurrency controls.

## Evidence

- Inngest self-hosting docs say self-hosting is supported as of 1.0, can run as a single binary, supports Docker, external PostgreSQL/Redis, metrics, and Helm, but direct support is not guaranteed for self-hosted deployments without enterprise support.
- Inngest usage limits document concrete managed limits: step timeout up to 2 hours maximum, 4 MB step return payload, 32 MB function run state, 1000 steps per function, and event payload/batch limits.
- Inngest concurrency docs support keyed and scoped concurrency; sleeping/waiting runs do not count as active step concurrency.
- Inngest wait-for-event docs support approval/external-event waits with timeout behavior.
- Inngest cancellation system events exist for cancelled functions.
- Vercel Workflow docs say Workflow is beta, managed, Vercel-native, and built on open-source WDK.
- `packages/flow/src/runtime/index.ts` currently defines provider-neutral runtime contracts.

## Impacted Files And Packages

- `packages/flow`
- future runtime adapter package or app/server runtime module
- `docs/ai-workflow-os/08-plans/package-playbooks/flow.md`
- `docs/ai-workflow-os/09-research/2026-05-27-durable-runtime-provider-strategy.md`

## Validation Checklist

- [ ] `@repo/flow` has no direct Inngest/Vercel Workflow SDK dependency.
- [ ] Runtime adapter contract exposes start/resume/cancel/emit without leaking provider event shapes.
- [ ] Static Inngest functions can load compiled workflow versions from storage/database.
- [ ] Approval wait/resume path works.
- [ ] Connector callback/event router path works.
- [ ] Cancellation emits a durable runtime event and updates workflow state.
- [ ] Per-org/per-tool/per-provider concurrency keys are defined.
- [ ] Step payload/artifact policy keeps large data out of runtime state.
