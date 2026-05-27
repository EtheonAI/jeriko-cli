# MADR-041: Keep feature flags while lazy-loading product auth

Status: Accepted

Date: 2026-05-25

## Context

`apps/web` should keep feature-flag toolbar support and the `/.well-known/vercel/flags` metadata route. Removing feature flags from the marketing app was the wrong cleanup move.

The actual build problem was that `@repo/feature-flags/lib/create-flag.ts` imported `@repo/auth` at module load. `@repo/auth` imports `@repo/database`, which validates `DATABASE_URL`. That made the marketing app build require product database env whenever the flags metadata route imported the feature flag package.

## Decision

Keep `@repo/feature-flags` in `apps/web`.

Keep `FLAGS_SECRET` in the T3 Env contract through `@repo/feature-flags/keys`, and use `env.FLAGS_SECRET` in `apps/web/proxy.ts`.

Move product auth/analytics imports inside the feature flag `decide()` function so metadata/build paths can load flag definitions without validating product database env. Product auth/database is loaded only when a flag is actually evaluated.

## Consequences

Positive:

- `apps/web` keeps Vercel Toolbar / feature flag support.
- The web app no longer needs `DATABASE_URL` just to build.
- Env access stays centralized through T3 Env.
- The product DB/auth dependency remains available for real flag evaluation.

Negative / follow-up:

- If a static marketing page directly evaluates a product-backed flag at build time, it can still require product auth/database. Marketing pages should avoid product-backed flag evaluation until their runtime boundary is explicit.
- Long term, feature flags should expose separate marketing/static flags and authenticated product flags.

## Alternatives Considered

- Remove feature flags from `apps/web`: rejected because the app should keep feature flag support.
- Use `process.env.FLAGS_SECRET` in web proxy: rejected because it bypasses the T3 Env contract.
- Require `DATABASE_URL` for marketing builds: rejected because marketing/content should not depend on product DB.

## Evidence

Commands:

```bash
pnpm --filter @repo/feature-flags typecheck
pnpm --filter web typecheck
pnpm --filter web build
```

Observed result:

- `@repo/feature-flags` typecheck passes.
- `apps/web` typecheck passes.
- `apps/web` production build passes under Next `16.2.6` without `DATABASE_URL`.
- `apps/web` keeps `/.well-known/vercel/flags`.

## Impacted Files

- `packages/feature-flags/lib/create-flag.ts`
- `apps/web/env.ts`
- `apps/web/proxy.ts`
- `apps/web/next.config.ts`
- `apps/web/app/[locale]/layout.tsx`
- `apps/web/app/.well-known/vercel/flags/route.ts`

## Validation Checklist

- [x] Feature flags kept in `apps/web`.
- [x] `FLAGS_SECRET` restored to T3 Env.
- [x] Web proxy uses `env.FLAGS_SECRET`, not `process.env`.
- [x] Product auth/database imports lazy-loaded inside flag evaluation.
- [x] `apps/web` build passes without `DATABASE_URL`.
