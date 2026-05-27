# Apps/App R17 Authenticated Shell Cleanup Plan

Date: 2026-05-26

Phase: Phase -1 base reset and cleanup

## Goal

Make the authenticated app shell senior enough to serve as the reset base without adding product features.

## Checklist

### Research And Audit

- [x] Read current engineering standards.
- [x] Read `apps/app` playbook.
- [x] Check Next.js route/project organization guidance.
- [x] Check Vercel docs bundle reference supplied by the user.
- [x] Audit active `apps/app/app` route tree.
- [x] Confirm no active old chat/sandbox/artifact route tree exists.
- [x] Record R17 MADR before edits.

### Code Cleanup

- [x] Extract authenticated shell composition into `_components/app-shell/app-shell.tsx`.
- [x] Add `_components/app-shell/app-header.tsx` with `SidebarTrigger`.
- [x] Add `_components/app-shell/beta-banner.tsx`.
- [x] Rename `GlobalSidebar` to `AppSidebar`.
- [x] Extract dashboard content into `_components/dashboard/dashboard-overview.tsx`.
- [x] Extract dashboard stat data/view into `_components/dashboard/dashboard-stats.tsx`.
- [x] Keep `/` as the dashboard; do not create `/dashboard`.
- [x] Replace direct sign-out loader icon with design-system `Spinner`.
- [x] Remove empty stale `apps/app/components/auth/forms` if still empty.

### Validation

- [x] `pnpm --filter app typecheck`
- [x] `pnpm test:smoke`
- [x] Targeted ESLint for changed app files
- [x] `pnpm --filter app build` with documented dummy env
- [x] Scan for forbidden old product route directories under `apps/app/app`
- [x] Scan for direct `Loader2Icon` usage in authenticated shell
- [x] `git diff --check`

## Validation Results

- `pnpm --filter app typecheck`: passed.
- `pnpm test:smoke`: passed, 3 files and 12 tests.
- Targeted ESLint for changed authenticated shell/dashboard files: passed.
- `pnpm --filter app build`: passed on Next `16.2.6` Turbopack with documented dummy env.
- Forbidden active product route directory scan under `apps/app/app`: no matches.
- Authenticated shell `Loader2Icon`/`GlobalSidebar` scan: no active code matches; sign-out imports `Spinner`.
- `git diff --check`: passed.

## Non-Goals

- No workflow parser/runtime.
- No sandbox provider migration.
- No file renderer.
- No search/tool upgrade.
- No visual redesign.
- No Payload CMS work.
- No package additions.

## Exit Criteria

R17 is complete only when the authenticated root is segmented into route-owned shell/dashboard/sidebar components, validation passes, and the docs/checklist are updated with proof.
