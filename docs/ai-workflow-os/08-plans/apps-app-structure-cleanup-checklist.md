# Apps/App Structure Cleanup Checklist

Date: 2026-05-25

Scope: `apps/app` only. This is the first focused Next.js App Router cleanup pass after package/version normalization and monorepo app-surface cleanup.

Updated: 2026-05-26 for the post-reset directory segmentation phase.

## Source Evidence

- Next.js project structure docs, last checked 2026-05-25: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js Server and Client Components docs, last checked 2026-05-25: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js `use client` directive docs, last checked 2026-05-25: `https://nextjs.org/docs/app/api-reference/directives/use-client`
- React `use client` directive docs, last checked 2026-05-25: `https://react.dev/reference/rsc/use-client`
- Next.js project structure docs, rechecked 2026-05-26: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js Server and Client Components docs, rechecked 2026-05-26: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js route groups docs, rechecked 2026-05-26: `https://nextjs.org/docs/app/api-reference/file-conventions/route-groups`
- Next.js `use client` directive docs, rechecked 2026-05-26: `https://nextjs.org/docs/app/api-reference/directives/use-client`
- npm package metadata, rechecked 2026-05-26: `next@16.2.6` and `@next/eslint-plugin-next@16.2.6` are current stable `latest`; `next@16.3.0-canary.29` is canary and out of scope.
- next-forge app docs, rechecked 2026-05-26: `https://www.next-forge.com/docs/apps/app`
- Next.js 16 upgrade docs, rechecked 2026-05-26: `https://nextjs.org/docs/app/guides/upgrading/version-16`
- Next.js data security docs, rechecked 2026-05-26: `https://nextjs.org/docs/app/guides/data-security`
- Next.js CLI analyzer docs, rechecked 2026-05-26: `https://nextjs.org/docs/app/api-reference/cli/next`
- Turborepo repository structure docs, rechecked 2026-05-26: `https://turborepo.com/docs/crafting-your-repository/structuring-a-repository`
- Vercel Conformance docs, rechecked 2026-05-26: `https://vercel.com/docs/conformance`
- Blazity `next-enterprise`, rechecked 2026-05-26: `https://github.com/Blazity/next-enterprise`
- DigitalApplied Next.js 16 performance guide, rechecked 2026-05-26: `https://www.digitalapplied.com/blog/nextjs-16-performance-server-components-guide`
- IO Digital enterprise Next.js article, rechecked 2026-05-26: `https://techhub.iodigital.com/articles/nextjs-at-enterprise-level`
- Enterprise research note: [`../09-research/2026-05-26-nextjs16-enterprise-architecture-research.md`](../09-research/2026-05-26-nextjs16-enterprise-architecture-research.md)
- Enterprise MADR: [`../07-madr/MADR-050-nextjs16-enterprise-app-standards.md`](../07-madr/MADR-050-nextjs16-enterprise-app-standards.md)

Evidence summary:

- `src` is an optional application source folder, so moving `apps/app/app` to `apps/app/src/app` is not required for senior Next.js structure.
- Private `_folder` directories are a documented App Router convention for implementation details that should not participate in routing.
- Pages and layouts are Server Components by default; Client Components should be used for state, effects, event handlers, browser APIs, and custom client hooks.
- A `'use client'` file marks its dependency subtree as client-rendered, so cleanup should narrow client boundaries instead of expanding them.
- `useSearchParams` is a Client Component hook; production prerendering requires the nearest relevant Client Component subtree to sit under `Suspense`.
- next-forge's current app docs explicitly describe `apps/app` as the main application and say it is split into authenticated and unauthenticated route groups, matching this repo's retained route-group direction.
- Local Vercel skills are helper inputs only. Official Next docs, npm metadata, local installed package types, and repo MADRs override the skill if there is a conflict.
- Blazity `next-enterprise` is useful for package/tooling categories, but its current package metadata is not a Next `16.2.6` source of truth.
- Package additions are not part of R9 cleanup unless the package solves the active route segmentation problem and its playbook is updated first.

## Local Audit Snapshot

- `apps/app/app/(authenticated)` already has a route group boundary.
- Before this slice, `apps/app/app/(authenticated)/components` was a broad shared bucket with header, sidebar, settings, search, prompt, project, onboarding, and collaboration components.
- After this slice, that bucket is `apps/app/app/(authenticated)/_components`: route-neutral, private, and still intentionally marked for later breakup.
- Several route subtrees already use local component folders: `actions/components`, `applications/components`, `files/components`, `projects/[id]/components`, and `chat/[id]/components`.
- Dev/test routes still live inside the authenticated route tree: `chat/test`, `chat/test-ide`, and `chat/test-stream`.
- `apps/app/app/(unauthenticated)/_components` is now a private route-group bucket for shared auth-page implementation components.

