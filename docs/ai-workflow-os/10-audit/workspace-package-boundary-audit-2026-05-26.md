# Workspace Package Boundary Audit

Date: 2026-05-26

Scope: active `apps/*`, active `packages/*`, package manifests, `@repo/*` import paths, dependency-cruiser graph, and package typecheck sweep.

This is not a full line-by-line audit of every source file. It is a package ownership and boundary audit before continuing app reset work.

## Executive Finding

The user is right: the next cleanup phase must be package-first.

The repo has the packages needed for a senior monorepo, but apps and packages still bypass package APIs in several places. Some package exports are incomplete, some shared concerns are still imported through internal paths, and `@repo/ai` still has tests reaching into old app internals.

## Active Workspace Inventory

### Apps

| App              | Role                           | Current Direction                              |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| `apps/app`       | Main authenticated product app | Keep, thin shell, route-owned workflow UI only |
| `apps/web`       | Marketing/content app          | Keep for now; later CMS decision               |
| `apps/docs`      | Mintlify docs app              | Keep as docs surface                           |
| `apps/email`     | React Email preview/export app | Keep as dev surface for email package          |
| `apps/storybook` | Design-system workbench        | Keep as dev surface                            |
| `apps/studio`    | Database studio helper         | Keep as dev surface                            |

### Packages

| Package               | Ownership                                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `@repo/auth`          | Better Auth server/client/Next adapters and auth env                                                           |
| `@repo/email`         | Resend, React Email templates, email env                                                                       |
| `@repo/observability` | Sentry, Better Stack status/logging, instrumentation                                                           |
| `@repo/notifications` | Knock server/client notification integration                                                                   |
| `@repo/feature-flags` | `flags`, Vercel Toolbar, flag access                                                                           |
| `@repo/design-system` | Shared UI primitives, theme, toast, shared styling                                                             |
| `@repo/next-config`   | Shared baseline Next config                                                                                    |
| `@repo/database`      | Drizzle schema/client/migrations/env                                                                           |
| `@repo/payments`      | Stripe                                                                                                         |
| `@repo/security`      | Arcjet/Nosecone/security middleware                                                                            |
| `@repo/analytics`     | PostHog/Vercel Analytics                                                                                       |
| `@repo/search`        | Typesense search                                                                                               |
| `@repo/storage`       | S3-compatible object storage                                                                                   |
| `@repo/contracts`     | Shared schemas/contracts/events/sandbox contracts                                                              |
| Other active packages | Audit/gate before use: CMS, collaboration, agentmail, webhooks, rate-limit, seo, internationalization, testing |

## Boundary Violations Found

The `@repo/*` import/export scan found 13 imports that use package subpaths not exposed by the owning package.

| Importer                                                              | Import                                       | Finding               | Fix Direction                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `apps/app/app/(authenticated)/_components/notifications-provider.tsx` | `@repo/notifications/components/provider`    | Missing public export | Add `@repo/notifications/provider` or root export; keep Knock internals in package   |
| `apps/app/app/(authenticated)/_components/sidebar/sidebar-footer.tsx` | `@repo/design-system/components/mode-toggle` | Missing public export | Add explicit design-system export for `mode-toggle` or move to app route if app-only |
| `apps/app/app/layout.tsx`                                             | `@repo/feature-flags/components/toolbar`     | Missing public export | Add `@repo/feature-flags/toolbar`                                                    |
| `apps/app/env.ts`                                                     | `@repo/database/keys`                        | Missing public export | Export package env keys                                                              |
| `apps/app/env.ts`                                                     | `@repo/email/keys`                           | Missing public export | Export package env keys                                                              |
| `apps/app/next.config.ts`                                             | `@repo/feature-flags/lib/toolbar`            | Internal lib import   | Add `@repo/feature-flags/next-config`                                                |
| `apps/web/app/[locale]/components/footer.tsx`                         | `@repo/observability/status`                 | Missing public export | Add `@repo/observability/status`                                                     |
| `apps/web/app/[locale]/components/header/index.tsx`                   | `@repo/design-system/components/mode-toggle` | Missing public export | Same design-system export decision                                                   |
| `apps/web/app/[locale]/contact/actions/contact.tsx`                   | `@repo/email/templates/contact`              | Missing public export | Import from `@repo/email/templates` or add explicit subpath                          |
| `apps/web/app/[locale]/layout.tsx`                                    | `@repo/feature-flags/components/toolbar`     | Missing public export | Add `@repo/feature-flags/toolbar`                                                    |
| `apps/web/env.ts`                                                     | `@repo/email/keys`                           | Missing public export | Export package env keys                                                              |
| `apps/web/next.config.ts`                                             | `@repo/feature-flags/lib/toolbar`            | Internal lib import   | Add `@repo/feature-flags/next-config`                                                |
| `packages/design-system/index.tsx`                                    | `@repo/auth/provider`                        | Missing public export | Add `@repo/auth/provider` or remove unused wrapper                                   |

