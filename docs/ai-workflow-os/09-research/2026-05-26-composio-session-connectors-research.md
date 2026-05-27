# Composio Session-First Connectors Research

Date researched: 2026-05-26

## Verdict

Use current Composio sessions as the primary integration model for `@repo/connectors`.

The old Tool Router beta blog is still useful for product intuition because it explains the Rube-style pattern: do not expose every app tool up front; give the agent a small router/meta-tool surface that can search, authenticate, and execute. But the beta API should not be copied. Composio docs now state Tool Router is GA and the current implementation path is sessions.

## Sources

| Source                                                                            | Type                   | Claim                                                                                                                                                                                                                                            | Impact                                                                                                                                 |
| --------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `https://composio.dev/blog/introducing-tool-router-%28beta%29`                    | Official blog          | The blog now has an update saying Tool Router is GA and points to current docs. It also says the feature came from Rube-style dynamic tool selection.                                                                                            | Use the product idea, not the beta API.                                                                                                |
| `https://docs.composio.dev/llms-full.txt`                                         | Official AI-agent docs | Current TypeScript pattern is `new Composio()`, `composio.create(user_id)`, then `session.tools()` or `session.mcp.url`; low-level `tools.get()` / `tools.execute()` are supported but discouraged unless direct execution is explicitly needed. | Build `@repo/connectors` around `create/use` sessions first.                                                                           |
| `https://docs.composio.dev/docs/how-composio-works`                               | Official docs          | A session scopes user ID, enabled toolkits/tools, auth, connected accounts, execution logs/state, MCP URL, native tools, and workbench files. Sessions persist and can be reused with `composio.use(sessionId)`.                                 | Model connector sessions as first-class refs with `userId`, `sessionId`, optional MCP metadata, and scoped toolkit/tool config.        |
| `https://docs.composio.dev/docs/configuring-sessions`                             | Official docs          | Sessions can enable/disable toolkits, preload tools, set auth configs, pin connected accounts, disable/manage workbench, choose sandbox tier, and show toolkit connection status with `session.toolkits()`.                                      | Add session options for toolkit scope, tool scope, auth config refs, connected-account refs, manage-connections, and workbench config. |
| `https://docs.composio.dev/docs/sessions-vs-direct-execution`                     | Official docs          | Sessions give meta tools for runtime discovery/auth/execution; direct execution gives code exact tool schemas and direct `tools.execute()`. Docs recommend sessions unless full control is needed.                                               | Keep `mode: "session"` as default and retain direct execution only for explicit, policy-wrapped platform tools.                        |
| `https://docs.composio.dev/docs/authentication`                                   | Official docs          | Composio supports in-chat auth and manual auth. Auth configs define OAuth/API-key scopes and connected accounts persist under the app's user ID.                                                                                                 | `@repo/connectors` owns Connect Links, connected-account status, and auth config references.                                           |
| `https://docs.composio.dev/docs/authenticating-users/manually-authenticating`     | Official docs          | `session.authorize(toolkit, { callbackUrl })` creates a Connect Link and can wait for connection completion.                                                                                                                                     | Add `authorize()` and `waitForConnection()` to the connector adapter.                                                                  |
| `https://docs.composio.dev/reference/sdk-reference/typescript/connected-accounts` | Official SDK reference | Connected accounts can be listed, fetched, refreshed, enabled, disabled, deleted, linked, and waited on. For Connect Link, use `connectedAccounts.link(userId, authConfigId, { callbackUrl })`.                                                  | Support manual auth by toolkit via session and by auth config via Connect Link.                                                        |
| `https://docs.composio.dev/docs/triggers`                                         | Official docs          | Triggers deliver connected app events to our webhook subscription URL and are scoped to connected accounts.                                                                                                                                      | Keep triggers in `@repo/connectors`, separate from session-native tool execution.                                                      |
| `https://docs.composio.dev/reference/sdk-reference/typescript/triggers`           | Official SDK reference | TypeScript triggers support create, listActive, enable, disable, delete, getType, listTypes, subscribe, and unsubscribe.                                                                                                                         | Add trigger lifecycle methods and event normalization contracts.                                                                       |
| `https://docs.composio.dev/docs/providers/vercel`                                 | Official docs          | `@composio/vercel` transforms Composio tools into Vercel AI SDK tools with built-in execution.                                                                                                                                                   | Do not expose this directly to apps or models yet; platform tools in `@repo/ai/tools` must filter/wrap before model use.               |
| `pnpm view @composio/core ... --registry https://registry.npmjs.org`              | Registry metadata      | Latest `@composio/core` is `0.10.0`; peer supports Zod v3/v4.                                                                                                                                                                                    | Install `@composio/core@0.10.0` in `@repo/connectors`.                                                                                 |
| `pnpm view @composio/vercel ... --registry https://registry.npmjs.org`            | Registry metadata      | Latest `@composio/vercel` is `0.9.2`; peers `ai` v5/v6 and `@composio/core >=0.10.0 <1.0.0`.                                                                                                                                                     | Defer until the platform-tool AI SDK bridge is implemented.                                                                            |

