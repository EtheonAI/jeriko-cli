# Advanced Monorepo App Ownership Research

Date: 2026-05-25

Purpose: correct the cleanup direction after package normalization. The target is an advanced multi-app monorepo, not a single-app repo with useful surfaces removed.

## Sources Checked

- Next.js project structure: `https://nextjs.org/docs/app/getting-started/project-structure`
- Turborepo structuring a repository: `https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository`
- Turborepo package types: `https://turborepo.dev/docs/core-concepts/package-types`
- Vercel monorepos: `https://vercel.com/docs/monorepos`
- pnpm workspaces: `https://pnpm.io/workspaces`
- next-forge docs and repository:
  - `https://www.next-forge.com/docs`
  - `https://github.com/vercel/next-forge`
- T3 Env package page and npm registry:
  - `https://www.npmjs.com/package/@t3-oss/env-nextjs?activeTab=versions`
  - `npm view @t3-oss/env-nextjs version dist-tags versions --json --registry https://registry.npmjs.org --prefer-online`

## Source Findings

### Turborepo

Turborepo recommends splitting workspace packages into `apps/` for applications and services, and `packages/` for libraries and tooling. It also warns against nested package globs like `apps/**` and `packages/**`; use explicit one-level package roots or group globs without package files at the grouping level.

Turborepo distinguishes:

- application packages: deployable or runnable endpoints, commonly in `apps`;
- library packages: shared code that supports applications and is not independently deployed.

Application packages should usually be graph endpoints, not dependencies of other workspace packages.

### Vercel

Vercel monorepos support multiple projects in one repo. Each deployable directory can be imported as a separate Vercel Project with its own root directory. Vercel can skip unaffected projects based on changed files, internal dependencies, and lockfile impact.

Implication: keeping `apps/app`, `apps/web`, docs, Storybook, email preview, and studio is compatible with Vercel monorepo deployment. The cleanup goal is correct project roots and build filters, not deleting apps.

### pnpm

pnpm workspaces require `pnpm-workspace.yaml` and support the `workspace:` protocol. `workspace:*` avoids accidentally resolving an internal package name from the registry.

Implication: all internal cross-package imports should use `workspace:*` in package manifests. App packages should consume packages; packages should not consume app packages.

### Next.js

Next.js App Router supports route groups, private folders, and safe colocation. Private folders such as `_components` and `_lib` are useful for route-local implementation details. `src/` is optional, not mandatory.

Implication: directory cleanup should standardize route-local folders inside each Next app. It does not require moving `apps/app/app` to `apps/app/src/app` during this reset.

### next-forge

next-forge is a current production-grade Turborepo template for Next.js apps. Its documented/reference structure keeps multiple app surfaces:

- `apps/web`
- `apps/app`
- `apps/api`
- `apps/docs`
- `apps/email`
- `apps/storybook`

and shared packages under `packages/*`.

Implication: this repo's old multi-app shape was directionally correct. The problem was unclear ownership, stale services, and dirty code, not the existence of multiple apps.

### T3 Env Latest Check

The official npm registry command reports `@t3-oss/env-nextjs` latest dist-tag as `0.13.10`. The versions list also ends at `0.13.10`.

Implication: keep `@t3-oss/env-nextjs@0.13.10` until exact npm registry resolution proves a newer version exists. The pnpm outdated report that claims `0.13.11` is a metadata conflict, not enough evidence to change the manifest.

## Corrected Target

Keep multiple app packages:

```text
apps/
  app          authenticated workflow OS app
  web          marketing/content site
  docs         documentation site
  email        email template preview/build app
  storybook    design-system workshop
  studio       database/admin studio

packages/
  auth
  database
  design-system
  ai
  workflow-kernel
  workflow-runtime
  sandbox
  tools
  contracts
  ...

legacy/
  manus-clone
  deactivated-apps/api
```

`apps/api` remains deactivated for now because a separate API deploy boundary has not been proven. Reintroduce it only when there is a real deploy reason: separate runtime, webhook isolation, public API boundary, or independent scaling.

## Cleanup Meaning

Directory cleanup means:

- keep app packages;
- give every app a clear owner and build role;
- keep app packages as graph endpoints;
- move shared logic out of apps into packages;
- remove service/proxy residue;
- standardize route-local folders;
- add package READMEs/ownership labels;
- make root scripts explicit: all apps, product app only, docs only, dev-only surfaces.

Directory cleanup does not mean:

- delete `apps/web`;
- delete docs;
- collapse every app into `apps/app`;
- move everything to `src/app` without a route migration plan;
- treat Storybook/email/studio as trash because they are not runtime product features.

## Build Boundary Implication

The current `pnpm build` blocker is not a reason to remove `apps/web`. It means build scripts and env boundaries are wrong.

Required fix:

- `build` should represent the intended active deploy matrix.
- `build:app`, `build:web`, `build:docs`, `build:storybook`, `build:email`, and `build:studio` should be explicit.
- Apps with optional integrations must either degrade gracefully or document required env.
- CI should build each app with the env it actually requires.

## Recommended Next Phase

Phase -1.7: Advanced monorepo directory cleanup.

Checklist:

- [ ] Move `tools/docs`, `tools/email`, `tools/storybook`, and `tools/studio` back under `apps/*` if they are runnable app packages.
- [ ] Keep `apps/app` and `apps/web`.
- [ ] Keep `legacy/deactivated-apps/api` deactivated unless a separate API deploy boundary is approved.
- [ ] Add app-level READMEs: role, owner, env, build command, deploy target.
- [ ] Add package-level READMEs for shared package ownership.
- [ ] Update root scripts to make app-specific and all-app builds explicit.
- [ ] Update Turbo filters so CI can build changed app surfaces without deleting others.
- [ ] Standardize route-local `_components`, `_hooks`, `_lib`, `_actions`, `_types` in each app.
- [ ] Run typecheck after each directory move.
