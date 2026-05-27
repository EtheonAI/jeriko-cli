# MADR-067: Retire The Central `@repo/contracts` Package

Status: Accepted

Date: 2026-05-26

## Context

The reset moved toward package-first ownership, but `@repo/contracts` became a generic bucket for unrelated schemas:

- stream events;
- messages;
- tool input contracts;
- sandbox request/response contracts;
- legacy adapters.

The package had no active consumers outside its own tests:

```bash
rg -n "@repo/contracts" apps packages --glob '!packages/contracts/**'
```

returned no active imports.

The package also kept the wrong mental model. Contracts are still required, but they should live with their owning package instead of being centralized too early.

## Sources

| Source                                                                           | Checked Date | Claim Used                                                                                                                    |
| -------------------------------------------------------------------------------- | -----------: | ----------------------------------------------------------------------------------------------------------------------------- |
| https://turborepo.dev/docs/core-concepts/internal-packages                       |   2026-05-26 | Internal packages are workspace libraries consumed through package dependencies and exports.                                  |
| https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package |   2026-05-26 | Turborepo recommends one purpose per internal package; this reduces dependencies and improves graph clarity.                  |
| https://turborepo.dev/docs/core-concepts/package-types                           |   2026-05-26 | Library packages support application packages; application packages should stay graph endpoints.                              |
| https://zod.dev/api                                                              |   2026-05-26 | Zod remains the schema library for package-local contracts.                                                                   |
| https://vercel.com/docs/vercel-sandbox                                           |   2026-05-26 | Vercel Sandbox implementation belongs behind the sandbox package boundary, not a generic contracts bucket.                    |
| https://vitest.dev/guide/projects                                                |   2026-05-26 | Vitest projects are the current monorepo test configuration model; root test config must not reference deleted project files. |

## Decision

Delete the active `@repo/contracts` package.

Rehome future contracts by ownership:

| Contract Area                                                           | Owning Package                             |
| ----------------------------------------------------------------------- | ------------------------------------------ |
| `.flow` source, AST, compiler, run state, FlowPatch                     | `@repo/flow`                               |
| Sandbox lifecycle, commands, files, browser, provider adapter types     | `@repo/sandbox`                            |
| AI stream parts, AI UI renderer props, model/tool UI contracts          | `@repo/ai`                                 |
| Platform tool manifests, permissions, tool adapter metadata             | `@repo/ai/tools`                           |
| Connector toolkits/actions, sessions, connected-account metadata        | future `@repo/connectors`                  |
| Artifact metadata, preview/rendering policies, storage object contracts | future `@repo/artifacts`                   |
| Public app route/API request-response schemas                           | owning app route or owning feature package |

`@repo/contracts` can only return later if there is a proven cross-package/public API surface with multiple real consumers and a single coherent purpose.

## Consequences

- The package graph becomes clearer.
- Root tests no longer target a retired package.
- Package-local contracts remain mandatory; this is not a move away from schemas or validation.
- Existing historical docs that mention `@repo/contracts` are superseded by this MADR.

## Alternatives Considered

- Keep and refactor `@repo/contracts`.
  - Rejected because it still centralizes unrelated domains and had no real consumers.
- Split it into multiple packages immediately.
  - Rejected because `@repo/flow` and `@repo/sandbox` already own the immediate contract surfaces; future `@repo/connectors` and `@repo/artifacts` should be created only when implementation starts, while platform tools stay under `@repo/ai/tools`.
- Keep it as a test-only package.
  - Rejected because test-only packages should support real package surfaces, not preserve obsolete architecture.

## Validation Checklist

- [x] Delete `packages/contracts`.
- [x] Remove root `test` filter that targets `@repo/contracts`.
- [x] Remove deleted `packages/contracts/vitest.config.ts` from root Vitest projects.
- [x] Run `pnpm install` to update the lockfile and workspace state.
- [x] Run active package typechecks.
- [x] Run remaining package tests.
- [x] Run app/web typechecks.
- [x] Run dependency graph validation.
- [x] Update active architecture docs and package playbooks.
