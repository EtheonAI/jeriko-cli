# MADR-072: Build `@repo/connectors` Around Current Composio Sessions

Date: 2026-05-26

Status: Accepted

Amends: [MADR-070](./MADR-070-separate-connectors-from-ai-platform-tools.md)

## Context

The platform needs external app connections, connector toolkits/actions, manual and in-chat auth, connected-account status, triggers, and raw connector execution. The user specifically asked to check Composio's old Tool Router beta blog because Rube used this style of dynamic tool selection.

Current Composio docs show the beta surface has graduated. The current implementation model is session-first:

```text
new Composio()
-> composio.create(userId)
-> session.tools() or session.mcp.url
-> meta tools search/auth/execute app tools at runtime
```

## Sources Checked

| Source                                                                            | Type                   | Checked Date | Evidence Used                                                                                                                                                                      |
| --------------------------------------------------------------------------------- | ---------------------- | -----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `https://composio.dev/blog/introducing-tool-router-%28beta%29`                    | Official blog          |   2026-05-26 | Blog now says Tool Router is GA and points to docs; it frames Rube-style dynamic tool routing.                                                                                     |
| `https://docs.composio.dev/llms-full.txt`                                         | Official AI-agent docs |   2026-05-26 | Current TypeScript guidance uses `composio.create(user_id)` and `session.tools()` / `session.mcp.url`; direct `tools.get/execute` is discouraged unless explicitly needed.         |
| `https://docs.composio.dev/docs/how-composio-works`                               | Official docs          |   2026-05-26 | Sessions scope user ID, tool access, auth, connected accounts, execution state, native tools, MCP URL, and workbench files; sessions can be reused with `composio.use(sessionId)`. |
| `https://docs.composio.dev/docs/configuring-sessions`                             | Official docs          |   2026-05-26 | Sessions support toolkit allow/deny, auth configs, connected account selection, workbench config, and `session.toolkits()` connection status.                                      |
| `https://docs.composio.dev/docs/sessions-vs-direct-execution`                     | Official docs          |   2026-05-26 | Sessions are recommended by default; direct execution is for full control over selected tools and execution timing.                                                                |
| `https://docs.composio.dev/docs/authentication`                                   | Official docs          |   2026-05-26 | Connect Links, auth configs, scopes, connected accounts, token refresh, in-chat auth, and manual auth are connector lifecycle concerns.                                            |
| `https://docs.composio.dev/reference/sdk-reference/typescript/connected-accounts` | Official SDK reference |   2026-05-26 | Connected accounts can be listed, linked, waited on, refreshed, enabled, disabled, and deleted.                                                                                    |
| `https://docs.composio.dev/reference/sdk-reference/typescript/triggers`           | Official SDK reference |   2026-05-26 | Triggers support create/list/enable/disable/delete and webhook/event subscription surfaces.                                                                                        |
| `https://docs.composio.dev/docs/providers/vercel`                                 | Official docs          |   2026-05-26 | `@composio/vercel` can produce AI SDK-format tools with built-in execution.                                                                                                        |
| `pnpm view @composio/core ... --registry https://registry.npmjs.org`              | Registry metadata      |   2026-05-26 | Latest `@composio/core` is `0.10.0`; peer supports Zod v3/v4.                                                                                                                      |
| `pnpm view @composio/vercel ... --registry https://registry.npmjs.org`            | Registry metadata      |   2026-05-26 | Latest `@composio/vercel` is `0.9.2`; peers support AI SDK v5/v6 and core `>=0.10.0 <1.0.0`.                                                                                       |

## Decision

Create `packages/connectors` as `@repo/connectors`.

The package will own:

- provider-neutral connector contracts;
- package-local connector env keys;
- Composio client/session adapter;
- manual auth and connected-account helpers;
- session-first toolkit/tool discovery;
- explicit direct execution for policy-wrapped platform tools;
- trigger lifecycle and connector event normalization;
- deterministic mock connector adapter for tests.

Use Composio sessions as the default execution model.

Use direct execution only behind `@repo/ai/tools` platform policy when we need exact tool selection, approval, audit, idempotency, lower latency, or deterministic `.flow` tool mapping.

Do not add `@composio/vercel` in this package yet. That provider emits AI SDK tools with built-in execution. It is useful later, but it must be introduced through `@repo/ai/tools` after permission/risk/approval filtering exists.

## Boundary

```text
apps/app route handlers
  -> @repo/connectors

@repo/ai/tools
  -> @repo/connectors
  -> @composio/core

@repo/flow
  -> stable tool IDs/types only
```

Forbidden:

```text
apps/* -> @composio/*
@repo/ai -> @composio/*
@repo/flow -> @composio/*
```

Exception:

```text
packages/connectors -> @composio/core
```

## Consequences

Positive:

- Preserves the Rube/Tool Router idea without copying a stale beta API.
- Keeps OAuth, connected accounts, and Composio SDK code out of app routes.
- Lets workflow/platform policy wrap side effects before any connector action runs.
- Gives tests a mock adapter before real provider integration.

Tradeoffs:

- `@repo/ai/tools` still needs a later policy bridge before workflows can use connector actions.
- Session IDs, connected-account IDs, and MCP metadata are sensitive server references and must not be exposed casually to clients.
- Composio Workbench is not the same as our workflow sandbox; Vercel Sandbox remains under `@repo/sandbox`.

## Implementation Checklist

- [x] Add `packages/connectors/package.json`.
- [x] Add `@composio/core@0.10.0`, `@t3-oss/env-nextjs@0.13.11`, `zod@4.4.3`, and `server-only`.
- [x] Do not add `@composio/vercel` until the platform-tool AI SDK bridge is policy-wrapped.
- [x] Add package-local T3 Env keys for `COMPOSIO_API_KEY`.
- [x] Add provider-neutral contracts for sessions, toolkits, actions, auth requests, connected accounts, execution, triggers, and events.
- [x] Add server-only Composio adapter using `composio.create`, `composio.use`, `session.authorize`, `session.toolkits`, `session.search`, `session.execute`, connected accounts, and triggers.
- [x] Add mock adapter with deterministic session/auth/execute/trigger behavior.
- [x] Add direct connector adapter factory for first-class provider integrations.
- [x] Add tests under package-level `tests/` for session create/use, auth/wait, execution, trigger lifecycle, and event normalization.
- [x] Add dependency-cruiser rule blocking direct `@composio/*` imports outside `packages/connectors`.
- [x] Add package to root Vitest projects and root `pnpm test`.
- [x] Validate package typecheck, package tests, active package typechecks, app/web typechecks, root tests, and dependency-cruiser.
