# CMS Replacement Research: BaseHub, Payload, And Web App Isolation

Date: 2026-05-25

## Question

Should the reset phase spend time fixing the current BaseHub-backed CMS package, or should it isolate/remove that dependency and evaluate a new CMS later?

## Verdict

Do not fix BaseHub as the future CMS.

The current BaseHub dependency is a build blocker inherited from the old marketing app. It should be treated as legacy marketing/content debt. Payload is a credible replacement candidate, but it should not be installed until CMS ownership, DB/storage boundaries, auth, and deploy shape are decided.

## Current Repo Evidence

- `apps/web` previously imported `@repo/cms` and BaseHub-backed components/routes.
- `apps/web/next.config.ts` previously imported `withCMS` from `@repo/cms/next-config`.
- `apps/web/next.config.ts` previously allowed images from `assets.basehub.com`.
- `packages/cms/package.json` previously ran `basehub build` as its default build.
- `packages/cms/index.ts` imports `basehub`.
- `packages/cms/components/*` re-export BaseHub React components.
- Prior root build was blocked by missing `BASEHUB_TOKEN` through `@repo/cms#build`.

Update after cleanup:

- `apps/web` no longer imports `@repo/cms`.
- `apps/web` no longer depends on `@repo/cms` in `package.json`.
- `apps/web` no longer references BaseHub image hosts or `withCMS`.
- `apps/web` uses `apps/web/lib/content.ts` as a temporary local content facade returning empty/static content until the CMS decision is made.
- `apps/web` build passes without `BASEHUB_TOKEN`.

## Payload Fresh Registry Evidence

Commands:

```bash
npm view payload version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload --prefer-online
npm view @payloadcms/next version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload-next --prefer-online
npm view @payloadcms/db-postgres version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload-db-postgres --prefer-online
npm view @payloadcms/storage-vercel-blob version engines peerDependencies --registry https://registry.npmjs.org --cache /private/tmp/npm-cache-fresh-payload-vercel-blob --prefer-online
```

Observed:

| Package                           | Latest observed | Key metadata                                                  |
| --------------------------------- | --------------: | ------------------------------------------------------------- | --- | --------------------------------- |
| `payload`                         |        `3.84.1` | Node `^18.20.2                                                |     | >=20.9.0`; peer `graphql ^16.8.1` |
| `@payloadcms/next`                |        `3.84.1` | peers with `payload@3.84.1`; supports `next >=16.2.2 <17.0.0` |
| `@payloadcms/db-postgres`         |        `3.84.1` | peers with `payload@3.84.1`                                   |
| `@payloadcms/storage-vercel-blob` |        `3.84.1` | peers with `payload@3.84.1`                                   |

This means the active `next@16.2.6` and Node `22.22.1` baseline are compatible with current Payload package metadata.

## Sources Checked

Primary:

- Payload installation: `https://payloadcms.com/docs/getting-started/installation`
- Payload custom server / Next integration: `https://payloadcms.com/docs/getting-started/custom-server`
- Payload deployment: `https://payloadcms.com/docs/production/deployment`
- Payload Postgres adapter: `https://payloadcms.com/docs/database/postgres`
- Payload storage adapters: `https://payloadcms.com/docs/upload/storage-adapters`
- Next.js CLI build docs: `https://nextjs.org/docs/app/api-reference/cli/next`
- Vercel monorepos: `https://vercel.com/docs/monorepos`

Secondary article reviewed for compatibility signal only:

- `https://www.buildwithmatija.com/blog/payload-cms-nextjs-16-compatibility-breakthrough`

Decision authority is still the official package metadata and official docs, not the article.

## Architecture Questions Before Adoption

- Does CMS live in `apps/web`, `apps/studio`, or a new `apps/cms`?
- Does Payload use the product Postgres database or a separate CMS database/schema?
- Does admin auth use Better Auth, Payload auth, or a separate admin-only boundary?
- Does media use Vercel Blob, S3, or the existing `@repo/storage` abstraction?
- Does marketing need dynamic CMS before launch, or can static MDX/content unblock reset faster?
- Should `@repo/cms` stay as a provider-neutral content interface or be deleted and rebuilt?

## Recommended Next Actions

1. Stop treating missing `BASEHUB_TOKEN` as something to fix.
2. Isolate or remove `@repo/cms` from default root build so workspace verification is truthful.
3. Keep `apps/web` active, but let it run with static/stub content during reset if needed.
4. Create a separate Payload spike only after `apps/app` build/lint and product route ownership are clean.

## Checklist

- [x] Local BaseHub surfaces identified.
- [x] Fresh Payload package metadata checked.
- [x] Payload compatibility with Next `16.2.6` recorded.
- [x] MADR created for BaseHub deferral and Payload evaluation.
- [ ] Remove or isolate BaseHub from root build.
- [ ] Decide CMS ownership before installing Payload.
