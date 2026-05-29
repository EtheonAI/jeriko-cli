# Latest Dependency Refresh And Corepack Research

Date: 2026-05-29

Scope:

- Refresh all direct workspace dependencies reported by `pnpm outdated -r`.
- Use the repo-pinned package manager through Corepack.
- Record package-manager evidence before any follow-up fixes.

## Corepack Evidence

Source checked:

- `https://github.com/nodejs/corepack`
- `https://raw.githubusercontent.com/nodejs/corepack/main/README.md`

Findings:

- Corepack bridges Node.js projects to the package manager they are intended to use.
- Corepack reads the project `packageManager` field and downloads/caches the compatible package-manager version for local commands.
- The `packageManager` field should always be present for deterministic installs.
- `COREPACK_HOME` defaults to `$HOME/.cache/node/corepack` outside Windows, so the first Corepack run may need cache write access.
- `corepack <package-manager> ...` runs the configured package manager for the local project and still validates that the package manager matches the project configuration.

Repo evidence:

- Root `package.json` now declares `pnpm@11.4.0` in `packageManager`, with a Corepack integrity hash.
- Root engines now declare `pnpm >=11.4.0 <12`.
- `pnpm-workspace.yaml` sets `nodeVersion: 22.22.1`, `engineStrict: true`, `preferOffline: false`, and `minimumReleaseAge: 0`.
- The local bare `/usr/local/bin/pnpm` shim failed with `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING`.
- `corepack pnpm --version` returned `11.3.0` before the package-manager refresh.
- `corepack use pnpm@11.4.0` updated the repo package-manager pin to latest pnpm and ran the workspace install through Corepack.
- `pnpm --version` now returns `11.4.0`.
- Turbo child tasks spawn bare `pnpm`; before shim repair that resolved to the broken `/usr/local/bin/pnpm`.
- `corepack enable pnpm` created `/Users/khaleelmusleh/.nvm/versions/node/v22.22.1/bin/pnpm`, after which bare `pnpm --version` returned `11.3.0`.

Decision:

- Use `corepack pnpm ...` for this repository's package-manager commands.
- Do not rely on the stale global `/usr/local/bin/pnpm` shim for validation.
- Keep the active Node/Corepack pnpm shim enabled so Turbo child tasks inherit the same pinned package-manager version.

## Registry Evidence

Command:

```bash
corepack pnpm outdated -r
```

Before refresh:

| Dependency                        | Current    | Latest     | Workspace owner                    |
| --------------------------------- | ---------- | ---------- | ---------------------------------- |
| `@commitlint/cli`                 | `21.0.1`   | `21.0.2`   | root                               |
| `@commitlint/config-conventional` | `21.0.1`   | `21.0.2`   | root                               |
| `@turbo/gen`                      | `2.9.15`   | `2.9.16`   | root                               |
| `turbo`                           | `2.9.15`   | `2.9.16`   | root                               |
| `commander`                       | `14.0.3`   | `15.0.0`   | root                               |
| `ai`                              | `6.0.191`  | `6.0.193`  | `@repo/ai`                         |
| `@vercel/sandbox`                 | `2.0.0`    | `2.0.1`    | `@repo/sandbox`                    |
| `fumadocs-core`                   | `16.9.1`   | `16.9.3`   | `apps/web`                         |
| `mint`                            | `4.2.578`  | `4.2.585`  | `apps/docs`                        |
| `posthog-js`                      | `1.376.2`  | `1.376.4`  | `@repo/analytics`                  |
| `posthog-node`                    | `5.35.4`   | `5.35.6`   | `@repo/analytics`                  |
| `@aws-sdk/client-s3`              | `3.1054.0` | `3.1056.0` | `@repo/storage`                    |
| `@aws-sdk/s3-request-presigner`   | `3.1054.0` | `3.1056.0` | `@repo/storage`                    |
| `@sentry/nextjs`                  | `10.54.0`  | `10.55.0`  | `@repo/observability`              |
| `chromatic`                       | `17.0.1`   | `17.1.0`   | `apps/storybook`                   |
| `lucide-react`                    | `1.16.0`   | `1.17.0`   | app, web, storybook, design-system |
| `next-intl`                       | `4.12.0`   | `4.13.0`   | `@repo/internationalization`       |
| `react-email`                     | `6.4.0`    | `6.5.0`    | `@repo/email`, `apps/email`        |
| `stripe`                          | `22.1.1`   | `22.2.0`   | `@repo/payments`                   |
| `svix`                            | `1.94.0`   | `1.95.1`   | `@repo/webhooks`                   |
| `agentmail`                       | `0.5.3`    | `0.5.4`    | `@repo/agentmail`                  |

## Refresh Command

```bash
corepack pnpm update -r --latest
```

Result:

- Workspace dependency update completed with pnpm `11.3.0`.
- Package-manager update completed with pnpm `11.4.0`.
- `corepack pnpm outdated -r --format json` returned `{}` after the refresh.
- Install reported 13 deprecated transitive subdependencies. These are not direct dependency drift and require separate tree-level cleanup only if an owning upstream or replacement path is available.

## Compatibility Fixes Required By Validation

`@repo/payments`:

- `stripe@22.2.0` installed types export `ApiVersion = "2026-05-27.dahlia"`.
- The package still pinned `"2026-04-22.dahlia"`, which caused `@repo/payments` typecheck to fail.
- Updated `packages/payments/index.ts` to use `"2026-05-27.dahlia"` so the package matches the SDK release type.

## Follow-Up Validation

Required before considering the refresh complete:

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm boundaries:cruise`
- `corepack pnpm --filter docs lint`
- `git diff --check`
