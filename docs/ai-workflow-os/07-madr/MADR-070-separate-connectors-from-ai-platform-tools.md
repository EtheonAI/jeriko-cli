# MADR-070: Separate Connectors From AI Platform Tools

Date: 2026-05-26

Status: Accepted

Amends: [MADR-069](./MADR-069-keep-side-effecting-tools-out-of-generic-ai-ui-code.md)

## Context

The platform has two different "tool" domains:

- connector tools: Composio tools/toolkits, direct API integrations, auth, connected accounts, sessions, triggers, and raw provider actions;
- platform tools: our AI/workflow-visible tool IDs, manifests, permission rules, approval behavior, risk tiers, idempotency, audit, billing, normalized results, and AI SDK tool adapters.

These should be separated, but platform tools should remain in `@repo/ai/tools`, not in a new `@repo/tools` package.

## Sources Checked

| Source                                                     | Type          | Checked Date | Evidence Used                                                                                                                                                 |
| ---------------------------------------------------------- | ------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.composio.dev/docs/how-composio-works          | Official docs |   2026-05-26 | Sessions scope user ID, enabled toolkits/tools, auth, connected accounts, execution logs/state, native tools, MCP URL, and session reuse.                     |
| https://docs.composio.dev/docs/tools-and-toolkits          | Official docs |   2026-05-26 | Toolkits are service action collections; tools are individual app actions with input/output schemas; meta tools search, inspect, auth, and execute app tools. |
| https://docs.composio.dev/docs/authentication              | Official docs |   2026-05-26 | Connect Links, auth configs, OAuth/API key credentials, scopes, and connected accounts are connector lifecycle concerns.                                      |
| https://docs.composio.dev/docs/triggers                    | Official docs |   2026-05-26 | Triggers send connected app events to our webhook subscription URL and are scoped to connected accounts.                                                      |
| https://docs.composio.dev/docs/providers/vercel            | Official docs |   2026-05-26 | Composio can produce AI SDK-format tools with built-in execution; platform tools must filter/wrap these before model use.                                     |
| https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling | Official docs |   2026-05-26 | AI SDK tools may include `execute`, run automatically by default, and can require approval for sensitive operations.                                          |

## Decision

Use this split:

```text
@repo/connectors
  Composio tools/toolkits, direct API integrations, connector auth/session/trigger lifecycle

@repo/ai/tools
  our platform tools, AI SDK adapters, permission/risk/approval/audit/idempotency policy
```

Do not create a separate `@repo/tools` package.

`@repo/connectors` owns:

- Composio SDK integration.
- Composio toolkits/tools as connector actions.
- Direct provider API integrations.
- Auth configs, Connect Links, connected-account references, sessions, and connection status.
- Trigger discovery/subscription helpers and connector event normalization.
- Raw connector action execution primitives.
- Mock connector provider for tests.

`@repo/ai/tools` owns:

- Stable AI/workflow-visible tool IDs used by `.flow`.
- Tool manifests and typed input/output contracts.
- Permission, risk, approval, idempotency, billing, and audit metadata.
- AI SDK tool adapter creation.
- Policy gates before execution.
- Normalized platform tool results.
- Delegation to `@repo/connectors` for external app actions.
- Delegation to internal packages such as `@repo/sandbox`, `@repo/search`, `@repo/storage`, or future `@repo/artifacts`.

Dependency direction:

```text
@repo/ai/tools
  -> @repo/connectors
  -> provider SDKs such as @composio/core

@repo/ai/tools
  -> @repo/sandbox / @repo/search / @repo/storage

@repo/flow
  -> stable tool IDs/types only
```

`@repo/ai/tools` must be a server-only subpath and must not import AI UI/chat components.

Example:

```text
.flow uses: github.create_issue

@repo/ai/tools manifest:
  id: github.create_issue
  permission: external_project_write
  approval: required_if_public_project
  connector: composio
  connectorAction: GITHUB_CREATE_ISSUE

@repo/connectors:
  resolves Composio session/connected account
  executes GITHUB_CREATE_ISSUE

@repo/ai/tools:
  records approval/audit/idempotency/billing
  returns normalized tool result
```

## Consequences

Positive:

- Keeps platform tools where requested: inside `@repo/ai/tools`.
- Keeps connector/toolkit/API integration complexity out of `@repo/ai/tools`.
- Avoids a confusing catch-all `@repo/tools` package.
- Allows Composio, direct APIs, and internal packages to be used through one platform tool policy layer.

Tradeoffs:

- `@repo/ai` must be internally segmented strictly; `@repo/ai/tools` cannot import UI/chat/browser code.
- Dependency-cruiser rules must enforce provider SDK imports only in `@repo/connectors`.
- Workflow runtime code that uses `@repo/ai/tools` must avoid pulling AI UI/model dependencies through broad barrels.

## Rules

- Do not create `@repo/tools`.
- Put platform tools in `@repo/ai/tools`.
- Put Composio tools/toolkits and direct API integrations in `@repo/connectors`.
- Do not import `@composio/*` from apps, `@repo/flow`, or `@repo/ai/tools`.
- Do not expose raw connector tools directly to the model or workflow runtime.
- Do not put connector OAuth/session/connected-account lifecycle in `@repo/ai/tools`.
- Keep `@repo/ai/tools` server-only and isolated from `@repo/ai/components`.

## Implementation Checklist

- [x] Create `packages/connectors` as `@repo/connectors`.
- [x] Add package-local T3 Env keys for `COMPOSIO_API_KEY` and optional connector feature config.
- [x] Install `@composio/core@0.10.0` in `@repo/connectors`.
- [x] Defer `@composio/vercel@0.9.2` until a connector-side AI SDK bridge is needed by `@repo/ai/tools`.
- [x] Define connector contracts: provider, action, toolkit, connection status, session ref, trigger, connector event.
- [x] Implement mock connector provider first.
- [x] Implement Composio connector provider behind server-only exports.
- [ ] Reorganize legacy `packages/ai/lib/tools` into `@repo/ai/tools`.
- [ ] Add tool manifest/policy/executor contracts inside `@repo/ai/tools`.
- [ ] Make `@repo/ai/tools` call `@repo/connectors`; never the reverse.
- [ ] Add dependency-cruiser guards for provider SDK imports and `@repo/ai/tools` server-only boundaries.
- [ ] Validate package typechecks, tests, graph, and app typechecks after scaffolding.
