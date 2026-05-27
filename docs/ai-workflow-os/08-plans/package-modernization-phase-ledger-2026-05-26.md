# Package Modernization Phase Ledger

Date: 2026-05-26

Status: active

## Rules

Each package moves through the same gate:

```text
local audit
-> official docs and llms.txt/llms-full.txt check when available
-> latest registry metadata
-> package playbook/checklist update
-> MADR if package direction changes
-> refactor
-> package validation
-> graph validation
```

No app-local provider/config implementation should be added when a package owns the concern.

## Current Registry Freshness

Command:

```bash
pnpm outdated -r
```

Initial result on 2026-05-26:

| Package                         |    Current |     Latest | Dependents                   | Phase             |
| ------------------------------- | ---------: | ---------: | ---------------------------- | ----------------- |
| `chromatic`                     |   `17.0.0` |   `17.0.1` | `storybook`                  | Storybook/support |
| `posthog-js`                    |  `1.376.0` |  `1.376.2` | `@repo/analytics`            | P3                |
| `posthog-node`                  |   `5.35.2` |   `5.35.4` | `@repo/analytics`            | P3                |
| `@aws-sdk/client-s3`            | `3.1053.0` | `3.1054.0` | `@repo/storage`              | P2                |
| `@aws-sdk/s3-request-presigner` | `3.1053.0` | `3.1054.0` | `@repo/storage`              | P2                |
| `@sentry/nextjs`                |  `10.53.1` |  `10.54.0` | `@repo/observability`, `web` | P1                |
| `react-email`                   |    `6.3.3` |    `6.4.0` | `@repo/email`, `email`       | P1                |

Refresh result:

- [x] Official docs checked for every affected dependency family.
- [x] Upgraded listed stale dependencies to latest.
- [x] `pnpm outdated -r` now reports no outdated dependency output.
- [x] Affected typechecks passed for `@repo/observability`, `@repo/email`, `@repo/storage`, `@repo/analytics`, and `storybook`.
- [x] Full active package typecheck passed after refresh.
- [x] `apps/app` and `apps/web` typecheck passed after refresh.
- [x] `pnpm boundaries:cruise` passed after refresh with 0 errors and 0 warnings.

Evidence:

- [`../09-research/2026-05-26-latest-dependency-refresh.md`](../09-research/2026-05-26-latest-dependency-refresh.md)
- [`../07-madr/MADR-066-latest-dependency-refresh-with-docs-gate.md`](../07-madr/MADR-066-latest-dependency-refresh-with-docs-gate.md)

## P0 Graph Health

Status: active now.

Goal: `pnpm boundaries:cruise` must pass before deeper package refactors.

Known errors:

- `@repo/ai`: renderer files import types from `tool-registry.tsx`, while the registry imports renderers.
- `@repo/database`: schema relation files import each other in cycles.

Checklist:

- [x] Audit `@repo/ai` renderer registry.
- [x] Read AI SDK, TypeScript type-only import, and dependency-cruiser rule docs as needed.
- [x] Move AI renderer shared types to a type-only file.
- [x] Validate `@repo/ai`.
- [x] Audit `@repo/database` schema cycles.
- [x] Read Drizzle relations/schema docs before changing database schema exports.
- [x] Refactor database schema cycles without changing table names or migrations.
- [x] Validate `@repo/database`.
- [x] Run `pnpm boundaries:cruise`.

## P1 Foundation Packages

Status: completed for the first cleanup pass.

Checklist:

- [x] `@repo/typescript-config` docs/registry audit completed; no code change required.
- [x] `@repo/next-config` Next.js/Vercel docs/registry audit completed; no code change required.
- [x] `@repo/design-system` shadcn/Tailwind/Radix registry audit completed; removed auth/observability coupling from the provider.
- [x] `@repo/design-system` UI segmentation cleanup completed; added category barrels and removed unused/domain-adjacent dependencies.
- [x] `@repo/auth` Better Auth docs/registry audit completed; removed orphan no-op provider export.
- [x] `@repo/database` Drizzle docs/registry audit completed; schema cycle fixed through aggregate relation module.
- [x] `@repo/email` Resend/React Email docs/registry audit completed; tests pass.
- [x] `@repo/security` Arcjet/Nosecone docs/registry audit completed; no code change required.
- [x] `@repo/observability` Sentry docs/registry audit completed; production trace sampling reduced.
- [x] Full package, app/web, and graph validation passed after P1.

