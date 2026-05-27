# Package Upgrade Validation Audit

Date: 2026-05-25

Scope: active workspace package update, pnpm 11 migration, direct dependency latest status, runtime/lint baseline, and post-upgrade blockers.

## Summary

The active workspace package upgrade is now direct-dependency clean under fresh registry metadata.

What is proven:

- Active workspace install passes with `pnpm@11.3.0` under Node `22.22.1`.
- `pnpm outdated -r --format json` returns `{}` under pnpm 11.
- `next@16.2.6`, `@next/eslint-plugin-next@16.2.6`, `@t3-oss/env-nextjs@0.13.11`, and `mint@4.2.577` are exact public npm versions; earlier 404 conclusions came from stale local metadata.
- `pnpm typecheck` passes under Node `22.22.1`: 27 successful tasks.
- Focused contracts/search tests pass under Node `22.22.1` and pnpm `11.3.0`.
- Docs broken-link lint passes under `mint@4.2.577`.
- pnpm 11 build-script approval is explicit through `allowBuilds`.
- Lint tooling runs under the upgraded stack.
- Legacy Manus code is no longer part of active lint.

What is not proven:

- Production build is not green.
- Lint is not green.
- Deprecated transitive dependency warnings remain.

## Active Workspace State

- App surfaces: `apps/app`, `apps/web`, `apps/docs`, `apps/email`, `apps/storybook`, `apps/studio`
- Active packages: packages under `packages/*`
- Archived/deactivated code: `legacy/manus-clone`, `legacy/deactivated-apps/api`

`pnpm-workspace.yaml` includes only:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

MADR-037 superseded the intermediate `tools/*` app-surface split. Keep `tools/*` only if repo-only tool packages are introduced later.

## Runtime And Package Manager

Current baseline:

| Area               | Version / policy                              |
| ------------------ | --------------------------------------------- |
| Node               | `>=22.22.1`, with `.nvmrc` set to `22.22.1`   |
| pnpm               | `11.3.0` via `packageManager`                 |
| Engine validation  | `engineStrict: true`                          |
| Registry freshness | `.npmrc` uses `prefer-offline=false`          |
| pnpm 11 config     | install policy lives in `pnpm-workspace.yaml` |
| Build scripts      | explicit `allowBuilds` true/false map         |

Why Node `22.22.1`:

- `pnpm@11.3.0` requires Node `>=22.13`.
- `lint-staged@17.0.5` requires Node `>=22.22.1`.
- Next.js 16 only requires Node `20.9+`, but current lint/package-manager tooling sets the higher floor.

## Direct Dependency Status

Fresh pnpm 11 result:

```bash
pnpm outdated -r --format json
# {}
```

Critical active versions:

| Family                  | Versions                                                                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Next/React              | `next@16.2.6`, `react@19.2.6`, `react-dom@19.2.6`, `@next/eslint-plugin-next@16.2.6`                                  |
| Package manager/runtime | `pnpm@11.3.0`, Node `22.22.1+`                                                                                        |
| Tooling                 | `turbo@2.9.14`, `typescript@6.0.3`, `eslint@10.4.0`, `typescript-eslint@8.60.0`, `vitest@4.1.7`, `lint-staged@17.0.5` |
| Env                     | `@t3-oss/env-nextjs@0.13.11`, `zod@4.4.3`                                                                             |
| Docs CLI                | `mint@4.2.577`, `react@19.2.6`, `react-dom@19.2.6` in `apps/docs`                                                     |
| Data                    | `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`                                                                           |
| AI                      | `ai@6.0.191`, `@ai-sdk/react@3.0.193`, `@assistant-ui/react@0.14.8`                                                   |
| Product services        | `stripe@22.1.1`, `better-auth@1.6.11`, `posthog-node@5.35.2`, `resend@6.12.4`                                         |
| UI/email                | `@tanstack/react-virtual@3.13.26`, `react-email@6.3.3`                                                                |

Remaining install warning:

```text
14 deprecated subdependencies found:
@esbuild-kit/core-utils@3.3.2, @esbuild-kit/esm-loader@2.6.5,
glob@7.1.6, glob@7.2.3, inflight@1.0.6, lodash.get@4.4.2,
oniguruma-to-js@0.4.3, prebuild-install@7.1.3, puppeteer@22.14.0,
rimraf@2.7.1, rimraf@3.0.2, uuid@10.0.0, uuid@8.3.2, uuid@9.0.1
```

Interpretation: direct packages are current; deprecated transitive packages need a separate dependency-tree cleanup because they come through upstream packages like Drizzle/Mintlify/Storybook/Sentry and cannot always be fixed by direct manifest bumps.

## pnpm 11 Build Script Policy

Allowed build scripts:

- `@parcel/watcher`
- `@sentry/cli`
- `@swc/core`
- `esbuild`
- `keytar`
- `protobufjs`
- `sharp`

Denied build scripts:

- `core-js`
- `core-js-pure`
- `msw`
- `puppeteer`

Reasoning is recorded in MADR-038. The important part is that browser downloads and funding/informational postinstalls do not happen silently during dependency install.

## Verification Results

Passed:

- `source "$HOME/.nvm/nvm.sh" && nvm install 22.22.1 && nvm use 22.22.1`
- `pnpm install --config.confirmModulesPurge=false` under pnpm `11.3.0`
- `pnpm outdated -r --format json` returned `{}`
- `pnpm typecheck` under Node `22.22.1`: 27 successful tasks
- `pnpm exec vitest run --project @repo/contracts --passWithNoTests`: 6 files, 112 tests passed
- `pnpm exec vitest run --project @repo/search --passWithNoTests`: 1 file, 9 tests passed
- `pnpm --filter docs lint`: Mintlify broken-link check passed with no broken links
- `pnpm --filter web typecheck`: passed after removing active BaseHub imports and restoring T3-backed feature flags
- `pnpm --filter web build`: passed under Next `16.2.6` without `BASEHUB_TOKEN` or `DATABASE_URL`
- `git diff --check`: passed

Failed or blocked:

- `pnpm lint`: runs but fails on existing active code debt
- `pnpm build`: previously blocked by `BASEHUB_TOKEN` through `@repo/cms#build`
- `pnpm --filter app build`: previously failed without env and then hung with dummy env after reaching Next production optimization

Not rerun in this subphase:

- production builds after the pnpm 11 lockfile update

## Build Blockers

### Root Build

`pnpm build` previously failed because the root build includes `web`, and `web#build` depends on `@repo/cms#build`.

Failure:

```text
@repo/cms:build: Token not found. Make sure to include the BASEHUB_TOKEN env var.
```

Decision needed:

- Keep `apps/web` as an active production app and configure its CMS env/build path.
- Or move `apps/web` out of default root build until marketing/CMS is intentionally restored.
- Or remove BaseHub/CMS dependency from the active base if the new platform does not need it.

### App Build

`pnpm --filter app build` previously failed strict T3 Env validation when required server env was absent.

Required env discovered by build gates:

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `AGENTMAIL_API_KEY`

With dummy-shaped local values, both Turbopack and Webpack builds previously reached:

```text
Creating an optimized production build ...
```

Then the process remained alive and idle. That still needs a focused Next build audit.

## Lint Blockers

Current lint command under Node `22.22.1` and pnpm `11.3.0`:

```bash
pnpm lint
```

Result:

- 873 total problems
- 841 errors
- 32 warnings
- 4 errors and 2 warnings potentially fixable with `--fix`

Top rule families remain:

| Rule                                 | Count / priority                                                  |
| ------------------------------------ | ----------------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any` | Largest active class; domain types or `unknown` narrowing needed. |
| `@typescript-eslint/no-unused-vars`  | Large class across tests/components/imports.                      |
| `react-hooks/set-state-in-effect`    | React Compiler / hooks cleanup required.                          |
| `@next/next/no-img-element`          | Replace product images with `next/image` where appropriate.       |
| `react-hooks/refs`                   | Ref access during render in active UI components.                 |
| `react-hooks/exhaustive-deps`        | Hook dependency cleanup.                                          |

Highest-priority directories remain:

| Directory                | Priority                            |
| ------------------------ | ----------------------------------- |
| `apps/app/app`           | Highest; product UI/app code.       |
| `packages/ai/components` | Highest; AI surface and renderers.  |
| `apps/app/lib`           | High; runtime/library code.         |
| `packages/ai/lib`        | High; AI runtime library.           |
| `packages/ai/hooks`      | High; client hooks.                 |
| `apps/app/__tests__`     | Medium; clean tests after app code. |

## Cleanup Decisions Made

- `.npmrc` no longer carries pnpm install policy; it keeps registry/cache settings only.
- pnpm install policy moved to `pnpm-workspace.yaml`.
- Node baseline raised to `22.22.1`.
- `apps/docs` uses only `docs.json`; legacy `mint.json` was removed after the latest Mintlify CLI auto-generated `docs.json`.
- Stale Mintlify starter links were updated to current external Mintlify docs URLs.
- `legacy/**` is ignored by ESLint because it is archived reference code, not active product code.
- `eslint-plugin-next@0.0.0` was removed because the active config uses `@next/eslint-plugin-next`.
- `turbo typecheck` no longer depends on upstream `build`.
- DayPicker v10 API changes were patched.

## Next Audit Phase

Order:

1. Fix app production build hang with a narrow Next build audit.
2. Make lint meaningful by cleaning active app and `@repo/ai` in priority order.
3. Add dead-code tooling, likely Knip, after the app/package boundaries are final.
4. Decide whether `packages/cms` is archived, kept as a legacy package, or replaced by a new content package.
5. Only then start workflow kernel implementation.

## Checklist

- [x] Active direct dependencies latest: `pnpm outdated -r --format json` returns `{}`.
- [x] pnpm upgraded to `11.3.0`.
- [x] Node baseline upgraded to `22.22.1`.
- [x] pnpm 11 install passes.
- [x] Full typecheck passes.
- [x] Legacy code excluded from active lint.
- [x] Fake Next ESLint plugin removed.
- [x] Keep `apps/web` as the marketing/content app.
- [x] Move docs/email/Storybook/studio back under `apps/*` per MADR-037.
- [x] Rerun focused core tests under pnpm 11.
- [x] Pass docs broken-link lint under `mint@4.2.577`.
- [x] Decide not to invest in BaseHub as the future CMS.
- [x] Remove BaseHub-backed `@repo/cms` from `apps/web`.
- [x] Keep feature flags in `apps/web` with T3 Env and lazy product auth/database loading.
- [x] Pass `apps/web` production build without `BASEHUB_TOKEN` or `DATABASE_URL`.
- [ ] Decide `packages/cms` archival/replacement path.
- [ ] Diagnose app production build hang.
- [ ] Reduce active lint to zero or define a scoped baseline gate.
- [ ] Add dead-code/dependency tooling after app strategy decision.
