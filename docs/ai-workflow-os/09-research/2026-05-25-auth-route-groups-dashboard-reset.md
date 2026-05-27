# Auth Route Groups and Dashboard Reset Research

Date researched: 2026-05-25

Updated 2026-05-26:

- The route-group findings still stand.
- The `/dashboard` route decision is superseded by [`../07-madr/MADR-052-root-is-dashboard-reset-route.md`](../07-madr/MADR-052-root-is-dashboard-reset-route.md).
- Current active dashboard route is `/` via `apps/app/app/(authenticated)/page.tsx`.
- There is no active `/dashboard` page in the reset app.

## Sources

| Source                    | Type          | URL                                                                     | Claim checked                                                                                  |
| ------------------------- | ------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Next.js Route Groups      | Official docs | https://nextjs.org/docs/app/api-reference/file-conventions/route-groups | Route groups organize routes without adding URL path segments.                                 |
| Next.js Project Structure | Official docs | https://nextjs.org/docs/app/getting-started/project-structure           | Private folders and route-local colocation are supported project organization patterns.        |
| next-forge App docs       | Official docs | https://www.next-forge.com/docs/apps/app                                | next-forge explicitly breaks the main app into authenticated and unauthenticated route groups. |
| next-forge Structure docs | Official docs | https://www.next-forge.com/docs/structure                               | Apps are self-contained deployable surfaces and packages isolate shared code.                  |
| next-forge source tree    | Source code   | https://github.com/vercel/next-forge/tree/main/apps/app/app             | The current app tree uses `(authenticated)` and `(unauthenticated)` route groups.              |

## Verified Findings

- `(authenticated)` and `(unauthenticated)` are valid Next.js route-group names because folders in parentheses are organizational and omitted from the URL.
- The split is not only valid; it matches next-forge's documented app shape.
- Route groups do not secure routes by themselves. Protection must still happen in `proxy.ts`, server layouts, route handlers, and package-level authorization checks.
- Route groups are best used for layout and concern boundaries. They should not become junk drawers for product code.
- Next.js supports route-local private folders such as `_components` and `_lib` to colocate code without creating routes.
- For this reset, the product surface should be one authenticated dashboard route, not premature `/workflows`, `/approvals`, and `/connections` pages. As of 2026-05-26, that dashboard route is `/`, not `/dashboard`. Those concepts stay in planning docs and return only when their data/API contracts exist.

## Implementation Impact

- Keep `apps/app/app/(authenticated)` and `apps/app/app/(unauthenticated)`.
- Keep `app/` at the app root instead of moving to `src/app`, matching next-forge and avoiding churn.
- Reduce active authenticated routes to:
  - `/`
- Keep unauthenticated routes only for Better Auth UX:
  - `/login`
  - `/forgot-password`
  - `/reset-password`
  - `/verify-email`
- Remove stale `/register` references until a real registration page exists.
- Remove placeholder app pages for workflow concepts until the workflow kernel and route contracts are implemented.

## Open Questions

- Whether the authenticated group should eventually be renamed to `(app)` for shorter paths in code review. Current decision is to keep next-forge-compatible names.
- Whether `/` remains the long-term product home or a future workflow-native route such as `/workflows` becomes primary after the `.flow` compiler/runtime is real.
