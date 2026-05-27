# MADR-075: Keep `@repo/ai` as a core AI SDK and platform-tool package

Status: Accepted

Date: 2026-05-26

## Context

The first AI package cleanup removed the dead agent-service runtime, but the package still carried a large product UI layer: canvas, browser panes, terminal panes, code/file preview views, planner widgets, provider hooks, and old Manus/E2B terminology.

The current app has no active imports of `@repo/ai` outside the package itself. That means keeping salvage UI in this package creates confusion without serving a current consumer.

Official AI SDK v6 docs show a clear package responsibility split:

- AI SDK Core owns model calls, tools, tool approval, agents, and model/UI message conversion.
- AI SDK UI owns framework hooks and message parts for app-level chat surfaces.
- Application UI should compose those primitives inside the app or a clearly named UI package.

`@repo/ai` should therefore be infrastructure, not the old Manus workbench.

## Decision

Reset `@repo/ai` to a core package.

Keep:

- explicit AI SDK v6 re-exports that the platform chooses to centralize;
- `ToolLoopAgent` and `stepCountIs` from AI SDK v6;
- server-side message helpers that delegate to AI SDK `convertToModelMessages`;
- server-only `@repo/ai/tools`;
- connector-to-AI-SDK bridge code that wraps `@repo/connectors` with platform risk, permission, and approval policy;
- schema-only platform tool definitions with AI SDK `inputSchema` for runtime handoff.

Remove from `@repo/ai`:

- canvas/workbench UI;
- browser/terminal/code/file preview panels;
- chat/input/message React components;
- React hooks and providers;
- assistant-ui adapters;
- custom stream/cache/transport/message type layers;
- old SSE processors and custom stream writers;
- legacy `lib` directory layout;
- UI tests that only validated deleted salvage.

Future placement:

- app-specific canvas/workbench UI belongs in `apps/app` route-local `_components` once the new product experience is specified;
- reusable product-agnostic primitives belong in `@repo/design-system`;
- a future reusable AI workbench package can be created only if there are multiple real consumers and a documented contract.

## Consequences

Positive:

- `@repo/ai` stops being a mixed UI/runtime dumping ground.
- The package becomes small enough to audit and upgrade confidently.
- React, assistant-ui, Monaco, Konva, Shiki, markdown rendering, and app workbench dependencies leave the core AI package.
- Vercel Sandbox UI can be rebuilt against `@repo/sandbox` and app route contracts instead of carrying old E2B/Neko assumptions.
- Public exports become honest and package ownership matches the monorepo package-first standard.

Negative:

- Old imports from `@repo/ai/components`, `@repo/ai/hooks`, and `@repo/ai/providers` intentionally break.
- Existing canvas/workbench salvage is deleted instead of preserved in package history.
- Product UI must be rebuilt deliberately in the app when needed.

## Evidence

- Local consumer scan found no active app/non-AI package imports of `@repo/ai`.
- `packages/ai/components` contained roughly 94 component files and product workbench concerns.
- AI SDK v6 docs document `inputSchema` for tools and optional `execute` for queue/runtime handoff.
- AI SDK v6 docs document `ToolLoopAgent` as the current reusable agent configuration class.
- AI SDK UI docs show `useChat` as an app-level hook with `DefaultChatTransport`; the app can use that directly when it owns the chat UI.
- Assistant UI docs support `ExternalStoreRuntime` when an app owns message state, but there is no active app consumer requiring that adapter today.

## Validation Checklist

- [ ] `@repo/ai` package exports point only at existing `src` files.
- [ ] `@repo/ai` no longer exports React component, hook, or provider subpaths.
- [ ] `@repo/ai` no longer depends on React, assistant-ui, Monaco, Konva, Shiki, markdown rendering, or design-system packages.
- [ ] `@repo/ai/tools` remains server-only.
- [ ] AI SDK tool definitions use `inputSchema`, not v5 `parameters`.
- [ ] Tests live under `packages/ai/tests`.
- [ ] `pnpm --filter @repo/ai typecheck` passes.
- [ ] `pnpm exec vitest run --project @repo/ai` passes.
- [ ] `pnpm boundaries:cruise --focus packages/ai` passes with no errors/warnings.
