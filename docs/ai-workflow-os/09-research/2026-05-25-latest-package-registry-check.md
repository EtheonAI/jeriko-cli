# Latest Package Registry Check

Date: 2026-05-25

Scope: active workspace package normalization after legacy service deactivation and multi-app monorepo cleanup.

## Correction Notice

This file supersedes the earlier stale-cache conclusion that `next@16.2.6`, `@next/eslint-plugin-next@16.2.6`, `@t3-oss/env-nextjs@0.13.11`, and `mint@4.2.577` were not exact public npm versions.

Root cause: the repo previously had `prefer-offline=true` in `.npmrc`, and local `pnpm view` / `npm view` calls used stale metadata. Fresh registry checks and direct npm registry JSON confirm those versions exist.

Decision: keep fresh registry metadata by default and document CLI/cache mismatches instead of downgrading.

## Sources Checked

- npm registry JSON and fresh `npm view --prefer-online` for exact version evidence.
- Next.js 16 upgrade guide: `https://nextjs.org/docs/app/guides/upgrading/version-16`
- Next.js CLI guide: `https://nextjs.org/docs/app/api-reference/cli/next`
- pnpm 11 settings: `https://pnpm.io/settings`
- pnpm build approvals: `https://pnpm.io/cli/approve-builds`
- pnpm workspace docs: `https://pnpm.io/workspaces`
- Vercel Node.js versions: `https://vercel.com/docs/functions/runtimes/node-js/node-js-versions`
- lint-staged migration guide: `https://github.com/lint-staged/lint-staged/blob/main/MIGRATION.md`
- Node.js 22.22.1 LTS release: `https://nodejs.org/en/blog/release/v22.22.1`
- T3 Env docs: `https://env.t3.gg/docs/introduction`, `https://env.t3.gg/docs/nextjs`, `https://env.t3.gg/docs/core`, `https://env.t3.gg/docs/customization`
- Mintlify CLI install docs: `https://www.mintlify.com/docs/installation`
- Mintlify `docs.json` settings: `https://www.mintlify.com/docs/organize/settings`
- Mintlify CLI commands: `https://www.mintlify.com/docs/cli/commands`
- Mintlify broken links / redirects: `https://www.mintlify.com/docs/create/redirects`
- React DayPicker v10 upgrade guide: `https://daypicker.dev/upgrading`
- ESLint flat config ignore docs: `https://eslint.org/docs/latest/use/configure/ignore`

## Fresh Registry Evidence

Registry/package manager:

```bash
npm view pnpm version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-pnpm --prefer-online
# 11.3.0

npm view pnpm@11.3.0 engines --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-pnpm-11 --prefer-online
# { node: '>=22.13' }
```

Next/T3/Mintlify:

```bash
curl -sL https://registry.npmjs.org/next/latest
# "version":"16.2.6"

curl -sL https://registry.npmjs.org/next/16.2.6
# exact package JSON returned

curl -sL https://registry.npmjs.org/@next%2Feslint-plugin-next/latest
# "version":"16.2.6"

curl -sL https://registry.npmjs.org/@next%2Feslint-plugin-next/16.2.6
# exact package JSON returned

npm view @t3-oss/env-nextjs version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-t3 --prefer-online
# 0.13.11

npm view @t3-oss/env-nextjs@0.13.11 version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-t3-exact --prefer-online
# 0.13.11

npm view mint version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-mint --prefer-online
# 4.2.577

npm view mint@4.2.577 version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-mint-exact --prefer-online
# 4.2.577
```

Lint/runtime:

```bash
npm view lint-staged version engines --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-lint-staged --prefer-online
# latest 17.0.5; engines require Node >=22.22.1
```

## Current Direct Version Targets

| Package                    |    Target | Evidence / decision                                                                                                     |
| -------------------------- | --------: | ----------------------------------------------------------------------------------------------------------------------- |
| `next`                     |  `16.2.6` | Fresh npm registry confirms latest and exact version.                                                                   |
| `@next/eslint-plugin-next` |  `16.2.6` | Fresh npm registry confirms latest and exact version.                                                                   |
| `react`                    |  `19.2.6` | Keep aligned with `react-dom`; workspace override enforces one family.                                                  |
| `react-dom`                |  `19.2.6` | Keep aligned with `react`.                                                                                              |
| `@t3-oss/env-nextjs`       | `0.13.11` | Fresh npm registry confirms latest and exact version.                                                                   |
| `mint`                     | `4.2.577` | Fresh npm registry confirms latest and exact version.                                                                   |
| `pnpm`                     |  `11.3.0` | Fresh npm registry confirms latest; requires Node `>=22.13`.                                                            |
| `lint-staged`              |  `17.0.5` | Latest; requires Node `>=22.22.1`.                                                                                      |
| `typescript`               |   `6.0.3` | Keep after prior typecheck; rerun after pnpm 11 lockfile finalization.                                                  |
| `eslint`                   |  `10.4.0` | Keep; rerun lint audit after pnpm 11 finalization.                                                                      |
| `typescript-eslint`        |  `8.60.0` | Fresh pnpm 11 outdated scan found `8.60.0`; upgraded and exact npm metadata supports ESLint 10 and TypeScript `<6.1.0`. |
| `vitest`                   |   `4.1.7` | Keep; rerun focused tests after pnpm 11 finalization.                                                                   |
| `drizzle-orm`              |  `0.45.2` | Keep; database package had passed prior typecheck.                                                                      |
| `drizzle-kit`              | `0.31.10` | Keep; database package had passed prior typecheck.                                                                      |
| `zod`                      |   `4.4.3` | Keep; prior focused contracts/search tests passed.                                                                      |
| `ai`                       | `6.0.191` | Keep; rerun after pnpm 11 finalization.                                                                                 |
| `@ai-sdk/react`            | `3.0.193` | Keep; rerun after pnpm 11 finalization.                                                                                 |
| `stripe`                   |  `22.1.1` | Keep; do not downgrade API package/date.                                                                                |
| `better-auth`              |  `1.6.11` | Keep; rerun auth package typecheck after pnpm 11 finalization.                                                          |
| `@tanstack/react-virtual`  | `3.13.26` | Fresh pnpm 11 outdated scan found `3.13.26`; upgraded.                                                                  |
| `@assistant-ui/react`      |  `0.14.8` | Fresh pnpm 11 outdated scan found `0.14.8`; upgraded.                                                                   |
| `posthog-node`             |  `5.35.2` | Fresh pnpm 11 outdated scan found `5.35.2`; upgraded.                                                                   |
| `react-email`              |   `6.3.3` | Fresh pnpm 11 outdated scan found `6.3.3`; upgraded.                                                                    |
| `resend`                   |  `6.12.4` | Fresh pnpm 11 outdated scan found `6.12.4`; upgraded.                                                                   |

