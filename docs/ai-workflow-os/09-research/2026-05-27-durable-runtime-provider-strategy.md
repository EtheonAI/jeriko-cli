# Durable Runtime Provider Strategy

Date: 2026-05-27

Scope: `.flow` runtime execution provider: managed Inngest, self-hosted Inngest, Vercel Workflow, or custom queue.

## Question

Should Jeriko use managed Inngest, self-host Inngest, use Vercel Workflow, or build its own durable workflow runtime?

## Sources Checked

| Source                                                                                   | Type          | Evidence Used                                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://www.inngest.com/docs/self-hosting`                                              | Official docs | Self-hosting is supported as of Inngest 1.0. Inngest can run as a single binary, supports Docker, can use PostgreSQL/Redis, exposes a dashboard/API/Event API, has a Connect gateway, and provides a Helm chart for production Kubernetes. The docs also state direct support is not guaranteed for self-hosted instances unless enterprise support is arranged. |
| `https://www.inngest.com/docs/usage-limits/inngest`                                      | Official docs | Managed Inngest has concrete limits that affect workflow design: sleeps up to a year depending on plan, step timeout up to 2 hours maximum, 4 MB step return payload, 32 MB function run state, 1000 steps per function, event name length limits, event payload limits, and batch limits.                                                                       |
| `https://www.inngest.com/docs/guides/concurrency`                                        | Official docs | Inngest concurrency limits active step execution, supports keyed multi-tenant limits, shared scopes, and does not count sleeping/waiting runs against active concurrency. This maps well to per-workspace/per-tool/per-provider workflow throttling.                                                                                                             |
| `https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event` | Official docs | `step.waitForEvent()` supports human-in-the-loop and external-event waits with timeout behavior. Race conditions must be handled because waits begin listening when the code executes.                                                                                                                                                                           |
| `https://www.inngest.com/docs/guides/error-handling`                                     | Official docs | Inngest automatically retries errors and requires idempotent step design for safe retries. This reinforces our platform idempotency/audit requirement.                                                                                                                                                                                                           |
| `https://www.inngest.com/docs/reference/system-events/inngest-function-cancelled`        | Official docs | Inngest emits cancellation system events when functions are cancelled via `cancelOn`, timeout, REST API, or bulk cancellation.                                                                                                                                                                                                                                   |
| `https://vercel.com/docs/workflow`                                                       | Official docs | Vercel Workflow is beta, fully managed, built on open-source WDK, uses Vercel Functions/Queues/persistence, and is designed for resumable/durable/observable async functions.                                                                                                                                                                                    |
| [`MADR-028`](../07-madr/MADR-028-static-inngest-functions-for-runtime.md)                | Repo decision | The current architecture already chose static Inngest functions instead of generating one function per user workflow.                                                                                                                                                                                                                                            |
| [`@repo/flow` runtime contract](../../../packages/flow/src/runtime/index.ts)             | Repo evidence | `@repo/flow/runtime` exposes provider-neutral `start`, `resume`, and `cancel` contracts and currently imports no provider SDK.                                                                                                                                                                                                                                   |

## Findings

### Managed Inngest Is Best For MVP

Use managed Inngest first.

Reasons:

- It gives durable steps, waits, retries, event triggers, schedules, cancellation hooks, concurrency controls, logs, and dashboard visibility without us operating queue/state infrastructure.
- It matches the current product needs better than a raw queue: human approvals, scheduled workflows, external connector callbacks, subagent callbacks, and event-routed resumes.
- It lets us learn real workload shape before paying operational complexity.
- It avoids spending reset time on Kubernetes, Redis, Postgres, backups, high availability, retention, and dashboard operations.

### Self-Hosted Inngest Is Viable But Not First

Self-hosting is real enough to keep as an exit path.

Use it later only if one of these becomes true:

- data residency/security/compliance requires it;
- managed pricing or concurrency limits become a business blocker;
- enterprise customers require private control plane;
- we need operational capabilities only available in self-hosted deployment;
- we have enough workflow volume to justify a dedicated runtime ops budget.

Do not self-host first. It adds production ownership for event intake, queue/state store, persistence, dashboards/APIs, metrics, scaling, backups, upgrades, retention, and incident response.

### Vercel Workflow Is Worth Tracking, Not The Default Yet

Vercel Workflow is attractive because the rest of the platform targets Vercel and Vercel Sandbox. It is beta and very aligned with durable async TypeScript.

Do not switch to Vercel Workflow until we validate:

- dynamic user-defined trigger routing;
- event waits and external connector callbacks;
- cancellation semantics;
- visibility/export of event logs and run state;
- cost model and limits under expected autonomous workflow volume;
- whether WDK code shape fits our `.flow` compiler/runtime interpreter.

### Custom Queue Is Not Justified

Do not build our own durable runtime now.

Reasons:

- The product risk is `.flow` compiler/runtime semantics, permissions, tool safety, artifact UX, sandbox migration, and connector policy, not queue implementation.
- A custom runtime would need retries, step state, waits, schedules, event fan-out, cancellation, observability, replay, and concurrency controls before it is safe.
- Building that before product proof would slow the platform down.

## Recommended Architecture

Keep this boundary:

```text
.flow source
-> @repo/flow parser/compiler/runtime contracts
-> durable runtime adapter
   -> managed Inngest first
   -> self-hosted Inngest later if needed
   -> Vercel Workflow later if proven better
-> provider/tool packages
```

`@repo/flow` must stay provider-neutral. It should not import `inngest`, `workflow`, Vercel Workflow, queues, databases, or provider SDKs.

Runtime adapters should consume compiled execution plans and expose a small contract:

```ts
start(plan, input);
resume(runId, event);
cancel(runId);
emit(event);
```

The first implementation can be a managed Inngest adapter behind this contract.

## Design Rules

- Use static runtime functions, not one function per user workflow.
- User workflows remain data/compiled specs.
- Use database-backed trigger rows for user-defined schedules/events.
- Use runtime events for approvals, connector callbacks, subagent reports, sandbox callbacks, cancellation, watchdogs, and reflection gates.
- Keep step IDs stable and deterministic.
- Keep step outputs small; large artifacts go to storage and are referenced by event/artifact records.
- Make every side-effect step idempotent.
- Add per-org/per-provider/per-tool concurrency keys.
- Treat cancellation as a durable runtime event, not only an HTTP stream abort.

## Verdict

Managed Inngest first, provider-neutral boundary always, self-hosting as a documented exit path.

Do not self-host until the workflow engine is useful enough that runtime control is the bottleneck.
