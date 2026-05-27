# Next.js 16 Turbopack Reset Validation

Date researched: 2026-05-25

## Sources

| Source                    | Type          | URL                                                                     | Claim checked                                                                                 |
| ------------------------- | ------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Next.js 16 upgrade guide  | Official docs | https://nextjs.org/docs/app/guides/upgrading/version-16                 | Next.js 16 changes the default bundler behavior and requires validating default `next build`. |
| Next.js Turbopack docs    | Official docs | https://nextjs.org/docs/app/api-reference/turbopack                     | Turbopack is the default bundler; webpack is an explicit fallback via `--webpack`.            |
| Next.js route groups docs | Official docs | https://nextjs.org/docs/app/api-reference/file-conventions/route-groups | Route groups are organization/layout boundaries, not URL segments or security by themselves.  |
| next-forge app docs       | Official docs | https://www.next-forge.com/docs/apps/app                                | next-forge uses authenticated and unauthenticated route groups in the main app.               |

## Findings

- `pnpm --filter app exec next build --webpack` passed earlier, but this did not prove the default Next.js 16 path.
- The first default Turbopack runs looked like a stall because they sat at `Creating an optimized production build ...`.
- A longer in-sandbox run revealed the actual failure:
  - Turbopack was evaluating CSS/PostCSS.
  - The command sandbox blocked process creation/local port binding.
  - Error: `Operation not permitted (os error 1)`.
- Running the same default build outside the command sandbox completed successfully:
  - `pnpm --filter app build`
  - Next.js 16.2.6
  - Turbopack
  - Compiled successfully in 18.4 seconds.
  - Final route output contains only the reset dashboard/auth shell.

## Decision Impact

- Do not switch the app build script to `next build --webpack`.
- Keep default `next build` so the app follows Next.js 16's Turbopack default.
- Treat this as a local command-sandbox validation requirement: Turbopack builds must be run with permission to spawn worker processes and bind local ports.
- Keep webpack build as a diagnostic fallback only, not the primary build path.

## Remaining Work

- Clean `packages/next-config` separately:
  - remove old E2B CSP entries;
  - trim stale `transpilePackages` and `serverExternalPackages`;
  - verify observability wrappers against Turbopack and production envs;
  - decide whether BetterStack logging should be enabled only when env vars exist.
- Add dashboard/auth smoke tests after the build config phase.
