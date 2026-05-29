# Flow Package Playbook

Package: `@repo/flow`

Date: 2026-05-27

Status: provider-neutral language/compiler/runtime contracts started; custom `.flow` grammar gate active; parser/runtime implementation still gated

Priority: P2 core platform package

## Ownership

What this package owns:

- `.flow` language source contracts;
- parser diagnostics and parser interface;
- AST schemas;
- core workflow vocabulary;
- compiler output and symbol table contracts;
- execution plan contracts;
- runtime interpreter interface;
- flow event and run state contracts;
- FlowPatch contracts;
- testing helpers for the flow package.

What this package must not own:

- Vercel Sandbox or any sandbox provider SDK;
- AI SDK model calls;
- database client or migrations;
- Next.js route handlers;
- app UI;
- email/payment/search/provider SDKs;
- external connector SDKs.

## Current Surface

Exports:

- `@repo/flow`
- `@repo/flow/source`
- `@repo/flow/lexer`
- `@repo/flow/cst`
- `@repo/flow/parser`
- `@repo/flow/ast`
- `@repo/flow/compiler`
- `@repo/flow/kernel`
- `@repo/flow/runtime`
- `@repo/flow/events`
- `@repo/flow/state`
- `@repo/flow/patch`
- `@repo/flow/testing`

Provider SDKs:

- none.

Dependencies:

- `zod`

Rejected dependencies:

- `yaml` for `.flow` parsing.

Intentional decision:

- This package is not a parser implementation yet.
- It defines stable contracts first so future app, AI, sandbox, connectors, database, runtime adapter, and artifacts packages can integrate without creating cycles.
- The first runtime contract pass added triggers, trigger registry records, ECP, TaskReports, reflection packets, scheduler decisions, run requests, and cancellation requests without importing provider SDKs.
- MADR-095 corrects the source-language direction: `.flow` is a custom workflow language, not YAML. YAML.org/spec/test-suite/package architecture and GitHub Actions syntax are research inputs only.

## Sources Checked

