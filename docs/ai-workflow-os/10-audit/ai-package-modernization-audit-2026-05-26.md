# AI Package Modernization Audit

Date: 2026-05-26

Scope: `packages/ai`

## Audit Commands

```bash
rg --files packages/ai
rg "@repo/ai" apps packages --glob '!packages/ai/**'
pnpm --filter @repo/ai typecheck
pnpm exec vitest run --project @repo/ai
pnpm boundaries:cruise --focus packages/ai
pnpm outdated -r --format json
```

## Current State

`packages/ai` has been reset from the old Manus workbench package into a clean core AI SDK package.

Current shape:

- `src/agents` exposes AI SDK agent primitives such as `ToolLoopAgent` and stop conditions.
- `src/messages` exposes UI message types, message conversion, validation, pruning, and file conversion helpers.
- `src/server` exposes UI/text stream response helpers and server stream utilities.
- `src/media` exposes download, transcription, image, and speech generation helpers.
- `src/models` exposes AI Gateway/provider registry/provider middleware helpers.
- `src/retrieval` exposes embedding, batch embedding, reranking, and similarity helpers.
- `src/observability` exposes telemetry/stream consumption helpers.
- `src/testing` exposes AI SDK testing utilities.
- `src/tools` remains server-only and owns platform tool policy plus the connector bridge.
- Deprecated AI SDK object helpers are not exposed from `@repo/ai`; structured output uses `generateText`/`streamText` with `Output.*`.

## Keep

- Capability subpaths under `src`.
- Server-only `@repo/ai/tools`.
- Schema-only platform tool definitions with AI SDK `inputSchema`.
- Connector bridge that delegates external integration execution to `@repo/connectors` after platform policy.
- Package-level tests under `packages/ai/tests`.

## Refactor Now

- Build the app-local custom AI/workflow UI in `apps/app` when that phase starts.
- Add route-level upload, transcription, approval, and tool-rendering flows in the app, backed by this package's public AI SDK helpers.
- Add persisted audit/idempotency/billing around platform tools before allowing real external side effects.

## Defer

- Vercel Sandbox live browser/terminal route UI.
- Persisted audit/idempotency/billing for tools.
- App-local `@ai-sdk/react` `useChat` integration.
- Typed app-local tool renderer registry.
- `.flow` subagent reporting/cancellation runtime tests.

## Risk

- Because no active app imports old `@repo/ai/components`, `@repo/ai/hooks`, or `@repo/ai/providers`, deleting those exports was acceptable.
- Future UI must not restore old Manus/E2B/canvas assumptions into `@repo/ai`; build app-local UI against `@repo/sandbox`, `@repo/flow`, and AI SDK message parts.
- Some AI SDK APIs exposed by this package are experimental; app routes must wrap them with product policy before production use.

## Checklist

- [x] Baseline package typecheck.
- [x] Baseline package tests.
- [x] Baseline package dependency cruise.
- [x] Latest package registry check.
- [x] Move tests into `packages/ai/tests`.
- [x] Remove dead exports.
- [x] Remove old agent-service provider and env key.
- [x] Replace custom agent wrapper with AI SDK v6 exports.
- [x] Remove broken custom AI stream fallback.
- [x] Remove custom execution tool registry from the old `lib/tools` layer.
- [x] Delete old React UI, canvas, hooks, providers, and assistant-ui adapter from `@repo/ai`.
- [x] Add AI SDK capability subpaths.
- [x] Add public API tests for planned AI SDK features.
- [x] Remove deprecated `streamObject` from the `@repo/ai` public API.
- [x] Verify fresh registry state under repo Node `22.22.1`: `pnpm outdated -r --format json` returned `{}`.
- [x] Re-run package typecheck.
- [x] Re-run package tests.
- [x] Re-run package dependency cruise.
- [x] Re-run full package typecheck.
