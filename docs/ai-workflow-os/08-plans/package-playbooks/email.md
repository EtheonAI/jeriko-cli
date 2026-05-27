# Email Package Playbook

Package: `@repo/email`

Date: 2026-05-27

Status: active P2.3 package cleanup

Priority: P2 foundation package

## Ownership

What this package owns:

- Resend transport wrapper;
- React Email template exports;
- email env keys;
- package-owned email tests.

What this package must not own:

- Better Auth server configuration;
- AgentMail inbox behavior;
- app route handlers;
- notification provider SDK behavior.

## Current Surface

Exports:

- `@repo/email`
- `@repo/email/templates`
- `@repo/email/keys`

Provider SDKs:

- `resend`
- `react-email`

Env keys:

- `RESEND_FROM`
- `RESEND_TOKEN`
- `RESEND_API_KEY`

## Sources Checked

| Source                                          | Type              | Checked Date | Claim Used                                                                                                      |
| ----------------------------------------------- | ----------------- | -----------: | --------------------------------------------------------------------------------------------------------------- |
| `https://resend.com/docs/send-with-nodejs`      | Official docs     |   2026-05-27 | Resend Node SDK sends transactional emails and supports standard email fields.                                  |
| `https://react.email/docs/integrations/resend`  | Official docs     |   2026-05-27 | React Email recommends Resend and documents the unified `react-email` package.                                  |
| `https://react.email/docs/changelog`            | Official docs     |   2026-05-27 | React Email 6 unified components/rendering utilities into `react-email`.                                        |
| `npm view react-email version dist-tags --json` | Registry metadata |   2026-05-27 | Stable latest `react-email` is `6.4.0`, matching the package.                                                   |
| `npm view resend version dist-tags --json`      | Registry metadata |   2026-05-27 | Stable latest `resend` is `6.12.4`, matching the package.                                                       |
| Local package audit                             | Repo evidence     |   2026-05-27 | Auth package and web contact server action consume root provider exports; template preview uses template files. |

## Local Audit

Commands:

```bash
find packages/email -maxdepth 3 -type f
pnpm --filter @repo/email typecheck
pnpm --filter @repo/email test
```

Findings:

- Package has templates for verification, password reset, invitations, and contact.
- `sendEmail` lazily initializes the Resend client and returns structured success/error results.
- `RESEND_TOKEN` and `RESEND_API_KEY` are treated as aliases through the env contract.
- Root provider entrypoint reads secret env and should be `server-only`.
- Template subpath must remain usable by preview tooling.

## Decision

Verdict: keep core and add server-only provider boundary.

Reason:

- Email is required for auth verification and password reset.
- Resend + React Email remains the right baseline.
- Root provider imports must not be usable from client components.

## P2.3 Refactor Checklist

- [x] Public exports are intentional.
- [x] Provider SDKs are package-owned.
- [x] Env validation is package-local.
- [x] Latest registry metadata checked.
- [x] Add `server-only` dependency.
- [x] Add `server-only` import to provider entrypoint.
- [x] Mock `server-only` in package tests.
- [x] Typecheck passes.
- [x] Tests pass.

## Validation

```bash
pnpm --filter @repo/email typecheck
pnpm --filter @repo/email test
```

Latest validation:

- `pnpm --filter @repo/email typecheck` passed.
- `pnpm --filter @repo/email test` passed: 1 file / 5 tests.
- `pnpm --filter @repo/auth typecheck` passed.
- `pnpm --filter app typecheck` passed.
- root `pnpm test` passed: 14 files / 50 tests.
- `pnpm --filter web typecheck` still fails on existing contact/i18n/calendar/metadata issues outside P2.3.

## Open Risks

- Add end-to-end auth email flow tests later with Better Auth routes and Resend mocked at the package boundary.
