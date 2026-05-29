# Connectors Package Playbook

Package: `@repo/connectors`

Date: 2026-05-26

Status: scaffolded and validated

Priority: P0 workflow/runtime package

## Ownership

What this package should own:

- External app integration/connectivity plane.
- Composio SDK integration.
- Direct provider connector clients when a first-class integration needs direct API access.
- Connector/toolkit catalog facts.
- Auth config references, Connect Links, connected-account references, connection status, and connector session references.
- Trigger discovery, subscription helpers, trigger instance lifecycle, and connector event normalization.
- Raw connector action execution primitives.
- Mock connector provider for tests and dry runs.

What this package must not own:

- `.flow` parser/compiler internals; those stay in `@repo/flow`.
- Platform tool permission/risk/approval/idempotency/billing/audit policy; that stays in server-only `@repo/ai/tools`.
- AI chat/model orchestration; that stays in `@repo/ai`.
- AI SDK tool-result UI rendering; that stays in `@repo/ai/components/tools`.
- Sandbox command execution; that stays in `@repo/sandbox`.
- App route handlers; apps own routes and call package APIs.

## Boundary Rule

`@repo/connectors` answers:

```text
Can this user/workflow reach this external app?
Which account/session/auth config is connected?
Which raw external action or trigger exists?
How do we execute or receive that connector event safely at the provider boundary?
```

`@repo/ai/tools` answers:

```text
Is this workflow allowed to use this platform tool?
Does this action need approval?
What is the stable .flow tool ID?
How do we audit, bill, dedupe, and normalize the result?
```

This means `@repo/connectors` may expose connector actions, but those are not automatically platform tools. `@repo/ai/tools` must wrap them before AI or `.flow` can use them.

## Sources Checked

| Source                                                                           | Type                   | Checked Date | Claim Used                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ---------------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://docs.composio.dev/docs/how-composio-works                                | Official docs          |   2026-05-26 | Sessions scope user, enabled toolkits/tools, auth, connected accounts, execution state, native tools, MCP URL, and session reuse.                                                |
| https://docs.composio.dev/docs/tools-and-toolkits                                | Official docs          |   2026-05-26 | Toolkits are service action collections; tools are individual app actions with schemas; meta tools discover, auth, and execute.                                                  |
| https://docs.composio.dev/docs/authentication                                    | Official docs          |   2026-05-26 | Connect Links, auth configs, OAuth/API keys, scopes, and connected accounts are connector lifecycle concerns.                                                                    |
| https://docs.composio.dev/docs/triggers                                          | Official docs          |   2026-05-26 | Triggers deliver connected app events to our webhook URL and are scoped to connected accounts.                                                                                   |
| https://docs.composio.dev/docs/providers/vercel                                  | Official docs          |   2026-05-26 | Composio can expose AI SDK-format tools with built-in execution; platform policy must wrap or filter these before model use.                                                     |
| https://docs.composio.dev/llms-full.txt                                          | Official AI-agent docs |   2026-05-26 | Current integration is `composio.create(user_id)` then `session.tools()` or `session.mcp.url`; low-level direct execution is supported but discouraged unless explicitly needed. |
| https://docs.composio.dev/reference/sdk-reference/typescript/tool-router-session | Official SDK reference |   2026-05-26 | Session methods include `authorize`, `execute`, `search`, `toolkits`, and `tools`.                                                                                               |
| https://docs.composio.dev/reference/sdk-reference/typescript/connected-accounts  | Official SDK reference |   2026-05-26 | Connected accounts can be listed, linked, waited on, refreshed, enabled, disabled, and deleted.                                                                                  |
| https://docs.composio.dev/reference/sdk-reference/typescript/triggers            | Official SDK reference |   2026-05-26 | Trigger lifecycle includes create, listActive, enable, disable, delete, and subscription surfaces.                                                                               |
| [MADR-070](../../07-madr/MADR-070-separate-connectors-from-ai-platform-tools.md) | Repo decision          |   2026-05-26 | Platform tools live in `@repo/ai/tools`; connector tools/toolkits and direct API integrations live in `@repo/connectors`.                                                        |
| [MADR-072](../../07-madr/MADR-072-composio-session-first-connectors-package.md)  | Repo decision          |   2026-05-26 | Use Composio sessions as the default connector model; defer `@composio/vercel` until platform-tool policy wrapping exists.                                                       |
| `pnpm view @composio/core ...`                                                   | Registry metadata      |   2026-05-26 | Latest `@composio/core` is `0.10.0`; peer supports Zod v3/v4.                                                                                                                    |
| `pnpm view @composio/vercel ...`                                                 | Registry metadata      |   2026-05-26 | Latest `@composio/vercel` is `0.9.2`; peer supports AI SDK v5/v6 and core `>=0.10.0 <1.0.0`.                                                                                     |
| `pnpm view composio-core ...`                                                    | Registry metadata      |   2026-05-26 | `composio-core` is deprecated and must not be used.                                                                                                                              |

