# Package Audit And Modernization Master Plan

Date: 2026-05-26

Status: active planning gate

Update 2026-05-27:

This master plan is now governed by the stricter package phase ledger:

- [`./package-phase-roadmap-2026-05-27.md`](./package-phase-roadmap-2026-05-27.md)
- [`../07-madr/MADR-081-package-phase-ledger-and-no-drift-rule.md`](../07-madr/MADR-081-package-phase-ledger-and-no-drift-rule.md)

If this older phase grouping conflicts with the package phase roadmap, the package phase roadmap wins.

## Goal

Audit, document, upgrade, and refactor every active package until the apps can be rebuilt on a clean package foundation.

This is the order:

```text
package audit
-> package docs/research
-> package public API decision
-> package refactor
-> package validation
-> app consumption
```

Do not rebuild `apps/app` as a serious product surface until the core packages it depends on are clean.

## Documentation Rule

Use central docs for decisions and phase tracking:

```text
docs/ai-workflow-os/09-research/
docs/ai-workflow-os/07-madr/
docs/ai-workflow-os/10-audit/
docs/ai-workflow-os/08-plans/package-playbooks/
```

Use package-local `README.md` only when a package has a stable public API worth documenting for contributors.

Do not scatter MADRs inside packages. Keep MADRs centralized so architecture history stays searchable.

## Required Package Playbook Shape

Before refactoring a package, create or update:

```text
docs/ai-workflow-os/08-plans/package-playbooks/<package-name>.md
```

Required sections:

- role and ownership;
- current exports and consumers;
- direct dependencies and provider SDKs;
- official docs checked;
- llms.txt / llms-full.txt checked when available;
- latest registry metadata;
- env contract;
- server/client/runtime boundary;
- app import rules;
- keep/refactor/delete/gate verdict;
- concrete refactor checklist;
- validation commands;
- unresolved risks.

## Source Gate

For each package:

1. Read official docs for the package area being touched.
2. Use llms.txt / llms-full.txt when the vendor provides it.
3. Check latest registry metadata:

```bash
pnpm view <package> version engines peerDependencies --registry https://registry.npmjs.org
```

4. Inspect installed/local types and source.
5. Inspect current repo imports with `rg`.
6. Document the decision before code changes.

## Global Validation Gate

After every package phase:

```bash
pnpm --filter <package> typecheck
pnpm --filter <package> test
pnpm --filter app typecheck
pnpm boundaries:cruise
```

After each P0/P1 group:

```bash
pnpm --filter "./packages/*" typecheck
pnpm --filter app typecheck
pnpm --filter web typecheck
pnpm test:smoke
pnpm --filter app build
```

Do not claim root build/lint health unless root commands are actually run and pass.

## Phase P0: Package Governance And Graph Health

Purpose: make the monorepo rules enforceable before deeper package refactors.

Packages/files:

- `.dependency-cruiser.cjs`
- `pnpm-workspace.yaml`
- `package.json`
- `turbo.json`
- `packages/typescript-config`
- `packages/next-config`

Checklist:

- [x] Inventory active packages.
- [x] Repair missing public `@repo/*` exports.
- [x] Move Better Auth Next handler/cookie helper behind `@repo/auth/next`.
- [x] Move AI SSE processor behind `@repo/ai/lib/server`.
- [x] Full active package typecheck passes across 26 active packages after adding `@repo/sandbox` and `@repo/flow`.
- [x] Fix dependency-cruiser errors.
- [x] Add package-boundary rules for `@repo/flow`.
- [x] Add package-boundary rules for provider SDK ownership.
- [ ] Normalize package export shape.
- [ ] Add package README requirements for stable public packages.

Known blockers:

- Resolved: `@repo/ai` renderer registry cycles.
- Resolved: `@repo/database` schema cycles.

## Phase P1: Foundation Packages

These must be senior before app rebuild continues.

| Package                   | Docs To Check                                                   | Target Verdict | Main Work                                                                                        |
| ------------------------- | --------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| `@repo/typescript-config` | TypeScript docs, TSConfig refs                                  | Keep core      | Strict shared configs, no stale service configs, no app path assumptions                         |
| `@repo/next-config`       | Next.js 16.2.6 docs, Vercel docs llms-full                      | Keep core      | Thin baseline config, no provider junk drawer, safe `serverExternalPackages`/`transpilePackages` |
| `@repo/design-system`     | shadcn/ui, Tailwind v4, Radix, next-themes, sonner, motion docs | Keep core      | Public exports, theme/toast ownership, component quality, Material restyle foundation            |
| `@repo/auth`              | Better Auth docs + llms.txt, Next.js route handler docs         | Keep core      | Latest Better Auth patterns, social login, reset/verify, org/team later, package-owned adapters  |
| `@repo/database`          | Drizzle, Neon/Postgres docs                                     | Keep core      | Fix schema cycles, workflow-native tables later, migration hygiene                               |
| `@repo/email`             | Resend, React Email docs                                        | Keep core      | Auth email flows, template tests, transport errors, no AgentMail confusion                       |
| `@repo/security`          | Arcjet, Nosecone, Next/Vercel security docs                     | Keep core      | Security middleware, headers, rate boundary, app proxy integration                               |
| `@repo/observability`     | Sentry Next.js, Better Stack/Logtail docs                       | Keep core      | Optional env behavior, client/server/edge split, status export                                   |

Exit criteria:

- all P1 package typechecks pass;
- no P1 package imports from apps;
- no app imports provider SDKs owned by P1 packages;
- package README exists where public API is stable.

Current status:

- First P1 cleanup pass is complete. Package docs/registry audits were recorded in package playbooks, full package/app/web typechecks passed, and graph validation passed with 0 errors and 0 warnings.

