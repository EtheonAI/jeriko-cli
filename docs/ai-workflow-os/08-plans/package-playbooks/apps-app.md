# Apps/App Playbook

Date: 2026-05-25

Updated: 2026-05-26 for Next.js component coding style, post-reset build status, and enterprise architecture research.

Owner role: main authenticated product app

Status: keep shell, reset product architecture

Priority: P0

## Verdict

Do not keep building the new workflow platform on top of the current `apps/app` internals as-is.

Do not delete the whole app and start from a blank Next.js project either.

Use the current app as a theme/reference shell and salvage selected components, while rebuilding the product architecture around a small, clean workflow app skeleton.

## Why

The app currently contains valuable UI/product work:

- authenticated app shell;
- sidebar/navigation structure;
- chat route and message rendering concepts;
- prompt/input components;
- file-preview and canvas ideas;
- settings/dialog patterns;
- Better Auth integration;
- database/auth/payment/search/storage package wiring.

But the app is not a clean foundation for the new platform:

- many route trees still reflect the old Manus clone;
- E2B/sandbox naming and service URLs leak through UI, env, API routes, and CSP;
- optional integrations were blocking build at import time;
- client boundaries are too broad;
- route-specific code is still mixed into shared route-group buckets;
- dev/test pages live inside authenticated product routes;
- Redux/store slices include many old product concepts;
- API routes still expose old sandbox/session/media/webdev surfaces;
- search/email/agentmail provider code had to be made lazy to build cleanly;
- the earlier default Turbopack hang is resolved for the reset shell after the authenticated route boundary and auth flow cleanup; full root build is still not proven.

The clean path is a skeleton reset, not a blind rewrite.

## Sources Checked

| Source                                                                              | Claim Used                                                                                                                                                  | Checked Date |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `https://github.com/vercel/next-forge/tree/main/apps/app`                           | next-forge app surface is small and explicit: app folder, env, proxy, config, instrumentation, tests, scripts, and app-owned files.                         | 2026-05-25   |
| `https://www.next-forge.com/docs/structure`                                         | Each app should be self-contained and independently deployable; app env composes package env from dependencies; packages isolate shared code.               | 2026-05-25   |
| `https://www.next-forge.com/docs/setup/env`                                         | Optional integrations should gracefully skip when not configured; core infrastructure is the real minimum setup.                                            | 2026-05-25   |
| `https://vercel.com/changelog/next-forge-6`                                         | next-forge 6 emphasizes graceful degradation; optional integrations should not throw when env vars are missing.                                             | 2026-05-25   |
| `https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config`   | `force-dynamic` is valid when a segment must be request-time rendered; route segment config is the correct boundary-level control.                          | 2026-05-25   |
| `https://nextjs.org/docs/app/guides/upgrading/version-16`                           | Next 16 keeps Turbopack as the default build path and changes key framework conventions that app code must follow.                                          | 2026-05-26   |
| `https://nextjs.org/docs/app/getting-started/project-structure`                     | `src` is optional; private folders and route groups are valid App Router organization tools.                                                                | 2026-05-26   |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components`          | Pages/layouts stay server-first; Client Components should be narrow interactive islands.                                                                    | 2026-05-26   |
| `https://nextjs.org/docs/app/guides/data-security`                                  | Server-only modules, DAL/DTO boundaries, and explicit auth checks are the correct data-security posture.                                                    | 2026-05-26   |
| `https://nextjs.org/docs/app/api-reference/cli/next`                                | `next experimental-analyze` is the default app analysis path for this Next 16 app.                                                                          | 2026-05-26   |
| `https://turborepo.com/docs/crafting-your-repository/structuring-a-repository`      | Keep a flat monorepo with `apps/*` and `packages/*`; avoid nested workspaces.                                                                               | 2026-05-26   |
| `https://github.com/Blazity/next-enterprise`                                        | Useful enterprise package/tooling reference, but current repo metadata is Next 15 based and must not be copied blindly.                                     | 2026-05-26   |
| `https://www.digitalapplied.com/blog/nextjs-16-performance-server-components-guide` | Useful high-level RSC/performance support; official Next docs decide exact caching/analyzer APIs.                                                           | 2026-05-26   |
| `https://techhub.iodigital.com/articles/nextjs-at-enterprise-level`                 | Supports governance, observability, security, CI/CD, and performance standards for enterprise Next apps.                                                    | 2026-05-26   |
| `https://www.blazity.com/resources`                                                 | Useful source for Blazity performance/governance resources and the 2025 Next.js performance guide.                                                          | 2026-05-26   |
| `~/Downloads/The Expert Guide to Next.js Performance Optimization [2025] (1).pdf`   | Useful route performance checklist: dynamic imports, Suspense, image/font/script handling, rendering strategy, budgets, dependency review, and measurement. | 2026-05-26   |

