# Env Validation And Loading Research

Date researched: 2026-05-23

## Sources

- T3 Env introduction: https://env.t3.gg/docs/introduction
- T3 Env Next.js guide: https://env.t3.gg/docs/nextjs
- T3 Env core guide: https://env.t3.gg/docs/core
- T3 Env customization guide: https://env.t3.gg/docs/customization
- Next.js environment variables guide: https://nextjs.org/docs/app/guides/environment-variables
- Vercel environment variables docs: https://vercel.com/docs/environment-variables

## Claims And Evidence

### T3 Env should be the validation and typed access layer

T3 Env exists to define schemas and safely use environment variables with autocomplete, validation, server/client separation, defaults, and transforms. It also protects against client access to server variables.

Impact: application and package code should import typed env objects from T3 Env modules instead of reading `process.env` ad hoc.

### Next apps should use `@t3-oss/env-nextjs`

The T3 Next.js guide says `@t3-oss/env-nextjs` is preconfigured for Next.js and enforces additional runtime compatibility rules. It also says Next.js `runtimeEnv` is strict by default, so keys must be explicitly destructured unless using the documented `experimental__runtimeEnv` path for supported Next versions.

Impact: Next apps and packages consumed by Next should use `@t3-oss/env-nextjs`, not plain dotenv parsing.

### Build validation should happen through app env imports

T3 recommends importing the env file in `next.config.ts` for build-time validation. For Next.js 16, the documented shape is a direct TypeScript import, not a `jiti` workaround.

Impact: active Next apps should import their app env contract from `next.config.ts` for validation. `apps/api` has since been deactivated, so current active scope is `apps/app` and `apps/web`.

### Empty strings should become undefined

The T3 core/customization docs recommend `emptyStringAsUndefined: true` for new projects so blank `.env.example` values do not bypass defaults or fail optional values as empty strings.

Impact: every T3 `createEnv` module should set `emptyStringAsUndefined: true`, especially because this repo has many `.env.example` entries set to `""`.

### Next/Vercel should load env files for Next apps

The Next.js guide says Next has built-in support for loading `.env*` files into `process.env`; Vercel manages environment variables through project settings/CLI and injects them into deployments. Next's `@next/env` helper exists for loading Next-style env files outside the Next runtime, such as ORM configs or test runners.

Impact: do not add app-level `dotenv` usage. Use Next/Vercel loading for apps. For standalone scripts and CLIs, prefer explicit environment injection (`vercel env run`, shell env, CI env, or Node runtime env-file flags) plus T3 validation. A direct `@next/env` import is an audited exception, not the default.

### `@t3-oss/env-core` is for framework-agnostic runtime env

The T3 core guide is for non-Next frameworks or framework-agnostic code that needs an explicit `clientPrefix`. Because this repo's env modules are mostly consumed by Next apps and packages used inside Next, `@t3-oss/env-nextjs` is the default. Use `@t3-oss/env-core` only if a package is truly not Next-coupled and needs its own prefix/runtime.

Impact: avoid declaring both `@t3-oss/env-core` and `@t3-oss/env-nextjs` unless the package imports both directly.

## Repo-Specific Findings

- `apps/app/env.ts` currently extends many package env contracts, including AgentMail, payments, database, security, webhooks, and notifications.
- That broad app env contract caused build validation to fail on unrelated `AGENTMAIL_API_KEY` while building app code that did not need AgentMail at config time.
- Some package modules instantiate external clients at import time, which makes validation happen earlier than the route/action that actually needs the secret.
- Source scan after cleanup finds no direct `dotenv` or `@next/env` imports in active `apps`, `packages`, or `scripts`.
- `@next/env` still appears in `pnpm-lock.yaml` as a transitive dependency of `next@16.2.6` and `@vercel/microfrontends`; this is not app source usage.
- `dotenv` still appears in `pnpm-lock.yaml` as a transitive dependency of release/build/vendor tooling, including `@auto-it/core`, `@changesets/changelog-github`, Prisma config dependencies pulled through Drizzle/Better Auth peer graphs, BaseHub, and Sentry bundler tooling. It is not directly declared in workspace `package.json` files.
- `packages/database/src/client.ts`, `packages/database/src/service-client.ts`, `packages/database/drizzle.config.ts`, and database seed/migration scripts now use `packages/database/keys.ts` for T3 validation instead of custom `.env` parsing.
- `packages/database/scripts/billing-migration.mjs` was deleted because it duplicated the TypeScript migration script and manually parsed `packages/database/.env`.

## Decision Direction

Use T3 Env as the single validation/typed-access contract.

Use Next/Vercel as the env loader for Next apps.

Do not import `@next/env` by default. If a standalone script truly needs Next-compatible file loading, document that exception first. The preferred path is explicit env injection plus T3 validation.

Do not use direct `dotenv` or custom `.env` parsing in app, package, service, or script source code.

Do not use broad app env aggregators that force every optional integration secret to exist for every build. App env contracts should be scoped to the app's required surface, and feature-specific secrets should be validated in feature/package env modules at the boundary where the feature runs.

## Implementation Checklist

- [ ] Add `emptyStringAsUndefined: true` to every T3 `createEnv` module.
- [ ] Keep `@t3-oss/env-nextjs` for Next app/package env modules.
- [ ] Remove direct `@t3-oss/env-core` dependencies from packages that do not import it directly.
- [ ] Import each app env file from its `next.config.ts` for build validation.
- [ ] Narrow `apps/app/env.ts` to the primary app's build/runtime contract.
- [ ] Keep optional integration env optional unless the feature is mandatory for boot.
- [ ] Move feature-specific required secrets to feature route/action/service boundaries.
- [x] Remove direct `dotenv` usage from standalone scripts.
- [x] Remove manual `.env` parsing from `packages/database` clients/config/scripts.
- [x] Delete duplicated manual-loader migration script.
- [x] Verify source search has no direct `dotenv` or `@next/env` imports.
- [ ] Verify with `pnpm -r --if-present typecheck`, targeted app builds, and root build.

## Open Questions

- Should `apps/api` remain a separate Next app or be merged/archived during the reset? Answered later: it was moved to `legacy/deactivated-apps/api` until a separate API deploy boundary is proven.
- Which integrations are mandatory for local app boot versus optional product features?
- Should shared packages expose split `env/server.ts` and `env/client.ts` contracts to avoid shipping server variable names to client bundles?

## Package Version Checks

- `@t3-oss/env-nextjs`: exact npm package resolution for `0.13.11` returned 404, while `@t3-oss/env-nextjs` dist-tags/versions list `latest: 0.13.10`. `pnpm outdated` can still report `0.13.11` because `@t3-oss/env-core` has that version. Do not set manifests to `0.13.11` unless exact `@t3-oss/env-nextjs@0.13.11` resolution succeeds.
- `@t3-oss/env-core`: npm latest is `0.13.11`, but this repo should not declare it directly unless a package imports `@t3-oss/env-core`; `@t3-oss/env-nextjs` brings its matching core dependency transitively.
- `@repo/service-utils` used to be a valid direct `@t3-oss/env-core` user because it was framework-agnostic Fastify/service code. It is now under `legacy/manus-clone/service-utils`, so there is no active `@t3-oss/env-core` exception unless a new active non-Next package imports it directly.
- `stripe`: local `@repo/payments` uses `stripe@22.1.1`. Public release information for stripe-node v22.1.x aligns with API version `2026-04-22.dahlia`, so that is the correct configured `apiVersion` for the current payment package unless a Stripe migration audit chooses otherwise.
