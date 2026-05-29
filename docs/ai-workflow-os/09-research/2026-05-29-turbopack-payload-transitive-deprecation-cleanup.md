# Turbopack Payload Trace And Transitive Deprecation Cleanup

Date: 2026-05-29

Scope:

- Remove the Turbopack NFT trace warning emitted during `apps/web` build.
- Reduce deprecated transitive dependencies where local manifests had stale or unused direct packages.
- Keep any remaining deprecated transitive package warnings explicit and audited instead of hidden by accident.

## Sources Checked

| Source                                                                      | Type                    | Claim Used                                                                                                                                                       |
| --------------------------------------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/output`    | Official Next.js docs   | Next.js output file tracing uses static analysis of imports, requires, and `fs` usage to include files needed at runtime.                                        |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack` | Official Next.js docs   | Turbopack is the active Next.js bundler configuration surface and should be handled through Next config/runtime tracing semantics, not webpack-only workarounds. |
| `https://payloadcms.com/docs/getting-started/installation`                  | Official Payload docs   | Payload's Next integration depends on an app-owned Payload config and generated convention route files.                                                          |
| `https://pnpm.io/settings#alloweddeprecatedversions`                        | Official pnpm docs      | `allowedDeprecatedVersions` is the supported workspace setting for muting deprecation warnings for audited packages.                                             |
| `https://turborepo.dev/docs/reference/configuration`                        | Official Turborepo docs | `outputs: []` is the supported way to mark a cached task as producing no file outputs beyond logs.                                                               |

## Turbopack Warning

Observed build warning:

```text
Encountered unexpected file in NFT list
Import trace:
  App Route:
    ./apps/web/next.config.ts
    ./packages/cms/config.ts
    ./apps/web/payload.config.ts
    ./apps/web/app/(payload)/api/[...slug]/route.ts
```

Local cause:

- `packages/cms/config.ts` used `path.resolve(process.cwd(), fileName)` for Payload generated type/schema/migration output defaults.
- These generated file paths are not runtime files that should make Turbopack trace the whole project.
- The warning text recommends scoping dynamic `process.cwd()` path usage or adding a `turbopackIgnore` comment when the path is intentionally not traceable.

Decision:

- Keep Payload config ownership in `@repo/cms`.
- Keep app-owned Payload convention files in `apps/web`.
- Mark the generated-path `process.cwd()` call with `/* turbopackIgnore: true */`.
- Do not broaden `outputFileTracingRoot` or add webpack-only config.

## Deprecated Transitive Cleanup

Removed unused direct packages:

- Root `@auto-it/first-time-contributor`: no active local script, import, config, or workflow reference.
- `apps/web` `mdx-bundler`: no active local import or route consumer.

Remaining deprecated transitive owners after removal:

| Deprecated package              | Current owner path                                                    | Local decision                                                |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `@esbuild-kit/core-utils@3.3.2` | `drizzle-kit` via `@repo/database`, Better Auth, and Payload Postgres | Keep; owning direct packages are current and active.          |
| `@esbuild-kit/esm-loader@2.6.5` | `drizzle-kit` via `@repo/database`, Better Auth, and Payload Postgres | Keep; owning direct packages are current and active.          |
| `glob@7.1.6`                    | Mintlify CLI internals                                                | Keep; `mint` is current and needed for docs broken-link lint. |
| `glob@7.2.3`                    | Lighthouse CI and Storybook internals                                 | Keep; direct owners are current and active.                   |
| `inflight@1.0.6`                | Old `glob@7` dependency tree                                          | Keep; transitive only.                                        |
| `prebuild-install@7.1.3`        | Mintlify CLI/keytar internals                                         | Keep; `mint` is current and active.                           |
| `puppeteer@22.14.0`             | Mintlify scraping internals                                           | Keep; `mint` is current and active.                           |
| `rimraf@2.7.1`                  | Lighthouse CI internals                                               | Keep; `@lhci/cli` is current and used by CI.                  |
| `rimraf@3.0.2`                  | Lighthouse CI and Storybook internals                                 | Keep; direct owners are current and active.                   |
| `uuid@8.3.2`                    | Lighthouse CI internals                                               | Keep; `@lhci/cli` is current and used by CI.                  |
| `uuid@10.0.0`                   | Arcjet/typeid internals                                               | Keep; `@arcjet/next` is current and active.                   |

Decision:

- Do not add unsafe transitive overrides for packages owned by active upstream frameworks.
- Use `allowedDeprecatedVersions` with exact versions only, so future new deprecated versions still surface.
- Revisit the allowlist during future package refreshes when upstream packages publish cleanup releases.

## Turborepo No-Output Build Warnings

Observed build warnings after the Turbopack trace fix:

```text
WARNING no output files found for task @repo/cms#build
WARNING no output files found for task @repo/database#build
```

Local cause:

- Root `turbo.json` declared generic build outputs for app/package build tasks.
- `@repo/cms#build` currently runs TypeScript with `--noEmit`.
- `@repo/database#build` and `@repo/search#build` are intentional no-op build scripts.

Decision:

- Add package-specific Turborepo task entries for `@repo/cms#build`, `@repo/database#build`, and `@repo/search#build`.
- Keep dependency ordering with `dependsOn: ["^build"]`.
- Set `outputs: []` for these no-output build tasks instead of creating dummy files or disabling cache globally.

## Validation

Passed after cleanup:

- `pnpm install`
- `pnpm outdated -r --format json`
- `pnpm typecheck`
- `pnpm test`
- `pnpm boundaries:cruise`
- `pnpm --filter docs lint`
- `git diff --check`
- `pnpm build` with local dummy app/web build env

Observed result:

- No Turbopack NFT trace warning.
- No deprecated transitive dependency warning during install.
- No Turborepo no-output warning for package build tasks.
