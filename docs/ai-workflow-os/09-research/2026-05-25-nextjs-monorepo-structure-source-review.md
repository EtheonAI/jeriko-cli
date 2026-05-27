# Next.js Monorepo Structure Source Review

Date: 2026-05-25

Update: 2026-05-26

Purpose: validate the repo cleanup direction against current external sources before continuing the app reset.

## Source Priority

Use sources in this order:

1. Official framework/package docs.
2. Maintained production templates with active communities.
3. Reference repos requested by the user.
4. Medium/community posts as directional inspiration only.

Medium posts are not authority for this repo. They are useful when they repeat the same pattern shown by official docs and production templates.

## Sources Checked

- Next.js project structure: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js Server and Client Components: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js `use client`: `https://nextjs.org/docs/app/api-reference/directives/use-client`
- React `use client`: `https://react.dev/reference/rsc/use-client`
- Vercel monorepos: `https://vercel.com/docs/monorepos`
- Vercel Turborepo deployment: `https://vercel.com/docs/monorepos/turborepo`
- Turborepo repository structure: `https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository`
- Turborepo package types: `https://turborepo.dev/docs/core-concepts/package-types`
- Turborepo internal packages: `https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package`
- pnpm workspaces: `https://pnpm.io/workspaces`
- next-forge structure: `https://www.next-forge.com/docs/structure`
- next-forge app docs: `https://www.next-forge.com/docs/apps/app`
- next-forge repository: `https://github.com/vercel/next-forge`
- Prediction-market reference: `https://github.com/kuestcom/prediction-market`
- Medium, "How to Set up a Next.js App in 2026": `https://medium.com/talex-global/how-to-set-up-a-next-js-app-in-2026-7cf9e17968a7`
- Medium, "How to Organize Your Next.js App with the App Router": `https://medium.com/@aritrapaulpc/how-to-organize-your-next-js-app-with-the-app-router-best-practices-folder-structures-4bba816df061`
- Medium, "From Pages to Boundaries: A Practical Clean Architecture for Next.js 16": `https://medium.com/@srachel27/from-pages-to-boundaries-a-practical-clean-architecture-for-next-js-16-9696bcd98005`

## Source-Backed Rules

- Keep deployable surfaces as app packages under `apps/*`.
- Keep shared reusable code in library packages under `packages/*`.
- Do not create nested workspace packages such as `apps/**` or `packages/**`; Turborepo documents this as unsupported/ambiguous.
- Every workspace package needs a unique `name` in `package.json`.
- Every internal package dependency must be explicit in the consumer package's `package.json`.
- Use `workspace:*` for internal package dependencies.
- Application packages should be terminal nodes of the package graph. Packages should not import app code.
- Next.js `src` is optional. A senior structure does not require `src/app`.
- In App Router, use route groups for layout/auth boundaries without changing URLs.
- Use private `_folder` names for implementation details that should not participate in routing.
- Pages/layouts are Server Components by default. Use Client Components only for state, effects, event handlers, browser APIs, custom client hooks, and client-only libraries.
- A `'use client'` directive marks its transitive import subtree as client-rendered, so client boundaries should be narrow.
- Apps should be self-contained and should not import other apps. next-forge explicitly follows this model.

## Medium/Community Takeaway

The Medium posts mostly align with the official direction:

- keep route files thin;
- avoid broad `"use client"` at page/layout level;
- keep route-specific UI close to the route;
- keep shared components truly shared;
- use domain/feature boundaries when a route becomes too large.

Do not copy Medium folder names like `contents/` blindly. For this repo, use documented App Router private folders (`_components`, `_lib`, `_actions`, `_hooks`, `_types`) and package boundaries.

## Next Version Registry Check

Current direct registry evidence, rechecked 2026-05-26:

```bash
npm view next version
# 16.2.6

npm view next dist-tags --json
# latest: 16.2.6
# canary: 16.3.0-canary.29

npm view @next/eslint-plugin-next version
# 16.2.6

npm view @next/eslint-plugin-next dist-tags --json
# latest: 16.2.6
# canary: 16.3.0-canary.29
```

Current repo state:

- manifests and lockfile currently contain `next@16.2.6` and `@next/eslint-plugin-next@16.2.6`;
- the public registry now resolves those exact versions as stable `latest`;
- earlier 2026-05-25 CLI `16.2.4` and 404 readings were stale metadata, not a reason to downgrade.

Decision: keep the user-required `16.2.6` target and do not move to canary without a dedicated upgrade MADR.

Resolved risk: the stale registry mismatch is no longer active as of the 2026-05-26 `npm view` check.