## Target Public Exports

Candidate exports:

```text
@repo/connectors
@repo/connectors/contracts
@repo/connectors/keys
@repo/connectors/mock
@repo/connectors/composio
@repo/connectors/direct
@repo/connectors/triggers
@repo/connectors/events
```

Server-only exports:

- `@repo/connectors/composio`
- `@repo/connectors/direct`
- `@repo/connectors/triggers`

## Implementation Checklist

- [x] Add package scaffold with TypeScript, Vitest, T3 Env, and dependency-cruiser guard.
- [x] Install `@composio/core@0.10.0`.
- [x] Do not install deprecated `composio-core`.
- [x] Defer `@composio/vercel@0.9.2` until a policy-wrapped AI SDK bridge is implemented by `@repo/ai/tools`.
- [x] Add package-local `COMPOSIO_API_KEY` env contract.
- [x] Define provider-neutral connector contracts.
- [x] Add mock connector provider first.
- [x] Add Composio connector provider.
- [x] Add direct connector provider interface.
- [x] Add session create/use strategy keyed by user/workflow/run where reuse is needed.
- [x] Add connection status and Connect Link helpers.
- [x] Add trigger lifecycle and connector event normalization.
- [x] Add package-level `tests/` folder for connector tests; do not mix tests into `src/`.
- [x] Add tests for session reuse, auth links, connection status, trigger normalization, and mocked raw action execution.
- [x] Add dependency-cruiser rule blocking apps, `@repo/ai`, and `@repo/flow` from importing `@composio/*` directly.
- [x] Add `@repo/connectors` to root Vitest projects and root `pnpm test`.
- [x] Validate package typecheck, package tests, active package typechecks, app/web typechecks, root tests, and dependency-cruiser.
- [ ] Build app route handlers/settings UI that consume `@repo/connectors`; do not add app-local Composio SDK code.
- [x] Add first `@repo/ai/tools` platform policy bridge before workflows/model calls can execute connector actions.
- [ ] Add persisted audit/idempotency/billing records before production connector actions.
- [ ] Decide later whether `@composio/vercel` belongs behind `@repo/ai/tools`.

## Validation

- [x] `pnpm --filter @repo/connectors typecheck`
- [x] `pnpm exec vitest run --project @repo/connectors`
- [x] `pnpm --filter "./packages/*" typecheck`
- [x] `pnpm test`
- [x] `pnpm --filter app --filter web typecheck`
- [x] `pnpm boundaries:cruise`
- [x] `pnpm outdated -r --format json` returned `{}` after unrelated stale patch versions were refreshed.

## Open Risks

- Do not let connector action execution bypass platform tool policy. `@repo/ai/tools` must approve and audit workflow-visible execution.
- Do not expose hosted MCP URLs, session IDs, connected-account IDs, or provider tokens to the client unless a route-specific security review permits a safe reference.
- Composio workbench is a connector/provider feature, not our workflow sandbox. Keep Vercel Sandbox semantics in `@repo/sandbox`.
- Direct provider connectors must be justified by product criticality, latency, observability, idempotency, scopes, or UX requirements.

## Flow Integration Follow-Up

Package-local plan:

- `packages/connectors/FLOW_CONNECTORS_INTEGRATION_PLAN.md`

Connector actions must become workflow-visible only through `@repo/ai/tools` platform manifests. Raw Composio/direct actions are not `.flow` tools until permission, approval, idempotency, audit, billing, and event normalization are resolved.
