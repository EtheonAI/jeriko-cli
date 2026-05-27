# CI, Deployment, And Dependency Audit

Date: 2026-05-23

Scope: workspace config, package versions, CI, deployment workflow, Docker/service inventory, and upgrade readiness.

Superseded package-status note 2026-05-25: active workspace package status and validation are now tracked in [`package-upgrade-validation-audit-2026-05-25.md`](./package-upgrade-validation-audit-2026-05-25.md) and [`../09-research/2026-05-25-latest-package-registry-check.md`](../09-research/2026-05-25-latest-package-registry-check.md). Older statements in this file about `services/*` being active, `@repo/service-utils`, and `pnpm outdated -r --format json` returning `{}` are historical snapshots, not current truth. Current truth: direct dependency latest checks have documented npm-resolution metadata exceptions for `@t3-oss/env-nextjs` and `mint`.

## Workspace State

Evidence:

- `pnpm-workspace.yaml` includes `apps/*`, `packages/*`, and `services/*`.
- Root package uses Turbo and pnpm `10.19.0`.
- Node baseline is `>=20.9.0`.
- Initial audit state had mixed Next 15/16 package versions. Post-upgrade active Next packages are normalized to Next `16.2.6`.

## Dependency Drift

Initial observed drift:

- Main app initially used Next `16.1.5`.
- Some packages reference Next `16.0.0`.
- One package still references Next `^15.3.2`.
- Root overrides force `ai 6.0.77`, `drizzle-orm 0.38.4`, and `zod 4.3.6`.
- Several packages still declare Zod 3 or Drizzle versions different from root overrides.
- `services/sandbox` depends on E2B and no Vercel Sandbox dependency exists yet.

Update 2026-05-23 dependency upgrade phase:

- `pnpm update -r --latest` was run with registry/network access.
- Stale root overrides for `ai`, `drizzle-orm`, `zod`, and React type packages were removed.
- `next` is normalized to `16.2.6` for active Next apps and internal Next dev dependencies.
- `react` and `react-dom` are normalized to `19.2.6`.
- `zod` is normalized to `4.4.3`.
- `drizzle-orm` is normalized to `0.45.2`; `drizzle-kit` is `0.31.10`.
- `ai` is `6.0.191`; `@ai-sdk/react` is `3.0.193`; `@ai-sdk/openai` is `3.0.65`; `@ai-sdk/anthropic` is `3.0.79`.
- `typescript` is `6.0.3`; `eslint` is `10.2.1`; `vite` resolves to `8.0.14`; `vitest` is `4.1.7`.
- S3 storage packages were aligned to the highest published AWS SDK S3 version found in npm versions metadata: `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` at `3.1053.0`.
- `stripe` is on `22.1.1`; Stripe API version constants were updated to `2026-04-22.dahlia`, matching the current SDK type.
- `@e2b/code-interpreter` is upgraded to `2.4.2` only as temporary compatibility in `services/sandbox`.
- `@stripe/agent-toolkit` was removed because its latest version still peers against older `ai` and `openai`, and its local export was unused.
- `@next/bundle-analyzer` was removed because the reset base uses Next 16 `next experimental-analyze`.
- Deprecated `@react-email/components` was replaced with `react-email@6.3.2`; template imports and rendering now use the supported `react-email` entrypoint.
- Final `pnpm outdated -r --format json` returns `{}`.

Post-upgrade verification run:

- `pnpm install` passes with strict peer dependency checks.
- The public npm versions tab reports `next@16.2.6`; all active workspace `next` dependencies resolve to `16.2.6`.
- Active React packages resolve to `react@19.2.6` and `react-dom@19.2.6`.
- `pnpm outdated -r --format json` returns `{}`.
- JSON parse check for key package manifests passes.
- `pnpm --filter @repo/next-config typecheck` passes after adding the TS 6 deprecation acknowledgement to the shared TypeScript config.
- `pnpm --filter @repo/contracts test` passes: 6 files, 112 tests.
- `pnpm --filter @repo/service-utils test` passes: 1 file, 11 tests.
- `pnpm --filter @repo/email typecheck` passes after explicitly enabling Node types for `process.env`.
- `pnpm --filter @jeriko/sandbox test` passes: 2 files, 75 tests.
- `pnpm --filter @jeriko/orchestrator typecheck` passes after the AI SDK 6 tool/usage compatibility fixes, stricter fetch/MySQL typing fixes, and strict test nullability fixes.
- `pnpm -r --workspace-concurrency=4 --if-present typecheck` passes across all workspaces that expose a typecheck script.

Risk:

- Medium for broad upgrade work.
- Package latest upgrades surfaced real compatibility debt in the old orchestrator, and the immediate TypeScript blockers have now been fixed.
- Workflow kernel should be added with explicit, isolated tests before deeper runtime rewrites.

## Next 16.2 Upgrade Readiness

