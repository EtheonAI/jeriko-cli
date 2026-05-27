# Prediction Market Architecture Reference

Date researched: 2026-05-23

Reference repo: `https://github.com/kuestcom/prediction-market`

Purpose: inspect a cleaner modern Next.js codebase for directory discipline, page/component segmentation, CSS/tooling posture, and reset/refactor lessons for AI Workflow OS.

## Research Verdict

Use `kuestcom/prediction-market` as a structural reference, not as product/domain code.

The useful lesson is its discipline:

- one primary Next.js application boundary under `src`;
- route groups with route-local `_components`, `_actions`, `_hooks`, `_lib`, `_providers`, `_types`, and `_utils`;
- shared reusable UI in `src/components/ui`;
- domain/data/server code under `src/lib`;
- database code grouped under `src/lib/db`;
- tests in a visible top-level `tests` folder;
- dead-code tooling through `knip.config.ts`;
- modern Next/React family versions.

This is the kind of shape Jeriko should move toward during the reset. Jeriko should not copy the prediction-market domain, Web3 stack, trading flows, routes, or business assumptions.

## Source Evidence

### GitHub Repository Page

Source: `https://github.com/kuestcom/prediction-market`

Observed on 2026-05-23:

- public repository;
- top-level source folders include `.github`, `docs`, `infra`, `public`, `scripts`, `src`, and `tests`;
- top-level config files include `components.json`, `eslint.config.mjs`, `knip.config.ts`, `next.config.ts`, `playwright.config.ts`, `tsconfig.json`, `vercel.json`, and `vitest.config.ts`;
- repository page identifies the stack as a Next.js/TypeScript app.

### Git Tree Snapshot

Source: GitHub API tree fetched locally:

```text
https://api.github.com/repos/kuestcom/prediction-market/git/trees/main?recursive=1
```

Observed tree snapshot:

| Path                          | Entry count including children |
| ----------------------------- | -----------------------------: |
| repository tree               |                          1,808 |
| `src`                         |                          1,097 |
| `src/app`                     |                            740 |
| `src/app/[locale]`            |                            619 |
| `src/app/[locale]/(platform)` |                            452 |
| `src/components`              |                             60 |
| `src/components/ui`           |                             25 |
| `src/lib`                     |                            236 |
| `src/lib/db`                  |                             78 |
| `tests`                       |                            153 |
| `docs`                        |                            140 |
| `infra`                       |                             74 |

This proves the repo is not a tiny sample app. It is a full application with a centralized source boundary and deliberate route-level organization.

### Representative Route Segmentation

Observed route-local folders under `src/app/[locale]/(platform)` include:

```text
src/app/[locale]/(platform)/(home)/_components
src/app/[locale]/(platform)/(home)/_utils
src/app/[locale]/(platform)/_actions
src/app/[locale]/(platform)/_components
src/app/[locale]/(platform)/_lib
src/app/[locale]/(platform)/_providers
src/app/[locale]/(platform)/event/[slug]/_actions
src/app/[locale]/(platform)/event/[slug]/_components
src/app/[locale]/(platform)/event/[slug]/_hooks
src/app/[locale]/(platform)/event/[slug]/_types
src/app/[locale]/(platform)/event/[slug]/_utils
src/app/[locale]/(platform)/portfolio/_actions
src/app/[locale]/(platform)/portfolio/_components
src/app/[locale]/(platform)/portfolio/_hooks
src/app/[locale]/(platform)/portfolio/_types
src/app/[locale]/(platform)/profile/_components
src/app/[locale]/(platform)/profile/_hooks
src/app/[locale]/(platform)/profile/_types
src/app/[locale]/(platform)/settings/_actions
src/app/[locale]/(platform)/settings/_components
```

This is a strong pattern for Jeriko:

- page-specific UI stays near the route;
- route-specific mutations/actions stay near the route;
- reusable primitives stay outside route folders;
- route-local hooks/types do not pollute the shared package surface.

### Representative Page Pattern

Source inspected locally from raw GitHub:

```text
src/app/[locale]/(platform)/event/[slug]/page.tsx
```

Observed pattern:

- typed route params through Next `PageProps`;
- async `params` handling;
- `generateMetadata`;
- route data loaded through shared server functions from `src/lib`;
- page shell delegates rendering to route-local `EventContent`;
- cached content function uses `"use cache"`;
- route redirects and `notFound()` are handled close to the page.

Implementation impact for Jeriko:

- workflow pages should be thin route controllers;
- data loading should move to `lib/workflow` or route `_lib`;
- rendering should be route-local `_components`;
- route pages should not contain giant client-side controllers.

### Package And Tooling Snapshot

Source: raw `package.json` at `https://raw.githubusercontent.com/kuestcom/prediction-market/main/package.json`

Observed:

