# AI Workflow OS Documentation Hub

This folder is the canonical workspace for the Jeriko redesign into AI Workflow OS: a `.flow`-based autonomous workflow runtime inspired by GitHub Actions, durable execution, scoped AI workers, approval gates, artifacts, and continuous workflow improvement.

## Read First

- [`00-OPERATING-MEMORY.md`](./00-OPERATING-MEMORY.md): canonical operating memory for product definition, audit truth, base reset, build order, P0 blockers, `.flow` kernel contract, sandbox migration, frontend/design rules, and what not to do.
- [`00-ENGINEERING-STANDARDS.md`](./00-ENGINEERING-STANDARDS.md): mandatory engineering rulebook for research, evidence, Next.js 16.2.6 structure, T3 Env, package boundaries, verification, and anti-drift behavior.
- [`08-plans/package-best-practices-registry.md`](./08-plans/package-best-practices-registry.md): required package/app priority matrix and playbook template before critical refactors.
- [`08-plans/phase-minus-one-base-reset-plan.md`](./08-plans/phase-minus-one-base-reset-plan.md): mandatory cleanup phase for workspace scope, stale services, dependency normalization, and meaningful baseline commands before workflow work.
- [`08-plans/advanced-monorepo-directory-cleanup-plan.md`](./08-plans/advanced-monorepo-directory-cleanup-plan.md): corrected multi-app directory cleanup plan for keeping app, web, docs, email, Storybook, and studio as first-class app surfaces.
- [`07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`](./07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md): accepted decision that supersedes the earlier `tools/*` final target.
- [`01-architecture/scale-triggers-events-ecp.md`](./01-architecture/scale-triggers-events-ecp.md): accepted architecture for DB-backed dynamic triggers, EventContextPackets, static Inngest functions, reflection gates, and scale controls.
- [`09-research/2026-05-23-scale-triggers-events-ecp-validation.md`](./09-research/2026-05-23-scale-triggers-events-ecp-validation.md): source-backed validation of the v3 scale/trigger/ECP docs from Downloads.
- [`10-audit/deletion-first-cleanup-audit-2026-05-23.md`](./10-audit/deletion-first-cleanup-audit-2026-05-23.md): concrete delete/archive/gate/keep report for sensitive docs dumps, stale `services/agent`, Manus/E2B residue, and first cleanup branch scope.
- [`10-audit/reset-upgrade-surface-audit-2026-05-23.md`](./10-audit/reset-upgrade-surface-audit-2026-05-23.md): keep/refactor/move/delete map for the reset, Vercel Sandbox migration, file rendering, search/tools, side canvas, and active architecture.
- [`09-research/2026-05-23-prediction-market-architecture-reference.md`](./09-research/2026-05-23-prediction-market-architecture-reference.md): external clean-architecture reference from `kuestcom/prediction-market` for route-local components, app structure, tests, and dead-code tooling.

## Source Status

The source materials were copied from:

- `/Users/khaleelmusleh/Downloads/ai_workflow_os_project_pack`
- `/Users/khaleelmusleh/Downloads/AI_Workflow_OS_Full_Brief_for_Codex.docx`
- `/Users/khaleelmusleh/Downloads/ai_workflow_os_docs_v3_scale_triggers_ecp`

Original files are preserved unchanged in [`_source/`](./_source/). The `.docx` brief was also converted to text for search and review.

## Folder Map

| Folder                                                         | Purpose                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| [`00-OPERATING-MEMORY.md`](./00-OPERATING-MEMORY.md)           | Read-first implementation memory and non-negotiable rules                      |
| [`00-ENGINEERING-STANDARDS.md`](./00-ENGINEERING-STANDARDS.md) | Read-first engineering standards and anti-drift rules                          |
| [`00-product`](./00-product)                                   | Product thesis, target users, MVP scope, non-goals, proof workflows            |
| [`01-architecture`](./01-architecture)                         | System architecture, runtime shape, deployment assumptions                     |
| [`02-workflow-kernel`](./02-workflow-kernel)                   | `.flow` language, parser, compiler, AST, validation, runtime contract          |
| [`03-backend`](./03-backend)                                   | Database, APIs, Inngest, workers, sandbox, artifacts, tool router              |
| [`04-frontend`](./04-frontend)                                 | Routes, app shell, chat, workflow console, approvals, artifacts                |
| [`05-design`](./05-design)                                     | Product design direction, material interface rules, Manus-inspired constraints |
| [`06-security-billing`](./06-security-billing)                 | Permissions, safety, sandbox boundaries, credits, limits                       |
| [`07-madr`](./07-madr)                                         | Markdown Architecture Decision Records and decision workflow                   |
| [`08-plans`](./08-plans)                                       | Build plans, phase checklists, execution order                                 |
| [`09-research`](./09-research)                                 | Online research queue, source notes, evidence log                              |
| [`10-audit`](./10-audit)                                       | Current codebase audit plans and findings                                      |
| [`11-validation`](./11-validation)                             | Technical feasibility checks, proof tests, acceptance criteria                 |
| [`12-roadmap`](./12-roadmap)                                   | Roadmap imports and execution sequencing                                       |
| [`_source`](./_source)                                         | Raw imported source documents and CSV files                                    |

