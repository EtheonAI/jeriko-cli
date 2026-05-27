# Monorepo Target Architecture

Date: 2026-05-24

## Verdict

The old repo was a monorepo in tooling only. The target is a monorepo by ownership.

Active code should be split by deployability and reuse:

```text
apps/       runnable application surfaces and deployable projects
packages/   reusable libraries, contracts, adapters, config, and UI
tools/      repo-only CLIs/scripts that are not app packages
docs/       architecture, research, audit, plans, and product memory
scripts/    repo maintenance scripts only
```

Legacy Manus-style services are not part of the active graph and now live under `legacy/manus-clone`. The redundant standalone API app is deactivated under `legacy/deactivated-apps/api`.

Update 2026-05-25: [`MADR-037`](../07-madr/MADR-037-keep-multiple-apps-as-first-class-monorepo-surfaces.md) supersedes the earlier `tools/*` target for docs/email/Storybook/studio. The current working tree may still have `tools/docs`, `tools/email`, `tools/storybook`, and `tools/studio` from the intermediate cleanup, but the target is to restore those runnable surfaces under `apps/*` with explicit app ownership.

## Active App Classification

| Path                          | Status                   | Role                                                                                        |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| `apps/app`                    | Primary                  | Main authenticated AI Workflow OS product.                                                  |
| `apps/web`                    | Active app               | Marketing/content site. Keep it; fix build/env ownership instead of deleting it.            |
| `apps/docs`                   | Active docs app          | Documentation site/content app. Current intermediate path may be `tools/docs`.              |
| `apps/email`                  | Active preview/build app | React Email template preview/build surface. Current intermediate path may be `tools/email`. |
| `apps/storybook`              | Active dev/QA app        | Design-system workshop. Current intermediate path may be `tools/storybook`.                 |
| `apps/studio`                 | Active admin/dev app     | Database/admin studio surface. Current intermediate path may be `tools/studio`.             |
| `legacy/deactivated-apps/api` | Deactivated              | Old standalone API app. Reintroduce only if a separate API deploy boundary is proven.       |

## Package Classification

Keep as reusable product packages:

```text
@repo/auth
@repo/database
@repo/design-system
@repo/payments
@repo/email
@repo/storage
@repo/search
@repo/ai
@repo/analytics
@repo/observability
@repo/security
@repo/feature-flags
@repo/notifications
@repo/webhooks
@repo/next-config
@repo/typescript-config
@repo/testing
```

Audit before keeping:

```text
@repo/agentmail
@repo/cms
@repo/collaboration
@repo/internationalization
@repo/rate-limit
@repo/seo
```

Detailed ownership and cleanup status lives in [`package-ownership-index.md`](./package-ownership-index.md).

Legacy / inactive:

```text
legacy/manus-clone/service-utils
legacy/manus-clone/services
legacy/deactivated-apps/api
```

## Target Backend Shape

The new backend should not begin as many hand-rolled Fastify microservices.

Start with:

```text
apps/app/app/api              route handlers for product-facing HTTP/SSE
apps/app/lib/server           server-only app facades
packages/flow                 .flow parser, AST, validation, compiler, execution plan, run-state contracts
packages/database             Drizzle schema and migrations
packages/sandbox              provider-neutral sandbox contracts and Vercel Sandbox adapter
packages/ai                   AI SDK/model/stream/UI contracts
packages/tools                tool registry, permissions, connector manifests
packages/artifacts            artifact metadata, preview/rendering policies, storage object contracts
```

Introduce a separate backend app only when there is a concrete deploy reason:

- long-running worker isolation;
- independent scaling;
- separate runtime constraints;
- queue/cron/webhook execution;
- security boundary;
- different ownership or release cadence.

## Next App Target Shape

`apps/app` should standardize toward this route ownership model. The `src/` folder is optional in Next.js and is not part of the current cleanup move:

```text
apps/app/app
  (auth)
  (app)
    workflows
    runs
    artifacts
    approvals
    connections
    settings
  (public)
  api

apps/app/components
  layout
  ui

apps/app/lib
  client
  server
  auth
  workflows
  runs
  artifacts
  sandbox
  tools
```

Rules:

- Pages and layouts are Server Components by default.
- Interactivity lives in small Client Components.
- Route-specific files live in route-local `_components`, `_hooks`, `_actions`, `_lib`, and `_types`.
- Shared UI primitives stay in the design system.
- Server-only modules stay under `lib/server` or route-local server folders.
- Do not move `apps/app/app` to `apps/app/src/app` without a dedicated route migration plan.

## App Package Ownership Rules

- Every `apps/*` package needs a README with role, env, commands, deploy/dev status, and ownership.
- Apps are graph endpoints. Workspace packages should not import app packages.
- Shared code moves to `packages/*`, not another app.
- `apps/web`, `apps/docs`, `apps/email`, `apps/storybook`, and `apps/studio` are kept as app surfaces. Build/env bugs in these apps are cleanup items, not delete signals.
- `apps/api` stays deactivated until a separate runtime/deploy/security boundary is proven.
- `tools/*` is only for repo-only utilities that are not app packages.

## Service Deletion Gates

Before physically deleting `legacy/manus-clone/services`, finish these gates:

- [ ] Inventory every active app route that still proxies to service URLs.
- [ ] Replace or delete legacy proxy routes.
- [ ] Define the provider-neutral sandbox adapter.
- [ ] Move file rendering/download flows into app/server plus storage package.
- [ ] Move workflow execution into workflow/runtime packages.
- [ ] Move connector/tool calls behind tool manifests and permissions.
- [ ] Remove remaining E2B URL assumptions from UI.
- [ ] Verify app typecheck and targeted lint.
- [ ] Verify root workspace has no `@jeriko/*` references.

## Active Infrastructure Shape

Docker in the active root is infrastructure only:

```text
docker-compose.infra.yml
  postgres
  redis
  typesense
```

Old service compose files were moved to `legacy/manus-clone/docker` and must not be used as the new backend plan.

## Evidence

- Next.js project structure and colocation: `https://nextjs.org/docs/app/getting-started/project-structure`
- Turborepo repository structure: `https://turborepo.com/docs/crafting-your-repository/structuring-a-repository`
- Turborepo package types and graph ownership: `https://turborepo.com/docs/core-concepts/package-types`
- Vercel monorepos: `https://vercel.com/docs/monorepos`
- pnpm workspaces: `https://pnpm.io/workspaces`
- next-forge structure: `https://www.next-forge.com/docs/structure`
- next-forge apps reference: `https://github.com/vercel/next-forge/tree/main/apps`
