# Advanced Monorepo Directory Cleanup Plan

Date: 2026-05-25

Purpose: convert the cleaned workspace into an intentional multi-app monorepo before feature reset work continues.

## Verdict

Keep the monorepo and keep the app surfaces.

The next cleanup stage is not deletion of `web`, docs, email, Storybook, or studio. The next stage is making each of them explicit:

```text
app role
env contract
build command
deploy/dev status
package ownership
shared-code boundary
CI filter
```

This follows the latest checked Next.js, Turborepo, Vercel monorepo, pnpm workspace, and next-forge guidance documented in [`../09-research/2026-05-25-advanced-monorepo-app-ownership.md`](../09-research/2026-05-25-advanced-monorepo-app-ownership.md) and [`../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`](../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md).

## Target Tree

```text
apps/
  app
  web
  docs
  email
  storybook
  studio

packages/
  auth
  database
  design-system
  ai
  contracts
  payments
  search
  storage
  workflow-kernel
  workflow-runtime
  sandbox
  tools

tools/
  repo-only CLIs or maintenance utilities, only when they are not app packages

legacy/
  manus-clone
  deactivated-apps/api
```

## Phase -1.7 Checklist

- [x] Move `tools/docs` back to `apps/docs`.
- [x] Move `tools/email` back to `apps/email`.
- [x] Move `tools/storybook` back to `apps/storybook`.
- [x] Move `tools/studio` back to `apps/studio`.
- [x] Remove `tools/*` from `pnpm-workspace.yaml` because no package roots remain there.
- [x] Keep `tools/` available only for non-app repo tooling.
- [x] Update root scripts:
  - [x] `build:product` or equivalent for `app` and `web`.
  - [x] `build:docs`.
  - [x] `build:email`.
  - [x] `build:storybook`.
  - [x] `dev:studio`.
  - [x] `build:all` as an explicit all-surface command, not the default safety check.
- [ ] Update Turbo filters and CI paths for each app surface.
- [x] Add README files:
  - [x] `apps/app/README.md`
  - [x] `apps/web/README.md`
  - [x] `apps/docs/README.md`
  - [x] `apps/email/README.md`
  - [x] `apps/storybook/README.md`
  - [x] `apps/studio/README.md`
- [x] Each app README must include role, env, commands, deploy target, ownership, and status.
- [ ] Verify no app imports another app.
- [ ] Verify packages do not import app code.
- [ ] Keep `legacy/deactivated-apps/api` inactive until an API boundary is proven.
- [ ] Keep `legacy/manus-clone` excluded from active lint/build/typecheck.

## Next.js App Router Cleanup Rules

- [ ] Keep `apps/app/app` during this cleanup.
- [ ] Do not migrate to `src/app` without a dedicated route migration plan.
- [ ] Use route-local folders for feature code:
  - `_components`
  - `_hooks`
  - `_actions`
  - `_lib`
  - `_types`
- [ ] Pages and layouts stay Server Components by default.
- [ ] Client Components are narrow islands for state, effects, event handlers, browser APIs, and interactive widgets.
- [ ] Server-only code lives in route-local `_lib` or app-level `lib/server`.
- [ ] Shared reusable UI stays in `packages/design-system`.
- [ ] Shared workflow/runtime logic goes to packages, not route trees.

## Package Boundary Cleanup Rules

- [ ] Keep workspace package directories flat under `packages/*`.
- [ ] Use `workspace:*` for internal dependencies.
- [ ] Add package README/ownership notes before moving package APIs.
- [ ] Add future workflow packages only when their boundary is real:
  - `packages/workflow-kernel`
  - `packages/workflow-runtime`
  - `packages/sandbox`
  - `packages/tools`
- [ ] Do not create nested active packages such as `packages/platform/auth`.
- [ ] Do not build new product code under `legacy/*`.

## Verification Gates

- [x] `pnpm install`
- [x] `pnpm -r list --depth -1`
- [x] `pnpm typecheck`
- [ ] `pnpm --filter app typecheck`
- [ ] `pnpm --filter web typecheck`
- [x] `pnpm --filter docs lint` if Mintlify remains docs tooling; command exits 0 but reports starter-doc broken links that need content cleanup.
- [ ] `pnpm --filter email build` or a documented React Email blocker
- [ ] `pnpm --filter storybook typecheck`
- [ ] `pnpm --filter studio dev` command documented, not necessarily run in CI
- [ ] `git diff --check`

## What Not To Do

- [ ] Do not delete `apps/web` because the CMS/BaseHub build path is currently blocked.
- [ ] Do not delete docs/email/storybook/studio because they are not the runtime product.
- [ ] Do not move everything into one app.
- [ ] Do not make `apps/api` active again without a proven deploy/security/runtime boundary.
- [ ] Do not start the `.flow` kernel or redesign work until this workspace boundary is clear.