## Current Post-Reset Snapshot

Active app routes are intentionally narrow:

- authenticated: `/`;
- unauthenticated: `/login`, `/forgot-password`, `/reset-password`, `/verify-email`;
- API: Better Auth, email check, health;
- metadata: manifest, robots, sitemap, icons, Open Graph image.

Current structure is clean enough to build, but not yet segmented enough:

- `apps/app/app/(unauthenticated)/login/page.tsx` is now a thin Server Component that renders a `Suspense` boundary around the route-local Client Component.
- `apps/app/app/(unauthenticated)/login/_components/login-form.tsx` is now a small Client Component that composes the route shell and selects the active step.
- `apps/app/app/(unauthenticated)/login/_hooks/use-login-flow.ts` owns the route-local login state machine, form instances, transitions, cooldown timer, auth calls, and navigation.
- `apps/app/app/(unauthenticated)/login/_components/email-step.tsx`, `password-step.tsx`, and `verify-step.tsx` own the individual screen markup.
- `apps/app/app/(unauthenticated)/login/_components/social-buttons.tsx` owns OAuth button state and Better Auth social sign-in calls.
- `apps/app/app/(unauthenticated)/_components/forms/password-strength.tsx` owns shared auth password strength presentation.
- `apps/app/app/(unauthenticated)/_lib/callback-url.ts` owns safe relative callback URL handling and same-origin absolute callback conversion for Better Auth calls.
- `apps/app/app/(unauthenticated)/login/_lib/auth-error-messages.ts` owns pure Better Auth error-code mapping.
- R11 deleted the login email-existence helper and `/api/auth/check-email` endpoint; do not reintroduce email preflight probing.
- `apps/app/app/(unauthenticated)/login/_schemas/auth.ts` owns route-local Zod form schemas and inferred form types.
- `apps/app/app/(unauthenticated)/login/_types/login.ts` owns route-local auth mode/step support types.
- `apps/app/components/auth/forms/*` was removed in R17 after route-owned unauthenticated forms were established.
- `apps/app/app/(authenticated)/_components/sidebar/*` has a clear shell owner and should stay there for now.
- `apps/app/app/(authenticated)/_components/app-shell/*` owns authenticated shell composition.
- `apps/app/app/(authenticated)/_components/dashboard/*` owns root dashboard content.
- `apps/app/app/(authenticated)/page.tsx` is a thin Server Component for the root dashboard route.
- `apps/app/lib/dal.ts` is server/session data access and should remain a small server-side boundary.
- `apps/app/components/icons.tsx` is app-shared icon glue and can stay global until the design-system/icon strategy is revisited.

## Phase -1.8 First Slice

Rename the authenticated route-group component bucket to a private App Router implementation folder:

```text
apps/app/app/(authenticated)/components
apps/app/app/(authenticated)/_components
```

This does not change URLs. It only clarifies that these files are shared implementation details for the authenticated route group, while preserving existing deeper route-local `components` folders.

Completed 2026-05-25: moved 71 files into `apps/app/app/(authenticated)/_components`, updated imports, preserved route-local `components` folders, and verified the app typecheck.

Second slice completed 2026-05-25: moved 3 files into `apps/app/app/(unauthenticated)/_components`, updated imports, and verified the app typecheck.

## Checklist

- [x] Refresh official Next.js and React docs for project structure and client boundaries.
- [x] Re-check MADR-031 and correct the `src/app` assumption for current cleanup.
- [x] Audit `apps/app/app` route groups, route-local folders, and active test/demo routes.
- [x] Identify first low-risk move: `(authenticated)/components` to `(authenticated)/_components`.
- [x] Move `(authenticated)/components` to `(authenticated)/_components`.
- [x] Update imports without changing route-local `actions/components`, `applications/components`, `files/components`, `projects/[id]/components`, or `chat/[id]/components`.
- [x] Run `pnpm --filter app typecheck`.
- [x] Run `git diff --check`.
- [x] Update this checklist after verification.

## Later Apps/App Cleanup Slices

- [x] Rename `(unauthenticated)/components` to `(unauthenticated)/_components` after import audit.
- [ ] Move authenticated dev/test pages behind an explicit dev-only route group or remove them after E2E fixture strategy is documented.
- [ ] Split page-level Client Components into Server pages plus narrow Client islands where feasible.
- [ ] Move route-specific pieces out of `(authenticated)/_components` into route-local `_components` when ownership is clear.
- [ ] Audit app-level `components` for true cross-route reuse versus route leakage.
- [ ] Audit CSS/design tokens before redesign work; do not preserve Manus naming in new workflow routes.
- [ ] Add dead-code detection after route ownership cleanup settles.

