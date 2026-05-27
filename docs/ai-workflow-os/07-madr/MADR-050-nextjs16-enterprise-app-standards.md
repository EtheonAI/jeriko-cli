# MADR-050: Next.js 16.2.6 Enterprise App Standards

Status: Accepted

Date: 2026-05-26

Update: Superseded in part by [`MADR-059`](./MADR-059-blazity-governance-performance-practices-as-gated-standards.md) for the detailed Blazity governance/performance follow-up. MADR-050 remains the broader Next.js 16.2.6 enterprise app standard.

## Context

`apps/app` is being reset from an old Manus-clone surface into a clean workflow platform shell. The user provided several enterprise/performance references and asked whether their package choices, directory structure, segmentation, and architecture should influence the reset.

The current codebase already has some enterprise pieces:

- Next `16.2.6`;
- Turborepo;
- pnpm `11.3.0`;
- T3 Env;
- Better Auth;
- Renovate;
- Storybook app;
- Vitest smoke tests;
- dependency-cruiser;
- `@total-typescript/ts-reset`;
- `packages/design-system`;
- Sentry/observability package;
- a documented reset/audit/MADR workflow.

The risk is importing another starter's dependency list and creating a new mess before the reset skeleton is clean.

## Decision

Adopt a source-backed enterprise standard for `apps/app`:

1. Official Next.js/Vercel/Turborepo docs and current package metadata are authoritative.
2. Blazity `next-enterprise`, next-forge, community best-practice repos, and articles are reference inputs, not templates to copy.
3. Keep `apps/app/app`; do not move to `src/app`.
4. Keep `(authenticated)` and `(unauthenticated)` route groups because they express auth/layout ownership without changing URLs.
5. Keep pages and layouts as thin Server Components by default.
6. Use route-local private folders for implementation details:

   ```text
   _components
   _hooks
   _lib
   _schemas
   _types
   _actions
   ```

7. Keep Client Components small and leaf-oriented.
8. Put shared primitives in `packages/design-system`, not app route folders.
9. Keep runtime/provider abstractions in packages, not page code.
10. Use `@/env` and package `keys()` contracts for env access. Do not use direct `process.env` in app runtime code when a typed env field exists.
11. Keep Turbopack as the default Next 16 build path and use `next experimental-analyze` before adding analyzer packages.
12. Do not add enterprise-template packages until a package playbook proves the need, current version, peer compatibility, and validation plan.

## Consequences

Positive:

- Refactors have a consistent standard.
- Starter repos can inspire us without dictating versions or architecture.
- The app reset can stay small while still moving toward enterprise quality.
- Future `.flow`, Vercel Sandbox, CMS, observability, and testing phases get clean boundaries to attach to.

Negative:

- We will move slower than a blind package import or template copy.
- Some useful tooling, such as Playwright, OpenTelemetry, or Testing Library, stays deferred until its phase.
- We must keep docs updated whenever package/runtime decisions change.

## Alternatives Considered

### Copy Blazity `next-enterprise`

Rejected.

It has useful enterprise tooling ideas, but the current repo is Next 15 based while this project is pinned to Next `16.2.6`. Copying versions or scripts would violate the package research rule and could reintroduce dependency drift.

### Copy next-forge exactly

Rejected.

next-forge is a strong shape reference, but this project has Better Auth instead of Clerk and a workflow-OS target instead of a generic SaaS starter. We keep the monorepo/app/package architecture ideas, not the whole template.

### Move `apps/app/app` to `apps/app/src/app`

Rejected for this reset.

Next.js documents `src` as optional. The current monorepo already uses app roots under `apps/*/app`, and moving would add route/import churn without proven benefit.

### Add all enterprise packages now

Rejected.

This would increase complexity before route ownership, tests, app shell, design system, and package boundaries are clean.

## Evidence

Primary research note:

- [`../09-research/2026-05-26-nextjs16-enterprise-architecture-research.md`](../09-research/2026-05-26-nextjs16-enterprise-architecture-research.md)

Primary sources checked:

- Next.js 16 upgrade: `https://nextjs.org/docs/app/guides/upgrading/version-16`
- Next.js project structure: `https://nextjs.org/docs/app/getting-started/project-structure`
- Next.js Server and Client Components: `https://nextjs.org/docs/app/getting-started/server-and-client-components`
- Next.js data security: `https://nextjs.org/docs/app/guides/data-security`
- Next.js Cache Components: `https://nextjs.org/docs/app/getting-started/cache-components`
- Next.js Proxy: `https://nextjs.org/docs/app/api-reference/file-conventions/proxy`
- Next.js CLI analyzer: `https://nextjs.org/docs/app/api-reference/cli/next`
- Turborepo repository structure: `https://turborepo.com/docs/crafting-your-repository/structuring-a-repository`
- Turborepo package types: `https://turborepo.com/docs/core-concepts/package-types`
- Vercel Conformance: `https://vercel.com/docs/conformance`
- Vercel Code Owners: `https://vercel.com/docs/workflow-collaboration/code-owners`
- next-forge structure: `https://www.next-forge.com/docs/structure`
- next-forge app: `https://www.next-forge.com/docs/apps/app`

Secondary sources checked:

- DigitalApplied Next.js 16 performance guide: `https://www.digitalapplied.com/blog/nextjs-16-performance-server-components-guide`
- Blazity next-enterprise repo: `https://github.com/Blazity/next-enterprise`
- Blazity next-enterprise product page: `https://www.blazity.com/solutions/next-enterprise`
- bablukpik Next.js best practices: `https://github.com/bablukpik/nextjs-best-practices`
- IO Digital enterprise Next.js article: `https://techhub.iodigital.com/articles/nextjs-at-enterprise-level`

## Impacted Files And Packages

Immediate docs:

- `docs/ai-workflow-os/00-ENGINEERING-STANDARDS.md`
- `docs/ai-workflow-os/08-plans/package-playbooks/apps-app.md`
- `docs/ai-workflow-os/08-plans/apps-app-structure-cleanup-checklist.md`
- `docs/ai-workflow-os/09-research/research-index.md`

Future code impact:

- `apps/app/app`
- `apps/app/env.ts`
- `apps/app/proxy.ts`
- `apps/app/components`
- `apps/app/lib`
- `packages/design-system`
- `packages/observability`
- `packages/testing`

## Package Candidate Decision

Do not install new packages from the research in this MADR.

Tracked candidates:

- `@vercel/otel`: observability phase candidate.
- `@testing-library/react`: component-test phase candidate.
- `@playwright/test`: e2e phase candidate after stable product flows.
- `next-safe-action`: workflow mutation phase candidate.
- `@tanstack/react-query`: workflow live-view phase candidate.
- `madge`: optional graph visualization candidate if dependency-cruiser is not enough.

Explicit non-default:

- `@next/bundle-analyzer`: do not add by default because `apps/app` already uses `next experimental-analyze`.
- `patch-package`: do not add unless a documented upstream defect blocks us.
- `semantic-release`: do not add while this repo is using Changesets/Renovate.

## Validation Checklist

- [x] Official docs checked.
- [x] Provided sources reviewed and classified.
- [x] Current package metadata checked for candidate packages.
- [x] Research note created.
- [x] MADR created.
- [x] Engineering standards updated.
- [x] App playbook updated.
- [x] Cleanup checklist updated.
- [ ] Docs sanity checks passed.
