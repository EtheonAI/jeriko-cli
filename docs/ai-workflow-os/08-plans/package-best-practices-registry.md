# Package Best-Practices Registry

Date: 2026-05-25

Status: active cleanup gate

Scope: all active `apps/*` and `packages/*`.

## Direct Answer

Yes, this repo needs package-specific best-practice documentation before serious refactors.

No, it does not need a full research essay for every npm package or transitive dependency before work can continue. That would slow the reset without improving quality.

Required rule:

- Full playbook before changing any P0 package/app API, env contract, runtime boundary, build behavior, auth/security behavior, database schema, payment behavior, workflow execution, or Next.js route structure.
- Focused source check before touching P1 packages.
- Lightweight keep/gate/archive note is enough for P2 packages until they become active.

## Evidence

Source-backed review:

- `../09-research/2026-05-25-package-best-practices-source-review.md`

Related standards and decisions:

- `../00-ENGINEERING-STANDARDS.md`
- `../01-architecture/package-ownership-index.md`
- `../07-madr/MADR-032-t3-env-as-env-contract.md`
- `../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`
- `../07-madr/MADR-042-canonical-engineering-standards.md`
- `../07-madr/MADR-043-package-specific-playbooks-before-refactors.md`

## Priority Matrix

| Area                         | Priority | Current Status                                                                                             | Required Before Refactor                                                                                                               |
| ---------------------------- | -------: | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/app`                   |       P0 | Main authenticated product app; current next cleanup target.                                               | Full app playbook: route map, env, auth, server/client boundaries, build blocker, lint plan, delete/move list.                         |
| `apps/web`                   |       P1 | Marketing/content app; BaseHub removed from active build; feature flags kept.                              | Focused playbook before CMS/Payload redesign or route restructure.                                                                     |
| `apps/docs`                  |       P2 | Mintlify docs app; `docs.json` is single config.                                                           | Lightweight docs app checklist before changing docs tooling.                                                                           |
| `apps/email`                 |       P2 | React Email preview/dev surface.                                                                           | Lightweight checklist unless email becomes MVP approval/notification surface.                                                          |
| `apps/storybook`             |       P2 | Design-system workshop.                                                                                    | Focused playbook before UI-system migration.                                                                                           |
| `apps/studio`                |       P2 | Database studio/dev surface.                                                                               | Lightweight checklist unless DB tooling changes.                                                                                       |
| `@repo/auth`                 |       P0 | Auth boundary package.                                                                                     | Full playbook: provider docs, server-only usage, org/team model, env, route/action guards, tests.                                      |
| `@repo/database`             |       P0 | Drizzle/Postgres schema and client package.                                                                | Full playbook: Drizzle docs, migration policy, schema ownership, serverless client behavior, test DB strategy.                         |
| `@repo/ai`                   |       P0 | Current AI/tool/canvas primitives; likely split later.                                                     | Full playbook before splitting UI/tool/runtime pieces.                                                                                 |
| `@repo/flow`                 |       P0 | Workflow source/parser/compiler/runtime contracts.                                                         | Full playbook before adding parser, compiler, runtime state, or executor contracts.                                                    |
| `@repo/sandbox`              |       P0 | Provider-neutral sandbox contracts plus Vercel/mock adapters.                                              | Full playbook before changing execution contracts, provider adapters, env, network policy, file/port behavior, or E2B migration gates. |
| `@repo/contracts`            |  Retired | Deleted by MADR-067; it had no active consumers and mixed unrelated domains.                               | Do not recreate unless a coherent cross-package/public contract surface has multiple real consumers.                                   |
| `@repo/security`             |       P0 | Security/rate-limit/platform protection surface.                                                           | Full playbook before auth, sandbox, webhook, or tool execution changes.                                                                |
| `@repo/payments`             |       P0 | Stripe/payment package.                                                                                    | Full playbook before Stripe API changes; never downgrade API dates without evidence.                                                   |
| `@repo/feature-flags`        |       P3 | Feature flags kept; stale runtime flags removed; auth/analytics are lazy-loaded inside the package helper. | Keep app imports on public package entrypoints; add new flags only with docs-backed metadata and a package playbook update.            |
| `@repo/next-config`          |       P0 | Shared Next config.                                                                                        | Full playbook before changing build, images, transpilation, Turbopack, or bundle policy.                                               |
| `@repo/typescript-config`    |       P0 | Shared TypeScript config.                                                                                  | Full playbook before compiler/module/bundler mode changes.                                                                             |
| `@repo/design-system`        |       P1 | Shared UI primitives and tokens.                                                                           | Focused playbook before material redesign, shadcn updates, tokens, or Tailwind changes.                                                |
| `@repo/storage`              |       P1 | Object/file storage helpers.                                                                               | Focused playbook before artifact/file rendering work.                                                                                  |
| `@repo/search`               |       P1 | Search package.                                                                                            | Focused playbook before workflow/artifact search migration.                                                                            |
| `@repo/email`                |       P1 | Email templates/components.                                                                                | Focused playbook before approval/notification email work.                                                                              |
| `@repo/webhooks`             |       P1 | Webhook helpers/contracts.                                                                                 | Focused playbook before trigger/event router work.                                                                                     |
| `@repo/observability`        |       P1 | Sentry/logging/status instrumentation.                                                                     | Focused playbook before production instrumentation changes.                                                                            |
| `@repo/analytics`            |       P1 | Product analytics helpers.                                                                                 | Focused playbook before event tracking changes.                                                                                        |
| `@repo/rate-limit`           |       P1 | Rate-limit wrapper.                                                                                        | Focused playbook before merge/split with security.                                                                                     |
| `@repo/testing`              |       P1 | Shared test utilities.                                                                                     | Focused playbook before test harness reset or fixture cleanup.                                                                         |
| `@repo/cms`                  |       P2 | BaseHub-backed package; gated for Payload evaluation.                                                      | Archive/gate decision before any further investment.                                                                                   |
| `@repo/agentmail`            |       P2 | Optional integration.                                                                                      | Keep optional or archive after import/env audit.                                                                                       |
| `@repo/collaboration`        |       P2 | Live collaboration not proven for MVP.                                                                     | Gate until workflow collaboration requirements exist.                                                                                  |
| `@repo/internationalization` |       P2 | Locale support package.                                                                                    | Keep only if active routes require it; avoid app-runtime coupling.                                                                     |
| `@repo/notifications`        |       P2 | Optional notification provider.                                                                            | Keep optional or archive after import/env audit.                                                                                       |
| `@repo/seo`                  |       P2 | Marketing SEO helpers.                                                                                     | Keep if `apps/web` remains active; otherwise gate.                                                                                     |

## Package Playbook Template

Create one package playbook before changing a P0 package or app.

Recommended location:

```text
docs/ai-workflow-os/08-plans/package-playbooks/<name>.md
```

Required sections:

```markdown
# <Package/App> Playbook