| Source                                                                                                                                                     | Type                       | Checked Date | Claim Used                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://turborepo.com/repo/docs/core-concepts/package-types`                                                                                              | Official docs              |   2026-05-26 | `@repo/flow` is a library package and apps are graph endpoints.                                                                                                  |
| `https://turborepo.com/repo/docs/core-concepts/internal-packages`                                                                                          | Official docs              |   2026-05-26 | Workspace packages are consumed through package manifests and imports like external packages.                                                                    |
| `https://nodejs.org/api/packages.html#subpath-exports`                                                                                                     | Official docs              |   2026-05-26 | Explicit package exports define public subpaths and prevent accidental internal imports.                                                                         |
| `https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md`                                                                          | Official project docs      |   2026-05-26 | Forbidden rules use `from` and `to` conditions with `severity: "error"` for graph gates.                                                                         |
| `https://vercel.com/docs/workflow`                                                                                                                         | Official docs              |   2026-05-26 | Durable workflows are resumable stateful functions; `@repo/flow` should define our language/runtime contracts, not provider details.                             |
| `https://vercel.com/docs/llms-full.txt`                                                                                                                    | Official llms-full         |   2026-05-26 | Vercel machine-readable docs are required before implementing Workflow/Sandbox adapters.                                                                         |
| `https://www.inngest.com/docs/self-hosting`                                                                                                                | Official docs              |   2026-05-27 | Self-hosting is supported, but it adds operational ownership; managed Inngest remains the MVP default behind a provider-neutral adapter.                         |
| `https://www.inngest.com/docs/usage-limits/inngest`                                                                                                        | Official docs              |   2026-05-27 | Managed limits shape runtime design: step timeouts, step payload size, run state size, step count, event payload, and batch limits.                              |
| `https://www.inngest.com/docs/guides/concurrency`                                                                                                          | Official docs              |   2026-05-27 | Keyed/scoped concurrency maps to per-org/per-provider/per-tool workflow limits.                                                                                  |
| [`MADR-079`](../../07-madr/MADR-079-managed-inngest-first-provider-neutral-runtime.md)                                                                     | Repo decision              |   2026-05-27 | Use managed Inngest first, keep self-hosted Inngest and Vercel Workflow behind provider-neutral runtime boundaries.                                              |
| [`MADR-080`](../../07-madr/MADR-080-prefer-inngest-over-vercel-workflow-for-dynamic-flow-runtime.md)                                                       | Repo decision              |   2026-05-27 | Prefer Inngest over Vercel Workflow for the dynamic `.flow` runtime while tracking Vercel Workflow as an evaluation path.                                        |
| [`2026-05-27-vercel-workflow-vs-inngest-runtime-comparison.md`](../../09-research/2026-05-27-vercel-workflow-vs-inngest-runtime-comparison.md)             | Repo research              |   2026-05-27 | Inngest maps better to DB-backed triggers, event fan-out, waits, cancellation, concurrency, and a data-driven `.flow` interpreter.                               |
| [`2026-05-27-v3-scale-triggers-ecp-source-validation.md`](../../09-research/2026-05-27-v3-scale-triggers-ecp-source-validation.md)                         | Repo validation            |   2026-05-27 | The Downloads v3 scale/trigger/ECP package matches the repo source copy and remains aligned with current official docs.                                          |
| `https://zod.dev/llms-full.txt`                                                                                                                            | Official llms-full         |   2026-05-27 | Zod 4 remains the post-parse AST/schema validation layer, not the lexer/parser layer.                                                                            |
| `https://yaml.org/`                                                                                                                                        | Official docs              |   2026-05-27 | YAML is a human-friendly serialization language; use it only as readability and architecture research for `.flow`.                                               |
| `https://yaml.org/spec/1.2.2/`                                                                                                                             | Official spec              |   2026-05-27 | YAML separates source, syntax, representation, and loading failure points; `.flow` should copy the pipeline separation, not the language.                        |
| `https://github.com/yaml/yaml-grammar`                                                                                                                     | Official YAML project repo |   2026-05-27 | Full YAML grammar complexity is evidence to keep `.flow` smaller and domain-specific.                                                                            |
| `https://github.com/yaml/yaml-test-suite`                                                                                                                  | Official YAML project repo |   2026-05-27 | Parser quality requires a fixture-driven corpus for valid and invalid source cases.                                                                              |
| `https://eemeli.org/yaml/`                                                                                                                                 | Official package docs      |   2026-05-27 | Mature parser package architecture separates lexer/parser/composer/document concepts; borrow the separation, not the dependency.                                 |
| [`2026-05-27-yaml-main-parser-architecture-reverse-engineering.md`](../../09-research/2026-05-27-yaml-main-parser-architecture-reverse-engineering.md)     | Local source audit         |   2026-05-27 | Local `yaml-main` pass covered 151 available files and 27,776 lines; borrow lexer/CST/composer/test architecture and reject YAML features.                       |
| `https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax`                                                                       | Official docs              |   2026-05-27 | Workflow files are readable source contracts with triggers/jobs/steps; `.flow` should own richer workflow semantics for approvals, artifacts, tools, and events. |
| [`2026-05-27-p4-1-flow-parser-compiler-research.md`](../../09-research/2026-05-27-p4-1-flow-parser-compiler-research.md)                                   | Repo research              |   2026-05-27 | P4.1 corrected to no YAML parser dependency and a custom `.flow` compiler stack.                                                                                 |
| [`MADR-095`](../../07-madr/MADR-095-flow-parser-and-compiler-v0.md)                                                                                        | Repo decision              |   2026-05-27 | Accepted: build a custom `.flow` parser and compiler v0; do not add `yaml` for parsing `.flow`.                                                                  |
| [`MADR-096`](../../07-madr/MADR-096-resumable-workflow-runs-and-ui-reconnect.md)                                                                           | Repo decision              |   2026-05-27 | Browser refresh/tab close must not cancel workflow runs; resume/reconnect is a durable runtime and UI requirement.                                               |
| [`2026-05-27-resumable-workflow-runs-and-ui-reconnect.md`](../../09-research/2026-05-27-resumable-workflow-runs-and-ui-reconnect.md)                       | Repo research              |   2026-05-27 | Current app is not resumable end to end; durable execution and resumable UI are separate layers.                                                                 |
| [`2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md`](../../09-research/2026-05-27-flow-language-runtime-pack-v0-1-reverse-engineering.md) | Local source audit         |   2026-05-27 | Copied `flow_language_runtime_pack_v0_1` into repo source reference, audited 48 files/5,226 lines, and accepted it as blueprint-only.                            |
| [`MADR-097`](../../07-madr/MADR-097-flow-runtime-pack-v0-1-blueprint-adoption.md)                                                                          | Repo decision              |   2026-05-27 | Adopt flow runtime pack concepts and checklists but do not import its YAML/Inngest/provider-mixed implementation into `@repo/flow`.                              |
| [`flow-v0-implementation-master-plan.md`](../flow-v0-implementation-master-plan.md)                                                                        | Repo plan                  |   2026-05-27 | Phase-by-phase implementation gate for vocabulary, lexer, CST, AST, symbol table, semantics, execution plan, adapters, persistence, and reconnect.               |
| [`flow-end-to-end-package-build-plan.md`](../flow-end-to-end-package-build-plan.md)                                                                        | Repo plan                  |   2026-05-27 | Package-by-package plan for compiler, persistence, runtime adapter, AI workers, tools/connectors/sandbox, and app UI wiring.                                     |
| [`flow-end-to-end-runtime-architecture.md`](../../01-architecture/flow-end-to-end-runtime-architecture.md)                                                 | Repo architecture          |   2026-05-27 | Prompt-to-`.flow` to durable runtime execution and resumable UI architecture.                                                                                    |
| [`flow-end-to-end-readiness-audit-2026-05-27.md`](../../10-audit/flow-end-to-end-readiness-audit-2026-05-27.md)                                            | Repo audit                 |   2026-05-27 | Current readiness matrix across flow, AI, connectors, sandbox, database, runtime, and app.                                                                       |
| Existing `.flow` architecture docs                                                                                                                         | Repo evidence              |   2026-05-26 | `.flow` is the source authoring layer; AST/ASG/DAG/CFG/state/event structures are internal layers.                                                               |