## App Connections Model

Use Composio user IDs from our application database, not emails and never `default` in production.

Connection lifecycle:

1. User asks for a workflow or manually opens integrations settings.
2. App creates or reuses a connector session for the app user.
3. For chat-native auth, session meta tools can prompt with a Connect Link.
4. For explicit onboarding/settings, `session.authorize(toolkitSlug, { callbackUrl })` returns a Connect Link.
5. If an existing auth config must be used, `connectedAccounts.link(userId, authConfigId, { callbackUrl })` creates the Connect Link.
6. When auth completes, Composio creates a connected account linked to our `userId`.
7. Future sessions for the same `userId` can reuse the connected account; specific accounts can be pinned in session config.

## Tool Model

Use sessions for broad autonomous workflows:

```text
composio.create(userId)
-> session.tools()
-> meta tools such as search/manage-connections/multi-execute/workbench
```

Use direct execution only when our platform has already selected a specific tool and applied approval/audit/idempotency policy:

```text
@repo/ai/tools policy gate
-> @repo/connectors direct execute
-> composio.tools.execute(...)
```

This preserves the Rube-style dynamic discovery advantage without allowing raw connector actions to bypass the platform tool layer.

## Trigger Model

Triggers do not become `.flow` runtime behavior directly. They enter the platform as connector events:

```text
Composio trigger webhook
-> @repo/connectors normalizes event
-> @repo/webhooks verifies generic webhook concerns where needed
-> runtime event router maps allowed events into workflow events
```

The connector package owns provider-specific trigger type names, trigger IDs, connected-account IDs, and raw payload normalization. The workflow runtime owns dedupe, routing, and `.flow` event semantics.

## Implementation Checklist

- [x] Verify Tool Router beta is not the implementation target anymore.
- [x] Verify current Composio session APIs.
- [x] Verify app connection/auth flow.
- [x] Verify session versus direct execution tradeoff.
- [x] Verify trigger lifecycle APIs.
- [x] Verify npm latest versions for `@composio/core` and `@composio/vercel`.
- [x] Create `@repo/connectors`.
- [x] Add session-first provider-neutral contracts.
- [x] Add server-only Composio adapter.
- [x] Add deterministic mock adapter.
- [x] Add dependency boundary guard against direct `@composio/*` imports outside the package.
- [x] Put package tests under `packages/connectors/tests`, not `src`.
- [x] Add tests and run validation.

## Open Questions

- Whether to expose an AI SDK-native Composio bridge from `@repo/connectors` or only from `@repo/ai/tools`. Current decision: defer `@composio/vercel` until `@repo/ai/tools` has policy-wrapped execution.
- Whether Composio Workbench should ever be allowed for workflow runtime code execution. Current decision: keep workflow sandbox semantics in `@repo/sandbox` and treat Composio Workbench as connector-specific context/offload only.
