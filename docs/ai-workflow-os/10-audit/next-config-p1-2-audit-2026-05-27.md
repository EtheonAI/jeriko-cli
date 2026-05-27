# Next Config P1.2 Audit

Date: 2026-05-27

Package: `@repo/next-config`

Scope:

- shared Next.js config package;
- active app consumers;
- current framework config options;
- env keys.

Out of scope:

- moving analytics/security/notifications config into their packages;
- changing app route config;
- changing Sentry/feature-flag wrappers;
- fixing web/app product routes.

## Current Surface

Exports:

- `@repo/next-config`
- `@repo/next-config/keys`

Current consumers:

- `apps/app/next.config.ts`
- `apps/web/next.config.ts`
- `apps/app/env.ts`
- `apps/web/env.ts`

Provider SDKs:

- none directly.

## Findings

### P1.2-1: `ANALYZE` Env Key Is Unused

`ANALYZE` exists in `packages/next-config/keys.ts`, but active non-doc search found no consumer outside that file.

Decision:

- remove `ANALYZE` from `@repo/next-config/keys`;
- do not add bundle analyzer behavior until a future performance/package phase chooses a package and workflow.

### P1.2-2: Baseline Config Still Contains Provider-Specific Policy

Current `packages/next-config/index.ts` includes:

- PostHog script/connect CSP hosts;
- PostHog `/ingest` rewrites;
- Knock connect CSP host;
- manual security headers and CSP.

Decision:

- do not move these in P1.2 because the owning packages are separate phases;
- record the required future ownership moves:
  - analytics/PostHog config to `@repo/analytics` in P5.3;
  - security headers to `@repo/security` in P2.4;
  - notification CSP needs to `@repo/notifications` in P4.7.

### P1.2-3: `transpilePackages` And `serverExternalPackages` Are Baseline But Should Stay Audited

`transpilePackages` and `serverExternalPackages` are valid Next config options, but hard-coded package lists can drift as packages are gated, removed, or added.

Decision:

- keep current lists in P1.2;
- revisit during package phases when provider ownership changes.

## Checklist

- [x] Official Next.js config docs checked.
- [x] Vercel `llms-full.txt` checked.
- [x] `next` latest registry metadata checked.
- [x] `@t3-oss/env-nextjs` latest registry metadata checked.
- [x] Current exports listed.
- [x] Current consumers searched.
- [x] Current env keys listed.
- [x] Server/client/runtime boundary stated.
- [x] Keep/refactor/defer verdict written.
- [x] MADR-083 created.
- [x] Package playbook updated.
- [x] Remove unused `ANALYZE` env key.
- [x] Run `@repo/next-config` typecheck.
- [x] Run affected app/web typechecks and document web blocker.

## Validation Commands

```bash
pnpm --filter @repo/next-config typecheck
```

Pre-change package typecheck passed:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter @repo/next-config typecheck
```

Post-change package typecheck passed with the same command.

Active non-doc `ANALYZE` reference check:

```bash
rg 'ANALYZE' -n --glob '!legacy/**' --glob '!docs/**' .
```

Result:

- no matches.

Affected app/web typecheck command:

```bash
/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/node /Users/khaleelmusleh/.cache/node/corepack/pnpm/11.3.0/bin/pnpm.cjs --filter app --filter web typecheck
```

Result:

- `apps/app` passed;
- `apps/web` failed on existing web code, not on `@repo/next-config`:
  - `apps/web/app/[locale]/contact/components/contact-form.tsx`: invalid `getTranslations` import from `@repo/internationalization`;
  - `apps/web/app/[locale]/contact/components/contact-form.tsx`: `Calendar` no longer accepts `initialFocus`;
  - `apps/web/app/[locale]/contact/page.tsx`: `createMetadata` call is missing `description`.

Decision:

- do not patch `apps/web` inside P1.2;
- carry these failures into the later web/app or owning package phase.