## Local Audit

Commands:

```bash
pnpm --filter @repo/flow typecheck
pnpm exec vitest run --config packages/flow/vitest.config.ts
pnpm exec vitest run --project @repo/flow
pnpm test
pnpm --filter "./packages/*" typecheck
pnpm boundaries:cruise --focus packages/flow
```

Findings:

- Package contracts compile.
- Package tests cover trigger/ECP/task report/reflection/cancellation contracts.
- No app imports exist yet.
- No provider SDKs exist in the package.
- `@repo/flow` currently has no YAML dependency and no YAML-backed parser implementation.
- Dependency-cruiser now has a dedicated `no-flow-to-app-or-runtime-sdk` rule to prevent `@repo/flow` from importing apps or provider/runtime SDKs directly.

## Decision

Verdict: keep core.

Reason:

- `@repo/flow` is the correct product-language package name.
- Subpath exports give clean segmentation without premature package splitting.
- Parser/runtime implementation should wait until the `.flow` grammar, token/CST contracts, and fixture corpus are written.
- The parser must be custom `.flow`, not YAML-backed.

## Refactor Checklist

- [x] Public exports are intentional.
- [x] No app imports package internals.
- [x] No provider SDK leaks into package.
- [x] Server/client boundaries are provider-neutral and non-Next-specific.
- [x] Dependency-cruiser blocks app/provider SDK imports from `packages/flow`.
- [x] Typecheck passes.
- [x] Add provider-neutral trigger registry contract.
- [x] Add EventContextPacket contract.
- [x] Add TaskReport and RunReflectionPacket contracts.
- [x] Add scheduler decision and run request contracts.
- [x] Add cancellation request contract.
- [x] Add package tests for runtime contracts.
- [x] Accept MADR-095 no-YAML parser decision.
- [x] Add `.flow` grammar design document.
- [x] Add token and CST contracts.
- [x] Add parser fixture corpus.
- [x] Add local `yaml-main` reverse-engineering source audit.
- [x] Copy and audit `flow_language_runtime_pack_v0_1` as source reference.
- [x] Record MADR-097 blueprint-only adoption decision.
- [x] Add flow runtime pack adoption checklist.
- [x] Add `.flow` v0 implementation master plan.
- [x] Add accepted vs reserved task/failure vocabulary contracts.
- [x] Add reserved vocabulary parser diagnostic contracts.
- [x] Add custom lexer implementation with source spans and YAML-only rejection diagnostics.
- [x] Add CST parser implementation.
- [ ] Add AST parser/normalizer implementation.
- [ ] Add semantic validation implementation.
- [ ] Add symbol table builder.
- [ ] Add execution planner.
- [ ] Add runtime interpreter implementation.
- [ ] Add resumable run state/event/cancellation contracts needed by MADR-096.
- [ ] Ensure browser disconnect is never modeled as run cancellation in flow contracts.
- [x] Add package README with contract-only status and package boundaries.
- [x] Add end-to-end runtime architecture/readiness docs.
- [x] Add package-local end-to-end build plan.

