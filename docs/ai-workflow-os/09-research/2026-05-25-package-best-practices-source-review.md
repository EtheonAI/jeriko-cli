# Package Best-Practices Source Review

Date: 2026-05-25

Scope: evidence for package-by-package cleanup/refactor playbooks.

## Sources Checked

| Source                                                                     | Type                                  | Claim Used                                                                                                                                                                                   |
| -------------------------------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://nextjs.org/docs/app/getting-started/project-structure`            | Official docs                         | App Router supports colocated route files, private folders, route groups, top-level project files, and optional `src`; `src/app` is optional, not required.                                  |
| `https://nextjs.org/docs/app/getting-started/server-and-client-components` | Official docs                         | Server Components are the default in App Router; Client Components are a boundary created by `"use client"` and should be used only where client capabilities are required.                  |
| `https://nextjs.org/docs/app/guides/upgrading/version-16`                  | Official docs                         | Next 16 changes include `proxy.ts`, async request APIs, Turbopack/config updates, and migration tooling; code should follow current v16 conventions instead of older App Router assumptions. |
| `https://env.t3.gg/docs/nextjs`                                            | Official docs                         | Next.js apps should use the typed T3 Env contract and import env during build/config validation where needed.                                                                                |
| `https://env.t3.gg/docs/core`                                              | Official docs                         | Core T3 Env defines runtime validation and typed env access for shared packages.                                                                                                             |
| `https://turborepo.com/repo/docs/core-concepts/package-types`              | Official docs                         | Application packages are deployable graph endpoints; internal packages are reusable libraries or configs.                                                                                    |
| `https://turborepo.com/repo/docs/handbook/workspaces`                      | Official docs                         | Monorepos should use clear workspace package ownership and avoid ambiguous workspace shape.                                                                                                  |
| `https://next-forge.com/docs`                                              | Product docs / reference architecture | next-forge uses multi-app Turborepo SaaS structure with apps and reusable `@repo/*` packages, useful as a reference but not a source of truth over this repo's needs.                        |
| `https://pnpm.io/settings`                                                 | Official docs                         | pnpm workspace and install settings should be explicit, documented, and not hidden behind stale cache assumptions.                                                                           |

## Local Evidence Checked

- `apps/*/package.json`
- `packages/*/package.json`
- `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md`
- `docs/ai-workflow-os/01-architecture/package-ownership-index.md`
- `docs/ai-workflow-os/08-plans/build-checklist.md`
- `docs/ai-workflow-os/08-plans/apps-app-structure-cleanup-checklist.md`
- `docs/ai-workflow-os/07-madr/MADR-031-next16-route-local-app-structure.md`
- `docs/ai-workflow-os/07-madr/MADR-032-t3-env-as-env-contract.md`
- `docs/ai-workflow-os/07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md`
- Vercel Next.js and next-forge skill references available locally for App Router and `@repo/*` monorepo conventions.

## Findings

The existing engineering standards are strong enough as a repo-level rulebook, but they are not enough for high-risk package work.

Package-specific behavior is where mistakes happen:

- env loading differs between apps, packages, config files, scripts, and tests;
- provider SDKs have peer dependencies and runtime assumptions;
- Server/Client boundaries can leak through shared UI packages;
- auth, billing, database, security, and sandbox code have different verification gates;
- optional integrations must not require secrets during unrelated app builds;
- some packages should be kept, some gated, and some archived before new workflow work starts.

## Implementation Impact

Add a package best-practices registry with:

- a priority matrix for every active app/package;
- a mandatory package playbook template;
- a rule for when full package documentation is required;
- a rule for when lightweight registry classification is enough;
- verification commands per package type;
- explicit keep/refactor/archive/gate decisions.

The next cleanup phase should not create exhaustive docs for every transitive npm dependency. It should create full playbooks for P0/P1 repo packages before changing their APIs, env shape, package boundaries, runtime behavior, or build behavior.

## Open Questions

- Whether `packages/cms` is archived immediately or kept as a gated compatibility package until Payload evaluation.
- Whether `packages/agentmail`, `packages/collaboration`, and `packages/notifications` are required for MVP or should remain gated.
- Whether the next active implementation slice should be `apps/app` production build diagnosis or lint-debt triage.
