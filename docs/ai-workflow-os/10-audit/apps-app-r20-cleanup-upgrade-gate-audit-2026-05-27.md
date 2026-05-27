# Apps/App R20 Cleanup Upgrade Gate Audit

Date: 2026-05-27

Scope: `apps/app`, active direct dependencies, docs Mintlify package, and `@repo/notifications`.

## Purpose

Establish the next cleanup gate before adding workflow runtime UI/backend code.

This audit answers:

- Is the app reset?
- Are direct packages current?
- Does the app typecheck and build?
- Is lint clean?
- Is notifications upgraded and usable as a package boundary?
- What must be cleaned next?

## Sources Checked

| Source                                                                      | Type          | Claim Used                                                                                                                       |
| --------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/getting-started/project-structure`             | Official docs | App Router supports `app`, route groups, private folders, colocation, and route/feature splitting.                               |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components`  | Official docs | Server Components should remain the default, with Client Components only for browser interactivity.                              |
| `https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopack` | Official docs | Turbopack is the active Next build path; keep Next 16.2.6 build behavior as the default unless a focused bug requires otherwise. |
| `https://nextjs.org/docs/app/api-reference/file-conventions/loading`        | Official docs | `loading.tsx` and route-level boundaries are valid App Router file conventions.                                                  |
| `npm view @knocklabs/node version`                                          | Registry      | `@knocklabs/node@1.32.0` is current.                                                                                             |
| `npm view @knocklabs/react version peerDependencies engines --json`         | Registry      | `@knocklabs/react@0.11.22` is current and supports Next `^16.0.0` plus React `^19.0.0`.                                          |
| `npm view mint version --json`                                              | Registry      | `mint@4.2.578` is current and replaced `4.2.577` in `apps/docs`.                                                                 |

## App Reset Status

The active `apps/app/app` route tree is materially reset.

Current active routes/files:

- authenticated root dashboard at `/`;
- unauthenticated auth flows: `/login`, `/forgot-password`, `/reset-password`, `/verify-email`;
- static metadata files;
- `api/auth/[...all]`;
- `api/health`;
- Vercel flags endpoint;
- App Router special files: `layout`, `loading`, `error`, `global-error`, `not-found`.

The old Manus surfaces are removed from the active route tree:

- chat workbench pages;
- demo/test chat pages;
- files UI;
- projects UI;
- applications/actions/community pages;
- tRPC route;
- sandbox route handlers;
- old Redux store;
- old E2B UI/proxy paths;
- old app E2E suites.

## Package Upgrade Status

Validation command:

```bash
pnpm outdated -r --format json
```

Result after upgrading `mint`:

```json
{}
```

Direct workspace dependencies are current under the fresh registry check.

Remaining warning:

- install still reports 14 deprecated transitive dependencies from upstream dependency trees. This is not a direct manifest freshness failure and needs a separate transitive cleanup pass.

## Build Status

Build without env:

```bash
pnpm --filter app build
```

Result:

- fails while loading `next.config.ts`;
- T3 Env correctly rejects missing required `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`.

Interpretation:

- This is expected for production builds without core env.
- The app should not silently build with missing Better Auth secrets.

Build with documented local/dummy-shaped core env:

```bash
env NEXT_TELEMETRY_DISABLED=1 \
  BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters \
  BETTER_AUTH_URL=http://localhost:3000 \
  DATABASE_URL=postgres://postgres:postgres@localhost:5432/jeriko \
  STRIPE_SECRET_KEY=sk_test_dummy \
  pnpm --filter app build
```

Result:

- passed on Next `16.2.6` with Turbopack;
- compiled successfully;
- TypeScript passed;
- static page generation completed;
- 13 app routes generated.

Routes reported by build:

- `/`
- `/_not-found`
- `/.well-known/vercel/flags`
- `/api/auth/[...all]`
- `/api/health`
- `/apple-icon.png`
- `/forgot-password`
- `/icon.png`
- `/login`
- `/manifest.webmanifest`
- `/opengraph-image.png`
- `/reset-password`
- `/robots.txt`
- `/sitemap.xml`
- `/verify-email`

## Typecheck Status

Commands:

```bash
pnpm --filter app typecheck
pnpm --filter @repo/notifications typecheck
```

Results:

- `apps/app` typecheck passed.
- `@repo/notifications` typecheck passed.

## Lint Status

Command:

```bash
pnpm exec eslint apps/app --max-warnings=0
```

Initial result:

- one error in `apps/app/scripts/skip-ci.js`;
- rule: `@typescript-eslint/no-require-imports`;
- cause: CommonJS `require()` in a type-module workspace.

Fix applied:

- converted `skip-ci.js` to ESM `import`;
- re-ran scoped app lint;
- result: passed.

Root lint status is not the same gate:

- `pnpm lint` is still a later global cleanup phase;
- active root lint has broad historical debt outside this app reset gate.

## Notifications Status

Current package:

- `@repo/notifications`

Current versions:

- `@knocklabs/node@^1.32.0`
- `@knocklabs/react@^0.11.22`
- `@t3-oss/env-nextjs@^0.13.11`
- `react@19.2.6`
- `zod@4.4.3`

Current exports:

- `@repo/notifications`
- `@repo/notifications/keys`
- `@repo/notifications/provider`

Current role:

- thin Knock provider/client boundary;
- optional T3 Env keys;
- app shell wraps it via `apps/app/app/(authenticated)/_components/notifications-provider.tsx`.

Not done:

- no workflow notification domain model yet;
- no approval/issue/digest/escalation rules yet;
- no Inngest-backed notification dispatch function yet;
- old database notification tables are not yet reconciled with the workflow event/ECP model.

Verdict:

- package is upgraded and typecheck-clean;
- package is not yet product-complete for AI Workflow OS.

## Clean Enough To Build On?

Yes, for the reset shell.

The app is now clean enough to start the next architecture phases:

- workflow database schema;
- hosted Inngest adapter;
- workflow/event/approval notification model;
- route-local workflow UI.

## Not 100% Clean Yet

Remaining cleanup:

- [x] Make `pnpm exec eslint apps/app --max-warnings=0` pass.
- [ ] Add a documented build-env command or CI env setup for `apps/app`.
- [ ] Keep `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`, and `STRIPE_SECRET_KEY` explicit for production builds.
- [ ] Continue route-local segmentation as new product routes are added.
- [ ] Replace shared authenticated `_components` buckets with route-owned folders when routes become real product surfaces.
- [ ] Add workflow notification domain contracts instead of using Knock directly as product truth.
- [ ] Reconcile database notification tables with EventContextPackets and workflow notifications.
- [ ] Run root build after database/CMS/build boundaries are updated.
- [ ] Run full root lint after active app lint is clean.

## Next Cleanup Phase

Phase R20 starts with the smallest high-signal cleanup:

1. Fix `apps/app/scripts/skip-ci.js` ESM lint error. Done.
2. Re-run app lint. Done.
3. Preserve the current build command/env requirements in docs. Done in this audit.
4. Move next to database workflow-native schema or global lint cleanup, depending on whether the next phase is product architecture or hygiene.