Date:
Owner role:
Status: keep | refactor | gate | archive
Priority: P0 | P1 | P2

## Purpose

What this package/app owns and what it must not own.

## Official Sources Checked

| Source | Claim Used | Checked Date |
| ------ | ---------- | ------------ |

## Package Metadata Checked

Latest version, peer dependencies, engines, registry/cache command used.

## Local Usage Map

Imports, dependents, env keys, routes, commands, tests, and build participation.

## Boundaries

Allowed imports, forbidden imports, server/client boundary, runtime target, env contract.

## Keep / Refactor / Delete

Concrete file/folder decisions with reason.

## Verification Gates

Commands that must pass before and after the change.

## Risks

Known risks, migrations, and rollback path.

## Open Questions

What remains unknown and how to prove it.
```

## Minimum Source Check By Package Type

| Package Type      | Must Check                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Next app          | Next.js docs for touched area, React docs for client/server boundary, app env file, route map, package metadata. |
| Env package       | T3 Env docs, current app/package `env.ts` and `keys.ts`, build with missing optional secrets.                    |
| Database          | Drizzle docs, database driver docs, migrations, schema ownership, serverless connection behavior.                |
| Auth              | Provider docs, route/action auth checks, server-only imports, org/team ownership.                                |
| Payments          | Stripe docs and current API version metadata; never change API version by memory.                                |
| AI/tooling        | AI SDK/provider docs, tool schema/runtime docs, streaming behavior, cost/safety boundaries.                      |
| UI/design-system  | Next/React client boundary, shadcn/Tailwind docs if touched, Storybook/design-system consumers.                  |
| Security/webhooks | Provider docs, signature verification, replay protection, rate-limit behavior, env handling.                     |
| Storage/files     | Provider docs, upload/download permissions, file rendering policies, artifact boundaries.                        |
| Testing/linting   | Vitest/Playwright/Biome/ESLint docs for touched config and current root commands.                                |

## Current Stage

Current repo phase remains Phase -1 base reset and cleanup.

Done:

- Active package versions normalized with fresh registry checks.
- Node baseline upgraded to `22.22.1`.
- pnpm baseline upgraded to `11.3.0`.
- Next.js held at `16.2.6`.
- `pnpm typecheck` passed previously for the active workspace.
- `apps/web` production build passes without `BASEHUB_TOKEN` or `DATABASE_URL`.
- Feature flags are kept and use T3 Env, with product auth/database lazy-loaded.
- BaseHub is removed from active `apps/web` build coupling.

Not done:

- `apps/app` production build diagnosis.
- Active lint debt cleanup or temporary baseline decision.
- Full `apps/app` playbook.
- Dead-code/dependency tooling.
- Final keep/archive decision for `packages/cms` and other P2 optional packages.

## Next Work Order

1. Write the `apps/app` P0 playbook.
2. Diagnose `apps/app` production build hang.
3. Clean app route ownership and dev/test route leakage.
4. Reduce lint debt to zero or create an explicitly scoped temporary baseline.
5. Add dead-code/dependency tooling after route ownership is stable.
6. Decide whether to archive `packages/cms` before Payload evaluation.

## Non-Negotiables

- Do not remove features just to make builds pass.
- Do not use direct `process.env` in app runtime code when an env contract exists.
- Do not introduce `dotenv` or `@next/env` into app runtime env handling.
- Do not move active app roots to `src/app` unless a MADR and migration plan explicitly approve it.
- Do not change Stripe API versions, auth strategy, database clients, or env shape without package-specific evidence.
- Do not implement Payload, `.flow`, Vercel Sandbox, or the UI redesign until Phase -1 blockers are resolved.
