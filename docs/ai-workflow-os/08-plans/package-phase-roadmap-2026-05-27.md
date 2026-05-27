# Package Phase Roadmap

Date: 2026-05-27

Status: active execution ledger

## Rule

No package code changes without the package phase gate:

```text
official llms.txt / llms-full.txt search
-> latest official docs + npm registry
-> local package audit
-> playbook update
-> MADR/checklist when architecture/API/provider changes
-> package cleanup/upgrade/refactor/migration/build-out
-> package tests/typecheck
-> affected consumers
```

If a bug appears outside the active package, document it for that package's phase. Do not chase it unless it blocks the active phase.

Package phases are modernization phases, not cleanup-only passes. A package is not complete until its intended provider/API direction is either fully implemented and validated or explicitly split into a documented subphase.

## Current Active Packages

There are 26 active packages:

- `@repo/agentmail`
- `@repo/ai`
- `@repo/analytics`
- `@repo/auth`
- `@repo/cms`
- `@repo/collaboration`
- `@repo/connectors`
- `@repo/database`
- `@repo/design-system`
- `@repo/email`
- `@repo/feature-flags`
- `@repo/flow`
- `@repo/internationalization`
- `@repo/next-config`
- `@repo/notifications`
- `@repo/observability`
- `@repo/payments`
- `@repo/rate-limit`
- `@repo/sandbox`
- `@repo/search`
- `@repo/security`
- `@repo/seo`
- `@repo/storage`
- `@repo/testing`
- `@repo/typescript-config`
- `@repo/webhooks`

## Completed Gate

### R21: Tests

Scope:

- active Vitest projects;
- test folder normalization;
- root test runner coverage.

Result:

- root `pnpm test` now runs all configured Vitest projects;
- `pnpm test` passed: 13 files, 45 tests;
- `pnpm test:smoke` passed: 4 app files, 15 tests.

Documentation:

- [`../10-audit/tests-r21-cleanup-audit-2026-05-27.md`](../10-audit/tests-r21-cleanup-audit-2026-05-27.md)
- [`../07-madr/MADR-081-package-phase-ledger-and-no-drift-rule.md`](../07-madr/MADR-081-package-phase-ledger-and-no-drift-rule.md)

### P1.1: `@repo/typescript-config`

Scope:

- TypeScript official docs and registry metadata;
- current config surface and active consumers;
- stale service preset cleanup.

Result:

- MADR-082 accepted;
- unused `packages/typescript-config/service.json` removed;
- active non-doc reference search found no `service.json` consumers;
- `@repo/typescript-config` typecheck passed after deletion.

Documentation:

- [`../09-research/2026-05-27-p1-1-typescript-config-research.md`](../09-research/2026-05-27-p1-1-typescript-config-research.md)
- [`../10-audit/typescript-config-p1-1-audit-2026-05-27.md`](../10-audit/typescript-config-p1-1-audit-2026-05-27.md)
- [`../07-madr/MADR-082-typescript-config-strict-shared-baseline.md`](../07-madr/MADR-082-typescript-config-strict-shared-baseline.md)

### P1.2: `@repo/next-config`

Scope:

- Next.js official config docs and Vercel `llms-full`;
- latest `next` and `@t3-oss/env-nextjs` registry metadata;
- current `@repo/next-config` exports, env keys, app consumers, and provider-policy debt.

Result:

- MADR-083 accepted;
- unused `ANALYZE` env key removed from `@repo/next-config/keys`;
- active non-doc `ANALYZE` reference search found no consumers;
- `@repo/next-config` typecheck passed after deletion;
- affected `apps/app` typecheck passed;
- affected `apps/web` typecheck failed on existing web contact/i18n/metadata issues and is deferred out of P1.2.

Documentation:

- [`../09-research/2026-05-27-p1-2-next-config-research.md`](../09-research/2026-05-27-p1-2-next-config-research.md)
- [`../10-audit/next-config-p1-2-audit-2026-05-27.md`](../10-audit/next-config-p1-2-audit-2026-05-27.md)
- [`../07-madr/MADR-083-next-config-baseline-and-provider-config-defer.md`](../07-madr/MADR-083-next-config-baseline-and-provider-config-defer.md)

### P1.3: `@repo/testing`

Scope:

- Vitest/MSW/Faker official docs and registry metadata;
- active `@repo/testing` exports and consumers;
- stale Manus-era fixtures, DB helpers, tRPC helpers, and MSW handlers.

Result:

- MADR-084 accepted;
- `@repo/testing` reset to shared Vitest config helpers only;
- stale public exports and files removed;
- stale `@faker-js/faker`, `msw`, `react`, and `react-dom` dependencies removed;
- pnpm lockfile/node_modules synced with pinned pnpm;
- `@repo/testing` typecheck passed;
- root `pnpm test` passed with 13 files / 45 tests.

Documentation:

- [`../09-research/2026-05-27-p1-3-testing-package-research.md`](../09-research/2026-05-27-p1-3-testing-package-research.md)
- [`../10-audit/testing-p1-3-audit-2026-05-27.md`](../10-audit/testing-p1-3-audit-2026-05-27.md)
- [`../07-madr/MADR-084-reset-testing-package-to-shared-vitest-config.md`](../07-madr/MADR-084-reset-testing-package-to-shared-vitest-config.md)

### P1.4: `@repo/design-system`

Scope:

- shadcn/Tailwind/Radix docs and registry metadata;
- design-system exports, dependencies, and active consumers;
- deprecated toast stack, icon dependency, Radix version pin, and Tailwind v4 font tokens.

Result:

- MADR-085 accepted;
- deprecated `toast.tsx` and `use-toast.ts` removed;
- old toast exports removed from `components/feedback`;
- `ModeToggle` switched from Radix icons to Lucide icons;
- direct `@radix-ui/react-icons` and `@radix-ui/react-toast` dependencies removed;
- `radix-ui` pinned to `1.4.3`;
- Tailwind v4 font tokens changed to literal Geist font stacks;
- Storybook sidebar story fixed as an affected design-system consumer;
- `@repo/design-system`, `apps/app`, `@repo/feature-flags`, and `apps/storybook` typechecks passed;
- root `pnpm test` passed with 13 files / 45 tests;
- `apps/web` typecheck still fails on existing contact/i18n/metadata issues and is deferred.

Documentation:

- [`../09-research/2026-05-27-p1-4-design-system-research.md`](../09-research/2026-05-27-p1-4-design-system-research.md)
- [`../10-audit/design-system-p1-4-audit-2026-05-27.md`](../10-audit/design-system-p1-4-audit-2026-05-27.md)
- [`../07-madr/MADR-085-design-system-primitives-and-tailwind-v4-cleanup.md`](../07-madr/MADR-085-design-system-primitives-and-tailwind-v4-cleanup.md)

### P2.1: `@repo/auth`

Scope:

- Better Auth official docs, AI resources, and registry metadata;
- current auth exports, deps, env, tests, and active consumers;
- stale package middleware, duplicate validation, and app-local type leftovers.

Result:

- MADR-086 accepted;
- unused `@repo/auth/middleware` export removed;
- stale `packages/auth/src/middleware.ts` deleted;
- stale duplicate `packages/auth/lib/validations/auth.ts` deleted;
- stale app-local `packages/auth/types/index.d.ts` deleted;
- `@repo/auth/validations` subpath added;
- app auth form schemas now consume package validation contracts;
- package-local auth validation tests added and root Vitest includes `@repo/auth`;
- `@repo/auth` typecheck and tests passed;
- `apps/app` typecheck passed;
- root `pnpm test` passed with 14 files / 50 tests;
- `apps/app` `next build --webpack` passed with the existing Sentry/OpenTelemetry warning;
- default Turbopack `next build` stayed silent for several minutes and was terminated; defer to the Next/app build phase.

Documentation:

- [`../09-research/2026-05-27-p2-1-auth-better-auth-research.md`](../09-research/2026-05-27-p2-1-auth-better-auth-research.md)
- [`../10-audit/auth-p2-1-audit-2026-05-27.md`](../10-audit/auth-p2-1-audit-2026-05-27.md)
- [`../07-madr/MADR-086-better-auth-package-boundary-and-flow-cleanup.md`](../07-madr/MADR-086-better-auth-package-boundary-and-flow-cleanup.md)

### P2.2: `@repo/database`

Scope:

- Drizzle official docs, Better Auth Drizzle adapter docs, and registry metadata;
- current database exports, deps, env, scripts, schema, and active consumers;
- service-era database clients/exports and old seed/one-off scripts.

