# Next 16 App Structure Audit And Standard

Date: 2026-05-23

Scope: `apps/app`, `apps/web`, the now-deactivated `legacy/deactivated-apps/api`, shared frontend packages, and the reset target for the new AI Workflow OS application.

## Verdict

The app structure is not senior-clean yet.

The dependency upgrade is clean, but the frontend/app organization still needs a structural reset before the new `.flow` product work. The current repo has useful pieces, including route groups, route-local components in some areas, and shared packages. It also has too many legacy global folders, test/demo routes inside the authenticated product app, broad client boundaries, and mixed ownership between app routes, shared `components`, route-local folders, Redux slices, tRPC routers, API routes, and service packages.

Update 2026-05-25: the `apps/app` env/service URL layer has been centralized with T3 Env and a server-only endpoint helper. See [`nextjs-app-cleanup-status-2026-05-25.md`](./nextjs-app-cleanup-status-2026-05-25.md). This does not make the app structure clean yet; it removes one cross-cutting source of drift before the route tree reset.

Update 2026-05-25: the `src/app` examples below are a possible future shape, not an approved cleanup move. Next.js supports both root `app/` and `src/app`; do not move `apps/app/app` to `apps/app/src/app` without a dedicated route migration plan.

## External Evidence

Primary sources checked:

- Next.js App Router project organization: `https://nextjs.org/docs/app/building-your-application/routing/colocation`
- Next.js Server and Client Components: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js App Router docs: `https://nextjs.org/docs/app`
- Prediction-market reference repo: `https://github.com/kuestcom/prediction-market`
- Kuest architecture docs: `https://kuestcom-prediction-market-18.mintlify.app/architecture`

Source-backed takeaways:

- Next App Router supports route groups, colocated files, and private folders. Files inside `app` are not public routes unless they are route files such as `page` or `route`.
- Next pages and layouts are Server Components by default. Client Components are for state, event handlers, effects, browser APIs, and custom client hooks.
- The prediction-market reference uses one primary `src` boundary, `src/app`, route groups, route-local folders, shared `src/components/ui`, and domain code under `src/lib`.

## Current Jeriko Evidence

Observed local structure:

```text
apps/app/app/(authenticated)
apps/app/app/(unauthenticated)
apps/app/app/api
apps/app/app/actions
apps/app/components
apps/app/lib
apps/web/app/[locale]
legacy/deactivated-apps/api/app
```

Good:

- `apps/app` already uses App Router route groups.
- `apps/web` already has a cleaner localized marketing structure with route-local `contact/components` and `(home)/components`.
- Some complex app routes already colocate route-specific folders, for example `chat/[id]/components`, `chat/[id]/hooks`, `projects/[id]/components`, `files/components`, `actions/components`, and `applications/components`.
- Server actions exist in explicit action files.

Not clean:

- `apps/app/app/(authenticated)/_components` is now a private authenticated route-group bucket, but it is still broad and contains many page-specific pieces that need later route-local breakup.
- `apps/app/components` and `apps/app/app/(authenticated)/_components` overlap with route-local components.
- Many authenticated pages are Client Components at the page level, including auth pages and test/demo pages. This is usually too broad for Next 16.
- `chat/test`, `chat/test-ide`, and `chat/test-stream` are product-route clutter and should move to dev-only routes or be removed.
- Test fixtures and tests are colocated under active route folders. That can be acceptable for route-local unit tests, but large fixtures/test harnesses should not shape the production route tree.
- `apps/api` was mostly a small Next API surface and has now been archived under `legacy/deactivated-apps/api` until a separate deploy boundary is justified.

## Are `(authenticated)` And `(unauthenticated)` Senior?

Yes, route groups are a senior App Router pattern when they express layout/auth boundaries.

The current names are acceptable because they do not affect URLs. However, the reset target should use shorter product-oriented route groups:

```text
(auth)       sign-in, reset, verify, public auth flows
(app)        logged-in workflow operating system
(public)     share/public artifact pages if kept in the product app
api          route handlers only
```

`(authenticated)` and `(unauthenticated)` are not the main problem. The main problem is the lack of a consistent ownership rule under those groups.

## Target Structure

For the primary product app, use this ownership model. Keep the current root `app/` path during cleanup; replace `src/app` with `app` unless a dedicated route migration is approved.

```text
apps/app/src/app
  layout.tsx
  providers.tsx
  styles.css

  (auth)
    layout.tsx
    login
      page.tsx
      _components
      _lib
    reset-password
      page.tsx
      _components

  (app)
    layout.tsx
    page.tsx
    workflows
      page.tsx
      _components
      _actions
      _lib
      _types
      [workflowId]
        page.tsx
        _components
        _hooks
        _actions
        _lib
        _types
    runs
      [runId]
        page.tsx
        _components
        _hooks
        _lib
    artifacts
      [artifactId]
        page.tsx
        _components
        _lib
    settings
      page.tsx
      _components
      _actions

  (public)
    share
      [id]
        page.tsx
        _components

  api
    auth
    chat
    workflows
    runs
    artifacts
    sandbox

apps/app/src/components
  layout
  ui

apps/app/src/lib
  server
  client
  auth
  workflows
  runs
  artifacts
  tools
  sandbox
```

