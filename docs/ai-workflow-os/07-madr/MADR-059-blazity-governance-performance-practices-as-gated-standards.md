# MADR-059: Blazity Governance And Performance Practices As Gated Standards

Status: Accepted

Date: 2026-05-26

## Context

The Blazity `next-enterprise` README and package manifest include useful enterprise tooling categories: Renovate, patch-package, component relationship graph tooling, semantic release, T3 Env, Storybook, testing layers, OpenTelemetry, health checks, bundle/performance tracking, and strict TypeScript.

The repo is not a direct template for AI Workflow OS because it is currently a single-app Next 15 starter, while this project is a multi-app Turborepo pinned to Next `16.2.6`.

## Decision

Borrow Blazity's governance and performance categories as standards, but do not copy its package list or folder structure.

Adopt now:

- Keep Renovate and remove stale pins that contradict current package normalization.
- Keep dependency-cruiser as the component/dependency relationship gate.
- Keep T3 Env as the canonical app/package env contract.
- Keep Changesets as release/versioning ownership.
- Add performance-budget and dependency-addition review rules to engineering standards.
- Require route-level performance review during app-shell and workflow-surface cleanup.

Defer:

- `patch-package`, unless a documented upstream package defect blocks delivery.
- `madge`, unless dependency-cruiser is insufficient for graph visualization.
- semantic-release, because Changesets already owns this repo's release model.
- Playwright until user flows stabilize.
- Storybook repair until the design-system validation phase.
- OpenTelemetry hardening until observability phase.
- Vercel Speed Insights or custom `useReportWebVitals` until observability/performance phase.

## Consequences

Positive:

- We benefit from enterprise starter experience without importing stale Next 15 versions.
- Package additions now have a concrete review gate.
- Performance becomes part of route cleanup, not late polish.
- Existing repo tools are reused before adding duplicates.

Negative:

- Some Blazity tools remain deferred even though they are useful.
- More documentation and audit work is required before package additions.
- Performance budgets need calibration after the reset shell is stable.

## Evidence

- Follow-up research: [`../09-research/2026-05-26-blazity-next-enterprise-governance-performance-followup.md`](../09-research/2026-05-26-blazity-next-enterprise-governance-performance-followup.md)
- Blazity `next-enterprise`: `https://github.com/Blazity/next-enterprise`
- Blazity `next-enterprise` package manifest: `https://raw.githubusercontent.com/Blazity/next-enterprise/main/package.json`
- Blazity resources: `https://www.blazity.com/resources`
- Blazity Next Enterprise product page: `https://www.blazity.com/solutions/next-enterprise`
- Blazity Next.js performance optimization page: `https://www.blazity.com/services/next-js-performance-optimization`
- Blazity tech audit page: `https://blazity.com/services/tech-audit`
- Local PDF: `~/Downloads/The Expert Guide to Next.js Performance Optimization [2025] (1).pdf`
- Renovate docs: `https://docs.renovatebot.com/configuration-options/`

## Validation Checklist

- [x] Blazity README checked.
- [x] Blazity package manifest checked.
- [x] Blazity app/components structure checked.
- [x] Blazity resources page checked.
- [x] Downloaded PDF extracted and reviewed.
- [x] Local repo tool overlap audited.
- [x] Stale Renovate Drizzle pin removed.
- [x] Engineering standards updated.
- [x] App playbook updated.
- [x] Adoption checklist created.

## Impacted Files

- `renovate.json`
- `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md`
- `docs/ai-workflow-os/08-plans/package-playbooks/apps-app.md`
- `docs/ai-workflow-os/08-plans/blazity-enterprise-practices-adoption-checklist.md`
- `docs/ai-workflow-os/09-research/2026-05-26-blazity-next-enterprise-governance-performance-followup.md`
