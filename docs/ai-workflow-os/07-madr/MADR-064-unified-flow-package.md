# MADR-064: Unified `@repo/flow` Package

Status: Accepted

Date: 2026-05-26

## Context

Earlier architecture notes listed separate future packages:

- `@repo/workflow-kernel`
- `@repo/workflow-runtime`
- `@repo/sandbox`
- `@repo/tools` (later rejected by MADR-070; platform tools live in `@repo/ai/tools`)
- `@repo/artifacts`

The user proposed a cleaner alternative for the workflow language itself:

```text
@repo/flow
@repo/flow/kernel
@repo/flow/runtime
@repo/flow/parser
```

This better matches the product. The public product primitive is `.flow`, not "workflow-kernel." The package name should reflect the source language and platform concept.

## Decision

Create one future package named `@repo/flow` for the `.flow` language, compiler pipeline, planning model, state machine types, validation, and runtime interpreter contracts.

Use explicit subpath exports instead of splitting the language into many packages too early:

```text
@repo/flow
@repo/flow/source
@repo/flow/parser
@repo/flow/ast
@repo/flow/compiler
@repo/flow/kernel
@repo/flow/runtime
@repo/flow/events
@repo/flow/state
@repo/flow/patch
@repo/flow/testing
```

Initial internal shape:

```text
packages/flow/
  package.json
  src/
    source/
    parser/
    ast/
    compiler/
    kernel/
    runtime/
    events/
    state/
    patch/
    testing/
```

## Boundary

`@repo/flow` owns:

- `.flow` versioned language types;
- lexer/parser/CST;
- AST;
- Zod schemas;
- semantic validation;
- symbol table;
- compiler output;
- execution plan model;
- event/state-machine contracts;
- FlowPatch transforms;
- interpreter interfaces.

`@repo/flow` must not own:

- provider SDKs;
- Vercel Sandbox implementation;
- database client;
- Next.js route handlers;
- app UI;
- billing provider;
- external connector SDKs.

Adjacent package boundaries:

- Package-local contracts stay with their owning package. The former `@repo/contracts` bucket is retired by MADR-067.
- `@repo/ai`: AI SDK, model calls, streaming, chat/workflow authoring UI primitives.
- `@repo/ai/tools`: platform tool manifests, permission metadata, tool adapter registry, and AI SDK adapters.
- `@repo/connectors`: connector toolkits/actions, direct API integrations, auth/session/trigger lifecycle.
- `@repo/sandbox`: provider-neutral sandbox adapter and Vercel Sandbox implementation.
- `@repo/artifacts`: artifact metadata, renderer contracts, storage policies.
- `@repo/database`: persisted workflow/run/artifact/event schema and migrations.

## Why Not Separate `workflow-kernel` And `workflow-runtime` Now?

Separate packages may be useful later, but they are premature during the reset.

The parser, AST, semantic resolver, execution planner, event model, and interpreter contracts will change together during the first implementation. If split too early, the repo gets package churn and package cycles before the language is stable.

Use one package with subpath exports first. Split later only if:

- runtime can evolve independently from parser/compiler;
- package size becomes a real issue;
- external consumers need only the parser or only the runtime;
- dependency boundaries prove stable.

## Consequences

Positive:

- clearer product vocabulary;
- fewer early package cycles;
- one package playbook for the `.flow` language system;
- explicit subpath exports still provide clean segmentation;
- easier app consumption: `@repo/flow/parser`, `@repo/flow/runtime`, etc.

Negative:

- `@repo/flow` could become too broad if not governed;
- internal folders must stay strict;
- provider/runtime adapters must not leak into it.

## Validation Checklist

- [x] Package naming decision documented.
- [x] Update package ownership index target package list.
- [x] Add `@repo/flow` playbook before implementation.
- [x] Create package scaffold with contracts only.
- [x] Add dependency-cruiser rules preventing `@repo/flow` from importing apps or provider SDK packages.