## Package Typecheck Sweep

Command:

```bash
pnpm --filter "./packages/*" typecheck
```

Result:

- 23 of 24 package typechecks passed.
- `@repo/ai` failed.

Failure:

```text
packages/ai components/tools/__tests__/full-rendering-pipeline.test.ts
Cannot find module '../../../../../apps/app/lib/chat/sse-processor'
```

Why it matters:

`@repo/ai` is a reusable package. Its tests cannot depend on removed or app-owned internals. The SSE/message parsing contract must move into `@repo/ai`, `@repo/contracts`, or a future workflow package if reusable.

## Dependency Graph Audit

Command:

```bash
pnpm boundaries:cruise
```

Result:

- 39 dependency violations total.
- 18 errors.
- 21 informational orphan findings.

Error groups:

- `@repo/database`: 5 schema circular dependency paths across `users`, `sessions`, `organizations`, `files`, and `agents`.
- `@repo/ai`: 13 circular dependency paths between `components/tools/tool-registry.tsx` and tool renderer files.

Why it matters:

These cycles make package boundaries harder to reason about and can break runtime initialization, tests, and future extraction. They should be fixed package-by-package before claiming architecture cleanliness.

## App Direct Dependency Concerns

Not every app dependency is wrong. Framework/runtime dependencies such as `next`, `react`, and `react-dom` are app-owned.

Concerns to audit and move behind packages where appropriate:

- `apps/app` imports `sonner` toast directly while `@repo/design-system` owns the `Toaster`.
- `apps/app` imports `next-themes` directly for notification theme bridging while `@repo/design-system` owns theme provider primitives and `@repo/notifications` owns Knock.
- `apps/web` declares provider packages such as `@arcjet/next` and `@sentry/nextjs` while security/observability packages already exist.
- `apps/app` and `apps/web` import non-exported package internals for feature flags, notifications, and observability.

## Next Config Finding

`apps/app/next.config.ts` and `apps/web/next.config.ts` should stay thin. They may compose package-owned config functions, but they should not import internal package paths.

Current issue:

```ts
import { withToolbar } from "@repo/feature-flags/lib/toolbar";
```

Correct direction:

```ts
import { withToolbar } from "@repo/feature-flags/next-config";
```

Longer-term:

- keep baseline config in `@repo/next-config`;
- expose package-specific config contributors from owning packages;
- do not hardcode all integration behavior inside app config files;
- avoid making `@repo/next-config` a second junk drawer for provider-specific behavior.

## Keep / Refactor / Delete

Keep:

- Active `apps/*` and `packages/*` shape.
- Package ownership model.
- T3 Env package key contracts.
- next-forge style app composition.

Refactor:

- Missing package exports.
- App direct provider imports.
- Package tests that import app internals.
- Package cycles in database and AI.
- Feature flag toolbar public API.
- Notification provider public API.
- Design-system theme/toast public API.

Delete or remove dependency declarations after refactor:

- App dependencies that become package-owned and are no longer imported directly by the app.
- Dead app/package files proven orphaned after graph cleanup.

## Validation Checklist

- [x] Active package manifests inventoried.
- [x] Active app manifests inventoried.
- [x] `@repo/*` import/export scan run.
- [x] Dependency-cruiser graph run.
- [x] Package typecheck sweep run.
- [ ] Export violations fixed.
- [ ] Direct provider SDK bypasses removed from app manifests.
- [ ] `@repo/ai` app-internal test dependency removed.
- [ ] Database schema cycles fixed or isolated.
- [ ] AI tool renderer registry cycles fixed.
- [ ] Re-run package typecheck, boundaries, app typecheck, app build.