- `next`: `16.2.6`;
- `react`: `19.2.6`;
- `react-dom`: `19.2.6`;
- package manager: `npm@11.6.2`;
- Node engine: `24.x`;
- scripts include `dev`, `build`, `start`, `knip`, `lint`, `test`, `test:e2e`, and `test:unit`;
- dev tooling includes Playwright, Vitest, Knip, TypeScript, Tailwind, ESLint, and React Compiler.

This confirms the reference repo intends to sit on the current Next/React family as of this audit date. Jeriko was normalized to the same active family: `next@16.2.6`, `react@19.2.6`, and `react-dom@19.2.6`.

### Knip Configuration

Source: raw `knip.config.ts` from the reference repo.

Observed:

```ts
ignore: ["docs.config.ts", "public/**/*", "src/components/ui/**"];
```

The exact config is repo-specific, but the lesson is important: the reset should add an unused-file/dependency check with intentional ignores, not rely on human memory to find dead code forever.

## Comparison To Current Jeriko

Current Jeriko evidence gathered locally:

| Area               | Current Jeriko                                         | Reference repo lesson                                                                      |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| App count          | 7 app packages under `apps`                            | Keep a multi-app monorepo, but give each app a clear role, env contract, and build status. |
| Service count      | 16 service package files                               | Gate legacy services before they block build/test/upgrade.                                 |
| Primary app source | `apps/app/app` and `apps/app/lib`                      | Move toward a clear source boundary during reset, likely `apps/app/src`.                   |
| Route folders      | generic `components` and route-specific ad hoc folders | Use route-local `_components`, `_actions`, `_hooks`, `_lib`, `_types`.                     |
| Dead-code gate     | no `knip.config.*` found locally                       | Add Knip or equivalent after scope classification.                                         |
| Root docs          | old Manus/E2B docs mixed with new docs                 | Keep `docs/ai-workflow-os`; archive/delete old dumps after summary.                        |
| Sandbox            | E2B, Neko, WebRTC, Manus patterns deeply embedded      | Create provider-neutral sandbox contract first.                                            |
| Package versions   | mixed Next/React/AI/Zod/Drizzle family versions        | Normalize active packages by family after cleanup.                                         |

## Proposed Target Shape For AI Workflow OS

Use this as the route ownership target for the primary product app. The `src/app` path is an optional future migration, not a Phase -1 cleanup requirement:

```text
apps/app/src/app/(app)/workflows
apps/app/src/app/(app)/workflows/[workflowId]/_components
apps/app/src/app/(app)/workflows/[workflowId]/_actions
apps/app/src/app/(app)/workflows/[workflowId]/_hooks
apps/app/src/app/(app)/workflows/[workflowId]/_lib
apps/app/src/app/(app)/runs/[runId]/_components
apps/app/src/app/(app)/runs/[runId]/_actions
apps/app/src/app/(app)/runs/[runId]/_hooks
apps/app/src/app/(app)/runs/[runId]/_types
apps/app/src/app/(app)/artifacts/[artifactId]/_components
apps/app/src/app/(app)/settings/_components
apps/app/src/components/ui
apps/app/src/components/layout
apps/app/src/lib/server
apps/app/src/lib/workflow
packages/workflow
packages/workflow-runtime
packages/sandbox
packages/tools
packages/workflow-ui
```

Do not move everything in one commit. Use this as the destination shape after deletion/gating and dependency normalization.

## What To Copy

- Route-local `_components`, `_actions`, `_hooks`, `_lib`, `_types`.
- Thin pages that delegate data loading and rendering.
- A small shared UI primitive folder.
- Central domain/data functions.
- Top-level tests and visible test configs.
- Knip-style dead-code tooling.
- Current Next/React version discipline.

## What Not To Copy

- Web3/prediction-market domain model.
- Trading UI concepts.
- Wallet/provider stack.
- Package manager choice.
- Exact i18n strategy unless we decide localization is MVP.
- Domain-specific data APIs.

## Implementation Impact

Phase -1 reset should add a structural target:

- [x] Choose `apps/app` as the primary product app inside a multi-app monorepo.
- [x] Gate `apps/api` and noncritical services before package upgrades.
- [x] Keep `apps/web`, `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio` as explicit app surfaces per MADR-037.
- [ ] Add a route migration plan before any `src` boundary move for the primary app.
- [ ] Start moving new workflow routes into route-local folders, not global `components`.
- [ ] Add Knip or equivalent after cleanup, with intentional ignores.
- [ ] Keep shared UI in one clear location.
- [ ] Keep domain/workflow logic out of page files.

## Open Questions

- Should Jeriko move `apps/app/app` to `apps/app/src/app` later, after the route reset plan is approved?
- Marketing stays in `apps/web` per MADR-037; the remaining question is how to fix or isolate its CMS/BaseHub build dependency.
- Should API routes remain in the Next app or be split into service packages after service auth is fixed?
- Should localization remain in the target app architecture or be deferred?
