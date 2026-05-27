# Apps/App R12 Shell Structure Cleanup Plan

Date: 2026-05-26

Status: completed

Scope: `apps/app` shell and directory hygiene only.

## References

- Research: [`../09-research/2026-05-26-app-shell-r12-structure-research.md`](../09-research/2026-05-26-app-shell-r12-structure-research.md)
- Audit: [`../10-audit/apps-app-r12-shell-structure-audit-2026-05-26.md`](../10-audit/apps-app-r12-shell-structure-audit-2026-05-26.md)
- Decision: [`../07-madr/MADR-054-app-shell-r12-empty-route-and-legal-link-cleanup.md`](../07-madr/MADR-054-app-shell-r12-empty-route-and-legal-link-cleanup.md)
- Next.js project structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js route groups docs: `https://nextjs.org/docs/app/api-reference/file-conventions/route-groups`
- Next.js Server and Client Components docs: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js data security docs: `https://nextjs.org/docs/app/guides/data-security`

## Checklist

- [x] R12.0: Research current Next.js route organization, route groups, and Server/Client boundary guidance.
- [x] R12.1: Audit active `apps/app` file surface and deleted-route leftovers.
- [x] R12.2: Write research, audit, and MADR before code edits.
- [x] R12.3: Remove empty route directories left by prior deletions.
- [x] R12.4: Route auth legal links to marketing web absolute URLs.
- [x] R12.5: Normalize touched app-shell import/style issues.
- [x] R12.6: Validate typecheck, targeted lint, smoke tests, build, and scans.
- [x] R12.7: Validate diff hygiene.

## Implementation Notes

- Removed four empty directories left by prior deletions:
  - `apps/app/app/(authenticated)/dashboard`
  - `apps/app/app/(unauthenticated)/_components/ui`
  - `apps/app/app/(unauthenticated)/login/_schemas`
  - `apps/app/app/api/auth/check-email`
- Added `app/(unauthenticated)/_lib/legal-links.ts`.
- Auth footer now links Terms and Privacy to the marketing web app URLs.
- Sign-up legal links now receive server-derived absolute URLs as serializable props.
- Normalized the touched authenticated layout import order.

## Validation

- `pnpm --filter app typecheck` passed.
- Targeted ESLint for touched app files passed.
- `pnpm test:smoke` passed: 2 files, 5 tests.
- `pnpm --filter app build` passed on Next `16.2.6` with Turbopack.
- Build output includes `/`, auth pages, `/api/auth/[...all]`, and `/api/health`; it does not include `/dashboard` or `/api/auth/check-email`.
- Old-surface scan only finds the README guardrail.
- Empty directory scan under `apps/app/app` returned no results.
- Legal relative-link scan only finds the absolute URL builder.
- `git diff --check` passed.

## Out Of Scope

- New workflow routes.
- Material redesign.
- Payload/Basehub decision.
- Vercel Sandbox migration.
- `.flow` parser/runtime.
