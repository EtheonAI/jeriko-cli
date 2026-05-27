# MADR-061: R18 App Support Files Cleanup

Status: Accepted

Date: 2026-05-26

## Context

After R17, the authenticated shell is segmented and the active `apps/app` route surface is small. The next cleanup target is app support files that can silently reintroduce confusion:

- `proxy.ts`
- `env.ts`
- `lib/dal.ts`
- health/auth/flags route handlers
- instrumentation files
- app-level shared icons
- tests and local test env setup

The goal is not to build product features. The goal is to make request-boundary, env, route-handler, and test support files explicit and auditable.

## Decision

Clean support files without changing app product behavior:

- Keep T3 Env as the app env contract.
- Keep `process.env` reads only in env contract/test setup/package key files for this scope.
- Keep Better Auth session validation in the DAL/layout, not Proxy.
- Keep `proxy.ts` as an optimistic redirect layer only.
- Make Proxy public bypasses explicit for:
  - auth API;
  - health API;
  - Vercel flags discovery endpoint;
  - static/public asset files.
- Keep health endpoint paths as-is:
  - `GET /api/health`: liveness;
  - `POST /api/health`: database readiness.
- Fix health route comments and use plain `Response.json`.
- Remove app-level `Icons.spinner`; loading indicators should use the design-system `Spinner`.
- Add smoke coverage for support routes.
- Add skill-freshness discipline to engineering standards.

## Consequences

Positive:

- Health probes no longer depend on auth redirects.
- Vercel Flags Explorer can reach the discovery endpoint and let the endpoint perform its own authorization check.
- Proxy intent is easier to audit.
- App-level icons stop duplicating design-system loading primitives.
- The "skills can be stale" rule is recorded as a durable repo rule.

Negative:

- `POST /api/health` remains a non-standard readiness path until a deploy/probe phase chooses to change it.
- The app still imports the full env contract into Proxy.
- This does not resolve feature-flag package cleanup or observability hardening.

## Alternatives Considered

- Validate the full Better Auth session in Proxy: rejected for R18 because Better Auth docs call cookie checks an optimistic redirect and require real validation in pages/routes.
- Split a dedicated proxy env file: rejected for R18 because the user explicitly wants the app to use the T3 Env contract and `@/env`.
- Rename readiness to `/api/health/ready`: deferred because changing probe paths belongs to deployment cleanup.
- Remove Vercel Toolbar/flags: rejected because feature flags are intentionally kept.

## Evidence

- Research: [`../09-research/2026-05-26-r18-app-support-files-research.md`](../09-research/2026-05-26-r18-app-support-files-research.md)
- Audit: [`../10-audit/apps-app-r18-support-files-audit-2026-05-26.md`](../10-audit/apps-app-r18-support-files-audit-2026-05-26.md)
- Plan: [`../08-plans/apps-app-r18-support-files-cleanup-plan.md`](../08-plans/apps-app-r18-support-files-cleanup-plan.md)
- Next.js Proxy docs: `https://nextjs.org/docs/app/api-reference/file-conventions/proxy`
- Better Auth Next.js docs: `https://better-auth.com/docs/integrations/next`
- T3 Env Next.js docs: `https://env.t3.gg/docs/nextjs`
- Vercel docs bundle: `https://vercel.com/docs/llms-full.txt`

## Validation Checklist

- [x] Proxy has explicit public route/prefix helpers.
- [x] `/api/health` bypasses auth redirects.
- [x] `/.well-known/vercel/flags` bypasses auth redirects and keeps endpoint-level authorization.
- [x] Health route comments match actual endpoint paths.
- [x] App-level `Icons.spinner` is removed.
- [x] Skill-freshness rule is recorded.
- [x] App typecheck passes.
- [x] App smoke tests pass.
- [x] Targeted ESLint passes.
- [x] App build passes with documented dummy env.
- [x] `git diff --check` passes.

## Impacted Files

- `apps/app/proxy.ts`
- `apps/app/app/api/health/route.ts`
- `apps/app/components/icons.tsx`
- `apps/app/test/proxy.test.ts`
- `apps/app/test/health-route.test.ts`
- `apps/app/test/setup-env.ts`
- `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md`
- `docs/ai-workflow-os/08-plans/package-playbooks/apps-app.md`