Result:

- MADR-087 accepted;
- unused `@repo/database/service` and `@repo/database/service-index` exports removed;
- `src/service-client.ts` and `src/service-index.ts` deleted;
- old connector/device seed scripts deleted;
- one-off billing migration script deleted;
- active database client marked `server-only`;
- schema files and migrations preserved;
- app tests gained a test-only `server-only` alias;
- `@repo/database`, `@repo/auth`, and `apps/app` typechecks passed;
- root `pnpm test` passed with 14 files / 50 tests;
- `drizzle-kit check` passed.

Documentation:

- [`../09-research/2026-05-27-p2-2-database-drizzle-research.md`](../09-research/2026-05-27-p2-2-database-drizzle-research.md)
- [`../10-audit/database-p2-2-audit-2026-05-27.md`](../10-audit/database-p2-2-audit-2026-05-27.md)
- [`../07-madr/MADR-087-database-package-cleanup-without-schema-deletion.md`](../07-madr/MADR-087-database-package-cleanup-without-schema-deletion.md)

### P2.3: `@repo/email`

Scope:

- Resend and React Email official docs plus registry metadata;
- current email exports, deps, env, tests, templates, and active consumers;
- provider boundary between root transport entrypoint and template subpath.

Result:

- MADR-088 accepted;
- root `@repo/email` provider entrypoint marked `server-only`;
- `server-only` dependency added;
- package tests mock `server-only`;
- `@repo/email` typecheck and tests passed;
- `@repo/auth` and `apps/app` typechecks passed;
- root `pnpm test` passed with 14 files / 50 tests;
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.

Documentation:

- [`../09-research/2026-05-27-p2-3-email-resend-react-email-research.md`](../09-research/2026-05-27-p2-3-email-resend-react-email-research.md)
- [`../10-audit/email-p2-3-audit-2026-05-27.md`](../10-audit/email-p2-3-audit-2026-05-27.md)
- [`../07-madr/MADR-088-email-package-server-only-provider-boundary.md`](../07-madr/MADR-088-email-package-server-only-provider-boundary.md)

### P2.4: `@repo/security`

Scope:

- Arcjet and Nosecone official docs plus registry metadata;
- current security exports, deps, env, tests, and active consumers;
- provider ownership between apps and `@repo/security`.

Result:

- MADR-089 accepted;
- unused direct `@arcjet/next` dependency removed from `apps/web`;
- package-local tests added for no-key and development skip behavior;
- root Vitest includes `@repo/security`;
- `@repo/security` typecheck and tests passed;
- `apps/app` typecheck passed;
- root `pnpm test` passed with 15 files / 52 tests;
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.

Documentation:

- [`../09-research/2026-05-27-p2-4-security-arcjet-nosecone-research.md`](../09-research/2026-05-27-p2-4-security-arcjet-nosecone-research.md)
- [`../10-audit/security-p2-4-audit-2026-05-27.md`](../10-audit/security-p2-4-audit-2026-05-27.md)
- [`../07-madr/MADR-089-security-package-provider-boundary-and-tests.md`](../07-madr/MADR-089-security-package-provider-boundary-and-tests.md)

### P2.5: `@repo/rate-limit`

Scope:

- Upstash Ratelimit/Redis official docs and registry metadata;
- current rate-limit exports, deps, env, tests, and active consumers;
- optional env behavior and provider construction timing.

Result:

- MADR-090 accepted;
- package kept standalone instead of merging into security;
- root provider entrypoint marked `server-only`;
- Upstash Redis client construction made lazy;
- missing credentials now fail on limiter creation, not import;
- package-local tests added;
- root Vitest includes `@repo/rate-limit`;
- `@repo/rate-limit` typecheck and tests passed;
- root `pnpm test` passed with 16 files / 54 tests;
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.

Documentation:

- [`../09-research/2026-05-27-p2-5-rate-limit-upstash-research.md`](../09-research/2026-05-27-p2-5-rate-limit-upstash-research.md)
- [`../10-audit/rate-limit-p2-5-audit-2026-05-27.md`](../10-audit/rate-limit-p2-5-audit-2026-05-27.md)
- [`../07-madr/MADR-090-standalone-rate-limit-package-with-lazy-upstash-client.md`](../07-madr/MADR-090-standalone-rate-limit-package-with-lazy-upstash-client.md)

