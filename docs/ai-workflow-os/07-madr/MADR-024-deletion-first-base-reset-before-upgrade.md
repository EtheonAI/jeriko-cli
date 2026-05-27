# MADR-024: Deletion-First Base Reset Before Upgrade

Date: 2026-05-23

Status: Accepted

Execution update 2026-05-23: first cleanup pass completed for sensitive docs dumps, stale Python-agent residue, stale CI/deploy/Docker/package references, old retirement scripts/tests, root README cleanup, generated/cache artifact cleanup, and E2B compatibility gating.

## Context

The current repo still contains old Manus/E2B/Rubic/Neko material, untracked docs dumps, stale `services/agent` references, many active apps/services, mixed dependency families, and a chat/session product center.

The target platform is AI Workflow OS: a `.flow`-based workflow runtime. Starting with package upgrades, redesign, Vercel Sandbox migration, or `.flow` feature work would preserve too much of the wrong base.

## Decision

Run a deletion-first Phase -1 base reset before dependency upgrades or feature coding.

The reset order is:

```text
delete obvious untracked/sensitive/generated junk
-> remove stale references
-> gate legacy services/apps
-> choose active app shape
-> normalize packages by family
-> verify build/test
-> then build workflow kernel
```

## Consequences

Positive:

- Reduces workspace noise before major architecture work.
- Prevents stale services from blocking CI and dependency upgrades.
- Removes secret-bearing docs dumps before any commit risk.
- Makes the Next/React upgrade smaller and more verifiable.
- Forces explicit keep/archive/delete decisions.

Negative:

- Delays visible product work.
- Requires careful review because the worktree is already dirty.
- Some legacy behavior may need temporary compatibility wrappers.

## Alternatives Considered

### Upgrade first

Rejected. Mixed apps/services and stale CI mean broad upgrades would produce noisy failures.

### Redesign first

Rejected. A visual redesign would repaint the old chat/session product instead of creating the workflow-first base.

### Delete E2B immediately

Rejected. E2B is deeply coupled to command execution, file IO, previews, terminal/browser behavior, DB fields, frontend hooks, and orchestrator code. Delete only after provider-neutral sandbox parity.

### Full rewrite

Rejected for now. The repo contains useful foundations: Next app shell, auth/database packages, file/rendering pieces, connector/tool ideas, task service patterns, and sandbox concepts.

## Evidence

- `docs/home_ubuntu_full` is untracked and contains `.env` plus `.secrets/sandbox_api_token`.
- `docs/.manus` is 1.1G and untracked.
- `docs/manus-architecture-docs` is 919M and untracked.
- `services/agent` has 0 tracked files and only Python bytecode locally.
- root `package.json`, CI, deploy, Docker Compose, and contract docs still reference `services/agent`.
- root `package.json` has mixed dependency overrides for React types, AI SDK, Drizzle, and Zod.
- initial app packages used `next@16.1.5`; post-upgrade active Next dependencies are normalized to `16.2.6`.
- `e2b-templates/**` contains 9,310 files and 260M of E2B/desktop template material.
- external reference `kuestcom/prediction-market` shows a cleaner target shape with one `src` app boundary, route-local folders, visible tests, and Knip.
- cleanup verification removed stale `services/agent`, `jeriko-agent`, `test:agent`, `docs/refactor-2026`, and old retirement-script references from the active CI/package/contracts/Docker surfaces.

## Impacted Files And Packages

- `package.json`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `.github/workflows/contract-gate.yml`
- `docker-compose.prod.yml`
- `docs/home_ubuntu_full`
- `docs/.manus`
- `docs/manus-architecture-docs`
- `services/agent`
- `apps/*`
- `services/*`
- `e2b-templates/*`

## Validation Checklist

- [x] Sensitive docs dump removed or moved outside repo.
- [x] `services/agent` bytecode removed after approval.
- [x] No package scripts reference missing `services/agent`.
- [x] No CI/deploy jobs reference missing `services/agent`.
- [x] Generated app `.next`, workspace `.turbo`, Playwright reports, untracked service/package `dist`, and ignored E2B template build payload removed.
- [ ] Active app/service set documented.
- [ ] Legacy apps/services gated from default build/test/dev.
- [ ] Next/React upgrade runs only after active scope is reduced.
- [ ] E2B remains compatibility-only until provider-neutral Vercel Sandbox parity tests pass.