## Phase R9 - Post-Auth Directory Segmentation Gate

Status: in progress.

Do not move code in this phase until the item has an owner and a validation command.

Target conventions:

- Keep `apps/app/app`; do not move to `apps/app/src/app` in this phase.
- Keep `(authenticated)` and `(unauthenticated)` route groups.
- Keep `page.tsx` files thin. If a page needs client state/effects, place that state inside a route-local client component.
- Use `_components`, `_hooks`, `_lib`, `_types`, and `_schemas` for route-group or route-private implementation details.
- Keep app-level `components/*` only for proven cross-route app reuse.
- Keep shared primitives in `@repo/design-system`, not in route folders.
- Keep server/session/data access out of Client Components.

Planned slices:

- [x] R9.0: Re-audit current `apps/app` file tree immediately before moves.
- [x] R9.1: Split `app/(unauthenticated)/login/page.tsx` into a thin page plus route-local `_components/login-form.tsx`, `_components/social-buttons.tsx`, `_components/password-strength.tsx`, `_lib/callback-url.ts`, and `_schemas/auth.ts` as needed.
- [x] R9.1b: Tighten the login split after review: move orchestration to `_hooks/use-login-flow.ts`, step markup to dedicated step components, and error/API helpers to `_lib`.
- [x] R9.2: Decide whether `components/auth/forms/*` should move under `app/(unauthenticated)/_components/forms/*` or stay global because multiple unauthenticated routes share it. Decision: move it under the unauthenticated route group because it only serves auth reset/recovery pages in the reset app.
- [x] R9.3: Confirm `forgot-password`, `reset-password`, and `verify-email` pages stay thin and move repeated auth-page shells only if duplication is meaningful. Decision: keep server `page.tsx` files thin, move repeated shell/form implementation under `app/(unauthenticated)/_components`, and keep reset/verify client logic route-local.
- [ ] R9.4: Keep authenticated sidebar under `app/(authenticated)/_components/sidebar/*`; do not move it to global components.
- [ ] R9.5: Add or adjust smoke tests only for behavior changed by the segmentation.
- [x] R9.6: Run validation after each slice: `pnpm --filter app typecheck`, `pnpm test:smoke`, default Turbopack app build when the slice changes routing/build behavior, and `git diff --check`.
- [ ] R9.7: Before adding any enterprise-template package to `apps/app`, update the app playbook with current docs, registry metadata, peer/engine compatibility, and validation commands.

R9 validation:

- [x] `pnpm --filter @repo/observability typecheck`
- [x] `pnpm --filter app typecheck`
- [x] targeted `eslint "apps/app/app/(unauthenticated)/login"`
- [x] targeted `pnpm exec eslint packages/observability apps/app/next.config.ts apps/app/instrumentation-client.ts apps/app/sentry.server.config.ts apps/app/sentry.edge.config.ts apps/app/app/error.tsx apps/app/app/global-error.tsx 'apps/app/app/(authenticated)/error.tsx'`
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build` with reset dummy env, Next `16.2.6`, and Turbopack
- [x] traced compile-only Turbopack diagnostic with `NEXT_TURBOPACK_TRACING=1`, `--experimental-build-mode compile`, and `--debug-build-paths`
- [x] `pnpm --filter app exec next build --webpack` with reset dummy env as fallback evidence
- [x] `git diff --check`

R9 build note:

- The default Turbopack build stall was fixed by the observability import-boundary cleanup captured in [`../07-madr/MADR-051-observability-boundary-for-reset-app.md`](../07-madr/MADR-051-observability-boundary-for-reset-app.md) and [`../09-research/2026-05-26-next16-auth-cleanup-build-bug-research.md`](../09-research/2026-05-26-next16-auth-cleanup-build-bug-research.md).
- Webpack still emits Sentry/OpenTelemetry dynamic dependency warnings, but the build passes and app code no longer imports `@sentry/nextjs` directly.

Next phase:

- Continue with [`apps-app-r10-reset-shell-cleanup-plan.md`](apps-app-r10-reset-shell-cleanup-plan.md).
- Route correction is captured in [`../07-madr/MADR-052-root-is-dashboard-reset-route.md`](../07-madr/MADR-052-root-is-dashboard-reset-route.md): `/` is the dashboard and `/dashboard` is removed.

Out of scope for R9:

- Redesign or Material UI pass.
- New workflow routes.
- `.flow` parser/runtime implementation.
- Vercel Sandbox migration.
- Payload/Basehub CMS decision.
- Package upgrades.
- Moving to `src/app`.