### P2.6: `@repo/observability`

Scope:

- Sentry, Next.js instrumentation, and Better Stack/Logtail official docs plus registry metadata;
- current observability exports, deps, env, tests, and active consumers;
- provider ownership between apps and `@repo/observability`.

Result:

- MADR-091 accepted;
- missing root `@repo/observability` export file added;
- package-owned `onRequestError` added for Next/Sentry request error capture;
- `apps/app` and `apps/web` instrumentation files re-export package `onRequestError`;
- `apps/web` global error now imports capture helper from `@repo/observability/error`;
- direct unused Sentry/Sentry-support dependencies removed from `apps/web`;
- package Next config wrapper now uses current `withBetterStack` naming;
- package-local tests added and root Vitest includes `@repo/observability`;
- `@repo/observability` typecheck and tests passed;
- `apps/app` typecheck passed;
- root `pnpm test` passed with 17 files / 58 tests;
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.
- Global `pnpm outdated -r --format json` now reports newer releases outside this package phase: `@vercel/sandbox@2.0.1`, `posthog-js@1.376.3`, `posthog-node@5.35.5`, `chromatic@17.1.0`, and `react-email@6.5.0`. Handle these in the owning package/app phases with fresh docs gates, not inside P2.6.

Documentation:

- [`../09-research/2026-05-27-p2-6-observability-sentry-logtail-research.md`](../09-research/2026-05-27-p2-6-observability-sentry-logtail-research.md)
- [`../10-audit/observability-p2-6-audit-2026-05-27.md`](../10-audit/observability-p2-6-audit-2026-05-27.md)
- [`../07-madr/MADR-091-observability-provider-boundary-and-request-error-hook.md`](../07-madr/MADR-091-observability-provider-boundary-and-request-error-hook.md)

### P3.1A: `@repo/cms` BaseHub Retirement

Scope:

- Payload, BaseHub, and Next.js official docs plus registry metadata;
- current CMS exports, deps, env, tests, and active consumers;
- BaseHub removal path and Payload adoption gate.

Result:

- MADR-092 accepted;
- Payload selected as the future CMS direction, but not installed during cleanup;
- BaseHub dependency, scripts, env, generated types, config, and component wrappers removed from `@repo/cms`;
- root export replaced with provider-neutral content contracts and static content helper;
- `withCMS` stayed inert during P3.1A and was replaced by a Payload wrapper in P3.1B;
- package-local tests added and root Vitest includes `@repo/cms`;
- `@repo/cms` typecheck and tests passed;
- root `pnpm test` passed with 18 files / 60 tests;
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues and is deferred.

Documentation:

- [`../09-research/2026-05-27-p3-1-cms-payload-basehub-research.md`](../09-research/2026-05-27-p3-1-cms-payload-basehub-research.md)
- [`../10-audit/cms-p3-1-audit-2026-05-27.md`](../10-audit/cms-p3-1-audit-2026-05-27.md)
- [`../07-madr/MADR-092-retire-basehub-cms-and-defer-payload-install.md`](../07-madr/MADR-092-retire-basehub-cms-and-defer-payload-install.md)

### P3.1B: `@repo/cms` Payload Package Implementation

Scope:

- Payload `llms-full.txt`, official docs, and registry metadata;
- app/package boundary for Payload in the monorepo;
- package-local docs and implementation checklist;
- package-owned Payload schema/config/access/content implementation;
- strict pnpm peer dependency validation.

Result:

- MADR-092A accepted;
- Payload implementation architecture approved and package-owned code implemented;
- `apps/web` selected as the first Payload app host;
- `@repo/cms` selected as owner of Payload schema/config/access/content API;
- app-owned Payload convention files are allowed only after package config passes;
- `PAYLOAD_DATABASE_URL` selected instead of implicit product `DATABASE_URL`;
- Payload migrations remain separate from `@repo/database`;
- package-local `packages/cms/README.md` added and updated;
- Payload packages installed in sync at `3.85.0`;
- `@repo/cms` exports `access`, `collections`, `content`, `globals`, `keys`, `next-config`, and `payload`;
- initial Payload collections/globals, access helpers, env contract, config factory, Vercel Blob media plugin, optional Resend email adapter, and Payload content adapter added;
- local implementation file named `config.ts` while public export remains `@repo/cms/payload` to avoid shadowing the npm `payload` package;
- explicit `esbuild@0.28.0` added where needed to satisfy `vite@8.0.14` strict peer resolution;
- `pnpm install`, `@repo/cms` typecheck/test/build, root `pnpm test`, and `@repo/cms` outdated check passed;
- `apps/web` Payload route integration was completed in P3.1C.

