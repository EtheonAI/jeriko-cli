# Monorepo Directory Cleanup Status

Date: 2026-05-24

## Scope

Physical directory cleanup after deciding that the old Manus-clone service tree is not the new backend.

Correction 2026-05-25: the `tools/*` app-surface move recorded here is superseded by [`../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`](../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md). It was an intermediate cleanup state, not the final target. Runnable docs/email/Storybook/studio surfaces were moved back under `apps/*`.

## Completed

- Moved `services/` to `legacy/manus-clone/services`.
- Moved `packages/service-utils` to `legacy/manus-clone/service-utils`.
- Moved `apps/api` to `legacy/deactivated-apps/api`.
- Moved dev/content utility apps to `tools/*`: docs, email, storybook, and studio.
- Moved old root service/dev/prod compose files to `legacy/manus-clone/docker`.
- Added `docker-compose.infra.yml` for active local dependencies only.
- Replaced the stale root `vitest.workspace.ts` with current `vitest.config.ts` `test.projects`.
- Removed generated/dependency state from `legacy/`: `node_modules`, `.turbo`, and `dist`.
- Added `legacy/README.md`.
- Added `legacy/manus-clone/README.md`.
- Added `legacy/deactivated-apps/README.md`.
- Updated workspace root so active packages are only:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

- Kept root service commands removed.
- Kept Docker commands scoped as infrastructure commands.

## Active Directory Meaning

```text
apps/       runnable application surfaces and deployable projects
tools/      repo-only CLIs/scripts that are not app packages
packages/   active reusable libraries/contracts/adapters/config
legacy/     inactive old source retained for reference only
docs/       architecture, research, audit, plans, decisions
scripts/    maintenance scripts only
```

## Why This Is Better

The old layout made services look like equal first-class architecture, even though they were created to copy Manus and no longer match the `.flow` workflow OS target.

Moving them to `legacy/` makes the repo communicate the truth:

- active backend should be rebuilt around app/server facades, contracts, workflow kernel, runtime adapters, and provider-neutral sandbox/tools packages;
- the old service source is reference material, not the new backend;
- `packages/*` is no longer polluted by service-only infrastructure.

## Remaining Directory Work

- [x] Decide `apps/api`: deactivated under `legacy/deactivated-apps/api`; keep active API work in `apps/app/app/api` for now.
- [x] Decide `apps/docs`: moved to `tools/docs`.
- [x] Decide `apps/storybook`: moved to `tools/storybook`.
- [x] Decide `apps/studio`: moved to `tools/studio`.
- [x] Decide `apps/email`: moved to `tools/email`.
- [x] Move docs/email/storybook/studio back under `apps/*` per MADR-037.
- [ ] Keep `apps/app/app`; do not move to `src/app` without a dedicated route migration plan.
- [ ] Rename route groups from `(authenticated)` / `(unauthenticated)` to target `(app)` / `(auth)` during the app route reset.
- [ ] Move route-local components/hooks/lib under private folders.
- [ ] Delete or isolate `chat/test`, `chat/test-stream`, and `chat/test-ide`.
- [ ] Add active package classification READMEs or a package ownership index.

## Validation Commands

Executed on 2026-05-25 after the `tools/*` move:

```bash
pnpm install
pnpm -r list --depth -1
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm --filter @repo/contracts typecheck
pnpm exec vitest list --passWithNoTests
pnpm exec vitest run --project @repo/contracts --passWithNoTests
pnpm exec vitest run --project @repo/search --passWithNoTests
pnpm exec turbo run typecheck --dry
```

Results:

- `pnpm install` passed across 31 workspace projects.
- `pnpm -r list --depth -1` shows `apps/app`, `apps/web`, 24 `packages/*` packages, and 4 `tools/*` packages.
- `app`, `web`, `@repo/contracts`, and `@repo/search` typechecks passed.
- `@repo/contracts` Vitest passed: 6 files, 112 tests.
- `@repo/search` Vitest passed: 1 file, 9 tests.
- `pnpm exec turbo run typecheck --dry` scoped 30 packages and no active legacy service/API package.
- Active config scan found no stale `apps/api`, `@repo/service-utils`, `@jeriko/*`, old service compose, `dev:services`, `vitest.workspace`, or `defineWorkspace` references.
