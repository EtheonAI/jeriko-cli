# MADR-036: Active Workspace Latest Package Normalization

Status: Accepted

Date: 2026-05-25

## Context

Phase -1 cleanup reduced the active workspace to product apps, shared packages, and explicit tools. The next reset gate was package normalization: the repo previously had mixed Next/React, Zod, Drizzle, AI SDK, tooling, and lint package versions, plus stale package overrides that hid drift.

The target framework baseline is Next.js `16.2.6`. Official Next.js 16 docs state that `next build` uses Turbopack by default, that Webpack can be selected with `--webpack`, and that the upgrade path is to install current Next/React packages. React DayPicker v10 docs also remove old `initialFocus` and `table` keys.

## Decision

Normalize all direct active workspace dependencies to current pnpm-reported latest versions and keep `next@16.2.6`.

The workspace now uses:

- `next@16.2.6`
- `react@19.2.6`
- `react-dom@19.2.6`
- `@next/eslint-plugin-next@16.2.6`
- `turbo@2.9.14`
- `typescript@6.0.3`
- `eslint@10.4.0`
- `typescript-eslint@8.59.4`
- `vitest@4.1.7`
- `@t3-oss/env-nextjs@0.13.10`
- `drizzle-orm@0.45.2`
- `drizzle-kit@0.31.10`
- `zod@4.4.3`
- `ai@6.0.191`
- `@ai-sdk/react@3.0.193`
- `stripe@22.1.1`
- `better-auth@1.6.11`

Also:

- Remove unused `eslint-plugin-next@0.0.0`; keep the real scoped Next plugin.
- Keep T3 Env as the env validation model.
- Make `turbo typecheck` depend on upstream typechecks, not upstream builds.
- Exclude archived `legacy/**` from active ESLint.
- Patch DayPicker v10 API changes in the design-system calendar and web contact form.

## Consequences

Positive:

- `pnpm outdated -r --format json` reports known registry conflicts for `@t3-oss/env-nextjs` and `mint`: exact public npm resolution for the reported latest package/version does not exist for those package names.
- Full `pnpm typecheck` passes.
- Focused `@repo/contracts` and `@repo/search` Vitest projects pass.
- Root package overrides for Zod, Drizzle, AI SDK, and React types are no longer carrying the upgrade.
- Archived Manus code no longer blocks active lint.

Negative / remaining:

- `pnpm build` is not green because `web#build` still depends on `@repo/cms#build`, which requires `BASEHUB_TOKEN`.
- `apps/app` production build needs a focused hang audit. With dummy required env, both default Turbopack and `--webpack` builds reached `Creating an optimized production build ...` and then became idle.
- `pnpm lint` is not green: 873 active problems remain after excluding `legacy/**`.
- Direct dependency latest does not remove deprecated transitive dependency warnings.

## Alternatives Considered

- Keep package families partially upgraded: rejected because mixed framework/tooling versions were hiding real migration problems.
- Downgrade to stale local `npm view` / `pnpm view` metadata: rejected because the installed lockfile, pnpm update result, and user target require newer versions.
- Keep `typecheck` depending on `^build`: rejected because typecheck should not require secret-backed CMS generation.
- Keep `legacy/**` in active lint: rejected because archived reference code is not active product surface.

## Evidence

Primary docs checked:

- Next.js 16 upgrade guide: `https://nextjs.org/docs/app/guides/upgrading/version-16`
- Next.js CLI guide: `https://nextjs.org/docs/app/api-reference/cli/next`
- T3 Env docs: `https://env.t3.gg/docs/introduction`, `https://env.t3.gg/docs/nextjs`, `https://env.t3.gg/docs/core`, `https://env.t3.gg/docs/customization`
- React DayPicker v10 upgrade guide: `https://daypicker.dev/upgrading`
- ESLint flat config ignore docs: `https://eslint.org/docs/latest/use/configure/ignore`

Command evidence:

```bash
pnpm update --latest -r --config.prefer-offline=false
pnpm --store-dir /Users/khaleelmusleh/Library/pnpm/store/v10 install
pnpm outdated -r --format json
pnpm typecheck
pnpm exec vitest run --project @repo/contracts --passWithNoTests
pnpm exec vitest run --project @repo/search --passWithNoTests
pnpm lint
pnpm build
```

Results:

- `pnpm outdated -r --format json`: only the known `@t3-oss/env-nextjs` and `mint` metadata conflicts remain.
- `pnpm typecheck`: 27 successful tasks.
- `@repo/contracts`: 6 test files, 112 tests passed.
- `@repo/search`: 1 test file, 9 tests passed.
- `pnpm lint`: 873 active problems remain after excluding `legacy/**`.
- `pnpm build`: blocked by `BASEHUB_TOKEN` through `@repo/cms#build`.

## Impacted Files / Packages

- `package.json`
- `pnpm-lock.yaml`
- `turbo.json`
- `eslint.config.mjs`
- `packages/design-system/components/ui/calendar.tsx`
- `apps/web/app/[locale]/contact/components/contact-form.tsx`
- Active package manifests across `apps/*`, `packages/*`, and `tools/*`

## Validation Checklist

- [x] Active direct dependencies updated.
- [x] `pnpm outdated -r --format json` has only documented `@t3-oss/env-nextjs` and `mint` metadata conflicts.
- [x] Full typecheck passes.
- [x] Focused contracts tests pass.
- [x] Focused search tests pass.
- [x] Legacy code excluded from active lint.
- [x] Unused `eslint-plugin-next@0.0.0` removed.
- [ ] Active production build passes.
- [ ] Active lint passes.
- [ ] App production build hang root cause is identified and fixed.
