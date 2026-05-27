# MADR-045: Keep Auth Route Groups and Reset apps/app to a Dashboard Shell

Status: Superseded in part by [`MADR-052`](./MADR-052-root-is-dashboard-reset-route.md)

Date: 2026-05-25

## Context

The app has already been reduced from a Manus clone to a small shell, but the protected surface still exposes placeholder workflow routes: `/workflows`, `/approvals`, and `/connections`. Those names are product-correct later, but they are premature before the workflow kernel, database contracts, authorization model, and Vercel Sandbox migration are implemented.

The user asked whether `(authenticated)` and `(unauthenticated)` are a senior structure for a SaaS app and requested a bare minimum next-forge-style reset.

## Decision

Keep `apps/app/app/(authenticated)` and `apps/app/app/(unauthenticated)`.

Use those folders only as route groups for layout and auth-context separation:

- `(authenticated)` contains protected app routes and the sidebar shell.
- `(unauthenticated)` contains public auth UX routes.
- `proxy.ts` remains the fast request gate.
- The authenticated server layout remains the session safety net.
- Route handlers and packages still need their own authorization checks when they are added.

Original reset route decision, superseded by MADR-052:

- `/` redirects to `/dashboard`.
- `/dashboard` is the only active authenticated page.

Current route decision:

- `/` is the dashboard.
- `/dashboard` is not part of the reset app.

Remove placeholder protected pages until their contracts exist:

- `/workflows`
- `/approvals`
- `/connections`

Remove stale `/register` references until a registration route is intentionally reintroduced.

## Consequences

Positive:

- Matches next-forge's documented route-group split.
- Keeps the Next.js App Router URL clean because route-group names do not appear in paths.
- Keeps the reset honest: there is no fake workflow, approval, or connection page before the backend exists.
- Makes the next validation surface small enough to fix Turbopack, tests, and shared `next-config` without product noise.

Negative:

- Future workflow UI work must reintroduce routes deliberately.
- Existing planning docs still mention future `/workflows`, `/approvals`, and `/connections`; those are roadmap routes, not active reset routes.

## Alternatives Considered

### Rename route groups to `(app)` and `(auth)`

Rejected for now. The names are shorter, but next-forge explicitly uses authenticated and unauthenticated route groups, and this reset is intentionally aligned with next-forge.

### Remove route groups and put `dashboard` directly under `app/`

Rejected. That would mix public auth pages and protected app routes under one layout boundary and reduce clarity.

### Keep `/workflows`, `/approvals`, and `/connections` as placeholders

Rejected. They create the impression that workflow/product surfaces exist when the contracts are not ready.

## Evidence

- Next.js route-group docs: route groups are folders in parentheses, omitted from the URL, and used to organize routes, share layouts, and define section boundaries. https://nextjs.org/docs/app/api-reference/file-conventions/route-groups
- Next.js project-structure docs: route groups and private folders are supported for organization and route-local colocation. https://nextjs.org/docs/app/getting-started/project-structure
- next-forge app docs: the app is broken into authenticated and unauthenticated route groups. https://www.next-forge.com/docs/apps/app
- next-forge structure docs: apps are self-contained deployable surfaces and should compose package env contracts at the app root. https://www.next-forge.com/docs/structure
- next-forge source tree shows `(authenticated)` and `(unauthenticated)` under `apps/app/app`. https://github.com/vercel/next-forge/tree/main/apps/app/app

## Impacted Files and Packages

- `apps/app/app/(authenticated)/**`
- `apps/app/app/(unauthenticated)/**`
- `apps/app/app/sitemap.ts`
- `apps/app/proxy.ts`
- `docs/ai-workflow-os/08-plans/apps-app-reset-phases-checklist.md`
- `docs/ai-workflow-os/10-audit/apps-app-reset-gate-audit-2026-05-25.md`

## Validation Checklist

Original checklist from the superseded route target:

- [x] Add `/dashboard`.
- [x] Redirect `/` to `/dashboard`.
- [x] Delete `/workflows`, `/approvals`, and `/connections`.
- [x] Remove sidebar links to deleted routes.
- [x] Remove `/register` proxy and sitemap references.
- [x] Run app typecheck.
- [x] Run webpack build.
- [x] Run stale route scan.
- [x] Run `git diff --check`.
