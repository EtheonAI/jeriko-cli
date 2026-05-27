# Manus Clone Legacy Source

This folder contains the old Manus-clone backend/service source after it was removed from the active workspace.

It is kept temporarily so useful concepts can be extracted into the new architecture:

- sandbox shell/browser/file capability semantics
- connector/tool capability ideas
- billing/usage ledger ideas
- task/execution patterns
- file/artifact handling ideas

It is not the new backend.

Do not:

- add new AI Workflow OS code here;
- import from this folder in active apps/packages;
- re-add these packages to `pnpm-workspace.yaml`;
- rebuild the product around `@jeriko/*` services.

See:

- [`../../docs/ai-workflow-os/07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md`](../../docs/ai-workflow-os/07-madr/MADR-033-deactivate-legacy-services-from-active-workspace.md)
- [`../../docs/ai-workflow-os/01-architecture/monorepo-target-architecture.md`](../../docs/ai-workflow-os/01-architecture/monorepo-target-architecture.md)
