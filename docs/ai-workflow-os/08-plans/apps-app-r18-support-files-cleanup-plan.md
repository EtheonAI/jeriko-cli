# Apps/App R18 Support Files Cleanup Plan

Date: 2026-05-26

Phase: Phase -1 base reset and cleanup

## Goal

Make app support files explicit, auditable, and aligned with current docs before starting workflow product surfaces.

## Checklist

### Research And Audit

- [x] Read R17 docs and current app playbook.
- [x] Audit `env.ts`, `proxy.ts`, DAL, instrumentation, route handlers, tests, Vercel config, and app shared files.
- [x] Check current Next.js Proxy docs.
- [x] Check current Next.js route-handler/instrumentation guidance.
- [x] Check Better Auth Next.js and cookie docs.
- [x] Check T3 Env Next.js docs.
- [x] Fetch and search the Vercel docs bundle from `https://vercel.com/docs/llms-full.txt`.
- [x] Record R18 MADR before edits.

### Code Cleanup

- [x] Refactor Proxy into named public-route/static-asset helpers.
- [x] Explicitly allow `/api/auth`, `/api/health`, and `/.well-known/vercel/flags`.
- [x] Keep authenticated pages/routes validating real sessions outside Proxy.
- [x] Fix health route comments and response helper.
- [x] Add support-route smoke tests.
- [x] Align test `NEXT_PUBLIC_DOCS_URL` with docs port `3004`.
- [x] Remove unused app-level `Icons.spinner`.
- [x] Record skill-freshness rule in engineering standards.

### Validation

- [x] `pnpm --filter app typecheck`
- [x] `pnpm test:smoke`
- [x] Targeted ESLint for changed support files
- [x] `pnpm --filter app build` with documented dummy env
- [x] Scan for direct `process.env` in app runtime outside env/test contracts
- [x] Scan for unused `Icons.spinner`
- [x] `git diff --check`

## Validation Results

- `pnpm --filter app typecheck`: passed.
- `pnpm test:smoke`: passed, 4 files and 15 tests.
- Targeted ESLint for changed support files: passed.
- `pnpm --filter app build`: passed on Next `16.2.6` Turbopack with documented dummy env.
- `process.env` app scan: only `apps/app/env.ts` and `apps/app/test/setup-env.ts`.
- `Icons.spinner` / `Loader2` app scan: no matches.
- Forbidden old active product route directory scan under `apps/app/app`: no matches.
- `git diff --check`: passed.

## Non-Goals

- No workflow parser/runtime.
- No Vercel Sandbox migration.
- No product route creation.
- No feature-flag package cleanup.
- No observability package hardening.
- No deployment probe path migration.
- No package additions.

## Exit Criteria

R18 is complete only when support files are cleaned, route behavior is covered by tests, validation passes, and checklist results are recorded.
