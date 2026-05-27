# MADR-037: Keep Multiple Apps As First-Class Monorepo Surfaces

**Status:** Accepted

## Context

The previous cleanup direction moved docs, email preview, Storybook, and Drizzle Studio from `apps/*` to `tools/*`. That reduced confusion temporarily, but it also overcorrected the architecture.

The target is not a single-app repository. The target is a serious multi-app monorepo where every runnable surface has an explicit role, owner, env contract, build command, and deploy/dev status.

The problem in the old repo was not that multiple apps existed. The problem was unclear ownership, stale Manus services, service-proxy residue, generated files, mixed package versions, and default scripts that made every surface feel equally active.

## Latest Evidence Checked

- Next.js project structure: `https://nextjs.org/docs/app/getting-started/project-structure`
  - `src` is optional.
  - route groups organize URLs without affecting the URL path.
  - private folders such as `_components` and `_lib` are supported for non-routable colocated code.
- Turborepo repository structure: `https://turborepo.com/docs/crafting-your-repository/structuring-a-repository`
  - recommended workspace split starts with `apps/*` for applications and services, and `packages/*` for libraries/tooling.
  - nested package globs such as `apps/**` and `packages/**` should be avoided.
- Turborepo package types: `https://turborepo.com/docs/core-concepts/package-types`
  - application packages are deployed/runnable workspace packages and should normally be package graph endpoints.
  - library packages support application packages and are not independently deployable.
- Vercel monorepos: `https://vercel.com/docs/monorepos`
  - multiple projects can live in one monorepo.
  - unchanged project builds can be skipped when roots and dependency graphs are clear.
- pnpm workspaces: `https://pnpm.io/workspaces`
  - a workspace is declared through `pnpm-workspace.yaml`.
  - `workspace:` dependencies prevent accidental registry resolution for internal packages.
- next-forge structure: `https://www.next-forge.com/docs/structure`
  - next-forge is a production-grade Turborepo monorepo.
  - apps are self-contained and can deploy independently.
  - packages isolate shared code.
- next-forge repository app list: `https://github.com/vercel/next-forge/tree/main/apps`
  - current reference structure keeps `api`, `app`, `docs`, `email`, `storybook`, `studio`, and `web` under `apps/`.
- T3 Env registry check:
  - `npm view @t3-oss/env-nextjs version dist-tags versions --json --registry https://registry.npmjs.org --prefer-online`
  - latest npm-published dist-tag is `0.13.10`; exact `0.13.11` is not published in npm registry output as of this check.

## Decision

Keep a multi-app monorepo.

Use this target classification:

```text
apps/
  app          primary authenticated AI Workflow OS product app
  web          marketing/content site
  docs         documentation site/content app
  email        React Email preview/build app
  storybook    design-system workshop app
  studio       database/admin studio app

packages/
  auth
  database
  design-system
  ai
  contracts
  workflow-kernel
  workflow-runtime
  sandbox
  tools
  ...

tools/
  repo-only scripts or CLIs that are not app packages

legacy/
  manus-clone
  deactivated-apps/api
```

Keep `apps/api` deactivated for now. Reintroduce an API app only after a separate deploy boundary is proven, such as public API isolation, webhook/runtime isolation, independent scaling, or a different security/runtime model.

Do not delete `apps/web`, docs, email preview, Storybook, or studio because they are not the core product runtime. Clean them, document them, and gate them through explicit scripts.

Do not move `apps/app/app` to `apps/app/src/app` during this cleanup. Next.js supports both shapes. A `src/` migration is allowed only with a dedicated route migration plan.

## Consequences

- MADR-035 is superseded as the final target. Its `tools/*` move is now treated as an intermediate cleanup state, not the target architecture.
- `tools/docs`, `tools/email`, `tools/storybook`, and `tools/studio` should move back to `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio` if they remain runnable package surfaces.
- Root scripts must distinguish product builds from all-app builds:
  - `build` or `build:product` for `apps/app` and `apps/web`;
  - explicit `build:docs`, `build:email`, `build:storybook`, and `dev:studio`;
  - `build:all` only when every active app has its env satisfied.
- Every app package needs a README with role, owner, env, build command, deploy status, and whether it is production, dev-only, or documentation-only.
- Shared code must stay in `packages/*`; apps should not import other apps.
- App packages should remain package-graph endpoints except rare test harness exceptions.
- Build failures in `apps/web` or docs are not deletion signals. They are env/build-boundary bugs.

## Alternatives Considered

- Keep only `apps/app` and `apps/web`, with docs/email/storybook/studio under `tools/*`.
  - Rejected as the final target because these are runnable app surfaces, and current next-forge/Turborepo practice supports first-class multi-app roots.
- Collapse docs/email/storybook/studio into `apps/app`.
  - Rejected because it mixes production runtime, docs, preview, and design-system QA concerns.
- Reintroduce `apps/api` immediately.
  - Rejected until a separate deploy/runtime/security reason is proven.
- Move app surfaces under nested paths such as `apps/internal/docs`.
  - Rejected because Turborepo warns against ambiguous nested workspace package globs.

## Impacted Files And Packages

- `pnpm-workspace.yaml`
- `package.json`
- `turbo.json`
- `apps/app`
- `apps/web`
- `tools/docs` -> `apps/docs`
- `tools/email` -> `apps/email`
- `tools/storybook` -> `apps/storybook`
- `tools/studio` -> `apps/studio`
- `docs/ai-workflow-os/01-architecture/monorepo-target-architecture.md`
- `docs/ai-workflow-os/08-plans/phase-minus-one-base-reset-plan.md`
- `docs/ai-workflow-os/08-plans/advanced-monorepo-directory-cleanup-plan.md`

## Validation Checklist

- [ ] Move runnable app packages from `tools/*` back to `apps/*`.
- [ ] Keep `tools/*` only for repo-only CLIs/scripts with package roots if needed.
- [ ] Update `pnpm-workspace.yaml` after the move.
- [ ] Add app READMEs for `app`, `web`, `docs`, `email`, `storybook`, and `studio`.
- [ ] Update root scripts for product-only, per-app, and all-app commands.
- [ ] Update Turbo filters and CI paths around explicit app roots.
- [ ] Verify no workspace package imports an app package.
- [ ] Run `pnpm install`.
- [ ] Run `pnpm -r list --depth -1`.
- [ ] Run `pnpm typecheck`.
- [ ] Run focused typechecks for every app package.
- [ ] Run app-specific builds with documented env or documented skips.
- [ ] Re-run `git diff --check`.
