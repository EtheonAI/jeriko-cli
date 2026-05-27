# MADR-054: App Shell R12 Empty Route and Legal Link Cleanup

Status: Accepted

Date: 2026-05-26

## Context

After R11, `apps/app` is buildable and Better Auth is aligned with latest stable docs. The next cleanup phase is not a feature phase. It should keep the reset shell small and remove misleading filesystem leftovers before workflow product work begins.

The app still contains empty directories from deleted routes. The auth UI also links to `/terms` and `/privacy` inside the app domain even though those pages are not part of the reset app and are not public proxy routes.

## Decision

- Remove empty deleted-route directories.
- Keep `/` as the authenticated dashboard.
- Keep `(authenticated)` and `(unauthenticated)` route groups.
- Keep `apps/app/app`; do not move to `src/app`.
- Use marketing web absolute URLs for Terms and Privacy links.
- Do not add or restore product routes in R12.

## Consequences

Positive:

- The physical app tree better matches the actual compiled route tree.
- Auth legal links no longer bounce through the app auth proxy.
- The reset shell stays small before redesign and workflow modules.

Negative:

- The app still has intentionally minimal placeholder dashboard content.
- Legal URLs depend on `NEXT_PUBLIC_WEB_URL`, which is already part of the app env contract.

## Evidence

- Next.js project structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js route groups docs: `https://nextjs.org/docs/app/api-reference/file-conventions/route-groups`
- Next.js Server and Client Components docs: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js data security docs: `https://nextjs.org/docs/app/guides/data-security`
- R12 research: [`../09-research/2026-05-26-app-shell-r12-structure-research.md`](../09-research/2026-05-26-app-shell-r12-structure-research.md)
- R12 audit: [`../10-audit/apps-app-r12-shell-structure-audit-2026-05-26.md`](../10-audit/apps-app-r12-shell-structure-audit-2026-05-26.md)

## Validation Checklist

- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint for touched app files
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] Old-surface scan
- [x] Empty route folder scan
- [x] `git diff --check`
