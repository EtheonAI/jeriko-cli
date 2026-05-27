# TypeScript And ESLint Config Audit

Date audited: 2026-05-23

## Sources

- Next.js TypeScript docs: https://nextjs.org/docs/app/api-reference/config/typescript
- Next.js ESLint docs: https://nextjs.org/docs/app/api-reference/config/eslint
- Local files: `packages/typescript-config/base.json`, `packages/typescript-config/nextjs.json`, `eslint.config.mjs`, `package.json`, app/package `tsconfig.json` files.

## Verdict

The repo is configured for TypeScript, and the baseline TypeScript strictness is good.

The repo had ESLint configured, but the monorepo setup was incomplete before this audit because `@next/eslint-plugin-next` was not told where the Next apps live. This caused plugin warnings during lint. The root ESLint config now sets `settings.next.rootDir` for active Next apps `apps/app` and `apps/web`; `apps/api` has been deactivated.

## TypeScript Findings

- TypeScript version: `6.0.3`.
- Next.js version in `apps/app`: `16.2.6`.
- Base config enables strict checks:
  - `strict`
  - `strictNullChecks`
  - `noUncheckedIndexedAccess`
  - `isolatedModules`
  - `forceConsistentCasingInFileNames`
- Next config enables:
  - Next TypeScript plugin
  - `moduleResolution: "Bundler"`
  - JSX preserve
  - no emit
  - app aliases `@/*` and `@repo/*`

## ESLint Findings

- ESLint version: `10.2.1`.
- Next ESLint plugin: `@next/eslint-plugin-next@16.2.6`.
- The official Next docs allow direct use of `@next/eslint-plugin-next` for custom configs.
- The official Next docs require `settings.next.rootDir` when using the plugin in a monorepo where Next apps are not at the repo root.
- Root config now ignores generated/build output:
  - `.next`
  - `dist`
  - `build`
  - `coverage`
  - `node_modules`
  - `.turbo`
- Root scripts now include:
  - `pnpm lint`
  - `pnpm typecheck`

## What Is Still Not Senior Enough

- There is no shared internal `@repo/eslint-config` package yet; the root config is centralized but not packaged.
- ESLint is not type-aware yet; it uses `typescript-eslint` recommended, not project-service typed rules.
- Full-repo lint is not clean yet.
- Some legacy/test fixture routes still sit inside active app routing and should be moved or deleted during the route reset.
- Build validation currently requires real required env, including `DATABASE_URL`.

## Validation

- `pnpm --filter app typecheck`: passed after env/type fixes.
- `pnpm --filter @repo/next-config typecheck`: passed.
- Targeted ESLint over modified env/config files: passed.
- `pnpm lint`: failed with 1,224 total problems, including 1,192 errors and 32 warnings.
- `pnpm --filter app build`: blocked on missing required `DATABASE_URL`, which is expected unless local env is provided.

## Full Lint Failure Categories

- Test suites contain many `any`, unused variables, and CommonJS `require()` calls.
- Active app routes/components contain `any`, unused imports, `react-hooks` dependency warnings, `react-hooks/incompatible-library` warnings, and raw `<img>` usage.
- Service packages contain many `any` types, unused variables, and unsafe `Function` types.
- Several service `src/lib/db.ts` shims still use broad `any`; these should be replaced with typed shared database exports or deleted during service cleanup.

## Required Follow-Up Checklist

- [ ] Decide whether to introduce `@repo/eslint-config` for app/package/service presets.
- [ ] Add type-aware ESLint only after checking current `typescript-eslint` project-service docs and performance impact.
- [x] Run full `pnpm lint` and document existing failures.
- [ ] Split lint cleanup into app, packages, services, and tests phases.
- [ ] Run full `pnpm typecheck` after required env is available or after task graph is adjusted so typecheck does not depend on build.
- [ ] Keep TypeScript strict settings during reset.
- [ ] Do not disable TypeScript or ESLint errors in Next production builds.
