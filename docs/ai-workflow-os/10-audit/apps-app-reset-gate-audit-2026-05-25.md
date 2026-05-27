# apps/app Reset Gate Audit - 2026-05-25

Status: Historical reset-gate audit. Route target superseded on 2026-05-26 by [`../07-madr/MADR-052-root-is-dashboard-reset-route.md`](../07-madr/MADR-052-root-is-dashboard-reset-route.md).

Current route correction:

- `apps/app/app/(authenticated)/page.tsx` is the dashboard at `/`.
- `apps/app/app/(authenticated)/dashboard/page.tsx` has been removed.
- `/dashboard` is not the active reset route.

Last updated: 2026-05-25 after smoke-test reset wiring.

## Purpose

This audit records the current `apps/app` reset state before further deletion. It does not claim every line has been manually reviewed. It records inspected inventories, local findings, and reset decisions so the app can be cleaned without losing the target architecture.

## Current Route Surface

Kept shell routes:

- `apps/app/app/(authenticated)/page.tsx`
- `apps/app/app/(authenticated)/page.tsx`
- `apps/app/app/(authenticated)/layout.tsx`
- `apps/app/app/(authenticated)/providers.tsx`
- `apps/app/app/(unauthenticated)/**`
- `apps/app/app/api/auth/[...all]/route.ts`
- `apps/app/app/api/health/route.ts`
- `apps/app/proxy.ts`

Removed route surface:

- `apps/app/app/(authenticated)/artifacts/page.tsx` - user requested no artifact page during reset.
- Stale authenticated route directories under `actions`, `applications`, `community`, `webhooks`, `chat`, `files`, `projects`, `search`, and `artifacts`.
- Reset placeholder routes `workflows`, `approvals`, and `connections`; these return only after their contracts exist.
- Legacy public routes `share`, `app-auth`, and `login/password`.
- Stale `/register` proxy and sitemap references.
- Legacy user server actions under `app/actions/users`.
- Old API routes under `avatar`, `chat`, `collaboration`, `connectors`, `files`, `gateway-token`, `ide`, `oauth-proxy`, `sandbox`, `sessions`, `trpc`, and `webhooks`.

## Current Component Surface

Keep for shell:

- `app/(authenticated)/_components/sidebar/index.tsx`
- `app/(authenticated)/_components/sidebar/nav-section.tsx`
- `app/(authenticated)/_components/sidebar/new-task-button.tsx`
- `app/(authenticated)/_components/sidebar/sidebar-footer.tsx`
- `app/(authenticated)/_components/notifications-provider.tsx`

Deleted:

- Chat prompt, demo chat, chat section, collaboration cursors/provider.
- Header/profile/credits dropdowns until billing/account shell is rebuilt.
- Project dialogs and connector panels from the old application model.
- Search modal/provider/buttons from the old app.
- Settings dialog and all settings tabs from the old app.
- Unified prompt components from the old Manus clone interface.
- Old user avatar/account components if auth shell is rebuilt from Better Auth package.

## Current State/Client Surface

Deleted:

- Chat/session/message/canvas/websocket Redux slices.
- Scheduled tasks, projects, connectors, community, file, webdev, device, meeting, mail, skill, knowledge, and browser slices.
- Old chat SSE processing, resumable streams, cache, and provider fallback code.
- Old tRPC routers until the new API boundary is defined.
- Redux provider/data loader, socket provider, tRPC provider, old app API client, old search hooks, old file utilities, and old Stripe helper wrapper.

## Current Test Surface

Removed:

- Chat, canvas, settings, votes, old E2E acceptance, and old page object tests.
- Vitest tests against old chat/SSE/tRPC/store slices once those source files are removed.

Keep/rebuild:

- Auth smoke test.
- Error/loading component tests if still valid after reset.
- Reset shell smoke tests for root dashboard and proxy auth routing.
- A new Better Auth integration smoke once the auth package is cleaned.

## Auth Audit

Keep:

- Better Auth.
- `packages/auth`.
- `apps/app/app/api/auth/[...all]/route.ts`.
- `apps/app/proxy.ts`.
- Better Auth database schema in `@repo/database` until a later auth schema audit.

Fixed in this reset phase:

- Replace direct `process.env` reads in `packages/auth/src/server.ts` and `packages/auth/src/client.ts` with a documented env boundary.

Fix later:

- Better Auth email delivery timing should be hardened with serverless `waitUntil` or equivalent.
- Add Better Auth route-level integration tests after test utilities are selected.
- Organization invite acceptance has no active reset-shell route yet.

Fixed in the Better Auth reset phase:

- Added `toNextJsHandler(auth)` for the app auth route.
- Added `nextCookies()` as the last Better Auth plugin.
- Enforced a 32+ character `BETTER_AUTH_SECRET`.
- Renamed GitHub provider envs to `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
- Kept Google/GitHub providers optional unless both credentials are configured.
- Switched proxy to Better Auth `getSessionCookie(request)` for optimistic redirects.
- Kept real protected data access behind `auth.api.getSession` in the authenticated layout.
- Made login/sign-up/social auth callback-aware for safe relative `callbackUrl` values.
- Replaced the old password reset client alias with `requestPasswordReset`.
- Removed automatic API-key creation from signup.

## Findings

| ID            | Finding                                                                                                     | Risk   | Decision                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------ |
| APP-RESET-001 | Active app shell is partially reset, but old routes/tests/API/lib code remain.                              | High   | Continue deletion-first reset.                                                 |
| APP-RESET-002 | Tests target deleted and obsolete pages.                                                                    | High   | Delete old tests, then add reset-shell tests.                                  |
| APP-RESET-003 | `app/api` exposes legacy runtime capabilities before new workflow contracts exist.                          | High   | Delete most routes; keep only auth and health. R11 removed `check-email`.      |
| APP-RESET-004 | Auth package is current but not yet senior env-clean.                                                       | Medium | Keep Better Auth, then refactor env access through T3 contracts.               |
| APP-RESET-005 | Redux store is too broad for the reset shell.                                                               | Medium | Trim store to shell only or remove Redux if no reset shell dependency remains. |
| APP-RESET-006 | `/artifacts` was added as a placeholder, but user now wants no artifact page during reset.                  | Low    | Remove route, sidebar item, tests, and nav tab.                                |
| APP-RESET-007 | `/workflows`, `/approvals`, and `/connections` were still placeholder product routes after the first reset. | Medium | Remove them and keep only `/` as the dashboard until contracts exist.          |
| APP-RESET-008 | `/register` was referenced by proxy and sitemap without an active route.                                    | Low    | Remove stale references until registration is intentionally added.             |

## Reset Checklist

- [x] Audit active shell routes.
- [x] Verify Better Auth latest package and docs.
- [x] Verify Next.js 16 project-structure and proxy docs.
- [x] Verify T3 Env docs for app/package env contract.
- [x] Remove `/artifacts` placeholder route.
- [x] Keep `/` as the dashboard route.
- [x] Remove `/dashboard` as an active reset route.
- [x] Remove `/workflows`, `/approvals`, and `/connections` placeholders.
- [x] Remove stale `/register` proxy and sitemap references.
- [x] Remove stale authenticated route folders.
- [x] Remove legacy app API routes not needed for auth shell.
- [x] Delete old chat/search/settings/project/unified-prompt components.
- [x] Delete obsolete tests and page objects.
- [x] Trim or remove Redux store.
- [x] Refactor Better Auth env access through T3 Env.
- [x] Regenerate Next type files and run app typecheck.
- [x] Add minimal shell/proxy smoke tests.
- [ ] Add Better Auth route integration smoke after auth refactor.

## Validation Gates

After each deletion slice:

- Run `rg` for deleted route names and old imports.
- Run `pnpm --filter app typecheck` with required minimum env.
- Run `pnpm --filter @repo/auth typecheck` with required minimum env.
- Run `pnpm --filter app exec next build --webpack` with required minimum env.
- Run targeted tests only after obsolete tests are removed.
- Run `test:smoke` for the app reset shell.
- Run `git diff --check`.

Known current validation issue:

- Default `next build` on Next 16.2.6 passes with Turbopack when run outside the command sandbox.
- The previous apparent Turbopack stall was a local command-sandbox restriction. The longer in-sandbox run failed with `Operation not permitted (os error 1)` while Turbopack/PostCSS tried to create a process and bind a local port.
- `next build --webpack` passes and remains a diagnostic fallback only.
- Build warnings remain from Sentry/OpenTelemetry dynamic instrumentation imports.
- BetterStack build warning spam is removed when BetterStack/Logtail env is absent.
- Active app CSP no longer includes E2B iframe/connect allowances.

## Validation Results

- `pnpm --filter app typecheck`: passed with reset dummy env.
- `pnpm --filter @repo/auth typecheck`: passed with reset dummy env.
- `pnpm --filter @repo/next-config typecheck`: passed.
- `pnpm --filter @repo/observability typecheck`: passed.
- `pnpm --filter @repo/auth typecheck`: passed after Better Auth reset cleanup.
- `pnpm --filter app typecheck`: passed after Better Auth reset cleanup.
- `./node_modules/.bin/vitest run --project app`: passed, 2 files and 5 tests.
- `pnpm test:smoke`: passed through Node `22.22.1` and Corepack pnpm `11.3.0`, 2 files and 5 tests.
- `next build --webpack`: passed and produced only the dashboard/auth reset route set.
- `pnpm --filter app build`: passed with default Turbopack outside the command sandbox and produced only the dashboard/auth reset route set. The clean rerun used Node `22.22.1`, Corepack pnpm `11.3.0`, reset dummy env, and a 32+ character dummy Better Auth secret.
- Stale active app/auth reference scan: passed with no matches for Manus, artifacts routes, Clerk, Liveblocks, E2B, deleted placeholder app routes, or removed app-side store/tRPC/socket/chat imports.
- Active app/config E2B and old package scan: passed for code paths.
- `git diff --check`: passed.
