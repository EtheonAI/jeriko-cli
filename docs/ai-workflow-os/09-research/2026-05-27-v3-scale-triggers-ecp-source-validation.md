# v3 Scale, Triggers, and ECP Source Validation

Date researched: 2026-05-27

Scope: Validate the original Downloads research package `ai_workflow_os_docs_v3_scale_triggers_ecp` against the repo docs and the current durable runtime decision.

## Source Package

Original package:

- `/Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp`

Repo-preserved source copy:

- [`../_source/v3-scale-triggers-ecp/`](../_source/v3-scale-triggers-ecp/)

Files validated:

- `IDEA_MEMORY.md`
- `MADR_ADDENDUM_v2.md`
- `MADR_ADDENDUM_v3_SCALE_TRIGGERS_ECP.md`
- `SCALE_TRIGGER_EVENT_ECP_ARCHITECTURE.md`
- `UX_FEATURES_ADDENDUM.md`
- `ai_workflow_os_project_plan_v2.csv`
- `ai_workflow_os_project_plan_v3.csv`
- `feature_addendum_v2.csv`
- `scale_trigger_event_ecp_tasks_v3.csv`

Validation command:

```bash
diff -qr /Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp docs/ai-workflow-os/_source/v3-scale-triggers-ecp
```

Result:

```text
no output
```

Meaning: the repo-preserved copy matches the Downloads source package.

## Latest External Checks

| Source                                                                                   | Type          | Evidence Used                                                                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://www.inngest.com/docs/guides/scheduled-functions`                                | Official docs | Inngest supports native cron schedules, timezones, fan-out with `step.sendEvent()`, and jitter from 1 second to 5 minutes.                                                                  |
| `https://www.inngest.com/docs/guides/concurrency`                                        | Official docs | Inngest concurrency limits active step execution, supports keys/scopes, and does not count sleeping/waiting runs as active execution.                                                       |
| `https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event` | Official docs | `step.waitForEvent()` waits for external events and returns the event or `null` on timeout.                                                                                                 |
| `https://www.inngest.com/docs/reference/typescript/functions/cancel-on`                  | Official docs | `cancelOn` cancels running/sleeping functions by matching events, between atomic steps.                                                                                                     |
| `https://vercel.com/docs/workflow`                                                       | Official docs | Vercel Workflow is durable, resumable, observable, and idiomatic async JavaScript using `"use workflow"` and `"use step"` directives. Pricing/observability docs reference the beta period. |
| `https://vercel.com/docs/cron-jobs/manage-cron-jobs`                                     | Official docs | Cron jobs can overlap; Vercel recommends locks and idempotency to avoid duplicate processing/race conditions.                                                                               |
| `npm view inngest version peerDependencies engines --json`                               | Registry      | Latest checked: `inngest@4.4.0`, Node `>=20`, Zod v3/v4 support.                                                                                                                            |
| `npm view workflow version peerDependencies engines --json`                              | Registry      | Latest checked: `workflow@4.2.5`, peer `@opentelemetry/api@1`.                                                                                                                              |
| `npm view @workflow/next version peerDependencies engines --json`                        | Registry      | Latest checked: `@workflow/next@4.0.6`, peer `next >13`.                                                                                                                                    |
| `npm view @workflow/world-vercel version peerDependencies engines --json`                | Registry      | Latest checked: `@workflow/world-vercel@4.2.0`, peer `@opentelemetry/api@1`.                                                                                                                |

## Coverage Against Current Docs

The source package is represented in the current docs as:

- [`2026-05-23-scale-triggers-events-ecp-validation.md`](./2026-05-23-scale-triggers-events-ecp-validation.md)
- [`2026-05-27-durable-runtime-provider-strategy.md`](./2026-05-27-durable-runtime-provider-strategy.md)
- [`2026-05-27-vercel-workflow-vs-inngest-runtime-comparison.md`](./2026-05-27-vercel-workflow-vs-inngest-runtime-comparison.md)
- [`../07-madr/MADR-027-db-backed-trigger-registry.md`](../07-madr/MADR-027-db-backed-trigger-registry.md)
- [`../07-madr/MADR-028-static-inngest-functions-for-runtime.md`](../07-madr/MADR-028-static-inngest-functions-for-runtime.md)
- [`../07-madr/MADR-029-internal-event-context-packets.md`](../07-madr/MADR-029-internal-event-context-packets.md)
- [`../07-madr/MADR-030-reflection-gated-main-ai.md`](../07-madr/MADR-030-reflection-gated-main-ai.md)
- [`../07-madr/MADR-079-managed-inngest-first-provider-neutral-runtime.md`](../07-madr/MADR-079-managed-inngest-first-provider-neutral-runtime.md)
- [`../07-madr/MADR-080-prefer-inngest-over-vercel-workflow-for-dynamic-flow-runtime.md`](../07-madr/MADR-080-prefer-inngest-over-vercel-workflow-for-dynamic-flow-runtime.md)

## Validated Decisions

- Use DB-backed `workflow_triggers`; do not create one Vercel Cron, route, or Inngest function per user trigger.
- Use a small static runtime function inventory: scheduler tick, event router, generic executor, approval resume, worker callback, reflection, notifications, usage rollup, watchdog, and cleanup.
- Normalize app/tool/worker/workflow events into internal EventContextPackets.
- Store TaskReports for worker outputs.
- Wake the main AI through Run Reflection Packets only when reflection rules require.
- Use Inngest as the default MVP durable runtime behind a provider-neutral adapter.
- Keep Vercel Workflow as an evaluation path for code-authored durable workflows, not the default dynamic `.flow` interpreter.
- Keep Vercel Cron as static maintenance/backup infrastructure, not user-trigger infrastructure.

## Gaps That Remain

This validation confirms the architecture and documentation alignment. It does not prove implementation completeness.

Implementation still needs:

- `workflow_triggers` database schema and indexes;
- `.flow` compiler extraction of schedule/event triggers;
- static Inngest scheduler tick;
- static event router;
- generic executor;
- EventContextPacket schema;
- TaskReport schema;
- approval resume flow;
- cancellation event flow;
- concurrency/idempotency/rate-limit tests;
- UI side panel event rendering.

## Verdict

The research pack was checked against the repo copy and current official docs. The direction is still valid:

```text
.flow trigger definitions
-> workflow_triggers table
-> static scheduler/event-router
-> workflow/run.requested event
-> generic durable executor
-> EventContextPackets, TaskReports, artifacts, approvals, issue cards, reflection packets
```

The confidence is high for the architecture decision. It is not a 100% implementation proof until the runtime adapter, schema, and tests exist.
