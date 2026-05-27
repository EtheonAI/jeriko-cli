# MADR-038: pnpm 11, Node 22.22.1, and strict linting runtime baseline

Status: Accepted

Date: 2026-05-25

## Context

The package upgrade phase moved direct dependencies to current registry versions. The workspace then exposed a real tooling conflict:

- `pnpm@11.3.0` is the current pnpm release from fresh npm registry metadata.
- `pnpm@11.3.0` declares `node >=22.13`.
- `lint-staged@17.0.5` is the current lint-staged release from fresh npm registry metadata.
- `lint-staged@17` no longer supports Node 20 and sets the floor at Node `22.22.1`.
- The local shell initially used Node `22.13.1`, which is too old for the current lint-staged release when `engineStrict` is enabled.
- pnpm 11 moves most project install policy to `pnpm-workspace.yaml`; `.npmrc` is now only for registry/auth style settings.
- pnpm 11 defaults to strict dependency build-script review through `allowBuilds`.

## Decision

Use the latest pnpm 11 line and set the active workspace runtime floor to Node `22.22.1`.

The repo now declares:

- `packageManager: pnpm@11.3.0`
- `engines.node: >=22.22.1`
- `engines.pnpm: >=11.3.0 <12`
- `.nvmrc: 22.22.1`
- `pnpm-workspace.yaml` install policy:
  - fresh registry metadata by default;
  - strict peer dependencies;
  - strict engine checks;
  - explicit Node engine baseline;
  - explicit build-script approval map;
  - React/React DOM override to one version family.

Keep `minimumReleaseAge: 0` during this forced latest-version migration because the product owner explicitly wants the newest registry versions now. Revisit supply-chain delay after the reset stabilizes.

## Build Script Policy

Allowed:

- `@parcel/watcher`: native watcher used through `next-intl`.
- `@sentry/cli`: Sentry Next.js sourcemap/upload tooling.
- `@swc/core`: compiler dependency used by Next/tooling/transforms.
- `esbuild`: bundler binary used by Drizzle/Tsup/Vite/Storybook/React Email.
- `keytar`: native credential store used by Mintlify CLI.
- `protobufjs`: postinstall build step used through OpenTelemetry/PostHog dependency graph.
- `sharp`: native image processing used by Next.js and Mintlify.

Denied:

- `core-js`: postinstall is not needed for runtime correctness here.
- `core-js-pure`: postinstall is not needed for runtime correctness here.
- `msw`: test package postinstall is not needed for app runtime.
- `puppeteer`: do not download browser binaries during dependency install; browser automation should be handled explicitly later, likely through Vercel Sandbox.

## Consequences

Positive:

- Current lint tooling is not downgraded to fit an older Node patch.
- pnpm 11 config follows the current documented config split.
- Install failures now reveal real engine/build-script policy problems instead of silently accepting unsafe defaults.
- Vercel can still use a compatible major Node runtime; Vercel maps `22.x`/`^22.0.0` to latest available 22.x.

Negative / follow-up:

- Contributors must use Node `22.22.1+`; older local Node 22 patches fail by design.
- Vercel only selects major Node lines, so project settings should choose Node 22.x or 24.x intentionally.
- Corepack on this machine failed signature validation for current pnpm metadata, so validation used `npm exec --package=pnpm@11.3.0` under Node `22.22.1`.
- If Mintlify later requires Puppeteer browser download during docs checks, that should be made an explicit docs/build decision, not a hidden install side effect.

## Alternatives Considered

- Downgrade `lint-staged`: rejected. The request is latest packages, and the current major documents the new Node floor.
- Disable `engineStrict`: rejected. It would hide runtime incompatibilities.
- Allow all build scripts: rejected. pnpm explicitly warns that allowing all scripts trusts present and future transitive install hooks.
- Use Node 24.x immediately: deferred. Vercel defaults new projects to latest LTS, but this repo already targets Next 16 plus current lint tooling; Node 22.22.1 is the minimum proven baseline and reduces migration blast radius.
- Keep pnpm policy in `.npmrc`: rejected for pnpm 11. Current docs say only auth/registry settings are read from `.npmrc`.

## Evidence

Primary sources checked:

- pnpm 11 settings: `https://pnpm.io/settings`
- pnpm `approve-builds`: `https://pnpm.io/cli/approve-builds`
- lint-staged migration guide: `https://github.com/lint-staged/lint-staged/blob/main/MIGRATION.md`
- Node.js 22.22.1 LTS release: `https://nodejs.org/en/blog/release/v22.22.1`
- Vercel supported Node.js versions: `https://vercel.com/docs/functions/runtimes/node-js/node-js-versions`
- Next.js 16 upgrade guide: `https://nextjs.org/docs/app/guides/upgrading/version-16`

Command evidence:

```bash
npm view pnpm version --registry https://registry.npmjs.org --prefer-online
npm view pnpm@11.3.0 engines --registry https://registry.npmjs.org --prefer-online
npm view lint-staged version engines --registry https://registry.npmjs.org --prefer-online
node --version
source "$HOME/.nvm/nvm.sh" && nvm install 22.22.1 && nvm use 22.22.1
npm exec --yes --package=pnpm@11.3.0 -- pnpm install --config.confirmModulesPurge=false
pnpm why @parcel/watcher @sentry/cli @swc/core core-js core-js-pure esbuild keytar msw protobufjs puppeteer sharp
```

Observed results:

- `pnpm` latest: `11.3.0`
- `pnpm@11.3.0` engines: `node >=22.13`
- `lint-staged@17.0.5` requires Node `>=22.22.1`
- Node `22.13.1` failed strict install for current `lint-staged`
- Node `22.22.1` installed successfully with nvm
- pnpm 11 install then reached the build-script approval gate, proving the engine issue was resolved

## Validation Checklist

- [x] Fresh registry metadata used for pnpm and lint-staged checks.
- [x] pnpm upgraded from `10.19.0` to `11.3.0` in `packageManager`.
- [x] Node baseline raised to `22.22.1`.
- [x] `.nvmrc` added.
- [x] pnpm policy moved to `pnpm-workspace.yaml`.
- [x] `.npmrc` reduced to registry/cache settings.
- [x] `engineStrict` enabled.
- [x] Build-script policy documented.
- [x] pnpm 11 install passes with approved build map.
- [x] `pnpm outdated -r --format json` passes or has only documented conflicts.
- [x] `pnpm typecheck` passes after pnpm 11 lockfile update.
- [x] `pnpm lint` baseline is updated after linting runtime upgrade.
