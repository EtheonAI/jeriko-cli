# apps/app Reset Phases Checklist

Status: Root dashboard reset shell implemented; shell/auth validation passed with webpack and default Turbopack builds before the R10 route correction.

## Reset Rule

Treat `apps/app` as a clean shell. Do not keep old Manus clone code unless it is required by the reset shell and has a documented owner.

## Phase R0 - Documented Decision Gate

- [x] Audit current app routes, APIs, components, state, and tests.
- [x] Research next-forge app shape.
- [x] Research Next.js 16 project structure and proxy.
- [x] Research Better Auth latest Next.js guidance.
- [x] Research T3 Env current Next.js guidance.
- [x] Record MADR-044.
- [x] Research and record MADR-045 for auth route groups and dashboard-only reset.

## Phase R1 - Route Shell Reset

- [x] Keep authenticated root `/` as the dashboard.
- [x] Remove `/dashboard` as the primary reset route.
- [x] Remove `/workflows` placeholder until workflow contracts exist.
- [x] Remove `/approvals` placeholder until approval contracts exist.
- [x] Remove `/connections` placeholder until tool connection contracts exist.
- [x] Remove `/artifacts`.
- [x] Remove stale authenticated route directories.
- [x] Confirm no sidebar links point to removed routes.
- [x] Confirm `robots.ts` references only active/reset routes.

## Phase R2 - Component Reset

- [x] Keep only shell sidebar/provider components needed by current layout.
- [x] Delete chat prompt/demo chat/collaboration components.
- [x] Delete old search components.
- [x] Delete old settings components.
- [x] Delete old project/dialog components.
- [x] Delete unified prompt components.
- [ ] Rebuild future components route-locally when product modules are introduced.

## Phase R3 - API Reset

Keep:

- [x] `app/api/auth/[...all]/route.ts`
- [x] Delete `app/api/auth/check-email/route.ts`; R11 replaced the email-existence preflight with explicit sign-in/sign-up mode.
- [x] `app/api/health/route.ts`

Delete or rebuild later:

- [x] `app/api/chat/**`
- [x] `app/api/avatar/upload`
- [x] `app/api/collaboration/auth`
- [x] `app/api/connectors/**`
- [x] `app/api/files/upload`
- [x] `app/api/gateway-token`
- [x] `app/api/ide`
- [x] `app/api/oauth-proxy`
- [x] `app/api/sandbox/**`
- [x] `app/api/sessions/**`
- [x] `app/api/trpc/**`
- [x] `app/api/webhooks/agentmail`
- [x] `app/api/webhooks/stripe`

## Phase R4 - State and Data Reset

- [x] Remove old chat/SSE/cache libs.
- [x] Remove old tRPC routers if no new contract is approved.
- [x] Remove old Redux slices not required by the reset shell.
- [x] Decide whether sidebar still needs Redux.
- [x] If not needed, remove Redux from app shell and dependencies.
- [ ] Keep data access through server components/actions/routes by default.

## Phase R5 - Auth and Env Cleanup

- [x] Keep Better Auth and auth route.
- [x] Verify no active Clerk dependency remains.
- [x] Move Better Auth direct env reads into typed env/keys boundary.
- [x] Decide whether to add `nextCookies()` to Better Auth plugin chain.
- [x] Keep OAuth provider env optional during reset.
- [x] Refactor login/signup/social/password reset against current Better Auth docs.
- [x] Remove default API key creation hook if API keys are removed from reset shell.

## Phase R6 - Test Reset

- [x] Delete obsolete chat/canvas/settings/votes E2E tests.
- [x] Delete obsolete chat/SSE/tRPC/unit tests.
- [x] Add shell smoke tests for root dashboard and proxy auth routing.
- [x] Add auth proxy smoke test.
- [x] Run focused tests only after obsolete tests are removed.
- [ ] Add Better Auth route integration smoke after the Better Auth refactor.

## Phase R7 - Validation

- [x] Remove `.next` generated output or regenerate route types.
- [x] Run `rg` for deleted route names.
- [x] Run `pnpm --filter app typecheck`.
- [x] Run `pnpm --filter @repo/auth typecheck`.
- [x] Run `pnpm --filter app exec next build --webpack` as diagnostic fallback.
- [x] Run default `pnpm --filter app build` with Turbopack outside command sandbox.
- [x] Run `git diff --check`.
- [x] Run stale active app scan for deleted dashboard placeholder routes.
- [x] Run app smoke tests.
- [x] Update audit with remaining blockers.

Validated on 2026-05-25 with reset dummy env. Default `next build` passes with Turbopack when run outside the command sandbox; the in-sandbox failure was `Operation not permitted` while Turbopack/PostCSS tried to create a process and bind a local port.

## Phase R8 - Shared Next Config Reset

- [x] Remove E2B CSP connect/frame allowances from active app config.
- [x] Remove broad WebSocket CSP allowances until realtime has a contract.
- [x] Keep production CSP free of `unsafe-eval`.
- [x] Remove unused experimental `optimizePackageImports`.
- [x] Trim `transpilePackages` to active reset-shell workspace packages.
- [x] Trim `serverExternalPackages` to active server/native dependencies.
- [x] Gate BetterStack logging wrapper on configured BetterStack/Logtail env.
- [x] Preserve existing transpile packages when applying Sentry config.
- [x] Run next-config, observability, and app typechecks.
- [x] Run default Turbopack app build.

## Phase R9 - App Directory Segmentation

Reference checklist: [`apps-app-structure-cleanup-checklist.md`](./apps-app-structure-cleanup-checklist.md)

- [x] Confirm Better Auth reset baseline is documented and validated.
- [x] Recheck current Next.js project-structure, route-group, Server/Client Component, and `use client` docs.
- [x] Document the post-auth segmentation gate before moving files.
- [x] Re-audit the current `apps/app` file tree immediately before moves.
- [x] Split the login client page into a thin page plus route-local private modules.
- [ ] Rehome app-level auth form components only after ownership is clear.
- [ ] Keep sidebar/dashboard shell route-local unless reuse proves otherwise.
- [x] Validate R9.1 with app typecheck, smoke tests, and app production build.

## Do Not Reintroduce Yet

- Artifact viewer route.
- Chat route.
- File manager route.
- Sandbox browser route.
- Project route.
- Workflow route.
- Approval route.
- Connection route.
- Settings modal.
- Search modal.
- tRPC routers.
- Redux store breadth.

These concepts can return only as new workflow-native modules with specs.
