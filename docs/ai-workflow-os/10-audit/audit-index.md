# Codebase Audit Index

This folder will hold the phase-by-phase audit of the existing Jeriko codebase.

## Current Reports

- [`full-platform-audit-2026-05-23.md`](./full-platform-audit-2026-05-23.md): master audit, blockers, keep/replace decisions, and phase-zero checklist.
- [`exhaustive-runtime-source-audit-2026-05-23.md`](./exhaustive-runtime-source-audit-2026-05-23.md): corrected runtime source audit baseline with inventory, service/app/package coverage, source-backed findings, and phase-zero checklist.
- [`reset-upgrade-surface-audit-2026-05-23.md`](./reset-upgrade-surface-audit-2026-05-23.md): reset/upgrade surface map for workspace cleanup, Vercel Sandbox migration, file rendering, search/tools, side canvas, and target architecture.
- [`deletion-first-cleanup-audit-2026-05-23.md`](./deletion-first-cleanup-audit-2026-05-23.md): delete/archive/gate/keep plan for sensitive dumps, stale `services/agent`, old Manus/E2B docs, legacy services, and pre-upgrade cleanup.
- [`docs-agent-template-cleanup-audit-2026-05-23.md`](./docs-agent-template-cleanup-audit-2026-05-23.md): root Markdown, repository-local agent files, `CLAUDE.md`, and checked-in E2B template payload cleanup.
- [`e2b-to-vercel-sandbox-migration-surface.md`](./e2b-to-vercel-sandbox-migration-surface.md): staged provider migration plan and delete gates for the remaining E2B compatibility runtime.
- [`security-auth-audit.md`](./security-auth-audit.md): authorization, service auth, API key, sandbox, media, connector, and webhook security findings.
- [`backend-services-audit.md`](./backend-services-audit.md): service-by-service backend readiness and refactor plan.
- [`frontend-design-audit.md`](./frontend-design-audit.md): workflow-first IA, design direction, and UI refactor checklist.
- [`next16-app-structure-audit-2026-05-23.md`](./next16-app-structure-audit-2026-05-23.md): App Router folder structure, route group, server/client component, CSS, and app ownership standard for the reset.
- [`typescript-eslint-config-audit-2026-05-23.md`](./typescript-eslint-config-audit-2026-05-23.md): TypeScript strictness, Next ESLint monorepo config, root scripts, and remaining lint/typecheck hardening.
- [`env-structure-dependency-remaining-audit-2026-05-24.md`](./env-structure-dependency-remaining-audit-2026-05-24.md): current remaining env, app structure, and dependency upgrade state after the T3/storage cleanup pass.
- [`nextjs-app-cleanup-status-2026-05-25.md`](./nextjs-app-cleanup-status-2026-05-25.md): apps/app-only cleanup checkpoint for T3 Env, service URL centralization, route proxy cleanup, and remaining Next.js reset phases.
- [`package-upgrade-validation-audit-2026-05-25.md`](./package-upgrade-validation-audit-2026-05-25.md): latest-package normalization proof, typecheck/test results, build blockers, lint debt, and next cleanup gates.
- [`apps-app-reset-gate-audit-2026-05-25.md`](./apps-app-reset-gate-audit-2026-05-25.md): current `apps/app` reset gate, keep/delete decisions, Better Auth status, stale API/component/test inventory, and validation checklist.
- [`apps-app-auth-r11-audit-2026-05-26.md`](./apps-app-auth-r11-audit-2026-05-26.md): Better Auth latest-doc cleanup audit for the auth route, proxy, DAL, login/signup/reset flows, and deleted email-existence preflight.
- [`apps-app-r12-shell-structure-audit-2026-05-26.md`](./apps-app-r12-shell-structure-audit-2026-05-26.md): reset-shell filesystem hygiene, active route surface, and auth legal-link cleanup findings.
- [`apps-app-r13-auth-ui-client-boundary-audit-2026-05-26.md`](./apps-app-r13-auth-ui-client-boundary-audit-2026-05-26.md): Better Auth UI completeness, sidebar client-boundary cleanup, forgot/reset/verify/sign-out coverage, and validation results.
- [`apps-app-r14-auth-flow-segmentation-audit-2026-05-26.md`](./apps-app-r14-auth-flow-segmentation-audit-2026-05-26.md): route-owned auth flow segmentation, Resend email wiring status, local alias policy, and validation results.
- [`email-r15-resend-auth-email-audit-2026-05-26.md`](./email-r15-resend-auth-email-audit-2026-05-26.md): Resend auth email transport wrapper, React Email template tests, Better Auth callback wiring, and validation results.
- [`apps-app-r16-alias-design-system-auth-audit-2026-05-26.md`](./apps-app-r16-alias-design-system-auth-audit-2026-05-26.md): local app alias usage, design-system auth primitive adoption, and validation results.
- [`apps-app-r17-authenticated-shell-audit-2026-05-26.md`](./apps-app-r17-authenticated-shell-audit-2026-05-26.md): authenticated root shell/sidebar audit, keep/refactor/delete decisions, and reset-phase validation gate.
- [`apps-app-r18-support-files-audit-2026-05-26.md`](./apps-app-r18-support-files-audit-2026-05-26.md): app support-file audit for Proxy, env, DAL, route handlers, instrumentation, Vercel config, tests, and shared icons.
- [`apps-app-r19-dependency-boundary-audit-2026-05-26.md`](./apps-app-r19-dependency-boundary-audit-2026-05-26.md): app package dependency ownership audit for active imports and direct external package declarations.
- [`apps-app-r20-cleanup-upgrade-gate-audit-2026-05-27.md`](./apps-app-r20-cleanup-upgrade-gate-audit-2026-05-27.md): current app reset, package freshness, app build/type/lint, notifications package, and next cleanup gate.
- [`tests-r21-cleanup-audit-2026-05-27.md`](./tests-r21-cleanup-audit-2026-05-27.md): active Vitest test normalization plan, root test runner gap, and tests-folder cleanup checklist.
- [`typescript-config-p1-1-audit-2026-05-27.md`](./typescript-config-p1-1-audit-2026-05-27.md): P1.1 `@repo/typescript-config` docs/registry/local audit, stale `service.json` verdict, and validation checklist.
- [`next-config-p1-2-audit-2026-05-27.md`](./next-config-p1-2-audit-2026-05-27.md): P1.2 `@repo/next-config` docs/registry/local audit, unused `ANALYZE` verdict, and provider-config debt.
- [`testing-p1-3-audit-2026-05-27.md`](./testing-p1-3-audit-2026-05-27.md): P1.3 `@repo/testing` docs/registry/local audit, stale fixture/helper verdict, and reset checklist.
- [`design-system-p1-4-audit-2026-05-27.md`](./design-system-p1-4-audit-2026-05-27.md): P1.4 `@repo/design-system` shadcn/Tailwind/Radix audit, deprecated toast verdict, and validation checklist.
- [`../08-plans/package-phase-roadmap-2026-05-27.md`](../08-plans/package-phase-roadmap-2026-05-27.md): package-by-package phase ledger, planned package MADRs, and per-package audit checklist.
- [`workspace-package-boundary-audit-2026-05-26.md`](./workspace-package-boundary-audit-2026-05-26.md): package-first ownership audit across active apps/packages, missing exports, dependency graph cycles, and package typecheck results.
- [`flow-runtime-contracts-audit-2026-05-27.md`](./flow-runtime-contracts-audit-2026-05-27.md): provider-neutral flow trigger, ECP, TaskReport, reflection, scheduler decision, run request, and cancellation contract implementation checkpoint.
- [`cms-p3-1-audit-2026-05-27.md`](./cms-p3-1-audit-2026-05-27.md): P3.1A BaseHub retirement audit and provider-neutral CMS reset.
- [`cms-p3-1b-payload-implementation-audit-2026-05-27.md`](./cms-p3-1b-payload-implementation-audit-2026-05-27.md): P3.1B Payload package implementation audit, validation, and remaining app integration checklist.
- [`cms-p3-1c-web-payload-route-integration-audit-2026-05-27.md`](./cms-p3-1c-web-payload-route-integration-audit-2026-05-27.md): P3.1C app-owned Payload App Router convention integration audit and non-CMS web blockers.
- [`internationalization-p3-2-audit-2026-05-27.md`](./internationalization-p3-2-audit-2026-05-27.md): P3.2 `@repo/internationalization` next-intl package boundary audit, stale dependency verdict, and web proxy impact.
- [`seo-p3-3-audit-2026-05-27.md`](./seo-p3-3-audit-2026-05-27.md): P3.3 `@repo/seo` Next Metadata helper audit, stale branding/env/dependency verdict, and web metadata blocker.
- [`apps-web-contact-calendar-unblock-2026-05-27.md`](./apps-web-contact-calendar-unblock-2026-05-27.md): web contact Calendar DayPicker v10 `initialFocus` to `autoFocus` unblock and validation.
- [`flow-p4-1-audit-2026-05-27.md`](./flow-p4-1-audit-2026-05-27.md): P4.1 `@repo/flow` package audit, no-YAML parser gate, custom `.flow` grammar checklist, and validation plan.
- [`flow-end-to-end-readiness-audit-2026-05-27.md`](./flow-end-to-end-readiness-audit-2026-05-27.md): end-to-end readiness matrix for `@repo/flow`, `@repo/ai`, `@repo/connectors`, `@repo/sandbox`, `@repo/database`, runtime adapter, and `apps/app`.
- [`resumable-runs-current-state-audit-2026-05-27.md`](./resumable-runs-current-state-audit-2026-05-27.md): current code evidence for Manus-style resume/reconnect, missing workflow-native runtime/API/UI pieces, and required implementation gate.
- [`active-package-viability-verdict-2026-05-26.md`](./active-package-viability-verdict-2026-05-26.md): verdict on whether the active packages/features should stay core, gated, replaced, or removed.
- [`../01-architecture/monorepo-target-architecture.md`](../01-architecture/monorepo-target-architecture.md): active app/package classification, legacy service deactivation, and target frontend/backend ownership.
- [`../01-architecture/package-ownership-index.md`](../01-architecture/package-ownership-index.md): active package role classification, audit/gate packages, legacy package status, and missing target packages.
- [`monorepo-directory-cleanup-status-2026-05-24.md`](./monorepo-directory-cleanup-status-2026-05-24.md): physical directory cleanup status after moving legacy Manus services under `legacy/manus-clone`, deactivating `apps/api`, and reducing Docker to local infra.
- [`database-workflow-model-audit.md`](./database-workflow-model-audit.md): current schema fit and required workflow-native tables.
- [`ci-deployment-dependency-audit.md`](./ci-deployment-dependency-audit.md): CI, deploy, Docker, dependency drift, and Next upgrade readiness.
- [`refactor-readiness-roadmap.md`](./refactor-readiness-roadmap.md): ordered build plan before new feature coding.
- [`phase-zero-current-state-audit.md`](./phase-zero-current-state-audit.md): earlier first-pass current-state map.

## Audit Phases

- Phase A: Repository map and ownership boundaries
- Phase B: App Router, Next.js version, build config, middleware/proxy
- Phase C: Auth and authorization
- Phase D: Database and migrations
- Phase E: Agent loop, AI SDK, tool execution
- Phase F: E2B sandbox and migration surface to Vercel Sandbox
- Phase G: Inngest and durable tasks
- Phase H: Frontend app shell, chat, timeline, Redux state
- Phase I: Design system and CSS/token inventory
- Phase J: Security, billing, rate limits, observability

## Finding Format

Each finding should include:

- File and line reference
- What exists
- Why it matters
- Keep, modify, replace, or delete recommendation
- Evidence
- Risk level
- Follow-up checklist
