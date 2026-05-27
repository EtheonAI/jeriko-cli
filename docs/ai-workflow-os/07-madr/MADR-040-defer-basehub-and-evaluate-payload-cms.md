# MADR-040: Defer BaseHub fixes and evaluate Payload as the CMS replacement

Status: Accepted

Date: 2026-05-25

## Context

The current `apps/web` marketing app depends on `@repo/cms`, and `@repo/cms` is BaseHub-backed. Root production build was previously blocked by `@repo/cms#build` requiring `BASEHUB_TOKEN`.

The product direction is no longer to preserve the old Manus/marketing implementation. BaseHub should not receive cleanup-phase investment unless it is needed only to safely remove or isolate it. The marketing/content system can be rebuilt later, and Payload is a plausible candidate because it is a Next.js-native CMS with current packages compatible with the active Next.js line.

Fresh registry checks on 2026-05-25:

```text
payload@3.84.1
@payloadcms/next@3.84.1
@payloadcms/db-postgres@3.84.1
@payloadcms/storage-vercel-blob@3.84.1
```

`@payloadcms/next@3.84.1` peers with `next >=16.2.2 <17.0.0`, so the active `next@16.2.6` target is compatible by package metadata.

## Decision

Do not fix BaseHub as the future CMS.

Treat the current BaseHub-backed `@repo/cms` package as legacy marketing-app debt. The cleanup/reset task is to isolate or remove the active BaseHub build dependency so it no longer blocks workspace verification.

Evaluate Payload in a later CMS decision phase, but do not install it into the active app until these are decided:

- whether CMS belongs inside `apps/web`, `apps/app`, or a separate admin app;
- whether Payload should use the existing Postgres database or a separate database/schema boundary;
- how auth/admin access is isolated from product user auth;
- how file/media storage maps to Vercel Blob or another storage adapter;
- whether the marketing site needs CMS at all before product launch.

## Consequences

Positive:

- Avoids spending reset time stabilizing a CMS we may delete.
- Keeps package/build cleanup focused on removing active blockers.
- Preserves the option to use Payload once the web/content boundary is intentionally designed.
- Prevents the CMS choice from blocking `.flow`, sandbox, auth, and product architecture cleanup.

Negative / follow-up:

- Root build can remain blocked until BaseHub is isolated, removed, or `apps/web` is removed from default root build.
- Payload still needs a dedicated architecture spike before adoption.
- Marketing docs/content may remain minimal until the new product surface is stable.

## Alternatives Considered

- Fix BaseHub now: rejected because the product owner no longer wants to invest in it as the likely future CMS.
- Delete `apps/web`: rejected by MADR-037; it remains a first-class app surface, but not a product-runtime dependency.
- Install Payload immediately: rejected because CMS placement, auth, DB, storage, and app boundary decisions are not made yet.
- Ignore CMS build failures: rejected because build gates must be truthful.

## Evidence

Primary sources checked:

- Payload installation: `https://payloadcms.com/docs/getting-started/installation`
- Payload Next.js custom server / Next integration: `https://payloadcms.com/docs/getting-started/custom-server`
- Payload deployment: `https://payloadcms.com/docs/production/deployment`
- Payload Postgres adapter: `https://payloadcms.com/docs/database/postgres`
- Payload Vercel Blob storage adapter: `https://payloadcms.com/docs/upload/storage-adapters`
- Next.js production build CLI: `https://nextjs.org/docs/app/api-reference/cli/next`
- Vercel monorepos: `https://vercel.com/docs/monorepos`

Fresh npm evidence:

```bash
npm view payload version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload --prefer-online
npm view @payloadcms/next version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload-next --prefer-online
npm view @payloadcms/db-postgres version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload-db-postgres --prefer-online
npm view @payloadcms/storage-vercel-blob version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload-vercel-blob --prefer-online
```

Observed result:

- `payload`: `3.84.1`, Node `^18.20.2 || >=20.9.0`
- `@payloadcms/next`: `3.84.1`, peers with `payload@3.84.1`, `graphql ^16.8.1`, and `next >=16.2.2 <17.0.0`
- `@payloadcms/db-postgres`: `3.84.1`, peers with `payload@3.84.1`
- `@payloadcms/storage-vercel-blob`: `3.84.1`, peers with `payload@3.84.1`

## Impacted Files And Packages

- `apps/web`
- `packages/cms`
- root build pipeline
- future CMS package/app boundary

## Validation Checklist

- [x] Current BaseHub build dependency identified.
- [x] Fresh Payload package metadata checked.
- [x] Payload documented as a candidate, not an adopted dependency.
- [x] BaseHub fix work removed from the next-phase plan.
- [ ] Isolate or remove BaseHub from active root build.
- [ ] Decide CMS placement and data/storage/auth boundaries before installing Payload.