## Phase P2: Flow And AI Platform Packages

These define the new product.

| Package            | Docs To Check                                                                   | Target Verdict     | Main Work                                                                  |
| ------------------ | ------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------- |
| `@repo/ai`         | AI SDK docs, Vercel AI Gateway docs, AI SDK registry metadata                   | Keep/refactor      | Split AI SDK server usage, UI components, tool rendering, remove cycles    |
| `@repo/flow`       | Compiler/parser references, YAML/source language research, Vercel Workflow docs | Keep core scaffold | `.flow` parser, AST, semantic validation, compiler, runtime contracts      |
| `@repo/sandbox`    | Vercel Sandbox docs + llms-full                                                 | Keep core scaffold | Provider-neutral adapter, Vercel Sandbox implementation, no app direct SDK |
| `@repo/connectors` | Composio/direct connector docs                                                  | Keep/refactor      | Connector sessions, app integrations, tool exposure boundary               |
| `@repo/storage`    | AWS SDK S3 docs, Vercel Blob if evaluated                                       | Keep core soon     | Artifact object storage, signed URLs, env isolation                        |
| `@repo/search`     | Typesense docs                                                                  | Keep gated         | Workflow/artifact search, replace old session/task indexes                 |

Exit criteria:

- `@repo/flow` package playbook exists before package creation;
- `@repo/ai` graph cycles fixed;
- old E2B naming removed or isolated behind future `@repo/sandbox`;
- apps consume AI/flow/tool APIs only through packages.

Current status:

- `@repo/contracts` is retired by MADR-067. Its useful schema discipline is rehomed into owning packages: `@repo/flow`, `@repo/sandbox`, `@repo/ai`, `@repo/connectors`, `@repo/storage`, and future package-specific schemas only when a phase proves they are needed.

## Phase P3: Product Operations Packages

These are useful, but should not block the reset shell.

| Package               | Docs To Check                  | Target Verdict | Main Work                                                          |
| --------------------- | ------------------------------ | -------------- | ------------------------------------------------------------------ |
| `@repo/payments`      | Stripe docs, API version docs  | Keep gated     | Billing/usage package, no API downgrades, no build blocker         |
| `@repo/feature-flags` | Vercel Flags/Toolbar docs      | Keep gated     | Public toolbar/next-config exports, optional env                   |
| `@repo/analytics`     | Vercel Analytics, PostHog docs | Keep gated     | Optional analytics providers, no secret requirement at app boot    |
| `@repo/notifications` | Knock docs                     | Gate           | Approval/in-app notification later, optional provider              |
| `@repo/webhooks`      | Svix/webhook docs              | Keep gated     | Workflow triggers later                                            |
| `@repo/rate-limit`    | Upstash docs                   | Keep/gate      | Public form/auth/API rate limiter, maybe merge with security later |
| `@repo/agentmail`     | AgentMail docs                 | Keep optional  | Agent-owned inboxes later, not auth email                          |

Exit criteria:

- optional packages do not require secrets during app build;
- provider SDKs stay package-owned;
- app imports only public package APIs.

## Phase P4: Web, CMS, Collaboration, And Support Packages

These depend on product/app decisions.

| Package                      | Docs To Check                                       | Target Verdict | Main Work                                               |
| ---------------------------- | --------------------------------------------------- | -------------- | ------------------------------------------------------- |
| `@repo/cms`                  | Payload docs, BaseHub docs only for removal context | Replace/gate   | Stop investing in BaseHub, plan Payload separately      |
| `@repo/internationalization` | next-intl / next-international docs                 | Web-scoped     | Decide one i18n strategy, avoid app core dependency     |
| `@repo/seo`                  | Next metadata, schema-dts docs                      | Web-scoped     | Marketing SEO only                                      |
| `@repo/collaboration`        | Liveblocks docs                                     | Gate           | Future collaborative `.flow` editing                    |
| `@repo/testing`              | Vitest/MSW/testing-library docs                     | Keep/refactor  | Remove stale Manus fixtures, package-owned test helpers |

Exit criteria:

- web/support packages do not block `apps/app`;
- CMS replacement has its own MADR before install;
- testing package no longer references deleted app/service internals.

## Phase P5: App Rebuild On Packages

Only after P0/P1 and first P2 decisions:

- reset `apps/app` route tree to workflow shell;
- keep `/` as dashboard;
- build workflow creation/edit/run surfaces;
- use `@repo/flow` for parser/runtime contracts;
- use `@repo/ai` for authoring/chat/model surfaces;
- use `@repo/design-system` for UI primitives;
- use `@repo/auth`, `@repo/database`, `@repo/email`, `@repo/security`, and `@repo/observability` through package APIs.

## Immediate Next Actions

1. Finish P0 graph health:
   - fix `@repo/ai` renderer cycles;
   - fix `@repo/database` schema cycles.
2. Create package playbooks for P1 packages in this order:
   - `typescript-config`
   - `next-config`
   - `design-system`
   - `auth`
   - `database`
   - `email`
   - `security`
   - `observability`
3. Keep `@repo/flow` as the source-language package. The scaffold exists, but parser/runtime implementation remains gated behind its package playbook.
4. Keep `@repo/sandbox` as the provider-neutral execution package. The scaffold exists, but Vercel Sandbox SDK wiring remains gated behind its package playbook.

## Active Phase Ledger

- [`package-modernization-phase-ledger-2026-05-26.md`](./package-modernization-phase-ledger-2026-05-26.md)
- [`package-phase-roadmap-2026-05-27.md`](./package-phase-roadmap-2026-05-27.md)