## Current Working Rule

Treat source documents as concept inputs, not final implementation truth. Any implementation decision that depends on external products, versions, pricing, APIs, security claims, or framework behavior must be verified against primary sources before code changes.

## First Build Bias

Do not start with a full rewrite or visual redesign. The first engineering milestone is the base reset:

1. Classify apps, services, and packages as keep, archive, delete, dev-only, or compatibility.
2. Delete or move sensitive untracked dumps such as `docs/home_ubuntu_full` after approval.
3. Remove stale server references such as `services/agent` CI/deploy hooks unless intentionally restored.
4. Gate inactive services out of default dev/build/test paths.
5. Normalize package versions with source-backed package evidence.
6. Keep the multi-app monorepo and make each app surface explicit.
7. Make install/typecheck/build/test meaningful for the active base.

Current package checkpoint:

- Active direct dependencies are current except documented npm-resolution metadata exceptions for `@t3-oss/env-nextjs` and `mint`.
- `pnpm typecheck` passes.
- Focused contracts/search tests pass.
- Production build and lint remain reset blockers.

See:

- [`09-research/2026-05-25-latest-package-registry-check.md`](./09-research/2026-05-25-latest-package-registry-check.md)
- [`10-audit/package-upgrade-validation-audit-2026-05-25.md`](./10-audit/package-upgrade-validation-audit-2026-05-25.md)
- [`07-madr/MADR-036-active-workspace-latest-package-normalization.md`](./07-madr/MADR-036-active-workspace-latest-package-normalization.md)

After that, build the workflow kernel:

1. Define `.flow` v0 vocabulary.
2. Implement safe parser and schema validation.
3. Compile to normalized runtime JSON/AST.
4. Execute one manual sample flow with mocked tools.
5. Add Vercel Sandbox only after the local kernel contract is testable.

## Source-Language Rule

`.flow` is the AI/user-facing source language, not the whole runtime. The platform should compile `.flow` into internal compiler/runtime layers: CST, AST, symbol table, semantic graph, DAG slices, control-flow graph, event graph, and run state machine.

See:

- [`09-research/2026-05-23-flow-source-language-vs-graphs.md`](./09-research/2026-05-23-flow-source-language-vs-graphs.md)
- [`02-workflow-kernel/compiler-stack.md`](./02-workflow-kernel/compiler-stack.md)
- [`07-madr/MADR-020-flow-source-language-compiler-ir-stack.md`](./07-madr/MADR-020-flow-source-language-compiler-ir-stack.md)

## Current Audit Baseline

Start with these before writing new product code:

- [`08-plans/phase-minus-one-base-reset-plan.md`](./08-plans/phase-minus-one-base-reset-plan.md)
- [`10-audit/reset-upgrade-surface-audit-2026-05-23.md`](./10-audit/reset-upgrade-surface-audit-2026-05-23.md)
- [`10-audit/deletion-first-cleanup-audit-2026-05-23.md`](./10-audit/deletion-first-cleanup-audit-2026-05-23.md)
- [`10-audit/full-platform-audit-2026-05-23.md`](./10-audit/full-platform-audit-2026-05-23.md)
- [`10-audit/exhaustive-runtime-source-audit-2026-05-23.md`](./10-audit/exhaustive-runtime-source-audit-2026-05-23.md)
- [`10-audit/security-auth-audit.md`](./10-audit/security-auth-audit.md)
- [`10-audit/package-upgrade-validation-audit-2026-05-25.md`](./10-audit/package-upgrade-validation-audit-2026-05-25.md)
- [`10-audit/refactor-readiness-roadmap.md`](./10-audit/refactor-readiness-roadmap.md)
- [`11-validation/platform-viability-validation.md`](./11-validation/platform-viability-validation.md)

Current verdict: the concept is viable and worth building, but the existing platform needs Phase -1 base reset, then phase-zero security, CI, service-auth, and sandbox-provider hardening before workflow feature coding starts.
