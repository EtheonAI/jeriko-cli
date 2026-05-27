# R17 Authenticated Shell Route Structure Research

Date researched: 2026-05-26

Scope: `apps/app` authenticated root route, shell/sidebar structure, route-local component segmentation, and reset-phase deletion gates.

## Sources

| Source                                                                     | Type                        | Claim used                                                                                                                                                         |
| -------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `https://nextjs.org/docs/app/getting-started/project-structure`            | Official Next.js docs       | `src` is optional; private folders can colocate implementation details; route groups organize route sections without changing URLs.                                |
| `https://nextjs.org/docs/app/getting-started/layouts-and-pages`            | Official Next.js docs       | `page.tsx` defines route UI and `layout.tsx` wraps route segments.                                                                                                 |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components` | Official Next.js docs       | Server Components are default; Client Components are needed only for interactivity, hooks, browser APIs, and event handlers.                                       |
| `https://nextjs.org/docs/app/guides/upgrading/version-16`                  | Official Next.js docs       | Next 16 uses Turbopack as the default build path; App Router code should stay compatible with current async and routing conventions.                               |
| `https://vercel.com/docs/llms-full.txt`                                    | Official Vercel docs bundle | Vercel docs should be used as source-backed reference for platform capabilities; Vercel Sandbox and Workflow are later phases, not app-shell cleanup dependencies. |
| `https://www.next-forge.com/docs/structure`                                | next-forge docs             | Multi-app monorepo apps stay self-contained; shared code belongs in packages.                                                                                      |
| `https://github.com/vercel/next-forge/tree/main/apps/app`                  | Reference repo              | Useful small app surface model, but auth provider/package choices are not copied directly.                                                                         |

## Findings

1. `(authenticated)` and `(unauthenticated)` route groups are valid for this app.
   They represent different layouts and access policies while keeping URLs clean. The current `/` dashboard can stay at `apps/app/app/(authenticated)/page.tsx`.

2. `src/app` migration is not required.
   Official Next.js project structure treats `src` as optional. This repo has an accepted monorepo convention to keep deployable app roots at `apps/*/app`.

3. Route-private folders are correct for reset work.
   `_components`, `_hooks`, `_lib`, `_schemas`, and `_types` keep implementation details colocated without becoming routes.

4. Pages and layouts should stay thin Server Components.
   Client code should sit behind leaf components such as sidebar navigation, sign-out, auth forms, and provider wrappers.

5. The authenticated shell should own shell composition explicitly.
   `layout.tsx` should authenticate and fetch route-level flags, then hand display composition to a route-owned app-shell component.

6. The sidebar needs an accessible trigger/header in the shell.
   The current reset shell has a sidebar provider and collapsible sidebar, but no visible `SidebarTrigger` in the content inset. A compact app header is a shell concern, not dashboard page content.

7. Vercel Sandbox is not part of R17.
   The Vercel docs bundle is relevant for later sandbox/runtime phases. R17 should not reintroduce sandbox routes or UI until a provider-neutral sandbox package and workflow module spec exist.

## Implementation Impact

- Keep `/` as the authenticated dashboard route.
- Keep route groups.
- Keep `apps/app/app`, not `apps/app/src/app`.
- Extract root dashboard markup into route-owned dashboard components.
- Extract authenticated shell composition into route-owned app-shell components.
- Keep the current sidebar, but rename generic `GlobalSidebar` to an app-owned sidebar name and add a shell header with `SidebarTrigger`.
- Continue using `@repo/design-system` primitives before local UI controls.
- Do not add new workflow, sandbox, chat, settings, or artifact pages during this reset pass.

## Open Questions

- Whether notifications should remain on the whole authenticated shell or move to a later notifications surface after product modules are rebuilt.
- Whether the dashboard stats should remain static placeholders or become server DTOs after workflow database tables exist.
- Whether the future workbench should use route groups, parallel routes, or nested workflow routes. This belongs to the workflow frontend phase, not R17.
