# P2.3 Email Package Audit

Date: 2026-05-27

Package: `@repo/email`

Status: completed before P2.3 email cleanup

## Current Package Surface

Files audited:

- `packages/email/package.json`
- `packages/email/index.ts`
- `packages/email/keys.ts`
- `packages/email/templates/*.tsx`
- `packages/email/tests/email.test.ts`
- `packages/email/vitest.config.ts`
- `apps/email/package.json`
- `apps/web/app/[locale]/contact/actions/contact.tsx`
- `packages/auth/src/server.ts`

Active exports before cleanup:

- `@repo/email`
- `@repo/email/templates`
- `@repo/email/keys`

Active consumers:

- `@repo/auth` consumes `sendEmail` and auth templates.
- `apps/web` consumes `resend` and `ContactTemplate` from a server action.
- `apps/app/env.ts` and `apps/web/env.ts` extend `@repo/email/keys`.
- `apps/email` previews templates from `packages/email/templates`.

## Findings

### Keep

- Resend as the transport provider.
- React Email as the template/rendering layer.
- `sendEmail` structured success/error result.
- Lazy Resend client creation.
- Template exports for contact, invitation, password reset, and verification.
- `RESEND_API_KEY` / `RESEND_TOKEN` compatibility.

### Refactor

- The root provider entrypoint imports Resend and reads secret env but does not import `server-only`. Add it.
- Package tests dynamically import the root provider entrypoint; add a test mock for `server-only`.

### Delete

- No code deletion in P2.3.

### Defer

- Branding/restyle of templates.
- Email preview app verification beyond package tests.
- End-to-end auth email flow tests through Better Auth route handlers.
- Notification digests and workflow approval emails.
- Choosing one canonical env name and removing the `RESEND_TOKEN` alias.

## Validation Before Cleanup

Commands:

```bash
npm view resend version dist-tags --json
npm view react-email version dist-tags --json
npm view @react-email/render version dist-tags --json
npm view @react-email/components version dist-tags --json
pnpm outdated --filter @repo/email --format json
pnpm --filter @repo/email typecheck
pnpm --filter @repo/email test
rg "@repo/email|sendEmail|RESEND_|resend|react-email|@react-email" apps packages
```

Results:

- `resend` stable latest: `6.12.4`.
- `react-email` stable latest: `6.4.0`.
- `pnpm outdated --filter @repo/email --format json` returned `{}`.
- `@repo/email` typecheck passed before cleanup.
- `@repo/email` tests passed before cleanup: 1 file / 5 tests.
- Root `@repo/email` consumers are server-side today, but the package entrypoint should still enforce it.

## Cleanup Checklist

- [x] Update package playbook and MADR before code changes.
- [x] Add `server-only` dependency to `@repo/email`.
- [x] Import `server-only` in `packages/email/index.ts`.
- [x] Mock `server-only` in package tests.
- [x] Run `@repo/email` typecheck.
- [x] Run `@repo/email` tests.
- [x] Run affected auth/web/app typechecks as practical.
- [x] Run root tests.

## Validation After Cleanup

Commands:

```bash
pnpm --filter @repo/email typecheck
pnpm --filter @repo/email test
pnpm --filter @repo/auth typecheck
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm test
```

Results:

- `@repo/email` typecheck passed.
- `@repo/email` tests passed: 1 file / 5 tests.
- `@repo/auth` typecheck passed.
- `apps/app` typecheck passed.
- root `pnpm test` passed: 14 files / 50 tests.
- `apps/web` typecheck still fails on the existing contact/i18n/calendar/metadata issues documented in earlier phases; no new email-specific error appeared before those failures.
