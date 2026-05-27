# MADR-074: Modernize `@repo/ai` by deleting the dead runtime layer

Status: Accepted

Date: 2026-05-26

## Context

`packages/ai` was inherited from the old Manus-clone phase. It currently mixes current AI SDK dependencies with old agent-service assumptions, E2B naming, custom stream/agent wrappers, UI salvage, and source-local tests.

The current platform direction is package-first:

- `@repo/ai/tools` owns platform-tool policy and AI SDK adapters.
- `@repo/connectors` owns Composio/direct connector sessions and provider SDK details.
- `@repo/sandbox` owns sandbox provider SDKs and Vercel Sandbox execution.
- `@repo/flow` owns workflow language and runtime contracts.

The AI package should not keep an old Python/FastAPI agent-service client or fake direct model runtime.

## Decision

Delete the dead AI runtime layer from `@repo/ai` and make the package use current AI SDK v6 APIs directly where it exposes agent/tool primitives.

Concretely:

- remove the old `JerikoAI` microservice client and `AGENT_SERVICE_URL` package env key;
- remove the custom `JerikoToolLoopAgent` wrapper and re-export AI SDK `ToolLoopAgent` instead;
- remove the broken `createAIStream` fallback that throws before model execution;
- remove the local execution `ToolRegistry` from `lib/tools`;
- keep schema-only legacy tool definitions only as UI/rendering compatibility;
- keep server-only platform tool policy under `@repo/ai/tools`;
- rename active E2B hook exports to provider-neutral sandbox hook exports;
- move package tests under `packages/ai/tests`.

## Consequences

Positive:

- The package stops pretending the removed agent service is the active runtime.
- AI SDK v6 semantics become the source of truth for agents, tools, tool approval, and model messages.
- The export map becomes honest.
- `@repo/ai/tools` remains the only execution-policy surface in this package.
- Tests follow the repo standard.

Negative:

- Old `JerikoAI`, `createAIStream`, `ToolRegistry`, and `useE2B*` imports break if any future code tries to revive them.
- The visual AI/canvas code still needs a deeper component cleanup phase.
- This does not prove Vercel Sandbox UI parity.

## Alternatives Considered

### Keep compatibility exports

Rejected. There are no active external consumers, and keeping dead exports would preserve the confusing API.

### Patch the custom `JerikoToolLoopAgent`

Rejected. AI SDK v6 already ships `ToolLoopAgent`; rebuilding a local wrapper before product requirements are clear creates another runtime to maintain.

### Delete all AI UI/canvas code

Rejected for this phase. The app reset is currently bare, but canvas/file/tool renderers may still be useful salvage. Delete only the dead runtime layer now; clean UI components in a later visual/component phase.

## Evidence

- AI SDK v6 docs list `ToolLoopAgent`, `inputSchema`, `ModelMessage`, async `convertToModelMessages`, and approval/tool-state patterns.
- Installed `ai@6.0.191` types expose `ToolLoopAgent`, `Tool`, `needsApproval`, `DefaultChatTransport`, `ModelMessage`, and `createUIMessageStreamResponse`.
- `pnpm view ai version peerDependencies engines` returned `6.0.191`, Node `>=18`, and Zod peer support for v4.
- `pnpm view @ai-sdk/react version peerDependencies engines` returned `3.0.193`.
- `pnpm view @assistant-ui/react version peerDependencies engines` returned `0.14.9`.
- Local consumer scan found no active `@repo/ai` imports outside `packages/ai`.
- Export audit found missing `./components/thread` and `./lib/react` targets.
- Baseline package validation passed before cleanup, so this is architectural cleanup rather than a build-fix patch.

## Validation Checklist

- [ ] `packages/ai/package.json` no longer exports missing paths.
- [ ] `packages/ai` no longer contains active `AGENT_SERVICE_URL` env access.
- [ ] `packages/ai/lib/agents` delegates to AI SDK v6 instead of a local fake runtime.
- [ ] `packages/ai/lib/server` no longer exports the broken `createAIStream`.
- [ ] `packages/ai/lib/tools` no longer exports a custom execution registry.
- [ ] E2B-named hook exports are replaced with provider-neutral sandbox hook exports.
- [ ] Source-local `__tests__` directories are removed.
- [ ] `pnpm --filter @repo/ai typecheck` passes.
- [ ] `pnpm exec vitest run --project @repo/ai` passes.
- [ ] `pnpm boundaries:cruise --focus packages/ai` has no errors/warnings.
