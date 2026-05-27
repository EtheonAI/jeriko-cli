# MADR-088: Email Package Server-Only Provider Boundary

Date: 2026-05-27

Status: accepted

Package: `@repo/email`

## Context

`@repo/email` owns transactional email sending through Resend and templates through React Email. The root package entrypoint can construct a Resend client using secret environment variables. Template-only imports are safe for preview/rendering workflows, but provider imports should not be available to client components.

The package dependencies are already current on stable latest dist-tags, and tests already cover template rendering, successful Resend sends, provider errors, and missing credentials.

## Decision

Keep Resend + React Email.

Add `server-only` to the root provider entrypoint:

- `@repo/email` is server-only.
- `@repo/email/templates` remains template-only.
- `@repo/email/keys` remains an env contract.

Do not split into `@react-email/render` or individual component packages during cleanup.

## Consequences

Positive:

- Prevents accidental client imports of Resend credentials.
- Keeps current auth and contact email behavior.
- Preserves email preview/template tooling.

Negative:

- Tests need a `server-only` mock.
- Future client code must import only `@repo/email/templates`, not the provider root.

## References

- `docs/ai-workflow-os/09-research/2026-05-27-p2-3-email-resend-react-email-research.md`
- `docs/ai-workflow-os/10-audit/email-p2-3-audit-2026-05-27.md`
- https://resend.com/docs/send-with-nodejs
- https://react.email/docs/integrations/resend
- https://react.email/docs/changelog

## Checklist

- [x] Package playbook updated.
- [x] Root provider entrypoint marked server-only.
- [x] Template subpath remains usable without provider import.
- [x] Email package typecheck passes.
- [x] Email package tests pass.
- [x] Root tests pass.

## Validation Notes

- `@repo/email` typecheck and tests passed after the server-only change.
- `@repo/auth` and `apps/app` typechecks passed as affected consumers.
- root `pnpm test` passed with 14 files / 50 tests.
- `apps/web` typecheck remains blocked by existing contact/i18n/calendar/metadata issues outside P2.3.