Enterprise research trail:

- [`../../09-research/2026-05-26-nextjs16-enterprise-architecture-research.md`](../../09-research/2026-05-26-nextjs16-enterprise-architecture-research.md)
- [`../../09-research/2026-05-26-blazity-next-enterprise-governance-performance-followup.md`](../../09-research/2026-05-26-blazity-next-enterprise-governance-performance-followup.md)
- [`../../09-research/2026-05-26-r17-authenticated-shell-route-structure-research.md`](../../09-research/2026-05-26-r17-authenticated-shell-route-structure-research.md)
- [`../../07-madr/MADR-050-nextjs16-enterprise-app-standards.md`](../../07-madr/MADR-050-nextjs16-enterprise-app-standards.md)
- [`../../07-madr/MADR-059-blazity-governance-performance-practices-as-gated-standards.md`](../../07-madr/MADR-059-blazity-governance-performance-practices-as-gated-standards.md)
- [`../../07-madr/MADR-060-r17-authenticated-root-shell-reset.md`](../../07-madr/MADR-060-r17-authenticated-root-shell-reset.md)

## Current Build Evidence

Verified with Node `22.22.1` and pnpm `11.3.0`.

Passing:

- `pnpm --filter @repo/agentmail typecheck`
- `pnpm --filter @repo/search typecheck`
- `pnpm --filter @repo/email typecheck`
- `pnpm --filter app typecheck`
- `pnpm --filter web typecheck`
- `pnpm --filter app build` on Next `16.2.6` with Turbopack and minimum dummy app env after the R17 authenticated shell cleanup.
- `pnpm test:smoke` after R18: 4 files and 15 tests passed.
- Targeted ESLint over R18 changed `apps/app` support files passed.
- `next build --webpack --debug` from `apps/app` with minimum dummy app env:
  - `DATABASE_URL`
  - `STRIPE_SECRET_KEY`
  - `BETTER_AUTH_SECRET`
  - app/web/docs public URLs

Not passing / not proven:

- Full root `pnpm build` still needs a fresh post-reset run across active app surfaces.
- Targeted lint is being restored route by route; do not claim root lint is clean yet.
- Live Resend forgot/reset email delivery is not proven without real Resend credentials, verified sender/domain, DB user, Better Auth token, and inbox/capture assertion.

## Dynamic Rendering Decision

`apps/app/app/(authenticated)/layout.tsx` is correctly marked:

```ts
export const dynamic = "force-dynamic";
```

Reason:

- the authenticated layout reads session data through `getSession()`;
- `getSession()` depends on request headers/cookies;
- the layout also can run security and feature-flag checks;
- the build proved authenticated routes failed static generation with `headers` usage before this boundary was marked dynamic;
- `/webhooks` also tried to call Svix at prerender time before the authenticated group was made request-time rendered.

This is not a permanent excuse to make everything dynamic. It is correct for the current authenticated shell. During the skeleton reset, keep only routes that actually require request-time auth dynamic. Public routes should stay static where possible.

## Keep

Keep and refactor:

- `apps/app` as the main authenticated app surface.
- Better Auth, but clean direct `process.env` use inside auth package later.
- Root `env.ts` pattern with T3 Env.
- `proxy.ts` auth redirect pattern, but replace direct `process.env` with the app env contract.
- authenticated layout concept: sidebar + header + providers + settings.
- sidebar menu/component structure as design reference.
- chat message rendering concepts.
- prompt/input small components after ownership audit.
- file-preview/canvas ideas as reference for artifact rendering.
- package-based auth/database/payments/search/storage/security boundaries.

## Rebuild

Rebuild as clean workflow surfaces:

- workflow dashboard;
- workflow detail/run timeline;
- `.flow` editor/preview;
- approvals inbox;
- artifacts/file renderer;
- connections/tools page;
- settings/billing/security pages;
- chat-to-workflow creation surface.

These should be new route-local folders, not patched into old Manus routes.

## Delete Or Gate

Gate or delete after import audit:

- `chat/test`, `chat/test-ide`, `chat/test-stream` from product routes;
- old E2B names, hooks, routes, CSP entries, and public env names;
- old service URL env keys when replaced by package/runtime adapters;
- unused Redux slices from old Manus concepts;
- old webdev/media/session sandbox routes that do not fit the new workflow architecture;
- optional integrations not required for MVP.

## Directory Target

Target shape for new product work:

```text
apps/app/app/
  (authenticated)/
    _components/
      app-shell/
      sidebar/
      header/
    workflows/
      _components/
      _actions/
      _hooks/
      _lib/
      page.tsx
    workflows/[id]/
      _components/
      _actions/
      _lib/
      page.tsx
    approvals/
    artifacts/
    connections/
    settings/
  (unauthenticated)/
    _components/
    login/
    verify-email/
  api/
    auth/
    trpc/
    webhooks/
```

