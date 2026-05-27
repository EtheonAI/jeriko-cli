# MADR-026: Defer Non-Cleanup Type Debt To Upgrade Phase

Date: 2026-05-23

Superseded package-status note 2026-05-25: current package normalization and validation are tracked in [`MADR-036-active-workspace-latest-package-normalization.md`](./MADR-036-active-workspace-latest-package-normalization.md). Older statements here about `pnpm outdated -r --format json` returning `{}` are historical; current latest checks retain the documented `@t3-oss/env-nextjs` npm-resolution exception.

## Status

Accepted

## Context

The repository is in a deletion-first cleanup phase before the larger reset, package upgrade, Vercel Sandbox migration, redesign, and `.flow` workflow kernel work.

During cleanup verification, some packages expose real type drift against current dependency surfaces, especially around AI SDK, Zod, and orchestrator tool types. Fixing every current type error before the planned package upgrade would spend time on APIs that are about to move again.

The cleanup branch still needs enough verification to prove deleted files did not break core packages, but it should not become a broad source-modernization branch.

## Decision

Do not chase non-cleanup type debt during deletion-first cleanup.

Cleanup-phase fixes are allowed only when they are directly caused by cleanup or required to keep targeted verification meaningful. Broader type errors, AI SDK migration issues, Zod major-version drift, and orchestrator source modernization move to the dependency-upgrade/reset phase.

## Consequences

- Cleanup stays focused on removing stale files, secrets, generated output, old assistant docs, checked-in templates, and invalid references.
- Remaining typecheck failures must be documented honestly as upgrade-phase debt.
- Package-family upgrades can fix source and types once, against the real target versions.
- We avoid wasting time stabilizing old APIs that will be replaced by the reset.

## Alternatives Considered

- Fix all type errors before continuing cleanup. Rejected because many failures are dependency-surface drift and will be invalidated by the planned upgrade.
- Ignore verification entirely. Rejected because cleanup must still prove that high-confidence deletions did not leave broken references.
- Upgrade packages during cleanup. Rejected because broad upgrades should happen after legacy apps/services are gated and baseline ownership is clear.

## Evidence

- `@repo/contracts` tests and typecheck pass after cleanup.
- `@repo/service-utils` tests pass after source exports were made usable without generated `dist`.
- `@jeriko/sandbox` tests pass after the service-utils export cleanup.
- `@jeriko/orchestrator` typecheck still reports AI SDK/Zod/source-level type drift, not deleted-template references.
- The reset plan already requires dependency-family upgrades for Next/React, AI SDK, Zod, Drizzle, and related packages.

## Impacted Files/Packages

- `packages/service-utils`
- `services/orchestrator`
- `services/sandbox`
- dependency upgrade plan under `docs/ai-workflow-os/08-plans`
- cleanup audit under `docs/ai-workflow-os/10-audit`

## Validation Checklist

- [x] Cleanup-critical packages still have targeted verification.
- [x] Generated verification output is removed after tests.
- [x] Remaining type debt is documented instead of hidden.
- [x] During the upgrade phase, rerun the full package-family verification after dependency versions are finalized.

## Upgrade Follow-Up 2026-05-23

The deferred type debt was handled in the package-upgrade phase, not the deletion-first cleanup phase.

Validation:

- `@jeriko/orchestrator` typecheck now passes on AI SDK 6.
- Full recursive `pnpm -r --workspace-concurrency=4 --if-present typecheck` passes.
- `pnpm outdated -r --format json` returns `{}` after replacing deprecated React Email imports with `react-email`.