Documentation:

- [`../09-research/2026-05-27-p3-1b-payload-implementation-research.md`](../09-research/2026-05-27-p3-1b-payload-implementation-research.md)
- [`../07-madr/MADR-092A-payload-cms-implementation-architecture.md`](../07-madr/MADR-092A-payload-cms-implementation-architecture.md)
- [`../10-audit/cms-p3-1b-payload-implementation-audit-2026-05-27.md`](../10-audit/cms-p3-1b-payload-implementation-audit-2026-05-27.md)
- [`../../../packages/cms/README.md`](../../../packages/cms/README.md)

### P3.1C: `apps/web` Payload Route Integration

Scope:

- Payload official docs and installed `@payloadcms/next` convention surface;
- `apps/web` thin Payload config entrypoint;
- `@payload-config` path;
- generated Payload App Router route group;
- web package dependency sync;
- CMS package boundary enforcement.

Result:

- `apps/web/payload.config.ts` added as a thin entrypoint to `@repo/cms/payload`;
- `apps/web/tsconfig.json` maps `@payload-config`;
- `apps/web/next.config.ts` composes through `@repo/cms/next-config`;
- `apps/web/app/(payload)` now contains the Payload Admin, REST, GraphQL, GraphQL Playground, layout, import map, and Sass convention files;
- `apps/web/payload-env.d.ts` declares `@payloadcms/next/css`;
- `apps/web` declares the needed Payload app dependencies at current checked versions;
- Payload-specific `apps/web` type errors were cleared;
- root `pnpm test` passed with 20 files / 66 tests;
- `pnpm outdated --filter web --format json` returned `{}`;
- `apps/web` typecheck still fails on existing contact/i18n/calendar/metadata issues outside CMS.

Documentation:

- [`../10-audit/cms-p3-1c-web-payload-route-integration-audit-2026-05-27.md`](../10-audit/cms-p3-1c-web-payload-route-integration-audit-2026-05-27.md)
- [`../07-madr/MADR-092A-payload-cms-implementation-architecture.md`](../07-madr/MADR-092A-payload-cms-implementation-architecture.md)
- [`../../../packages/cms/README.md`](../../../packages/cms/README.md)

## Package Phase Ledger

