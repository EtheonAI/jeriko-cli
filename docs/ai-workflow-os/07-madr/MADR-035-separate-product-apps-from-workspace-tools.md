# MADR-035: Separate Product Apps From Workspace Tools

**Status:** Superseded by [`MADR-037`](./MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md)

## Supersession Note

This decision was useful as an intermediate cleanup step, but it is no longer the final monorepo target. The corrected architecture keeps runnable surfaces as first-class app packages: `apps/app`, `apps/web`, `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio`. `tools/*` is reserved for repo-only CLIs/scripts that are not app packages.

## Context

After deactivating `apps/api`, the `apps/` directory still mixes product deployables with non-product utility surfaces:

- `apps/app`: primary product app.
- `apps/web`: marketing/content app.
- `apps/docs`: Mintlify docs content/tooling.
- `apps/email`: React Email template preview/build tool.
- `apps/storybook`: design-system workshop, currently disabled for Next 16 dev in its own script.
- `apps/studio`: Drizzle Studio wrapper.

This makes `apps/` look like every directory is a deployable product surface even when some are local tooling.

## Latest Evidence Checked

- Next.js project structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`
  - `src` is optional.
  - route groups and private folders are supported.
  - colocated files inside `app` are safe unless they are route files.
- Turborepo package types: `https://turborepo.com/repo/docs/core-concepts/package-types`
  - application packages are deployable workspace packages.
  - library packages support application packages.
  - application packages should normally be endpoints of the package graph.
- Turborepo repository structure docs: `https://turborepo.com/repo/docs/crafting-your-repository/structuring-a-repository`
  - avoid nested package globs like `apps/**` or `packages/**`.
- Vercel monorepo docs and FAQ: `https://vercel.com/docs/monorepos`, `https://vercel.com/docs/monorepos/monorepo-faq`
  - monorepo deployables should have intentional project roots.
- pnpm workspaces: `https://pnpm.io/workspaces`
  - workspace roots are declared in `pnpm-workspace.yaml`.

Local package inspection before the move:

- `apps/docs/package.json` only runs `mintlify dev` and link checks.
- `apps/email/package.json` runs React Email against `packages/email/templates`.
- `apps/storybook/package.json` has a disabled `dev` script and is design-system QA tooling.
- `apps/studio/package.json` delegates to `packages/database` Drizzle Studio.

Post-move verification:

- `pnpm install` passed across 31 workspace projects.
- `pnpm -r list --depth -1` shows only `apps/app` and `apps/web` under active `apps/`, with docs/email/storybook/studio under `tools/*`.
- Focused typechecks passed for `app`, `web`, `@repo/contracts`, and `@repo/search`.
- Focused Vitest runs passed for `@repo/contracts` and `@repo/search`.
- `pnpm exec turbo run typecheck --dry` scoped 30 packages and no longer included `apps/api`, old services, or `@repo/service-utils`.
- Active config scan found no references to `apps/api`, `@repo/service-utils`, `@jeriko/*`, old service compose files, `dev:services`, `vitest.workspace`, or `defineWorkspace`.
- Latest package/version evidence for this cleanup checkpoint is recorded in [`../09-research/2026-05-25-latest-package-registry-check.md`](../09-research/2026-05-25-latest-package-registry-check.md).

## Decision

Keep product deployables under `apps/`:

```text
apps/app
apps/web
```

Move non-product workspace tools under `tools/`:

```text
tools/docs
tools/email
tools/storybook
tools/studio
```

Add `tools/*` to `pnpm-workspace.yaml` only for these explicit tool packages.

Do not move `apps/app/app` to `apps/app/src/app` as part of this decision. That route-tree migration needs a separate plan.

## Consequences

- `apps/` becomes deployable-product focused.
- Tooling remains installable/runnable through pnpm filters.
- Product app cleanup can continue without docs/email/storybook/studio appearing as runtime surfaces.
- Vercel project roots become easier to reason about.

## Alternatives Considered

- Keep dev tools under `apps/`.
  - Rejected because it keeps app ownership ambiguous.
- Move tools into `packages/`.
  - Rejected because they are runnable utility surfaces, not reusable libraries.
- Move tools under nested package globs like `apps/tools/*`.
  - Rejected because Turborepo cautions against nested package globs.

## Validation Checklist

- [x] Move docs/email/storybook/studio to `tools/*`.
- [x] Add `tools/*` to `pnpm-workspace.yaml`.
- [x] Remove generated state from moved tools: `node_modules`, `.cache`, `.turbo`, `.next`, `storybook-static`.
- [x] Update docs and README references.
- [x] `pnpm install`
- [x] `pnpm -r list --depth -1`
- [x] `pnpm --filter app typecheck`
- [x] `pnpm --filter web typecheck`
- [x] `pnpm --filter @repo/contracts typecheck`
- [x] `pnpm --filter @repo/search typecheck`
- [x] `pnpm exec vitest run --project @repo/contracts --passWithNoTests`
- [x] `pnpm exec vitest run --project @repo/search --passWithNoTests`
- [x] `pnpm exec turbo run typecheck --dry`
