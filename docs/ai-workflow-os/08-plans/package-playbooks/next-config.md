# Next Config Package Playbook

Package: `@repo/next-config`

Date: 2026-05-27

Status: P1.2 active; scoped cleanup approved by MADR-083

Priority: P1 foundation package

## Ownership

What this package owns:

- shared baseline `NextConfig`;
- shared Next/Vercel URL env keys;
- common image config;
- framework-level package transpilation/externalization defaults.

What this package must not own long term:

- app-specific routes;
- provider-specific auth/payment/database initialization;
- CMS-specific config;
- observability build wrapping, which belongs to `@repo/observability/next-config`;
- feature flag toolbar wrapping, which belongs to `@repo/feature-flags/next-config`;
- analytics/PostHog policy once `@repo/analytics` is audited;
- security headers/CSP once `@repo/security` is audited;
- notifications CSP once `@repo/notifications` is audited.

## Current Surface

Exports:

- `@repo/next-config`
- `@repo/next-config/keys`

Consumers:

- `apps/app/next.config.ts`
- `apps/web/next.config.ts`
- `apps/app/env.ts`
- `apps/web/env.ts`

Provider SDKs:

- none directly.

Env keys:

- Vercel system vars
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WEB_URL`
- optional `NEXT_PUBLIC_API_URL`
- optional `NEXT_PUBLIC_DOCS_URL`

Unused env key scheduled for deletion:

- `ANALYZE`

## Sources Checked

| Source                                                                                   | Type               | Checked Date | Claim Used                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------------ | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js`                        | Official docs      |   2026-05-27 | `next.config` owns framework-level build/runtime options such as headers, rewrites, images, transpilation, and server external packages. |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages` | Official docs      |   2026-05-27 | `serverExternalPackages` opts dependencies out of Server Component/Route Handler bundling when native Node resolution is needed.         |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/transpilePackages`      | Official docs      |   2026-05-27 | `transpilePackages` is for local monorepo packages and selected external dependencies.                                                   |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/headers`                | Official docs      |   2026-05-27 | `headers()` can apply custom response/security headers by route pattern.                                                                 |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites`               | Official docs      |   2026-05-27 | `rewrites()` can proxy external URLs while masking destination paths.                                                                    |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler`          | Official docs      |   2026-05-27 | `reactCompiler: true` is supported and requires the Babel plugin in the app/build endpoint.                                              |
| `https://vercel.com/docs/llms-full.txt`                                                  | Official llms-full |   2026-05-27 | Vercel framework-defined infrastructure means framework config should stay explicit and intentional.                                     |
| `npm view next version peerDependencies engines`                                         | Registry metadata  |   2026-05-27 | Latest `next` is `16.2.6`, matching the workspace and user requirement.                                                                  |
| `npm view @t3-oss/env-nextjs version peerDependencies engines`                           | Registry metadata  |   2026-05-27 | Latest `@t3-oss/env-nextjs` is `0.13.11`, matching the package.                                                                          |
| Local app/config audit                                                                   | Repo evidence      |   2026-05-27 | Apps compose `@repo/next-config`, observability config, and feature flag config through public package exports.                          |

## Local Audit

Commands:

```bash
rg "@repo/next-config|next.config" apps packages
rg "ANALYZE" -n --glob "!legacy/**" .
pnpm --filter @repo/next-config typecheck
```

Findings:

- App `next.config.ts` files consume package-owned config contributors.
- Latest `next` and T3 Env versions are installed.
- `ANALYZE` is unused outside `@repo/next-config/keys`.
- Baseline config still contains provider-specific PostHog/Knock/security policy that must move only during owning package phases.

## Decision

Verdict: keep core; remove unused env key; defer provider policy moves.

Reason:

- Shared config ownership is correct.
- No package version update is needed.
- `ANALYZE` is unused and has no analyzer implementation.
- Moving provider-specific config now would cross package phases and risk app behavior.

## Refactor Checklist

- [x] Public exports are intentional.
- [x] No provider SDK initialization in this package.
- [x] Next 16.2.6 registry metadata checked.
- [x] T3 Env registry metadata checked.
- [x] Consumers searched.
- [x] MADR-083 created.
- [x] Remove unused `ANALYZE` key.
- [x] Package typecheck passes after cleanup.
- [x] Record analytics/security/notifications config debt for their package phases.
- [x] Run affected app/web typechecks and document unrelated web blocker.

## Validation

```bash
pnpm --filter @repo/next-config typecheck
```

Latest validation:

- Pre-change `@repo/next-config` typecheck passed on 2026-05-27.
- Post-change `@repo/next-config` typecheck passed on 2026-05-27.
- Active non-doc `ANALYZE` reference search returned no matches.
- `apps/app` typecheck passed.
- `apps/web` typecheck failed on existing contact/i18n/metadata issues; do not patch in P1.2.

## Open Risks

- PostHog rewrites/CSP still live in the baseline config until P5.3.
- Manual security headers still live in the baseline config until P2.4.
- Knock CSP host still lives in the baseline config until P4.7.
- `transpilePackages` and `serverExternalPackages` are hand-maintained lists; package-contributor composition may be cleaner later.