Current status:

- Active Next apps now use Next `16.2.6`.
- The workspace was reinstalled against `registry.npmjs.org` after the npm versions tab showed `16.2.6`.
- `proxy.ts` convention exists.
- React 19.2.x is already in use.
- App/API/Web analyze scripts use `next experimental-analyze`.
- Official Next 16.2 upgrade docs were recorded in research.

Upgrade recommendation:

1. Fix CI first.
2. Run official codemods only after a clean baseline.
3. Verify App Router, proxy, cache behavior, Playwright, and build outputs.
4. Keep `@next/bundle-analyzer` out unless a Webpack-only app explicitly needs it.

Do not mix Next upgrade with auth rewrites, sandbox provider migration, and UI redesign in one branch.

## CI Findings

### CI-001: E2E job does not start app server

Evidence:

- CI builds the app and sets `PLAYWRIGHT_BASE_URL=http://localhost:3000`.
- `apps/app/playwright.config.ts` disables `webServer` on CI.

Impact:

E2E can fail or give false confidence depending on external server state.

Fix:

- Start app server in CI before Playwright.
- Or re-enable Playwright `webServer` for CI with deterministic command.

### CI-002: Stale agent test job

Evidence:

- Root `test:agent` and CI `test-agent` reference `services/agent`.
- The repo does not contain a real tracked service package there.

Impact:

CI contains stale product assumptions.

Fix:

- Remove the job or restore the service intentionally.

### CI-003: Docker matrix references missing agent Dockerfile

Evidence:

- Docker matrix includes `agent`.
- No `services/agent/Dockerfile` exists.

Fix:

- Align Docker matrix with actual service folders.

### CI-004: Deploy workflow references stale agent services

Evidence:

- Deploy workflow waits for `jeriko-agent-staging` and `jeriko-agent-production`.

Fix:

- Remove stale waits or add the service back intentionally.

## Deployment Findings

Current deployment workflow:

- Watches service/package/docker-compose changes, not app route changes.
- Uses AWS access keys in secrets.
- Has `id-token: write`, but does not appear to use OIDC for AWS auth.
- Deploys all services if no service-specific changes are detected.

Risks:

- App changes may not trigger expected deployment flow.
- Static cloud credentials are less desirable than OIDC.
- Deploying all services as fallback is expensive and noisy.

Recommendations:

- Split app deployment from service deployment.
- Use OIDC for AWS where possible.
- Make service change detection explicit and tested.
- Add workflow-kernel CI job before service deploys.

## Required CI Gates Before Rebuild

- [ ] `pnpm lint`
- [x] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] Workflow kernel parser/compiler tests.
- [ ] Security ownership regression tests.
- [ ] Service auth integration tests.
- [ ] Sandbox fake-provider contract tests.
- [ ] App Playwright smoke test with CI-started server.
- [ ] Docker build matrix only for real Dockerfiles.

## Dependency Cleanup Checklist

- [x] Normalize Next versions.
- [x] Normalize React peer ranges.
- [x] Normalize Zod major version intentionally.
- [x] Normalize Drizzle version intentionally.
- [x] Replace deprecated `@react-email/components` with supported `react-email`.
- [ ] Add `@vercel/sandbox` only inside provider adapter package/service.
- [ ] Keep E2B dependency until provider-neutral tests pass.
- [ ] Remove stale `services/agent` scripts or restore service.
- [ ] Audit package exports for E2B-specific names.

## Decision

CI and dependency cleanup is a phase-zero task. A large redesign without truthful CI will hide regressions in auth, routing, service calls, and workflows.

## Final Package-Upgrade Verification 2026-05-23

Commands:

- `pnpm list -r ai @ai-sdk/react @ai-sdk/openai @ai-sdk/anthropic next react react-dom react-email zod drizzle-orm drizzle-kit typescript eslint stripe @aws-sdk/client-s3 @aws-sdk/s3-request-presigner --depth=0`
- `pnpm outdated -r --format json`
- `pnpm -r --workspace-concurrency=4 --if-present typecheck`
- `pnpm test`

Results:

- Active Next packages: `16.2.6`.
- Active React packages: `19.2.6`.
- AI SDK packages: `ai@6.0.191`, `@ai-sdk/react@3.0.193`, `@ai-sdk/openai@3.0.65`, `@ai-sdk/anthropic@3.0.79`.
- Core data/runtime packages: `zod@4.4.3`, `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `typescript@6.0.3`, `eslint@10.2.1`, `stripe@22.1.1`, AWS S3 packages at `3.1053.0`.
- React Email: `react-email@6.3.2`; deprecated `@react-email/components` no longer appears in package manifests or lockfile scans.
- `pnpm outdated -r --format json` returns `{}`.
- Recursive typecheck passes.
- Root targeted tests pass: contracts 112 tests, service-utils 11 tests, sandbox 75 tests.
