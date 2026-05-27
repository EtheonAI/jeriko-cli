# MADR-033: Deactivate Legacy Services From Active Workspace

Status: Accepted

Date: 2026-05-24

## Context

The repository had a valid package-manager monorepo shape, but not a clean ownership model.

The old `services/*` tree was created to copy Manus-style backend decomposition. It introduced many Fastify services, `@jeriko/*` package names, service URL coupling, generated `dist` folders, local ports, E2B assumptions, and duplicate concerns that now conflict with the AI Workflow OS reset.

The target product should be built around a clean Next.js app, shared packages, typed contracts, `.flow` compilation/runtime, provider-neutral sandboxing, workflow execution, artifacts, approvals, and events.

## Decision

Remove legacy services from the active workspace/build graph now.

The active workspace is:

```text
apps/*
packages/*
!packages/service-utils
```

`services/*` and `packages/service-utils` are no longer active workspace packages. They were moved under `legacy/manus-clone` and remain temporarily as reference until the app-side replacement boundaries are complete and physical deletion is safe.

Root scripts now focus on the product apps:

```text
pnpm dev
pnpm dev:web
pnpm dev:frontend
pnpm build
pnpm typecheck
```

Docker scripts are renamed to infra scripts because they currently keep shared dependencies such as Postgres and Redis, not the product service architecture:

```text
pnpm infra:up
pnpm infra:down
pnpm infra:logs
```

## Consequences

Positive:

- The active monorepo graph no longer includes `@jeriko/*` service packages.
- The app no longer depends on `@repo/service-utils`.
- The root build script no longer builds legacy gateway/task/file/connector/search/project/webhook/orchestrator/sandbox services.
- The workspace becomes easier to reason about before the Next app route reset.
- Future backend work can be designed from the workflow architecture instead of inherited from Manus.

Negative:

- Some current app route handlers still proxy to service URLs. Those routes now represent explicit legacy facades and must be refactored or removed.
- The physical legacy service source still exists under `legacy/manus-clone/services` until deletion gates are met.
- Backend functionality such as sandbox, file service, task execution, connectors, and orchestration needs a clean replacement plan.

## Alternatives Considered

- Keep all services active and keep fixing them.
  - Rejected because it preserves the wrong architecture and keeps the app tied to Manus-style service sprawl.
- Delete `services/` immediately.
  - Deferred because some app routes still point at service URLs and we need a controlled replacement/deletion checklist.
- Move services under `packages/backend`.
  - Rejected for now because it would make old code look endorsed as the new backend.

## Evidence

- Turborepo package type guidance distinguishes deployable applications from reusable packages and emphasizes package/task graph clarity: `https://turborepo.com/repo/docs/core-concepts/package-types`
- Turborepo package configuration guidance supports specialized task ownership without forcing unrelated packages into one root task model: `https://turborepo.com/repo/docs/reference/package-configurations`
- Vercel monorepo guidance treats each app as an independently linked/deployable project: `https://vercel.com/docs/monorepos`
- Next.js App Router project structure supports route groups, colocation, and private folders for clear app ownership: `https://nextjs.org/docs/app/getting-started/project-structure`

## Impacted Files

- `pnpm-workspace.yaml`
- `package.json`
- `turbo.json`
- `apps/app/package.json`
- `pnpm-lock.yaml`

## Validation Checklist

- [x] `services/*` removed from `pnpm-workspace.yaml`.
- [x] `packages/service-utils` excluded from the active workspace.
- [x] Legacy service source moved to `legacy/manus-clone`.
- [x] Root scripts no longer reference `@jeriko/*`.
- [x] Root scripts no longer expose `dev:services`.
- [x] App no longer depends on `@repo/service-utils`.
- [x] `pnpm install` completes with 32 active workspace projects.
- [x] `pnpm -r list --depth -1` shows no `@jeriko/*` packages and no `@repo/service-utils`.
- [x] `pnpm --filter app typecheck` passes.
