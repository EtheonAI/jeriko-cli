# Apps/App R16 Alias and Design-System Auth Plan

Date: 2026-05-26

Status: completed

Scope: use existing app-local aliases and current design-system auth primitives before restyling.

## Checklist

- [x] R16.0: Verify `@/*` alias exists in `apps/app` and `apps/web`.
- [x] R16.1: Check current design-system primitives and shadcn docs.
- [x] R16.2: Write research, audit, and MADR before edits.
- [x] R16.3: Convert cross-boundary auth imports to `@/…`.
- [x] R16.4: Use `Field` and `FieldError` for auth field structure.
- [x] R16.5: Use `InputGroup` for password visibility fields.
- [x] R16.6: Use design-system `Spinner` for loading indicators.
- [x] R16.7: Validate typecheck, lint, tests, build, scans, and diff hygiene.

## Validation Results

- `pnpm --filter app typecheck`: passed.
- Targeted ESLint for `apps/app/app/(unauthenticated)` and `apps/app/test/auth-pages.test.ts`: passed.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- `pnpm --filter app build`: passed on Next.js 16.2.6.
- Alias scan: no auth cross-boundary `../../_components`, `../../_lib`, or `../../_schemas` imports remain.
- Design-system scan: auth now uses `Field`, `FieldError`, `InputGroup`, `InputGroupButton`, `InputGroupInput`, `ToggleGroup`, and `Spinner`.
- Hygiene scan: no `Loader2`, no raw auth `<button>`, no raw red error paragraph pattern, and `git diff --check` passed.

## Remaining Limits

- This phase did not restyle the auth pages; it deliberately uses the current design-system primitives first.
- This phase did not prove live email delivery; R15 documents that Resend requires real credentials, a verified sender/domain, DB user, Better Auth token, and inbox/capture assertion.
