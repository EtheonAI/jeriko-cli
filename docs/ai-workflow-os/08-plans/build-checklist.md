# Build Checklist

## Phase -1 — Base Reset

- [x] Move legacy Manus services out of the active workspace.
- [x] Deactivate redundant standalone API app.
- [x] Move docs/email/Storybook/studio to `tools/*` as an intermediate cleanup.
- [x] Research and accept corrected multi-app monorepo target in MADR-037.
- [x] Move docs/email/Storybook/studio back to `apps/*` as first-class app surfaces.
- [x] Add app-level READMEs and command/env ownership for `app`, `web`, `docs`, `email`, `storybook`, and `studio`.
- [x] Normalize active direct dependencies; stale package-manager cache was corrected and fresh registry metadata confirms the selected latest versions.
- [x] Keep Next.js on `16.2.6`.
- [x] Pass full active workspace typecheck.
- [x] Pass focused contracts/search tests.
- [x] Exclude `legacy/**` from active ESLint.
- [x] Remove fake unused `eslint-plugin-next@0.0.0`.
- [x] Keep `apps/web` active as marketing/content app.
- [x] Upgrade package-manager baseline to `pnpm@11.3.0`.
- [x] Upgrade Node runtime baseline to `22.22.1`.
- [x] Add pnpm 11 build-script approval policy.
- [x] Pass pnpm 11 install after explicit `allowBuilds`.
- [x] Migrate docs app to `docs.json` only and remove legacy `mint.json`.
- [x] Pass docs broken-link lint under `mint@4.2.577`.
- [x] Stop treating BaseHub as a fix target; document Payload as a researched CMS candidate.
- [x] Remove BaseHub-backed `@repo/cms` from `apps/web`.
- [x] Keep feature flags in `apps/web` while lazy-loading product auth/database for flag evaluation.
- [x] Pass `apps/web` production build without `BASEHUB_TOKEN` or `DATABASE_URL`.
- [x] Add package best-practices registry and require package playbooks before critical refactors.
- [x] Add `apps/app` P0 playbook with skeleton-reset recommendation.
- [x] Pass `apps/app` Webpack production build with minimum dummy core app env.
- [x] Research and accept `apps/app` reset to next-forge-shaped shell with Better Auth in MADR-044.
- [ ] Diagnose `apps/app` production build hang.
- [x] Complete `apps/app` route/API/component/test deletion-first reset.
- [ ] Reduce active lint failures to zero or define a scoped temporary baseline.
- [ ] Add dead-code/dependency tooling after final app strategy.

## Phase 0 — Architecture

- [ ] Approve product primitive: prompt -> `.flow` source -> AST -> execution.
- [ ] Approve MVP non-goals.
- [ ] Approve workflow folder model.
- [ ] Approve step primitives.
- [ ] Approve MADRs 001–018.

## Phase 1 — Foundation

- [ ] Bootstrap Next.js / next-forge app.
- [ ] Configure Tailwind/shadcn UI.
- [ ] Configure better-auth.
- [ ] Configure Drizzle/Postgres migrations.
- [ ] Provision object storage.
- [ ] Add Inngest function route.
- [ ] Add Vercel Sandbox adapter.
- [ ] Add Composio/direct tool adapter.
- [ ] Add model router.

## Phase 2 — Workflow Engine

- [ ] Define Workflow AST types.
- [ ] Define `.flow` grammar and AST schema.
- [ ] Implement custom `.flow` lexer/parser.
- [ ] Implement `.flow` renderer/formatter.
- [ ] Implement workflow linter.
- [ ] Implement compiler prompt and compile API.
- [ ] Implement workflow create API.
- [ ] Implement generic Inngest executor.
- [ ] Implement step executors: ai_task, tool_call, sandbox_command, verify, human_review.
- [ ] Implement event log.
- [ ] Implement artifacts.
- [ ] Implement run cancellation.
- [ ] Implement dry run.

## Phase 3 — UX

- [ ] App shell and sidebar.
- [ ] New workflow prompt UI.
- [ ] Workflow preview card.
- [ ] Workflow cards/list.
- [ ] Workflow detail page.
- [ ] Live run timeline.
- [ ] Approval inbox.
- [ ] Artifact viewer.
- [ ] Connections page.
- [ ] Billing/credits page.

## Phase 4 — Templates

- [ ] Social content workflow.
- [ ] Inbox reply workflow.
- [ ] Lead research workflow.

## Phase 5 — Billing and beta

- [ ] Credit ledger.
- [ ] Free trial grants.
- [ ] Plan limits.
- [ ] Stripe integration.
- [ ] Usage alerts.

## Phase 6 — Security and QA

- [ ] Org authorization middleware.
- [ ] OAuth token encryption.
- [ ] Command policy scanner.
- [ ] Approval safety tests.
- [ ] Compiler tests.
- [ ] Executor integration tests.
- [ ] E2E UX tests.

## Phase 7 — Launch

- [ ] Private beta onboarding.
- [ ] User docs.
- [ ] Internal engineering docs.
- [ ] Admin dashboard.
- [ ] Support triage process.
