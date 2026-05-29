# @repo/flow

`@repo/flow` owns the `.flow` source-language contracts for the AI Workflow OS.

This package is intentionally provider-neutral. It defines the language, AST, compiler, planning, runtime, event, state, patch, and testing contracts that other packages will consume. It does not execute AI model calls, sandbox commands, database writes, route handlers, or provider SDK operations.

`.flow` is a custom source language. It is not YAML and this package must not depend on a YAML parser for `.flow` parsing. YAML.org, YAML parser architecture, and GitHub Actions workflow syntax are research inputs only.

## Public Entry Points

- `@repo/flow`
- `@repo/flow/source`
- `@repo/flow/lexer`
- `@repo/flow/cst`
- `@repo/flow/parser`
- `@repo/flow/ast`
- `@repo/flow/compiler`
- `@repo/flow/kernel`
- `@repo/flow/runtime`
- `@repo/flow/events`
- `@repo/flow/state`
- `@repo/flow/patch`
- `@repo/flow/testing`

## Boundaries

Allowed:

- `zod`
- local source modules inside `packages/flow`
- type-only contracts from this package's public surface

Forbidden:

- app imports from `apps/*`
- YAML parser dependencies for `.flow`
- database clients and migrations
- provider SDKs such as AI SDK, Vercel Sandbox, Better Auth, Stripe, Resend, Typesense, or Drizzle
- Next.js route handlers or UI components

Runtime/provider integration belongs in adjacent packages or app/server runtime adapters such as `@repo/sandbox`, `@repo/ai`, future `@repo/artifacts`, and `@repo/database`. Platform tools live under server-only `@repo/ai/tools`, not a separate `@repo/tools` package.

## Current Status

The package now has the first provider-neutral runtime foundation:

- logical `.flow` trigger contracts;
- custom `.flow` token and CST contracts;
- custom `.flow` lexer behavior with source spans and YAML-only rejection diagnostics;
- custom `.flow` CST parser behavior with comments, order, spans, token IDs, sequences, inline lists, and block literals;
- trigger registry row contracts;
- scheduler tick and scheduler decision contracts;
- workflow run request contracts;
- EventContextPacket contracts;
- TaskReport, IssueCard, and RunReflectionPacket contracts;
- run cancellation request contracts.

Parser, semantic validation, symbol resolution, execution planning, database persistence, Inngest adapter implementation, and interpreter implementation are gated by the package playbook:

`docs/ai-workflow-os/08-plans/package-playbooks/flow.md`

Package-local architecture memory:

`packages/flow/ARCHITECTURE.md`

Flow runtime pack source review:

`packages/flow/FLOW_RUNTIME_PACK_V0_1.md`

End-to-end build plan:

`packages/flow/END_TO_END_BUILD_PLAN.md`

Current parser gate:

- write and maintain the `.flow` grammar design;
- use token/CST contracts before parser behavior;
- add a fixture corpus before broad parsing behavior;
- reject YAML-only features by design.

Current resumability gate:

- support provider-neutral run resume and cancellation contracts;
- do not treat browser disconnect as workflow cancellation;
- keep persistence and provider adapter implementations outside `@repo/flow`;
- require future UI/API/runtime work to reconnect by durable `runId` and event cursor.