## P2 Platform Packages

Status: active.

Checklist:

- [x] `@repo/contracts` docs/registry audit completed.
- [x] Re-audit found no active consumers outside package-owned tests.
- [x] MADR-067 accepted: retire the central contracts package and rehome contracts into owning packages.
- [x] Delete `packages/contracts`.
- [x] Remove root `test` filter that targets `@repo/contracts`.
- [x] Remove deleted contracts project from root Vitest project config.
- [x] Refresh lockfile/workspace state with `pnpm install`.
- [x] Run active package typechecks after deletion.
- [x] Run remaining package tests after deletion: `pnpm test` passed 2 files, 14 tests.
- [x] Run `apps/app` and `apps/web` typechecks after deletion.
- [x] Run graph validation after deletion.
- [x] `@repo/ai` graph cleanup and current package test cleanup; root `pnpm test` now includes AI.
- [x] `@repo/ai` UI segmentation cleanup completed; added `components/ai` domain UI facade and server-only `@repo/ai/tools` entrypoint.
- [x] `@repo/storage` playbook, docs audit, S3 edge-case refactor, and validation.
- [x] `@repo/search` playbook, docs audit, stale domain reset, and validation.
- [x] `@repo/sandbox` Vercel Sandbox implementation phase after docs/MADR; adapter, mock, env keys, tests, and validation complete.
- [x] `@repo/connectors` Composio session-first scaffold phase after docs/MADR; contracts, T3 Env keys, server-only Composio adapter, direct adapter factory, mock adapter, tests under package-level `tests/`, and validation complete.
- [x] `@repo/ai/tools` connector policy bridge after AI SDK approval docs/MADR; manifests, approval gate, AI SDK v6 conversion, `@repo/connectors` delegation, package-level tests, and focused validation complete.
- [x] Late patch dependency refresh complete: `turbo@2.9.15`, `@turbo/gen@2.9.15`, and `@assistant-ui/react@0.14.9`; `pnpm outdated -r --format json` returns `{}`.

## P3 Operations Packages

Status: active, with `@repo/feature-flags` completed early because both active apps consume it.

Checklist:

- [x] `@repo/feature-flags` playbook, official Flags SDK/Vercel docs audit, stale Manus runtime flag removal, and validation.
- [ ] `@repo/analytics` provider boundary phase.
- [ ] `@repo/payments` Stripe docs/API-version phase.
- [ ] `@repo/notifications` package ownership phase.
- [ ] `@repo/webhooks` package ownership phase.
- [ ] `@repo/rate-limit` package ownership phase.
- [ ] `@repo/agentmail` package ownership phase.

## Package Order

1. P0 governance and graph health.
2. P1 foundation: `typescript-config`, `next-config`, `design-system`, `auth`, `database`, `email`, `security`, `observability`.
3. P2 platform: `ai`, `flow`, `sandbox`, `storage`, `search`, future `connectors`, future `artifacts`; central `contracts` is retired by MADR-067. Do not create a separate catch-all `@repo/tools`; platform tools live in server-only `@repo/ai/tools`, while Composio/direct API integration concerns live in future `@repo/connectors`.
4. P3 operations: `payments`, `feature-flags`, `analytics`, `notifications`, `webhooks`, `rate-limit`, `agentmail`.
5. P4 support/web: `cms` with Payload decision, `internationalization`, `seo`, `collaboration`, `testing`, Storybook/docs apps.
6. P5 app rebuild on package APIs.

## Validation Commands

Use as applicable per package:

```bash
pnpm --filter <package> typecheck
pnpm --filter <package> test
pnpm boundaries:cruise
pnpm --filter "./packages/*" typecheck
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm --filter app build
pnpm --filter web build
```
