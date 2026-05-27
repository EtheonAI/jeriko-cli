# Package Playbook: @repo/feature-flags

Package: `@repo/feature-flags`

Date: 2026-05-26

Status: completed

Priority: P3 operations package

## Ownership

What this package owns:

- Feature flag definitions used by apps.
- Vercel Toolbar wiring.
- Flags SDK discovery/access helper boundary.
- Package-local `FLAGS_SECRET` env contract.

What this package must not own:

- Product-specific stale flags from deleted runtimes.
- App route handlers.
- Direct app env access outside `keys()`.
- Analytics provider implementation; it only calls the analytics package boundary.
- Auth provider implementation; it only calls the auth package boundary.

## Current Surface

Exports:

- `@repo/feature-flags`
- `@repo/feature-flags/access`
- `@repo/feature-flags/keys`
- `@repo/feature-flags/next-config`
- `@repo/feature-flags/toolbar`

Consumers:

- `apps/app/app/(authenticated)/layout.tsx` uses `showBetaFeature`.
- `apps/app/next.config.ts` and `apps/web/next.config.ts` compose toolbar config.
- `apps/app/app/layout.tsx` and `apps/web/app/[locale]/layout.tsx` render toolbar.
- `apps/app/env.ts` and `apps/web/env.ts` compose `@repo/feature-flags/keys`.

Provider SDKs:

- `flags`
- `@vercel/toolbar`

Env keys:

- `FLAGS_SECRET`

## Sources Checked

| Source                                                                                             | Type               | Checked Date | Claim Used                                                                                                |
| -------------------------------------------------------------------------------------------------- | ------------------ | -----------: | --------------------------------------------------------------------------------------------------------- |
| https://flags-sdk.dev/docs/api-reference/frameworks/next                                           | Official docs      |   2026-05-26 | `flag()` declares Next.js flags; default value is fallback; descriptions/options show in Flags Explorer.  |
| https://vercel.com/docs/flags/flags-sdk-reference                                                  | Official docs      |   2026-05-26 | Flags SDK is provider-agnostic, framework-native, type-safe, and works with Flags Explorer/observability. |
| https://vercel.com/docs/flags/flags-explorer/getting-started                                       | Official docs      |   2026-05-26 | Flags Explorer can override code-defined flags.                                                           |
| `pnpm view flags version engines peerDependencies --registry https://registry.npmjs.org`           | Registry metadata  |   2026-05-26 | Latest `flags` is `4.0.6`; installed package matches.                                                     |
| `pnpm view @vercel/toolbar version engines peerDependencies --registry https://registry.npmjs.org` | Registry metadata  |   2026-05-26 | Latest `@vercel/toolbar` is `0.2.6`; installed package matches.                                           |
| `packages/feature-flags/**` local audit                                                            | Local source/types |   2026-05-26 | Current package works, but exports stale old-runtime flags such as E2B/orchestrator cutover flags.        |

## Local Audit

Commands:

```bash
find packages/feature-flags -maxdepth 3 -type f | sort
rg -n "@repo/feature-flags|flag\\(|createFlag|showBetaFeature|enableE2BAdapter|enableComposioAdapter|orchestratorVersion" apps packages --glob '!node_modules/**' --glob '!legacy/**'
pnpm --filter @repo/feature-flags typecheck
```

Findings:

- App only uses `showBetaFeature`.
- Old flags for E2B, Composio, Python/Node orchestrator, and rollout percentage are not active reset features.
- T3 Env boundary is correct: direct `process.env` appears only inside `keys.ts`.
- `createFlag` is boolean-only in behavior but was not explicitly typed as such.

## Decision

Verdict: keep and clean

Reason:

- Feature flags are still useful for safe rollout and reset-shell beta gating.
- Old Manus/runtime cutover flags should not remain active exports.
- Keep package ownership and package-local env composition.

## Refactor Checklist

- [x] Keep `FLAGS_SECRET` in package `keys.ts`.
- [x] Remove stale E2B/Composio/orchestrator flags.
- [x] Make `createFlag` an explicit boolean flag helper.
- [x] Add description/options metadata for the active beta flag.
- [x] Keep app consumers unchanged.
- [x] Run package typecheck.
- [x] Run active package/app/graph validation.

## Validation

```bash
pnpm --filter @repo/feature-flags typecheck
pnpm --filter "./packages/*" typecheck
pnpm test
pnpm --filter app --filter web typecheck
pnpm boundaries:cruise
```

Results:

- `pnpm --filter @repo/feature-flags typecheck`: passed.
- `pnpm --filter "./packages/*" typecheck`: passed.
- `pnpm test`: passed.
- `pnpm --filter app --filter web typecheck`: passed.
- `pnpm boundaries:cruise`: passed with 0 errors and 0 warnings.

## Open Risks

- The Flags discovery route is not currently wired in the reset shell. Add it when Flags Explorer is required.
- Analytics-backed flag decisions depend on `@repo/analytics` behavior; that package gets its own phase.