Rules:

- route-owned UI stays route-local;
- shared primitives live in `packages/design-system`;
- use current `@repo/design-system` primitives before creating local controls;
- route-local wrappers should compose design-system primitives and exist only for route-specific semantics;
- use `@repo/*` only for workspace packages;
- use `@/*` for app-owned imports crossing route/app/shared boundaries;
- before adding or keeping provider/config/integration behavior in `apps/app`, identify the owning package and repair that package first;
- workflow/chat UI must reconnect by durable `runId` and event cursor; browser refresh/tab close must not cancel a run;
- app route handlers must not be the only source of truth for long-running workflow execution;
- `apps/app/next.config.ts` composes package-owned config contributors only; package internals such as `@repo/feature-flags/lib/*` are forbidden from app imports;
- do not import provider SDK internals from `apps/app` when a workspace package owns that provider; auth goes through `@repo/auth/*`, email through `@repo/email`, payments through `@repo/payments`, observability through `@repo/observability`, and so on;
- if app code needs a provider-specific framework adapter, add an app-facing export to the owning package instead of importing the provider directly from the app;
- prefer short relative imports only inside tightly colocated route folders;
- workflow compiler/runtime logic does not live inside `apps/app`;
- optional integrations must lazy-load provider SDKs;
- no package should require optional provider secrets during app build.
- package candidates from enterprise starter repos require a playbook decision before installation.
- `apps/app` analysis uses `next experimental-analyze` before package analyzers.
- future component/e2e/observability packages are phase-gated, not installed during skeleton reset.
- Blazity-style governance categories are useful, but this repo already uses Renovate, dependency-cruiser, Changesets, T3 Env, Storybook, LHCI config, and a design-system package. Reuse or repair those first.
- Do not add `patch-package`, semantic-release, madge, Playwright, or new observability packages during app shell cleanup unless a dedicated MADR proves the need.
- Before rebuilding chat/workflow UI, satisfy [`resumable-workflow-runs-checklist.md`](../resumable-workflow-runs-checklist.md).
- Every app route cleanup should include a performance pass: LCP asset, client boundary, image/font/script behavior, Suspense/loading stability, rendering/caching strategy, and dependency impact.

## Component Coding Style

Source-backed details are in [`../../09-research/2026-05-26-nextjs-component-coding-style.md`](../../09-research/2026-05-26-nextjs-component-coding-style.md).

Rules for app route code:

- `page.tsx` files stay thin Server Components by default.
- Use `Suspense` at the page/layout boundary when a Client Component uses `useSearchParams`.
- Client Components should be small islands for state, events, effects, custom hooks, and browser-only behavior.
- Move client orchestration into route-local `_hooks/*`.
- Move pure parsing, error mapping, DTO shaping, and callback validation into route-local `_lib/*`.
- Move Zod schemas and inferred types into `_schemas/*`.
- Move route-only support types into `_types/*`.
- Keep step/screen JSX in small `_components/*` files.
- Do not use factories for ordinary React components or forms. Use adapter/factory patterns only for provider selection in runtime packages.

Current login verdict:

- `login/page.tsx` is now clean enough as a thin Server page.
- `login/_components/login-form.tsx` is now clean enough as a Client shell and step selector.
- The login state machine now lives in `login/_hooks/use-login-flow.ts`.
- Step markup now lives in `email-step.tsx`, `password-step.tsx`, and `verify-step.tsx`.
- Pure error mapping and route-local API helpers now live in `login/_lib/*`.

## Next Steps

1. Keep the current `force-dynamic` boundary for the authenticated route group until route-specific request data is re-audited.
2. Keep app-level `apps/app/components` limited to intentionally shared app assets such as social auth icons; route-owned auth forms stay under `(unauthenticated)`.
3. Complete R17 authenticated shell/sidebar cleanup and deletion gate.
4. Complete R18 app support-file cleanup.
5. Audit `apps/app/package.json` dependencies/imports and remove app dependencies that no active route or support file uses.
6. Create a deletion/gating list for remaining old route APIs, store slices, env keys, CSP entries, and product-test leftovers outside the active App Router surface.
7. Build the clean workflow app skeleton inside `apps/app` route groups after the shell and support files are stable.
8. Move only proven-good UI pieces into the new skeleton.
9. Add package candidates only when their phase starts and the package playbook proves need, version, peers, and validation.
10. Delete old route/API trees after their replacement surface exists and import usage is clean.

## Non-Goals

- Do not redesign UI yet.
- Do not implement `.flow` yet.
- Do not migrate Vercel Sandbox yet.
- Do not install Payload yet.
- Do not preserve old Manus route/API surfaces just because they compile.
