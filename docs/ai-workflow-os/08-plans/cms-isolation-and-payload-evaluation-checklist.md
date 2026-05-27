# CMS Isolation And Payload Evaluation Checklist

Date: 2026-05-25

## Phase

Historical phase: Phase -1 base reset, CMS/build isolation slice.

Status update 2026-05-27: this checklist is superseded by the P3.1A/P3.1B CMS modernization records. BaseHub retirement is complete, and Payload implementation architecture is accepted under `MADR-092A`. This file remains historical context.

## Checklist

- [x] Identify BaseHub-backed files in `apps/web` and `packages/cms`.
- [x] Check current Payload package metadata from fresh npm registry.
- [x] Record MADR-040: do not invest in BaseHub; evaluate Payload later.
- [x] Update package/build audit so BaseHub is not described as a fix target.
- [x] Remove `@repo/cms` from `apps/web` active source imports and package dependencies.
- [x] Replace web CMS reads with a temporary local content facade that returns empty/static content.
- [x] Keep feature flags in `apps/web` and restore `FLAGS_SECRET` through T3 Env.
- [x] Remove `BASEHUB_TOKEN` as a default web/root-build requirement.
- [x] Verify `apps/web` typecheck passes.
- [x] Verify `apps/web` production build passes.
- [x] Decide whether `packages/cms` is archived, kept as a legacy package, or replaced by a new provider-neutral content package.
- [ ] Keep `apps/web` deploy/build ownership separate from `apps/app`.
- [ ] Decide whether marketing content is static MDX/content until the product reset stabilizes.
- [x] Run Payload architecture spike.

## Payload Spike Gate

Payload implementation is now approved, with these answers:

- CMS app boundary: `apps/web` first, with `@repo/cms` owning schema/config.
- Database boundary: use `PAYLOAD_DATABASE_URL`; do not implicitly reuse product `DATABASE_URL`.
- Auth boundary: Payload admin auth is separate from Better Auth initially.
- Storage boundary: defer media storage implementation; likely Payload Vercel Blob adapter.
- Deployment boundary: same Vercel project as `apps/web` first; separate app remains an exit path.
