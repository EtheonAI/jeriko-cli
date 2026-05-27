# MADR-060: R17 Authenticated Root Shell Reset

Status: Accepted

Date: 2026-05-26

## Context

`apps/app` is in Phase -1 base reset. The active App Router surface is now intentionally small: authenticated root `/`, auth pages, Better Auth API route, health route, metadata files, and shell/sidebar components.

The old Manus app surfaces are no longer active route trees in `apps/app`, but the authenticated shell still has reset debt:

- `layout.tsx` composes auth, security, feature flag, notifications, sidebar, and page content directly.
- The root dashboard page owns inline stat and empty-state markup instead of route-owned components.
- The sidebar component is named generically as `GlobalSidebar`.
- The collapsible sidebar lacks an app header/sidebar trigger in the content inset.
- The sign-out loading state imports `Loader2Icon` directly instead of composing the design-system `Spinner`.

## Decision

Keep the authenticated root `/` as the reset dashboard and refactor the authenticated shell into explicit route-owned pieces:

```text
apps/app/app/(authenticated)/
  _components/
    app-shell/
    dashboard/
    sidebar/
  layout.tsx
  page.tsx
```

Rules:

- `layout.tsx` remains a Server Component responsible for auth, security, and request-time checks.
- `AppShell` owns shell composition.
- `AppHeader` owns the sidebar trigger and reset-phase title/status.
- `AppSidebar` owns navigation and user footer composition.
- `DashboardOverview` owns the reset dashboard view.
- The sidebar remains minimal: only `/` exists during reset.
- No new product route is added during R17.
- No sandbox, chat, artifact, settings, workflow, or file-rendering surface is reintroduced during R17.
- Design-system primitives are used before local controls.

## Consequences

Positive:

- The authenticated root is cleaner and easier to build on.
- The shell can evolve separately from dashboard content.
- The sidebar is usable on collapsed/mobile layouts through the design-system trigger.
- The dashboard page becomes a thin Server Component.
- The reset phase does not accidentally revive old Manus product surfaces.

Negative:

- The dashboard remains a placeholder until workflow-native tables and modules exist.
- Notifications are still wrapped at the authenticated shell level and need a later product decision.
- This does not resolve root lint debt outside the R17 scope.

## Alternatives Considered

- Move `/` to `/dashboard`: rejected because the accepted reset decision says `/` is the dashboard.
- Move `apps/app/app` to `apps/app/src/app`: rejected because Next.js does not require `src`, and current monorepo standards keep app roots under `apps/*/app`.
- Delete the entire shell and rebuild from a blank app: rejected because the sidebar/auth/design-system wiring is useful and already validated.
- Keep the current inline layout/page: rejected because it slows the reset and keeps shell/page ownership blurred.

## Evidence

- Research note: [`../09-research/2026-05-26-r17-authenticated-shell-route-structure-research.md`](../09-research/2026-05-26-r17-authenticated-shell-route-structure-research.md)
- Audit: [`../10-audit/apps-app-r17-authenticated-shell-audit-2026-05-26.md`](../10-audit/apps-app-r17-authenticated-shell-audit-2026-05-26.md)
- Checklist: [`../08-plans/apps-app-r17-authenticated-shell-cleanup-plan.md`](../08-plans/apps-app-r17-authenticated-shell-cleanup-plan.md)
- Next.js project structure: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js Server and Client Components: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Vercel docs bundle: `https://vercel.com/docs/llms-full.txt`
- next-forge structure reference: `https://www.next-forge.com/docs/structure`

## Validation Checklist

- [x] Authenticated root page is a thin Server Component.
- [x] Authenticated layout remains server-first and request-time authenticated.
- [x] Shell composition is route-owned under `_components/app-shell`.
- [x] Dashboard content is route-owned under `_components/dashboard`.
- [x] Sidebar composition is app-owned and no longer named `GlobalSidebar`.
- [x] Sidebar header/trigger exists.
- [x] Sign-out loading state uses the design-system `Spinner`.
- [x] No new product routes are introduced.
- [x] App typecheck passes.
- [x] App smoke tests pass.
- [x] App production build passes with the documented dummy env.

## Impacted Files

- `apps/app/app/(authenticated)/layout.tsx`
- `apps/app/app/(authenticated)/page.tsx`
- `apps/app/app/(authenticated)/_components/app-shell/*`
- `apps/app/app/(authenticated)/_components/dashboard/*`
- `apps/app/app/(authenticated)/_components/sidebar/*`
- `apps/app/test/dashboard.test.ts`
- `docs/ai-workflow-os/08-plans/package-playbooks/apps-app.md`