| Order | Package                      | Phase Goal                                                                       | Planned Decision Record                | Playbook                                                                               | Required Validation                                        |
| ----: | ---------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
|  P1.1 | `@repo/typescript-config`    | Shared strict TypeScript baseline.                                               | MADR-082                               | `package-playbooks/typescript-config.md`                                               | package typecheck dependents                               |
|  P1.2 | `@repo/next-config`          | Shared Next 16.2.6 config without provider junk.                                 | MADR-083                               | `package-playbooks/next-config.md`                                                     | app/web build/typecheck as affected                        |
|  P1.3 | `@repo/testing`              | Shared test utilities only, no stale Manus fixtures.                             | MADR-084                               | `package-playbooks/testing.md`                                                         | root `pnpm test`, package typecheck                        |
|  P1.4 | `@repo/design-system`        | UI primitives/tokens only, no domain workflow UI.                                | MADR-085                               | `package-playbooks/design-system.md`                                                   | design-system typecheck, app/web typecheck                 |
|  P2.1 | `@repo/auth`                 | Better Auth package boundary, latest docs, complete flows.                       | MADR-086 accepted                      | `package-playbooks/auth.md`                                                            | auth/app tests, app build                                  |
|  P2.2 | `@repo/database`             | Drizzle/Postgres schema hygiene and workflow schema plan.                        | MADR-087 accepted                      | `package-playbooks/database.md`                                                        | database typecheck, migration dry run if available         |
|  P2.3 | `@repo/email`                | Resend/React Email package, auth email flows.                                    | MADR-088 accepted                      | `package-playbooks/email.md`                                                           | email tests, auth consumers                                |
|  P2.4 | `@repo/security`             | Security headers/rate boundaries.                                                | MADR-089 accepted                      | `package-playbooks/security.md`                                                        | security typecheck, app proxy tests                        |
|  P2.5 | `@repo/rate-limit`           | Decide keep standalone or merge into security.                                   | MADR-090 accepted                      | `package-playbooks/rate-limit.md`                                                      | rate-limit/security/app consumers                          |
|  P2.6 | `@repo/observability`        | Sentry client/server/edge/request-error boundaries.                              | MADR-091 accepted                      | `package-playbooks/observability.md`                                                   | observability typecheck/tests, app/web typecheck           |
| P3.1A | `@repo/cms`                  | Retire BaseHub from active package graph.                                        | MADR-092 accepted                      | `package-playbooks/cms.md`                                                             | cms tests/typecheck, web typecheck as affected             |
| P3.1B | `@repo/cms`                  | Implement Payload package architecture.                                          | MADR-092A accepted/package implemented | `package-playbooks/cms.md`, `packages/cms/README.md`                                   | cms tests/typecheck/build                                  |
| P3.1C | `apps/web` + `@repo/cms`     | Add app-owned Payload convention integration.                                    | MADR-092A updated                      | `package-playbooks/cms.md`, `packages/cms/README.md`                                   | cms tests/typecheck/build, web typecheck to known blockers |
|  P3.2 | `@repo/internationalization` | Standardize on `next-intl@4.12.0`.                                               | MADR-093 accepted/implemented          | `package-playbooks/internationalization.md`, `packages/internationalization/README.md` | i18n tests/typecheck, web typecheck to known blockers      |
|  P3.3 | `@repo/seo`                  | Marketing metadata helper only.                                                  | MADR-094 accepted/implemented          | `package-playbooks/seo.md`, `packages/seo/README.md`                                   | seo tests/typecheck, web typecheck to known blockers       |
| P3.3A | `apps/web`                   | Unblock contact Calendar for DayPicker v10.                                      | MADR-094A accepted/implemented         | web unblock audit                                                                      | web/design-system typecheck, root tests                    |
|  P4.1 | `@repo/flow`                 | Custom `.flow` grammar/parser/runtime-neutral kernel; no YAML parser dependency. | MADR-095 accepted/no-YAML parser gate  | `package-playbooks/flow.md`                                                            | flow tests/typecheck/root tests                            |
| Cross | resumable workflow runs      | Durable run execution and UI reconnect after refresh/tab close.                  | MADR-096 accepted                      | `resumable-workflow-runs-checklist.md`                                                 | reconnect/replay/cancel tests                              |
|  P4.2 | `@repo/ai`                   | AI SDK capability layer and platform tools.                                      | MADR-097                               | `package-playbooks/ai.md`                                                              | ai tests/typecheck/boundaries                              |
|  P4.3 | `@repo/sandbox`              | Vercel Sandbox provider behind neutral boundary.                                 | MADR-098                               | `package-playbooks/sandbox.md`                                                         | sandbox tests/typecheck                                    |
|  P4.4 | `@repo/connectors`           | Composio/direct connector sessions/tools/triggers.                               | MADR-099                               | `package-playbooks/connectors.md`                                                      | connectors tests/typecheck                                 |
|  P4.5 | `@repo/search`               | Typesense generic workflow/artifact search boundary.                             | MADR-100                               | `package-playbooks/search.md`                                                          | search tests/typecheck                                     |
|  P4.6 | `@repo/storage`              | Artifact/object storage boundary.                                                | MADR-101                               | `package-playbooks/storage.md`                                                         | storage typecheck/tests if added                           |
|  P4.7 | `@repo/notifications`        | Workflow approvals/issues/digests provider boundary.                             | MADR-102                               | `package-playbooks/notifications.md`                                                   | notifications typecheck/app shell                          |
|  P5.1 | `@repo/payments`             | Stripe billing/usage boundary, no API version downgrade.                         | MADR-103                               | `package-playbooks/payments.md`                                                        | payments typecheck                                         |
|  P5.2 | `@repo/feature-flags`        | Active flags only, optional env.                                                 | MADR-104                               | `package-playbooks/feature-flags.md`                                                   | flags/app tests                                            |
|  P5.3 | `@repo/analytics`            | Optional analytics provider package.                                             | MADR-105                               | `package-playbooks/analytics.md`                                                       | analytics typecheck                                        |
|  P5.4 | `@repo/webhooks`             | Workflow trigger/webhook boundary.                                               | MADR-106                               | `package-playbooks/webhooks.md`                                                        | webhooks typecheck                                         |
|  P5.5 | `@repo/agentmail`            | Decide optional later agent inbox package.                                       | MADR-107                               | `package-playbooks/agentmail.md`                                                       | agentmail typecheck                                        |
|  P5.6 | `@repo/collaboration`        | Gate Liveblocks until `.flow` collaboration is needed.                           | MADR-108                               | `package-playbooks/collaboration.md`                                                   | collaboration typecheck                                    |