For the marketing website:

```text
apps/web/src/app/[locale]
  (home)
    page.tsx
    _components
  contact
    page.tsx
    _components
    _actions
  pricing
    page.tsx
    _components
  legal
    [slug]
      page.tsx
      _lib
  _components
```

If marketing stays separate, `apps/web` should remain small and content-focused. It should not import product runtime code except safe shared UI/SEO/i18n packages.

## Route Ownership Rules

- `page.tsx`: server route controller. Fetch data, validate access, compose route-local components.
- `layout.tsx`: server by default. Use a small Client provider wrapper only when context/state is required.
- `_components`: components used only by that route subtree.
- `_hooks`: client hooks used only by that route subtree.
- `_actions`: Server Actions for that route subtree.
- `_lib`: route-local server helpers, mappers, loaders, and adapters.
- `_types`: route-local UI/domain types that are not shared contracts.
- `components/ui`: reusable primitives only.
- `components/layout`: reusable shell/layout primitives only.
- `lib/server`: server-only data access, auth checks, and service calls.
- `lib/client`: browser-only clients and helpers.
- shared packages: reusable cross-app contracts, design system, workflow parser/runtime, sandbox adapter, tools.

## Server And Client Component Rules

Default to Server Components.

Use Client Components only for:

- state;
- event handlers;
- effects;
- browser APIs;
- custom client hooks;
- client-only third-party libraries;
- optimistic interaction surfaces.

Do not make an entire page client-side only because one button, dialog, or input is interactive. Split the page:

```text
page.tsx                 server
_components/client.tsx   client island
_lib/load-data.ts        server helper
```

Do not import server-only modules into Client Components. Server-only code should sit in `_lib` or `src/lib/server`, not in generic shared component folders.

## CSS And Styling Rules

- Keep global CSS limited to reset, tokens, Tailwind imports, and app-wide CSS variables.
- Prefer design-system primitives and Tailwind utilities for normal UI composition.
- Use route-local CSS modules only when a route has complex route-specific styling that would be noisy in utilities.
- Do not create a CSS file for every page by default.
- Keep material/design tokens centralized in the design system package or one app theme layer.
- Avoid old Manus/Rubic CSS naming in new routes.

Update 2026-05-25: the first approved `apps/app` route-tree cleanup slice is to rename
`apps/app/app/(authenticated)/components` to `apps/app/app/(authenticated)/_components`.
This follows the official private-folder convention and preserves all URLs. See
[`../08-plans/apps-app-structure-cleanup-checklist.md`](../08-plans/apps-app-structure-cleanup-checklist.md).

## App Classification

Recommended reset classification:

| App                           | Decision                          | Reason                                                                                                   |
| ----------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/app`                    | Keep as primary product app       | Main workflow OS experience lives here.                                                                  |
| `apps/web`                    | Keep as a first-class app surface | Marketing/content can stay separate if it remains content-only and does not import product runtime code. |
| `legacy/deactivated-apps/api` | Deactivated                       | Current surface was too small to justify a separate Next app without a deploy reason.                    |
| `apps/email`                  | Keep dev-only                     | Email template preview/build tool, not product runtime.                                                  |
| `apps/storybook`              | Dev-only                          | Useful later for design-system QA, not a reset blocker.                                                  |
| `apps/docs`                   | Keep dev/docs surface             | Product docs are not MVP runtime, but the app surface stays explicit.                                    |
| `apps/studio`                 | Keep dev-only until needed        | No reset-critical path yet, but the app surface stays explicit.                                          |

## Migration Checklist

- [ ] Keep route groups, but rename target groups to `(auth)`, `(app)`, and `(public)` during the reset.
- [ ] Move new workflow pages into route-local `_components`, `_actions`, `_hooks`, `_lib`, and `_types`.
- [ ] Stop adding page-specific components to global `components` folders.
- [ ] Move test/demo routes out of `(app)` production navigation.
- [ ] Convert page-level Client Components into Server pages with Client islands where possible.
- [ ] Keep `apps/app/app` during cleanup; create a `src` boundary only through a dedicated migration plan.
- [x] Decide whether `apps/api` is deleted, merged, or a real separate deployment: deactivated until a real separate deployment is justified.
- [ ] Keep `apps/web` content-only if it remains separate.
- [ ] Add Knip or equivalent dead-code detection after the folder reset lands.
- [ ] Add lint rules or review checklist for server/client boundary violations.

## Do Not Do

- Do not move all files in one blind rename pass.
- Do not create route-local folders without deleting the old global duplicates.
- Do not make every route a Client Component.
- Do not move server actions or DB access into Client Components.
- Do not copy prediction-market domain structure exactly; copy the organizational discipline only.
- Do not start `.flow` UI coding until the primary app boundary is chosen.
