# Jeriko

Jeriko is being reset into **AI Workflow OS**: a `.flow`-based workflow runtime for durable AI workflows, approvals, artifacts, sandboxed execution, tools, and event-driven automation.

This repo is no longer being treated as a Manus clone or chat-first agent platform. The old platform contained useful primitives, but the target architecture is workflow-first:

```text
.flow source
-> parser / AST / semantic validation
-> compiled execution plan
-> durable workflow runtime
-> tools, approvals, artifacts, events, reports, and patches
```

## Canonical Docs

Use [`docs/ai-workflow-os`](./docs/ai-workflow-os/README.md) as the source of truth.

Start here:

- [`00-OPERATING-MEMORY.md`](./docs/ai-workflow-os/00-OPERATING-MEMORY.md)
- [`08-plans/phase-minus-one-base-reset-plan.md`](./docs/ai-workflow-os/08-plans/phase-minus-one-base-reset-plan.md)
- [`10-audit/deletion-first-cleanup-audit-2026-05-23.md`](./docs/ai-workflow-os/10-audit/deletion-first-cleanup-audit-2026-05-23.md)
- [`10-audit/reset-upgrade-surface-audit-2026-05-23.md`](./docs/ai-workflow-os/10-audit/reset-upgrade-surface-audit-2026-05-23.md)
- [`10-audit/e2b-to-vercel-sandbox-migration-surface.md`](./docs/ai-workflow-os/10-audit/e2b-to-vercel-sandbox-migration-surface.md)
- [`07-madr`](./docs/ai-workflow-os/07-madr)

## Current Engineering Rule

Do not start by adding product features.

The required order is:

```text
Phase -1 base reset
-> security and CI stabilization
-> isolated .flow kernel
-> workflow-native database schema
-> provider-neutral sandbox adapter
-> durable executor
-> workflow-first frontend
```

## Sandbox Direction

The target sandbox provider is **Vercel Sandbox** through a provider-neutral interface.

E2B-specific runtime code may remain temporarily as a compatibility provider, but old checked-in E2B desktop/template payloads are not the product base. Do not add new workflow code directly to E2B-specific paths.

## Cleanup Status

The Phase -1 deletion-first cleanup has already removed old sensitive docs dumps, stale Python-agent residue, old retirement scripts, generated caches/build output, and stale CI/deploy/Docker references.

The active workspace now excludes the old Manus-style service tree and `service-utils`. Those sources were moved to `legacy/manus-clone` as reference until their app-facing routes are replaced or deleted.

The current monorepo direction is:

```text
apps/app        primary product app
apps/web        marketing/content app
apps/docs       documentation app
apps/email      email preview/build app
apps/storybook  design-system workshop app
apps/studio     database/admin studio app
packages/*      reusable product libraries and contracts
tools/*         repo-only CLIs/scripts, not app packages
legacy/*        old Manus-clone reference, not active architecture
```

`apps/api` and the old service Docker Compose definitions are now deactivated under `legacy/` until a separate deploy boundary is justified.

The current working tree may still contain `tools/docs`, `tools/email`, `tools/storybook`, and `tools/studio` from an intermediate cleanup. MADR-037 corrects the target: those runnable surfaces should move back under `apps/*` with explicit app ownership.

Active direct workspace dependencies have been normalized, with `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6`, `turbo@2.9.14`, `typescript@6.0.3`, and `eslint@10.4.0`. Current latest-status exceptions are documented registry conflicts: `@t3-oss/env-nextjs` stays on npm-resolvable `0.13.10`, and docs uses public `mint@4.2.3` while `pnpm outdated` incorrectly reports `mint@4.2.577` from the `mintlify` package line. Full `pnpm typecheck` and focused contracts/search tests pass.

The reset is not finished: the old BaseHub CMS build path has been removed, but `apps/web` typecheck still fails on contact/i18n/calendar/metadata debt, `apps/app` production build still needs a focused Turbopack hang audit, and `pnpm lint` still fails on active-code debt.

See [`01-architecture/monorepo-target-architecture.md`](./docs/ai-workflow-os/01-architecture/monorepo-target-architecture.md), [`01-architecture/package-ownership-index.md`](./docs/ai-workflow-os/01-architecture/package-ownership-index.md), [`MADR-033`](./docs/ai-workflow-os/07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md), [`MADR-034`](./docs/ai-workflow-os/07-madr/MADR-034-deactivate-redundant-api-app-and-legacy-compose.md), [`MADR-037`](./docs/ai-workflow-os/07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md), [`MADR-036`](./docs/ai-workflow-os/07-madr/MADR-036-active-workspace-latest-package-normalization.md), and the latest package check in [`09-research/2026-05-25-latest-package-registry-check.md`](./docs/ai-workflow-os/09-research/2026-05-25-latest-package-registry-check.md).

## Local Commands

```bash
pnpm install
pnpm dev
pnpm dev:frontend
pnpm --filter app typecheck
pnpm --filter @repo/contracts typecheck
pnpm infra:up
```

Run broader build/test commands only after the active app/package set is gated; the repo still contains legacy reference surfaces under audit.