## Sub-MADR Checklist

These MADRs are intentionally scheduled before implementation. A package phase may update its assigned MADR instead of creating a new one only when the existing record already captures the same architecture/provider/API decision.

- [x] MADR-082: `@repo/typescript-config`
- [x] MADR-083: `@repo/next-config`
- [x] MADR-084: `@repo/testing`
- [x] MADR-085: `@repo/design-system`
- [x] MADR-086: `@repo/auth`
- [x] MADR-087: `@repo/database`
- [x] MADR-088: `@repo/email`
- [x] MADR-089: `@repo/security`
- [x] MADR-090: `@repo/rate-limit`
- [x] MADR-091: `@repo/observability`
- [x] MADR-092: `@repo/cms` BaseHub retirement
- [x] MADR-092A: `@repo/cms` Payload implementation architecture
- [x] MADR-093: `@repo/internationalization`
- [x] MADR-094: `@repo/seo`
- [x] MADR-094A: `apps/web` contact Calendar DayPicker v10 unblock
- [x] MADR-095: `@repo/flow`
- [x] MADR-096: resumable workflow runs and UI reconnect
- [ ] MADR-097: `@repo/ai`
- [ ] MADR-098: `@repo/sandbox`
- [ ] MADR-099: `@repo/connectors`
- [ ] MADR-100: `@repo/search`
- [ ] MADR-101: `@repo/storage`
- [ ] MADR-102: `@repo/notifications`
- [ ] MADR-103: `@repo/payments`
- [ ] MADR-104: `@repo/feature-flags`
- [ ] MADR-105: `@repo/analytics`
- [ ] MADR-106: `@repo/webhooks`
- [ ] MADR-107: `@repo/agentmail`
- [ ] MADR-108: `@repo/collaboration`

## CMS Package Notes

Payload package implementation is complete under `P3.1B`. The required App Router convention files are integrated in `apps/web` under `P3.1C`.

## Flow Package Notes

P4.1 is in the research/design gate. The accepted decision is to build a custom `.flow` grammar and parser inside `@repo/flow`, using YAML.org/spec/test-suite/package architecture only as research input. Do not add `yaml` or any YAML-backed parser implementation unless a future MADR reverses MADR-095.

Known latest registry versions checked on 2026-05-27:

- `payload@3.85.0`
- `@payloadcms/next@3.85.0`
- `@payloadcms/db-postgres@3.85.0`
- `@payloadcms/richtext-lexical@3.85.0`
- `@payloadcms/storage-vercel-blob@3.85.0`
- `@payloadcms/email-resend@3.85.0`
- `@payloadcms/live-preview-react@3.85.0`
- `graphql@16.14.0`
- `sharp@0.34.5`

Payload docs currently support:

- code-first, version-controlled schemas;
- React Admin Panel;
- database schema/migrations/access control;
- REST, GraphQL, and direct Node APIs;
- file/media support;
- live preview;
- adding Payload into an existing Next.js app.

Accepted decision for P3.1B:

- `@repo/cms` owns Payload schema/config/access/content API;
- `apps/web` is the first Payload host and owns required `(payload)` App Router convention files;
- separate `apps/cms` remains an exit path only if deployment/build isolation is later proven necessary.

Implemented package exports:

- `@repo/cms/access`
- `@repo/cms/collections`
- `@repo/cms/content`
- `@repo/cms/globals`
- `@repo/cms/keys`
- `@repo/cms/next-config`
- `@repo/cms/payload`

Implemented app convention surface:

- `apps/web/payload.config.ts`
- `apps/web/payload-env.d.ts`
- `apps/web/app/(payload)/layout.tsx`
- `apps/web/app/(payload)/admin/*`
- `apps/web/app/(payload)/api/[...slug]/route.ts`
- `apps/web/app/(payload)/api/graphql/route.ts`
- `apps/web/app/(payload)/api/graphql-playground/route.ts`

