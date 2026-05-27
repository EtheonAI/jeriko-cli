# MADR-058: R16 App Alias and Design-System Auth Primitives

Status: Accepted

Date: 2026-05-26

## Context

The reset app should use the existing design system first, then restyle later. The auth flow is now route-segmented, but some fields still use ad hoc local markup for errors, password visibility, and loading indicators.

`apps/app` and `apps/web` already define local `@/*` aliases. The issue is consistency, not missing configuration.

## Decision

- Do not add new app alias config; keep the existing `@/*` in app tsconfigs.
- Use `@repo/*` for workspace packages.
- Use `@/*` for app-owned imports that cross route or shared app boundaries.
- Keep short relative imports for tight route-local files.
- Use current `@repo/design-system` primitives for auth forms before any restyle.
- Keep local auth-specific wrappers only when the design system does not provide the semantic component.

## Consequences

Positive:

- Auth forms align with the current design system.
- Import ownership becomes clearer.
- Later material restyling can happen in the design system without rewriting every auth flow.

Negative:

- Some route imports become longer because route groups are part of the path.
- Password-specific semantics remain app-owned until a shared password-field component is proven reusable.

## Evidence

- Next.js Project Structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`
- shadcn/ui Monorepo docs: `https://ui.shadcn.com/docs/monorepo`
- shadcn/ui Input Group docs: `https://ui.shadcn.com/docs/components/base/input-group`
- shadcn/ui Field docs: `https://ui.shadcn.com/docs/components/base/field`
- shadcn/ui Toggle Group docs: `https://ui.shadcn.com/docs/components/base/toggle-group`
- shadcn/ui Spinner docs: `https://ui.shadcn.com/docs/components/base/spinner`
- shadcn/ui Forms docs: `https://ui.shadcn.com/docs/forms`
- R16 research: [`../09-research/2026-05-26-r16-app-alias-design-system-auth-research.md`](../09-research/2026-05-26-r16-app-alias-design-system-auth-research.md)
- R16 audit: [`../10-audit/apps-app-r16-alias-design-system-auth-audit-2026-05-26.md`](../10-audit/apps-app-r16-alias-design-system-auth-audit-2026-05-26.md)

## Validation Checklist

- [x] `pnpm --filter app typecheck`
- [x] Targeted ESLint for `apps/app/app/(unauthenticated)` and `apps/app/test/auth-pages.test.ts`
- [x] `pnpm test:smoke`
- [x] `pnpm --filter app build`
- [x] App alias scan
- [x] Design-system usage scan
- [x] `git diff --check`

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint: passed.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- `pnpm --filter app build`: passed on Next.js 16.2.6 with `/`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email`, `/api/auth/[...all]`, and `/api/health`.
- Raw auth UI scan: no `Loader2`, no raw `<button>`, no raw red error paragraph pattern.
- Cross-boundary alias scan: no remaining `../../_components`, `../../_lib`, or `../../_schemas` imports in auth; only tight route-local `../_lib` imports remain.
- `git diff --check`: passed.
