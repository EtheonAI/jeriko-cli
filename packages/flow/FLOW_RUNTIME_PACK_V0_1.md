# Flow Runtime Pack v0.1 Package Memory

Date: 2026-05-27

Status: local package memory for applying the copied flow runtime pack to `@repo/flow`

## Source Snapshot

The downloaded pack has been copied into the repo at:

- `docs/ai-workflow-os/_source/flow-language-runtime-pack-v0-1`

The copied snapshot contains 48 files and 5,226 total lines.

Central reverse-engineering report:

- `docs/ai-workflow-os/09-research/2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md`

Decision:

- `docs/ai-workflow-os/07-madr/MADR-097-flow-runtime-pack-v0-1-blueprint-adoption.md`

Implementation checklist:

- `docs/ai-workflow-os/08-plans/flow-runtime-pack-v0-1-adoption-checklist.md`

Implementation master plan:

- `docs/ai-workflow-os/08-plans/flow-v0-implementation-master-plan.md`

Current implementation progress:

- Phase A vocabulary gate complete.
- Phase B custom lexer complete.
- Phase C CST parser complete.

## Verdict

Use the pack as a blueprint.

Do not import the pack implementation directly.

`@repo/flow` must stay provider-neutral and must not import:

- `yaml`;
- `inngest`;
- `ai` / AI SDK;
- `@vercel/sandbox`;
- Drizzle or database clients;
- Next.js route handlers;
- React/UI components.

## Concepts To Keep

- `.flow` as the source authoring layer.
- Lexer -> CST -> AST -> symbol table -> semantic validation -> execution plan.
- EventContextPackets for worker/tool/app/runtime routing.
- TaskReports, IssueCards, and RunReflectionPackets.
- FlowPatch as safe workflow mutation.
- `auto`, `ask`, and `block` permissions.
- Approval-gated external actions.
- Static durable runtime function inventory.
- DB-backed trigger registry.
- Durable run/event/artifact/approval persistence.
- Reflection-gated main AI.

## Concepts To Correct

- The pack's YAML-backed parser direction is superseded by MADR-095.
- The pack's direct Inngest runtime code belongs outside `@repo/flow`.
- The pack's string-hint permission enforcement must become manifest-backed policy.
- The pack's examples need cleanup before becoming fixtures.
- The pack's JSON Schema contracts need alignment with active Zod 4 schemas.
- The pack does not implement end-to-end resume/cancel/replay.

## Active Boundary Mapping

| Concern                                                                | Active owner                                 |
| ---------------------------------------------------------------------- | -------------------------------------------- |
| `.flow` grammar, source spans, tokens, CST, AST                        | `@repo/flow`                                 |
| compiler contracts, symbol table, semantic diagnostics, execution plan | `@repo/flow`                                 |
| ECP, TaskReport, IssueCard, RunReflectionPacket                        | `@repo/flow`                                 |
| AI SDK v6 model/tool/agent primitives                                  | `@repo/ai`                                   |
| platform tool manifests and policy wrappers                            | `@repo/ai/tools`                             |
| connector sessions and provider execution                              | `@repo/connectors`                           |
| Vercel Sandbox SDK                                                     | `@repo/sandbox`                              |
| persistence schema                                                     | `@repo/database`                             |
| Inngest static functions and API routes                                | app/server runtime or future adapter package |
| workflow/chat UI and reconnect behavior                                | `apps/app`                                   |

## Implementation Notes

- Start with MVP accepted task types and reserve future task types until tests exist.
- Current accepted task types: `ai_task`, `tool_call`, `sandbox_command`, `human_review`, `wait_for_event`, `subflow`.
- Current reserved task types: `sleep`, `foreach`, `parallel`, `condition`, `verify`, `emit_event`, `invoke_workflow`, `memory_patch`, `flow_patch`, `issue_card`.
- Current reserved failure policies: `retry_then_stop`, `retry_then_ask`, `use_cached`, `fallback`, `create_issue_card`, `regenerate_once_then_ask`, `skip_optional`.
- Do not accept `{{...}}` interpolation until expression grammar is specified.
- Model nested tasks with scoped task paths, not only flat job/task IDs.
- Keep semantic validation separate from structural validation.
- Enforce permissions at compile time and runtime.
- Keep large outputs in artifact storage, not durable step state.
- Treat browser stream abort as UI disconnect only.
- Treat Stop/Cancel as a durable cancellation event.
