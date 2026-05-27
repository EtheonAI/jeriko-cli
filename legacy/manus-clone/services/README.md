# Legacy Services

This directory is not part of the active workspace architecture.

The services here were built during the Manus-clone phase and are retained only as temporary reference while the Next.js app, workflow kernel, sandbox adapter, tools, artifacts, and runtime contracts are reset.

Do not add new AI Workflow OS code here.

Current decision:

- `services/*` is excluded from `pnpm-workspace.yaml`.
- root `dev:services` scripts were removed.
- root build/test scripts no longer reference `@jeriko/*`.
- replacement backend boundaries should be introduced through `apps/app`, `packages/contracts`, and new workflow/runtime packages.

See:

- [`../../../docs/ai-workflow-os/07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md`](../../../docs/ai-workflow-os/07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md)
- [`../../../docs/ai-workflow-os/01-architecture/monorepo-target-architecture.md`](../../../docs/ai-workflow-os/01-architecture/monorepo-target-architecture.md)
