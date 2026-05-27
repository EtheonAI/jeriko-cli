# MADR-077: Segment `@repo/ai` by AI SDK capability

Status: Accepted

Date: 2026-05-26

## Context

After deleting the old UI/workbench layer, `@repo/ai` needed a clean senior package shape that still exposes the AI SDK capabilities the platform will use.

The platform needs chat, files, tool calls, approvals, custom data parts, agents, voice-to-text, generated media, provider aliases, retrieval/RAG, telemetry, and test helpers. It does not need a third-party assistant UI abstraction in the core package.

## Decision

Segment `@repo/ai` by AI SDK capability:

- `agents`: agent loops and stop conditions;
- `messages`: UI messages, parts, file conversion, validation, pruning, model conversion;
- `server`: stream responses, UI message streams, stream readers, smooth streams;
- `media`: transcription, downloads, image generation, speech generation;
- `models`: AI Gateway, provider registries, custom providers, model middleware;
- `retrieval`: embeddings, batch embeddings, reranking, cosine similarity;
- `observability`: telemetry integration and stream consumption;
- `testing`: simulated readable streams and streaming middleware;
- `tools`: platform tool policy, connector bridge, and schema-only tool definitions.

Do not add React, assistant UI, canvas, or app workbench UI to this package.

## Consequences

Positive:

- Each AI SDK feature has a discoverable subpath.
- App UI can import only the capability it needs.
- The package remains UI-free and server-safe by default.
- Future model/provider policy can be centralized without scattering model strings.
- Tests can assert the public contract and block accidental UI dependencies.

Negative:

- The package exports mostly thin AI SDK wrappers; this is intentional to keep the platform dependency boundary explicit.
- Some APIs are experimental in AI SDK, such as transcription/speech; production routes must wrap them with product policy before use.

## Evidence

- AI SDK `llms.txt` instructs local coding agents to use targeted docs/search and the AI SDK skill before changing code.
- AI SDK introduction splits the library into Core and UI surfaces.
- AI SDK advanced docs cover stream cancellation/backpressure, rate limiting, model routing, multistep interfaces, and sequential generations.
- AI SDK UI docs expose message parts, tool outputs, approvals, custom data parts, and transport hooks, which allow us to build custom UI.
- AI SDK core docs expose provider registries, model middleware, telemetry, testing utilities, embeddings, reranking, transcription, image generation, and speech generation.
- Installed AI SDK v6 migration docs mark `generateObject` and `streamObject` as deprecated; expose structured-output support through `Output.*` plus `generateText`/`streamText`, not deprecated object helpers.
- Fresh registry checks on 2026-05-26 showed `ai@6.0.191`, `@ai-sdk/react@3.0.193`, and `next@16.2.6`; `pnpm outdated -r --format json` returned `{}` under repo Node `22.22.1`.

## Validation Checklist

- [x] `@repo/ai` exports capability subpaths only.
- [x] `@repo/ai` does not depend on React or third-party assistant UI packages.
- [x] Public API tests cover planned AI SDK capabilities.
- [x] Deprecated AI SDK `streamObject` is not exposed from `@repo/ai`.
- [x] `pnpm --filter @repo/ai typecheck` passes.
- [x] `pnpm exec vitest run --project @repo/ai` passes.
- [x] `pnpm boundaries:cruise --focus packages/ai` passes.
