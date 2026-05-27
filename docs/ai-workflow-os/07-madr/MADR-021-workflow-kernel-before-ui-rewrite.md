# MADR-021: Build Workflow Kernel Before UI Rewrite

Date: 2026-05-23

Status: Proposed

## Context

The current product is chat/session-centric. The target product is a workflow operating system based on `.flow` source, compiled runtime structures, durable execution, approvals, artifacts, and events.

Starting with a full UI redesign would only reskin the existing chat model. The platform needs a workflow-native source and runtime contract first.

## Decision

Build a workflow kernel package before the major UI rewrite.

The package should own:

- `.flow` v0 vocabulary.
- Parser/loader.
- AST types.
- Diagnostics.
- Symbol table.
- Semantic validator.
- Compiled runtime JSON.
- Fixtures and tests.

## Consequences

Positive:

- UI can render real workflow objects instead of fake chat abstractions.
- Executor and database can share one contract.
- AI patching can target a typed workflow tree.
- Invalid workflows can fail before runtime.

Negative:

- Visual progress is delayed.
- Some existing chat surfaces will remain temporarily.

## Acceptance Criteria

- Valid sample flow compiles deterministically.
- Invalid flow produces clear diagnostics.
- Compiled JSON can be saved as a workflow version.
- One mock executor test can run the compiled flow.
