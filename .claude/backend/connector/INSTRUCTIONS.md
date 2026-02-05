# Connector Service Instructions

> VERIFIED against actual codebase -- Feb 2026 audit

## Overview

The connector service (`services/connector/`) manages third-party app integrations via Composio. Composio provides 500+ pre-built app integrations (Google Drive, GitHub, Slack, Notion, Linear, Jira, Salesforce, etc.) with OAuth handling, token management, and tool execution. This is a CRITICAL integration -- it transforms Rubic from a chatbot into an agent that can act on external services.

**Port:** 4009 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify 5
**Status:** Fully implemented. ~700 LOC across 8 source files + 374-line tRPC router. Real Drizzle queries, real Composio integration, working OAuth flow.

---

## Current State -- IMPLEMENTED

### File Structure

```
services/connector/src/
  index.ts                          # 93 lines  - Main entry, registers 5 route modules + health check + error handler + request logging + graceful shutdown
  routes/
    connectors.ts                   # 109 lines - List definitions, get by type, sync Composio catalog
    oauth.ts                        # 166 lines - OAuth start (Composio connectedAccounts.initiate) + callback (verify ACTIVE, update status, redirect)
    integrations.ts                 # 76 lines  - List user integrations with joins, delete/revoke via Composio
    tools.ts                        # 215 lines - Get all user tools, get per-integration tools, execute tool via Composio actions API
    sync.ts                         # 147 lines - Trigger sync, get sync status, get sync history, placeholder performSync()
  lib/
    composio.ts                     # 13 lines  - Lazy-initialized Composio client singleton
    db.ts                           # 23 lines  - Re-exports from @repo/database/service-index (tables, operators, types)
    helpers.ts                      # 18 lines  - Logger + getUserId(request) from x-user-id header
  seed/
    connector-definitions.ts        # Seed script for initial connector definitions (run via `pnpm seed`)
```

**Total service LOC:** ~860

### Implemented Endpoints (All with Real Drizzle Queries)

