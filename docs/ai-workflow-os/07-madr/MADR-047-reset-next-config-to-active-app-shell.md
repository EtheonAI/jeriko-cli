# MADR-047: Reset next-config to the Active App Shell

Status: Accepted and implemented

Date: 2026-05-25

## Context

`packages/next-config` still carried assumptions from the old Manus/E2B app: E2B CSP allowances, broad WebSocket allowances, old workspace package transpilation, and server external packages for removed collaboration/webhook/runtime surfaces.

The app has now been reset to a dashboard/auth shell. Shared Next config should match the active app surface, not the old product.

## Decision

Reset `packages/next-config` to the current active app shell:

- Remove E2B `connect-src` and `frame-src` CSP entries.
- Remove broad `ws:`/`wss:` CSP allowance until a realtime contract exists.
- Keep analytics, Sentry, Google Analytics, and Knock CSP allowances because those packages remain in the app shell and degrade when env is absent.
- Use `unsafe-eval` only outside production.
- Remove `experimental.optimizePackageImports` during reset.
- Limit `transpilePackages` to active reset-shell workspace packages.
- Limit `serverExternalPackages` to active native/server dependencies.
- Gate BetterStack logging config on actual BetterStack/Logtail env vars.
- Preserve existing `transpilePackages` when applying Sentry config.

## Evidence

- Next.js documents `serverExternalPackages` as an opt-out for packages needing native Node.js resolution. https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
- Next.js documents `transpilePackages` for monorepo/local package transpilation. https://nextjs.org/docs/pages/api-reference/config/next-config-js/transpilePackages
- Next.js CSP guidance says `unsafe-eval` is required in development but not production by default. https://nextjs.org/docs/app/guides/content-security-policy
- Next.js documents `optimizePackageImports` as experimental and lists several libraries as optimized by default. https://nextjs.org/docs/pages/api-reference/config/next-config-js/optimizePackageImports
- Installed `@logtail/next@0.3.1` source requires BetterStack/Logtail source token plus ingest URL, or a custom endpoint, before the config wrapper produces useful rewrites.
- Local package import audit showed no active `apps/app` imports of `@repo/ai`, `@repo/collaboration`, `@repo/seo`, `@repo/webhooks`, `ai`, `@liveblocks/node`, or `svix`.

## Consequences

Positive:

- Shared Next config now matches the reset app instead of the old Manus clone.
- Default Turbopack build no longer announces unused experimental package-import optimization.
- BetterStack no longer logs build-time warnings when not configured.
- Vercel/Sentry config no longer drops workspace package transpilation.
- E2B iframe/connect policy is removed from the active app.

Negative:

- Reintroducing sandbox browser, realtime, webhooks, or workflow file preview will require explicit CSP and package-list changes.
- A future nonce-based CSP hardening phase is still needed.

## Impacted Files and Packages

- `packages/next-config/index.ts`
- `packages/observability/next-config.ts`
- `packages/observability/keys.ts`
- `apps/app/.env.example`

## Validation Checklist

- [x] Run `pnpm --filter @repo/next-config typecheck`.
- [x] Run `pnpm --filter @repo/observability typecheck`.
- [x] Run `pnpm --filter app typecheck`.
- [x] Run default `pnpm --filter app build` with Turbopack.
- [x] Run stale E2B/old package scan.
- [x] Run `git diff --check`.
