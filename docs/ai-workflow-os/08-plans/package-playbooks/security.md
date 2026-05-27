# Security Package Playbook

Package: `@repo/security`

Date: 2026-05-27

Status: active P2.4 package cleanup

Priority: P2 foundation package

## Ownership

What this package owns:

- Arcjet runtime protection helper;
- Nosecone security middleware options;
- security env keys.

What this package must not own:

- app route tree;
- auth session ownership;
- rate-limit package internals unless explicitly merged later;
- product-specific workflow permission policy.

## Current Surface

Exports:

- `@repo/security`
- `@repo/security/keys`
- `@repo/security/middleware`

Provider SDKs:

- `@arcjet/next`
- `@nosecone/next`

Env keys:

- `ARCJET_KEY`

## Sources Checked

| Source                                                 | Type              | Checked Date | Claim Used                                                                                                   |
| ------------------------------------------------------ | ----------------- | -----------: | ------------------------------------------------------------------------------------------------------------ |
| `https://docs.arcjet.com/`                             | Official docs     |   2026-05-27 | Arcjet is a runtime security SDK with Next.js support.                                                       |
| `https://docs.arcjet.com/bot-protection`               | Official docs     |   2026-05-27 | Bot protection is configured as runtime rules with allow categories.                                         |
| `https://docs.arcjet.com/shield`                       | Official docs     |   2026-05-27 | Shield WAF is an Arcjet runtime protection rule.                                                             |
| `https://docs.arcjet.com/rate-limiting`                | Official docs     |   2026-05-27 | Rate limiting exists but remains separate until the rate-limit package phase.                                |
| `https://docs.arcjet.com/nosecone/quick-start`         | Official docs     |   2026-05-27 | Nosecone owns security headers middleware/options.                                                           |
| `https://www.next-forge.com/packages/security/headers` | next-forge docs   |   2026-05-27 | next-forge uses Nosecone in `@repo/security/middleware`; option changes affect apps.                         |
| `npm view @arcjet/next version dist-tags --json`       | Registry metadata |   2026-05-27 | Stable latest `@arcjet/next` is `1.4.0`, matching the package.                                               |
| `npm view @nosecone/next version dist-tags --json`     | Registry metadata |   2026-05-27 | Stable latest `@nosecone/next` is `1.4.0`, matching the package.                                             |
| Local package audit                                    | Repo evidence     |   2026-05-27 | Apps consume security through public package exports, but `apps/web` had an unused direct Arcjet dependency. |

## Local Audit

Commands:

```bash
rg "@repo/security|secure\\(" apps packages
pnpm --filter @repo/security typecheck
```

Findings:

- `apps/web/proxy.ts` and authenticated app layout consume public package exports.
- Package is latest and typechecks.
- `ARCJET_KEY` is optional, allowing local/dev builds without provider secrets.
- `apps/web` does not import `@arcjet/next`, but still declares it directly.

## Decision

Verdict: keep core, remove app-level provider dependency, and add package tests.

Reason:

- Security should remain package-owned.
- Current package versions are latest.
- Apps should not directly declare provider SDKs owned by `@repo/security`.
- Skip behavior should be covered by package tests.

## Refactor Checklist

- [x] Public exports are intentional.
- [x] Provider SDKs are package-owned.
- [x] Env validation is package-local and optional.
- [x] Latest registry metadata checked.
- [x] Remove unused direct `@arcjet/next` dependency from `apps/web`.
- [x] Add package-local tests.
- [x] Add package test script/config.
- [x] Typecheck passes.
- [x] Tests pass.
- [ ] Add route-specific security policy tests later.

## Validation

```bash
pnpm --filter @repo/security typecheck
pnpm boundaries:cruise
```

Latest validation:

- `pnpm --filter @repo/security typecheck` passed.
- `pnpm --filter @repo/security test` passed: 1 file / 2 tests.
- `pnpm --filter app typecheck` passed.
- root `pnpm test` passed: 15 files / 52 tests.
- `pnpm --filter web typecheck` still fails on existing contact/i18n/calendar/metadata issues outside P2.4.

## Open Risks

- `@repo/rate-limit` remains separate; decide later whether rate limiting stays split or folds into security.
- CSP remains disabled by default until app/workflow/sandbox asset needs are finalized.
