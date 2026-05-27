# Engineering Standards Source Review

Date: 2026-05-25

Scope: research used to write `00-ENGINEERING-STANDARDS.md`.

## Sources Checked

| Source                                                                     | Type          | Claim Used                                                                                                                                                                                                 |
| -------------------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/guides/upgrading/version-16`                  | Official docs | Next 16 upgrade codemod handles `proxy`, ESLint CLI migration, Turbopack config, and stabilized API prefixes.                                                                                              |
| `https://nextjs.org/docs/app/getting-started/project-structure`            | Official docs | App Router supports route groups, private folders, colocation, optional `src`, and top-level `proxy.ts`.                                                                                                   |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components` | Official docs | Layouts/pages are Server Components by default; Client Components are for state/effects/browser APIs; `"use client"` creates a client module graph boundary; `server-only` prevents environment poisoning. |
| `https://nextjs.org/docs/app/getting-started/route-handlers`               | Official docs | Route Handlers live in `app`, use Web Request/Response, are not cached by default, and cannot share a route segment with `page.tsx`.                                                                       |
| `https://nextjs.org/docs/app/getting-started/mutating-data`                | Official docs | Server Functions / Server Actions are async mutation functions, use POST, and must verify auth/authz because they are reachable by direct POST.                                                            |
| `https://nextjs.org/docs/app/getting-started/proxy`                        | Official docs | Next 16 calls Middleware `Proxy`; `proxy.ts` is the correct convention.                                                                                                                                    |
| `https://env.t3.gg/docs/nextjs`                                            | Official docs | T3 Env recommends importing env in Next config for build-time validation and using the typed env object in server/client code.                                                                             |
| `https://env.t3.gg/docs/core`                                              | Official docs | T3 Env is the env validation/type contract used by packages and apps.                                                                                                                                      |
| `https://turborepo.dev/docs/core-concepts/package-types`                   | Official docs | Application packages should be package graph endpoints; library packages are reusable internal packages.                                                                                                   |
| `https://turborepo.com/repo/docs/handbook/workspaces`                      | Official docs | Turborepo workspace structure should avoid ambiguous nested package globs and use explicit app/package ownership.                                                                                          |
| `https://pnpm.io/settings`                                                 | Official docs | pnpm 11 install policy belongs in workspace config rather than broad `.npmrc` assumptions.                                                                                                                 |

## Repo Evidence Checked

- `docs/ai-workflow-os/00-OPERATING-MEMORY.md`
- `docs/ai-workflow-os/01-architecture/monorepo-target-architecture.md`
- `docs/ai-workflow-os/01-architecture/package-ownership-index.md`
- `docs/ai-workflow-os/07-madr/MADR-032-t3-env-as-env-contract.md`
- `docs/ai-workflow-os/07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`
- `docs/ai-workflow-os/07-madr/MADR-038-pnpm11-node-linting-runtime-baseline.md`
- `docs/ai-workflow-os/07-madr/MADR-041-keep-feature-flags-with-lazy-product-auth.md`
- Vercel Next.js skill references on file conventions, RSC boundaries, async patterns, and data patterns.

## Implementation Impact

The standards now require:

- official-doc research before package/framework refactors;
- T3 Env instead of direct `process.env` in app runtime code;
- Server Components by default and narrow Client Component boundaries;
- route-local `_components`, `_actions`, `_hooks`, `_lib`, and `_types`;
- app packages as deployable graph endpoints;
- lazy optional product dependencies to avoid unrelated env validation;
- documentation and verification after every non-trivial cleanup/refactor.

## Open Questions

- Whether to add Knip immediately or after `apps/app` build is green.
- Whether `packages/cms` should be archived now or kept until the Payload/static-content decision.
- Whether root `pnpm build` should temporarily mean `app + web` or split product/web verification until `apps/app` production build is fixed.
