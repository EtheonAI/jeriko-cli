# R19 Apps/App Dependency Boundary Research

Date researched: 2026-05-26

Scope: direct dependencies in `apps/app/package.json` versus active imports in `apps/app`.

## Sources

| Source                                                                                                         | Type              | Claim used                                                                                                     |
| -------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------- | --- | --- | --- | ----------------- | --- | ----- |
| `apps/app/package.json`                                                                                        | Local source      | Current app dependency list.                                                                                   |
| `apps/app/**` active import scan                                                                               | Local source      | Which packages are directly imported by active app code, config, tests, and support files.                     |
| `packages/next-config/index.ts`                                                                                | Local source      | `reactCompiler: true` means the app needs `babel-plugin-react-compiler` available to Next.                     |
| `packages/auth/package.json`                                                                                   | Local source      | `@repo/auth` depends on `better-auth`, but `apps/app` also imports `better-auth` subpaths directly.            |
| `packages/design-system/package.json`                                                                          | Local source      | The design system owns its own `motion` dependency.                                                            |
| `pnpm view better-auth version peerDependencies engines --registry https://registry.npmjs.org`                 | Registry metadata | Latest `better-auth` is `1.6.11`; it supports `next` `^14                                                      |     | ^15 |     | ^16`and React`^18 |     | ^19`. |
| `pnpm view motion version peerDependencies engines --registry https://registry.npmjs.org`                      | Registry metadata | Latest `motion` is `12.40.0`; app has it but active app code does not import it.                               |
| `pnpm view next version peerDependencies optionalDependencies engines --registry https://registry.npmjs.org`   | Registry metadata | Latest stable Next is `16.2.6`; `babel-plugin-react-compiler` is a Next peer dependency when compiler is used. |
| `pnpm view babel-plugin-react-compiler version peerDependencies engines --registry https://registry.npmjs.org` | Registry metadata | Latest `babel-plugin-react-compiler` is `1.0.0`.                                                               |

## Findings

1. `apps/app` directly imported `better-auth` before R19.
   Direct imports existed in:
   - `apps/app/proxy.ts` via `better-auth/cookies`;
   - `apps/app/app/api/auth/[...all]/route.ts` via `better-auth/next-js`.

   The stricter repo boundary is better: `packages/auth` should own those Better Auth adapters and expose app-safe Next.js helpers. `apps/app` should import from `@repo/auth/next`, not `better-auth`.

2. `motion` is not imported by active `apps/app` code.
   The only active owner of the `motion` package is `packages/design-system`. The app should not carry a duplicate direct dependency for a package it does not import.

3. `babel-plugin-react-compiler` should stay.
   `packages/next-config` enables `reactCompiler: true`, and `next@16.2.6` lists `babel-plugin-react-compiler` as a peer. The app is the Next build endpoint, so keeping it in the app dependency set is correct.

4. Workspace package dependencies should stay for now.
   Even when some workspace packages are imported only through `env.ts`, those imports are intentional because the app env contract extends package key contracts. Removing those workspace dependencies would break the central app env model the user asked to keep.

5. `next-themes`, `sonner`, `react-hook-form`, `@hookform/resolvers`, `zod`, `server-only`, `lucide-react`, Tailwind, React, and Next are active.
   They have direct app imports or app config usage.

## Implementation Impact

- Add a Next-specific adapter/helper export under `@repo/auth/next`.
- Move app Better Auth adapter imports behind `@repo/auth/next`.
- Remove `motion` from `apps/app` dependencies.
- Run `pnpm install` to update `pnpm-lock.yaml`.
- Validate app typecheck, smoke tests, targeted lint, and app build.

## Open Questions

- Whether `publicHoistPattern` can be narrowed after all direct `better-auth` imports are declared. This is not part of R19 because shared package resolution and Next/Turbopack behavior need a separate workspace install audit.
- Whether app env should stop extending optional integration package keys. The user explicitly wants centralized T3 Env, so this remains out of scope for R19.
