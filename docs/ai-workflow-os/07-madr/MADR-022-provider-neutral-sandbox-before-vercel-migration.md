# MADR-022: Provider-Neutral Sandbox Before Vercel Migration

Date: 2026-05-23

Status: Proposed

Execution update 2026-05-23: E2B source/templates were kept as compatibility. Ignored generated E2B template `node_modules` and build output were removed. Full E2B deletion remains blocked until Vercel Sandbox parity is proven.

## Context

The current runtime is deeply E2B-specific. The target platform should use Vercel Sandbox, but direct delete/replace would break command execution, file IO, previews, terminal/browser behavior, deployment, DB records, and frontend hooks.

## Decision

Introduce a provider-neutral sandbox interface first. Keep E2B behind an adapter until Vercel Sandbox parity is proven.

Provider interface should cover:

- Create/connect.
- Run command.
- Write/read/list files.
- Port preview URL.
- Stop/destroy.
- Status/capabilities.
- Timeout and output limits.

## Consequences

Positive:

- Vercel Sandbox migration becomes testable.
- Workflow executor does not depend on provider SDK objects.
- Fake provider can power deterministic tests.
- E2B can remain as fallback during migration.

Negative:

- Temporary adapter layer adds code.
- Some provider-specific behavior must be modeled as optional capabilities.

## Acceptance Criteria

- Fake provider contract tests pass.
- E2B provider passes existing smoke behavior.
- Vercel Sandbox proof can run without changing workflow executor code.
- DB records store provider-neutral fields.
- E2B source deletion happens only after live code imports, DB reads, frontend hooks, and old sessions no longer require E2B-specific behavior.