Remaining CMS-adjacent work:

- Payload migrations;
- live preview;
- CMS localization;
- content route rendering;
- Payload admin auth/SSO decision.

## Internationalization Package Notes

P3.2 is complete. Keep `@repo/internationalization` as the package boundary and use `next-intl` as the only active provider.

Known latest registry version checked on 2026-05-27:

- `next-intl@4.12.0`

`next-intl` docs currently support:

- App Router locale segment setup;
- `defineRouting`;
- `proxy.ts` for Next.js 16 routing middleware;
- `createNavigation`;
- request config;
- `[locale]` layout validation;
- static rendering helpers.

Open decision for P3.2:

- package wrapper over `next-intl` is accepted in MADR-093;
- `apps/web` owns app-specific request config and layout composition;
- `apps/web` Payload `/api/*` routes bypass i18n middleware.

Validation:

- `pnpm --filter @repo/internationalization typecheck` passed.
- `pnpm --filter @repo/internationalization test` passed: 1 file / 3 tests.
- root `pnpm test` passed: 21 files / 69 tests.
- `pnpm outdated --filter @repo/internationalization --format json` returned `{}`.
- `apps/web` typecheck no longer reports i18n root `getTranslations` errors. Later P3.3 and P3.3A resolved the SEO metadata and DayPicker Calendar blockers.

## SEO Package Notes

P3.3 is complete. Keep `@repo/seo` as the shared SEO helper package.

Known latest registry versions checked on 2026-05-27:

- `schema-dts@2.0.0`
- `lodash.merge@4.6.2`

Accepted decision for P3.3:

- keep `description` required in `createMetadata`;
- remove `lodash.merge` from the package;
- remove direct env reads from the package;
- replace next-forge/Vercel defaults with Jeriko defaults;
- keep CMS fetching, i18n routing, and app env out of `@repo/seo`.

Validation:

- `pnpm --filter @repo/seo typecheck` passed.
- `pnpm --filter @repo/seo test` passed: 2 files / 4 tests.
- root `pnpm test` passed: 23 files / 73 tests.
- `pnpm outdated --filter @repo/seo --format json` returned `{}`.
- `apps/web` typecheck no longer reports SEO metadata description errors. The remaining non-SEO contact Calendar issue was resolved in P3.3A.

## Web Contact Calendar Unblock Notes

P3.3A is complete. This was an app unblock, not a package refactor.

Known latest registry version checked on 2026-05-27:

- `react-day-picker@10.0.1`

Accepted decision for P3.3A:

- use DayPicker v10 `autoFocus` instead of removed `initialFocus`;
- keep the shared design-system Calendar wrapper unchanged in this unblock;
- defer a package-wide `@daypicker/react` import/package-name migration to a future design-system phase if needed.

Validation:

- `pnpm --filter web typecheck` passed.
- `pnpm --filter @repo/design-system typecheck` passed.
- root `pnpm test` passed: 23 files / 73 tests.

## Per-Package Gate Checklist

Each package phase must check these boxes before code changes:

- [ ] Official docs opened and summarized.
- [ ] llms.txt / llms-full.txt checked when vendor provides it.
- [ ] npm latest version, peer deps, and engine metadata checked.
- [ ] Current package exports listed.
- [ ] Current consumers found with `rg`.
- [ ] Current env keys listed.
- [ ] Server/client/runtime boundary stated.
- [ ] Keep/refactor/replace/gate/delete verdict written.
- [ ] MADR created or updated if architecture changes.
- [ ] Package playbook updated.
- [ ] Refactor checklist written.
- [ ] Validation commands selected.

After code changes:

- [ ] Package typecheck passes.
- [ ] Package tests pass or missing tests are documented.
- [ ] Affected app/package consumers typecheck.
- [ ] Root tests run when shared behavior changed.
- [ ] Dependency-cruiser run when imports/exports changed.
- [ ] Audit doc updated with exact command results.

## App Rebuild Gate

Do not start serious `apps/app` or `apps/web` product rebuild until the active package phase says the needed package APIs are stable enough to consume.

Apps may receive only:

- direct fixes required to validate the active package;
- route-local reset shell maintenance;
- test harness updates.