## Validation

```bash
pnpm --filter @repo/flow typecheck
pnpm exec vitest run --config packages/flow/vitest.config.ts
pnpm exec vitest run --project @repo/flow
pnpm test
pnpm --filter "./packages/*" typecheck
pnpm boundaries:cruise --focus packages/flow
```

Latest validation:

- `pnpm --filter @repo/flow typecheck` passed after adding runtime contracts.
- `pnpm exec vitest run --config packages/flow/vitest.config.ts` passed: 1 file, 5 tests.
- `pnpm exec vitest run --project @repo/flow` passed: 1 file, 5 tests.
- `pnpm test` passed after adding `@repo/flow` to the root test project list: 9 files, 30 tests.
- `pnpm --filter "./packages/*" typecheck` passed across 26 active package projects.
- `pnpm boundaries:cruise --focus packages/flow` passed with no dependency violations.
- `pnpm boundaries:cruise` runs with the `@repo/flow` app/provider guard enabled and still fails on pre-existing `@repo/ai` renderer cycles and `@repo/database` schema cycles; no `@repo/flow` cycle or provider violation was reported.

Latest P4.1 no-YAML gate validation:

- `pnpm --filter @repo/flow typecheck` passed.
- `pnpm exec vitest run --config packages/flow/vitest.config.ts` passed: 3 files, 11 tests.
- `pnpm outdated --filter @repo/flow --format json` returned `{}`.
- `pnpm boundaries:cruise --focus packages/flow` passed with no dependency violations.
- `pnpm test` passed: 25 files, 79 tests.
- Active planning docs no longer use legacy YAML-source workflow terminology outside historical `_source` imports.

Latest Phase B lexer validation:

- `tsc --noEmit --emitDeclarationOnly false -p packages/flow/tsconfig.json` passed under Node `22.22.1`.
- `vitest run --config packages/flow/vitest.config.ts` passed: 4 files, 26 tests.

Latest Phase C CST parser validation:

- `tsc --noEmit --emitDeclarationOnly false -p packages/flow/tsconfig.json` passed under Node `22.22.1`.
- `vitest run --config packages/flow/vitest.config.ts` passed: 5 files, 30 tests.
- `depcruise --config .dependency-cruiser.cjs --focus packages/flow apps packages` passed with no dependency violations.

## Open Risks

- The package can become too broad if provider/runtime adapters leak into it.
- The parser grammar must be specified before implementation.
- Runtime integration with Vercel Workflow, Inngest, or another durable executor must be decided separately from the `.flow` language contracts.
- Current runtime provider posture is managed Inngest first, but only behind a provider-neutral adapter. Do not import `inngest`, `workflow`, queues, or provider SDKs into `@repo/flow`.
- Self-hosted Inngest is an exit path for compliance, data residency, cost, or dedicated-control requirements after real workload data exists.
- Vercel Workflow is a tracked alternative, but not the MVP default. It needs validation against dynamic triggers, event fan-out, cancellation, run/event visibility, concurrency policy, and `.flow` interpreter fit before adoption.
