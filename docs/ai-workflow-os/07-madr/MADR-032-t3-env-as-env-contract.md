# MADR-032: Use T3 Env As The Env Contract

**Status:** Accepted

## Context

The repo needs typed, validated, server/client-safe environment variables across Next apps and shared packages. The current env layer is centralized, but `apps/app/env.ts` extends too many package contracts and can fail a build because an unrelated optional integration secret is missing.

The repo also contained ad hoc env loading patterns, including direct `dotenv` usage in a fixture script and manual `.env` parsing in database clients/scripts.

## Decision

Use T3 Env as the single env validation and typed-access contract.

Use Next/Vercel as the loader for Next apps. Do not use `dotenv` in app/runtime code, packages, services, or scripts. Do not hand-parse `.env` files.

For standalone scripts, prefer explicit environment injection (`vercel env run`, shell env, CI env, or Node runtime env-file flags) plus T3 validation. A direct `@next/env` import is only allowed as a documented exception for a standalone command that truly needs Next-compatible `.env*` loading outside `next dev/build`.

Use `@t3-oss/env-nextjs` for Next apps and packages consumed by Next. Use `@t3-oss/env-core` only when a package directly needs framework-agnostic env handling.

The previous active `@t3-oss/env-core` exception was `@repo/service-utils`, but that package is now legacy-only under `legacy/manus-clone/service-utils`. New active `@t3-oss/env-core` usage requires a package-level reason and direct import.

Every T3 env module should set `emptyStringAsUndefined: true`.

App env files must stay scoped to the app's actual boot/build contract. Feature-specific optional integrations should validate their own env at the feature boundary instead of forcing the whole app build to require every integration secret.

## Consequences

- Build-time env validation remains strong.
- Server/client boundaries stay explicit.
- Optional integrations stop breaking unrelated app builds.
- Direct `process.env` reads should become exceptions, not normal runtime access.
- Standalone scripts should use the same T3 env contracts as the app/package they exercise, with env supplied by the caller.
- Transitive `dotenv` and `@next/env` dependencies may remain through third-party packages; source code should not import them directly without an ADR-level exception.

## Alternatives Considered

- Use only `process.env`: simple but loses type safety, defaults, transforms, and client/server guardrails.
- Use direct `dotenv`: loads files but does not validate or protect client/server boundaries.
- Use `@next/env` everywhere: useful loader outside Next, but not a schema/typing system and not needed when env is injected by Vercel/CI/shell.
- Keep one huge app env aggregator: centralized, but it couples optional integrations to every build and route.

## Evidence

- T3 Env introduction: https://env.t3.gg/docs/introduction
- T3 Env Next.js guide: https://env.t3.gg/docs/nextjs
- T3 Env core guide: https://env.t3.gg/docs/core
- T3 Env customization guide: https://env.t3.gg/docs/customization
- Next.js environment variables guide: https://nextjs.org/docs/app/guides/environment-variables
- Vercel environment variables docs: https://vercel.com/docs/environment-variables
- Local evidence: `apps/app/env.ts`, `apps/web/env.ts`, archived `legacy/deactivated-apps/api/env.ts`, `packages/*/keys.ts`, `packages/database/src/client.ts`, `packages/database/src/service-client.ts`, `packages/database/drizzle.config.ts`, `packages/database/scripts/billing-migration.ts`, `scripts/seed-library-test.ts`, `apps/app/app/(authenticated)/chat/[id]/fixtures/seed-test-chat.ts`.

## Impacted Files And Packages

- `apps/app/env.ts`
- `apps/web/env.ts`
- `legacy/deactivated-apps/api/env.ts`
- `apps/*/next.config.ts`
- `packages/*/keys.ts`
- `packages/database/src/client.ts`
- `packages/database/src/service-client.ts`
- standalone fixture/scripts that previously loaded env manually

## Validation Checklist

- [ ] Official docs checked before env code changes.
- [ ] App env files imported in `next.config.ts`.
- [ ] T3 modules use `emptyStringAsUndefined: true`.
- [x] No direct `dotenv` usage remains in source code.
- [x] No direct `@next/env` usage remains in source code.
- [x] No custom `.env` parser remains in source code.
- [ ] `@t3-oss/env-core` is only declared where directly imported.
- [ ] Optional integration secrets are optional at app boot.
- [ ] Required feature secrets are validated at feature execution boundaries.
- [ ] `pnpm -r --if-present typecheck` passes.
- [ ] Targeted Next app builds pass.