| Method   | Path                               | What It Does                                                                                                                                                                          |
| -------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/health`                          | Returns `{ status: "ok", service: "connector" }`                                                                                                                                      |
| `GET`    | `/connectors`                      | Lists enabled `connector_definitions` from DB, ordered by category + name                                                                                                             |
| `GET`    | `/connectors/:type`                | Gets a single connector definition by its `type` string                                                                                                                               |
| `POST`   | `/connectors/sync-catalog`         | Fetches Composio `apps.list()`, upserts into `connector_definitions` with `inferCategory()`                                                                                           |
| `GET`    | `/connectors/:type/oauth/start`    | Looks up definition, checks for existing connection (409), creates pending `user_connector`, calls `composio.connectedAccounts.initiate()`, stores Composio connection ID in metadata |
| `GET`    | `/connectors/:type/oauth/callback` | Receives `connected_account_id` from Composio, verifies ACTIVE status via `composio.connectedAccounts.get()`, updates `user_connector` status, redirects to `/settings/integrations`  |
| `GET`    | `/users/:userId/integrations`      | Joins `user_connectors` + `connector_definitions`, returns all for user, ordered by `createdAt` desc                                                                                  |
| `DELETE` | `/integrations/:id`                | Looks up Composio connection ID from metadata, calls `composio.connectedAccounts.delete()`, deletes from DB                                                                           |
| `GET`    | `/users/:userId/tools`             | Gets user's connected integrations, fetches `composio.actions.list()` for all connected app names, returns mapped tools                                                               |
| `GET`    | `/integrations/:id/tools`          | Gets tools for a single integration via `composio.actions.list()` for that app                                                                                                        |
| `POST`   | `/tools/execute`                   | Extracts app name from tool name convention (`GITHUB_CREATE_ISSUE` -> `github`), verifies user has app connected, calls `composio.actions.execute()` with `connectedAccountId`        |
| `POST`   | `/integrations/:id/sync`           | Creates `connector_sync_logs` entry, sets status to `syncing`, fires async `performSync()`                                                                                            |
| `GET`    | `/integrations/:id/sync/status`    | Returns integration status + latest sync log                                                                                                                                          |
| `GET`    | `/integrations/:id/sync/history`   | Returns paginated sync log history (default 20, max 100)                                                                                                                              |

### tRPC Router (Frontend)

**File:** `apps/app/lib/trpc/routers/connectors.router.ts` (374 lines)
**All 12 procedures have real Drizzle queries:**

| Procedure         | Type     | What It Does                                                                               |
| ----------------- | -------- | ------------------------------------------------------------------------------------------ |
| `listDefinitions` | query    | Lists enabled connector definitions from DB                                                |
| `list`            | query    | Lists user's installed connectors with definition joins                                    |
| `get`             | query    | Gets single connector by ID with ownership check                                           |
| `install`         | mutation | Creates pending `user_connector` record (checks for existing, validates definition exists) |
| `updateConfig`    | mutation | Updates config/syncEnabled/syncInterval with ownership verification                        |
| `saveTokens`      | mutation | Saves OAuth tokens and sets status to "connected"                                          |
| `disconnect`      | mutation | Sets status to "disconnected", clears tokens                                               |
| `uninstall`       | mutation | Hard-deletes the `user_connector` row                                                      |
| `sync`            | mutation | Creates sync log, sets status to "syncing" (TODO: trigger actual sync job)                 |
| `initializeOAuth` | mutation | Proxies to connector service `GET /connectors/:type/oauth/start` via fetch                 |
| `getTools`        | query    | Proxies to connector service `GET /integrations/:id/tools` via fetch                       |
| `getSyncHistory`  | query    | Fetches `connector_sync_logs` with ownership check, paginated                              |

### Key Implementation Details

**Composio Client** (`lib/composio.ts`): Lazy singleton using `composio-core` v0.5.0. Requires `COMPOSIO_API_KEY` env var.

**Auth**: User ID extracted from `x-user-id` header (set by gateway). The `getUserId()` helper in `lib/helpers.ts` throws 401 if missing.

**OAuth Flow**:

1. Frontend calls tRPC `initializeOAuth({ type: "github" })`
2. tRPC router proxies to connector service `GET /connectors/github/oauth/start`
3. Service creates pending `user_connector`, calls `composio.connectedAccounts.initiate()` with `entityId = userId`
4. Returns `authUrl` -- frontend redirects browser to it
5. After user authorizes, Composio redirects to `GET /connectors/github/oauth/callback?connected_account_id=...`
6. Callback verifies ACTIVE status, updates `user_connector` to "connected", redirects to `/settings/integrations`

**Tool Execution Flow** (agent service integration):

1. Agent service calls `GET /users/:userId/tools` to get all available Composio tools
2. When LLM picks a tool, agent calls `POST /tools/execute` with `{ toolName, arguments }`
3. Service extracts app name from tool name (e.g., `GITHUB_CREATE_ISSUE` -> `github`), verifies user has app connected
4. Executes via `composio.actions.execute()` with the user's `connectedAccountId`

**Catalog Sync**: `POST /connectors/sync-catalog` pulls Composio's full app catalog and upserts into `connector_definitions` with auto-inferred categories (communication, storage, development, crm, analytics, productivity, other).

---

## What Needs Building

### 1. Real Sync Logic (P2)

The `performSync()` function in `routes/sync.ts` is a **placeholder** -- it sleeps 1 second, marks the sync as "success" with `itemsSynced: 0`, and dispatches a webhook event. It does not actually fetch any data.

**What's needed:**

- Fetch data from the connected app via Composio (e.g., list files from Google Drive, list repos from GitHub)
- Store synced items in the knowledge base tables (or a dedicated connector data table)
- Track real `itemsSynced` / `itemsFailed` counts
- Handle pagination for large data sets
- Implement periodic/scheduled sync (via Inngest or cron) based on `syncInterval`

### 2. Token Refresh Handling

The `user_connectors` table has `tokenExpiresAt` but nothing checks it or refreshes tokens. Composio may handle this internally for its managed connections, but:

- Add a check before tool execution: if `tokenExpiresAt` is approaching, refresh via Composio
- Add a background job that scans for expiring tokens and proactively refreshes
- Handle the case where refresh fails (set status to "error", notify user)

### 3. More Detailed Health Check

Current `/health` returns a static `{ status: "ok" }`. Should also check:

- Database connectivity (run a simple query)
- Composio API reachability (ping or lightweight call)
- Return service version and uptime

### 4. Token Encryption

The `user_connectors` table stores `accessToken` and `refreshToken` as plaintext. The schema comments note "encrypted" but no encryption is implemented. If tokens are stored directly (rather than managed entirely by Composio), add:

- Encrypt before insert/update using `ENCRYPTION_KEY` env var
- Decrypt on read
- Currently Composio manages most tokens via `connectedAccountId`, so this is lower priority

### 5. Webhook Events on Connection Changes

The sync routes already dispatch webhook events via `dispatchWebhookEvent()`. Extend to:

- `connector.connected` -- when OAuth callback succeeds
- `connector.disconnected` -- when user disconnects
- `connector.error` -- when connection enters error state

---

## Database Tables

From `packages/database/src/schema/connectors.ts` (185 lines):

### `connector_definitions`

Available connector types in the marketplace.

- `id` (text, PK, CUID2)
- `type` - Unique string identifier (e.g., "gmail", "github", "slack")
- `name`, `description`, `icon` - Display metadata
- `category` - "communication" | "storage" | "productivity" | "development" | "crm" | "analytics" | "other"
- `authType` - "oauth2" | "api_key" | "basic" | "custom"
- `oauthConfig` (JSONB) - `{ authUrl, tokenUrl, scopes, clientId }`
- `capabilities` (JSONB) - String array of what this connector can do
- `isEnabled`, `isPremium`
- `createdAt`, `updatedAt`

### `user_connectors`

User's installed/connected integrations.

- `id` (text, PK, CUID2)
- `userId` -> `users.id` (cascade delete)
- `connectorDefinitionId` -> `connector_definitions.id` (cascade delete)
- `organizationId` -> `organizations.id` (cascade delete, optional)
- `status` - "connected" | "disconnected" | "error" | "pending" | "syncing"
- `accessToken`, `refreshToken`, `tokenExpiresAt` - OAuth tokens
- `apiKey` - For API key auth
- `credentials` (JSONB) - Additional auth data
- `syncEnabled` (default true), `syncInterval` (seconds, default 3600), `lastSyncAt`
- `lastSyncStatus` - "success" | "failed" | "partial"
- `lastSyncError` - Error message from last failed sync
- `config` (JSONB) - `{ selectedFolders, selectedChannels, selectedRepos, syncDirection }`
- `metadata` (JSONB) - Stores `composioConnectionId` and other internal state
- `createdAt`, `updatedAt`

### `connector_sync_logs`

History of sync operations.

- `id` (text, PK, CUID2)
- `userConnectorId` -> `user_connectors.id` (cascade delete)
- `status` - "started" | "success" | "failed" | "partial"
- `itemsSynced`, `itemsFailed`
- `errorMessage`
- `details` (JSONB)
- `startedAt`, `completedAt`

### Relations

- `userConnectors` -> `users`, `connectorDefinitions`, `organizations`
- `connectorSyncLogs` -> `userConnectors`

### Exported Types

`ConnectorDefinition`, `NewConnectorDefinition`, `UserConnector`, `NewUserConnector`, `ConnectorSyncLog`, `NewConnectorSyncLog`

---

## Integration with Agent Service

The tool execution pipeline is fully wired:

1. Agent service calls `GET /users/:userId/tools` to get all Composio tools for a user's connected apps
2. Tools are returned with `{ name, description, parameters, appName, source: "composio" }` shape
3. When the LLM selects a Composio tool, agent calls `POST /tools/execute` with `{ toolName, arguments }`
4. Connector service verifies the user has the app connected, extracts `connectedAccountId` from metadata, and calls `composio.actions.execute()`
5. Result is returned as `{ success, result, error }`

The agent tool loop should seamlessly handle both native tools (web_search, execute_code) and Composio tools (GITHUB_CREATE_ISSUE, GMAIL_SEND_EMAIL) by checking the tool's `source` field.

---

## Environment Variables

| Variable                | Default                 | Description                                                  |
| ----------------------- | ----------------------- | ------------------------------------------------------------ |
| `PORT`                  | `4009`                  | Connector service port                                       |
| `HOST`                  | `0.0.0.0`               | Bind address                                                 |
| `CORS_ORIGIN`           | `*`                     | CORS origin (set to app URL in production)                   |
| `COMPOSIO_API_KEY`      | None (required)         | Composio API key                                             |
| `APP_URL`               | `http://localhost:3000` | App URL for OAuth redirect construction                      |
| `DATABASE_URL`          | (from @repo/database)   | PostgreSQL connection                                        |
| `ENCRYPTION_KEY`        | None                    | Key for encrypting stored OAuth tokens (not yet implemented) |
| `CONNECTOR_SERVICE_URL` | `http://localhost:4009` | Used by tRPC router to proxy requests to connector service   |

---

## Dependencies

From `package.json`:

- `composio-core` ^0.5.0
- `fastify` ^5.2.2
- `@fastify/cors` ^10.0.0
- `@repo/database` (workspace)
- `@repo/service-utils` (workspace) -- provides `createId`, `getEnv`, `requireEnv`, `createLogger`, `dispatchWebhookEvent`