## Runtime Baseline

Next.js 16 requires Node `20.9+`, but current pnpm and linting packages force a higher floor:

- `pnpm@11.3.0`: Node `>=22.13`
- `lint-staged@17.0.5`: Node `>=22.22.1`

The active repo baseline is therefore Node `22.22.1+`, recorded in:

- `package.json` `engines.node`
- `pnpm-workspace.yaml` `nodeVersion`
- `.nvmrc`

## pnpm 11 Config Findings

pnpm 11 docs state that only auth and registry settings are read from `.npmrc`; install policy belongs in `pnpm-workspace.yaml`.

Applied policy:

- `.npmrc` keeps registry/cache behavior only.
- `pnpm-workspace.yaml` owns `strictPeerDependencies`, `engineStrict`, `nodeVersion`, `publicHoistPattern`, `overrides`, `packageExtensions`, `peerDependencyRules`, and `allowBuilds`.
- `allowBuilds` explicitly permits required native/runtime packages and denies hidden browser/funding/test install side effects.

## Command Evidence

Commands run in this package-manager phase:

```bash
pnpm --version
npm view pnpm version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-pnpm --prefer-online
npm view pnpm@11.3.0 engines --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-pnpm-11 --prefer-online
npm view @t3-oss/env-nextjs@0.13.11 version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-t3-exact --prefer-online
npm view mint@4.2.577 version --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-mint-exact --prefer-online
curl -sL https://registry.npmjs.org/next/latest
curl -sL https://registry.npmjs.org/next/16.2.6
curl -sL https://registry.npmjs.org/@next%2Feslint-plugin-next/latest
curl -sL https://registry.npmjs.org/@next%2Feslint-plugin-next/16.2.6
source "$HOME/.nvm/nvm.sh" && nvm install 22.22.1 && nvm use 22.22.1
npm exec --yes --package=pnpm@11.3.0 -- pnpm install --config.confirmModulesPurge=false
pnpm outdated -r --format json
pnpm update -r @tanstack/react-virtual@3.13.26 posthog-node@5.35.2 react-email@6.3.3 resend@6.12.4 typescript-eslint@8.60.0 @assistant-ui/react@0.14.8
pnpm outdated -r --format json
pnpm why @parcel/watcher @sentry/cli @swc/core core-js core-js-pure esbuild keytar msw protobufjs puppeteer sharp
pnpm --filter docs lint
git diff --check
```

Current install status:

- pnpm 11 install succeeded through dependency resolution and Node engine checks under Node `22.22.1`.
- pnpm 11 install initially stopped on unreviewed build scripts, which is expected with pnpm 11 strict dependency build policy.
- `allowBuilds` was added after dependency graph review.
- pnpm 11 install then passed and ran only the reviewed allowed build scripts.
- Initial pnpm 11 outdated scan found six remaining direct patch/minor updates: `@tanstack/react-virtual`, `posthog-node`, `react-email`, `resend`, `typescript-eslint`, and `@assistant-ui/react`.
- After upgrading those six packages, `pnpm outdated -r --format json` returned `{}`.
- `pnpm typecheck` passed: 27 successful tasks.
- Focused Vitest checks passed: contracts 112 tests, search 9 tests.
- Docs broken-link validation passed under `mint@4.2.577` after removing legacy `mint.json` and updating stale starter links to current Mintlify URLs.
- `git diff --check` passed after the docs config cleanup.

## Current Verdict

The old claim that T3 Env `0.13.11`, Mint `4.2.577`, or Next `16.2.6` were not registry-resolvable was wrong. It came from stale package-manager metadata.

Use fresh registry metadata and exact package checks for every package phase. Do not use cached `pnpm view` output as the source of truth when it conflicts with direct registry JSON or fresh `npm view --prefer-online`.

## Remaining Validation

- [x] pnpm 11 install passes after `allowBuilds`.
- [x] `pnpm outdated -r --format json` rechecked with pnpm 11.
- [x] `pnpm typecheck` rerun under Node `22.22.1`.
- [x] `pnpm lint` rerun under Node `22.22.1`.
- [x] Package upgrade audit updated with final pnpm 11 results.
- [x] Docs app broken-link lint passes after Mintlify config/link cleanup.
