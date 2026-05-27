# AI Package Modernization Research

Date: 2026-05-26

Scope: `packages/ai`

## Supersession Note

This note records the first AI package modernization research pass. Its original "keep UI salvage" verdict is superseded by:

- [`MADR-075`](../07-madr/MADR-075-ai-package-is-core-not-workbench-ui.md)
- [`MADR-076`](../07-madr/MADR-076-build-custom-ai-ui-on-vercel-ai-sdk.md)
- [`MADR-077`](../07-madr/MADR-077-segment-ai-package-by-ai-sdk-capability.md)
- [`2026-05-26-ai-sdk-custom-ui-research.md`](./2026-05-26-ai-sdk-custom-ui-research.md)

Current accepted direction: `@repo/ai` is a core AI SDK/platform-tool package, not a React UI/workbench package. Product AI UI starts in `apps/app` route-local folders and composes `@repo/design-system` primitives.

## Sources Checked

| Source                                                             | Type              | Evidence Used                                                                                                                                                                  |
| ------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `https://ai-sdk.dev/docs/introduction`                             | Official docs     | AI SDK v6 is the current docs track and provides Core plus UI surfaces for AI apps and agents.                                                                                 |
| `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`       | Official docs     | Current tool definitions use `inputSchema`; `execute` is optional when calls are forwarded to client/queue/runtime.                                                            |
| `https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0`     | Official docs     | `CoreMessage` was replaced by `ModelMessage`; `convertToModelMessages` is async; `Experimental_Agent` became `ToolLoopAgent`; v6 package family is `ai@^6` and `@ai-sdk/*@^3`. |
| `https://ai-sdk.dev/docs/agents/building-agents`                   | Official docs     | `ToolLoopAgent` is the current multi-step agent class; default loop control is `stopWhen: stepCountIs(20)`.                                                                    |
| `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage`             | Official docs     | AI SDK UI tool rendering is message-part based with typed tool states and client-side approval/output handoff.                                                                 |
| `https://www.assistant-ui.com/docs/runtimes/custom/external-store` | Official docs     | `ExternalStoreRuntime` is correct when the app owns message state; handlers should be stable and messages updated immutably.                                                   |
| `https://vercel.com/docs/vercel-sandbox`                           | Official docs     | Vercel Sandbox is the target for untrusted/user-generated code; provider behavior belongs behind the SDK/package boundary.                                                     |
| `https://vercel.com/docs/vercel-sandbox/sdk-reference`             | Official docs     | Port URLs come from `sandbox.domain(port)` and command/file APIs are SDK/provider concerns, not AI UI concerns.                                                                |
| `pnpm view ai version peerDependencies engines`                    | Registry metadata | Latest `ai` is `6.0.191`; peer `zod` supports v4.                                                                                                                              |
| `pnpm view @ai-sdk/react version peerDependencies engines`         | Registry metadata | Latest `@ai-sdk/react` is `3.0.193`; peer React supports current repo React 19.                                                                                                |
| `pnpm view @assistant-ui/react version peerDependencies engines`   | Registry metadata | Latest `@assistant-ui/react` is `0.14.9`; peer React supports React 18/19.                                                                                                     |
| `pnpm outdated -r --format json`                                   | Registry metadata | Returned `{}` before this phase; no package version upgrade was available at the time of audit.                                                                                |
| Installed `ai@6.0.191` types                                       | Local source      | `ToolLoopAgent`, `ModelMessage`, `DefaultChatTransport`, `createUIMessageStreamResponse`, `Tool.needsApproval`, and `inputSchema` are present.                                 |
| Installed `@assistant-ui/react@0.14.9` types                       | Local source      | `AssistantRuntimeProvider`, `useExternalStoreRuntime`, `ThreadMessageLike`, and `ExternalStoreAdapter` are present.                                                            |

## Current Package Findings

- `packages/ai` has 157 TypeScript/TSX files before cleanup.
- No active app or non-AI package imports `@repo/ai` outside `packages/ai` itself, so public API cleanup is low blast radius right now.
- Baseline validation before edits:
  - `pnpm --filter @repo/ai typecheck` passed.
  - `pnpm exec vitest run --project @repo/ai` passed: 16 files, 469 tests.
  - `pnpm boundaries:cruise --focus packages/ai` reported info-level orphans only: `vitest.setup.ts` and `keys.ts`.
- The package export map contains dead subpaths:
  - `./components/thread` points at missing `components/thread.tsx`.
  - `./lib/react` points at missing `lib/react.ts`.
- The package still exposes old E2B hook names:
  - `./hooks/use-e2b-stream`
  - `./hooks/use-e2b-terminal`
- `lib/jeriko-provider.ts` is an old agent microservice client, reads `process.env.AGENT_SERVICE_URL`, and documents E2B/provider routing that is no longer the target package boundary.
- `lib/agents/tool-loop-agent.ts` is a custom simulated wrapper around AI SDK behavior. It dynamically imports `generateText`, but its own `getModelInstance()` always throws, so it is dead runtime surface.
- `lib/server/ai-stream.ts` has the same issue: it imports AI SDK stream functions, but `getModelInstance()` always throws and comments point to a removed agent proxy.
- `lib/server/convert-messages.ts` uses a local `CoreMessage` type name even though AI SDK v6 replaced that concept with `ModelMessage`.
- `lib/tools/tool-registry.ts` defines a custom execution registry and custom `tool()` helper that conflicts conceptually with AI SDK `tool()` and the newer server-only `@repo/ai/tools` policy layer.
- Tests are split between `packages/ai/tests` and many source-local `__tests__` folders, violating the current repo standard that new package tests live under package-level `tests/`.

## Refactor Verdict

Refactor aggressively inside `packages/ai`, and after the second research pass delete the old AI/workflow UI salvage from this package.

Keep:

- `@repo/ai/tools` connector/platform-tool bridge.
- AI SDK v6 primitives and capability subpaths.
- Server-side message/stream/model/media/retrieval/observability/testing helpers.
- Schema-only platform tool definitions with AI SDK `inputSchema`.

Remove or replace now:

- old `JerikoAI` agent microservice client;
- old `AGENT_SERVICE_URL` AI env contract;
- custom `JerikoToolLoopAgent`;
- broken `createAIStream` direct model fallback;
- custom execution `ToolRegistry` under `lib/tools`;
- dead package exports;
- source-local test directories;
- React components, canvas/workbench UI, hooks, providers, and assistant-ui adapters.

Do not do now:

- full visual restyle;
- Vercel Sandbox browser streaming implementation in the UI;
- persisted audit/idempotency/billing for side-effect tools;
- `.flow` runtime execution wiring;
- app-local chat/composer/upload/voice/tool-renderer implementation.
