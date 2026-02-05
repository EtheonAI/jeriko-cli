# Connector Service Instructions

## Overview

The connector service (`services/connector/`) manages third-party app integrations via Composio. Composio provides 500+ pre-built app integrations (Google Drive, GitHub, Slack, Notion, Linear, Jira, Salesforce, etc.) with OAuth handling, token management, and tool execution. This is a CRITICAL integration -- it transforms Rubic from a chatbot into an agent that can act on external services.

**Port:** 4009 (configurable via `PORT` env var)
**Framework:** Node.js / Fastify
**Status:** Pure stub. 141 lines with hardcoded 5 connectors and TODO comments everywhere.

---

## Current File Structure

```
services/connector/src/
  index.ts              # 141 lines - 8 endpoints, all stubs
```

---

## Current Endpoints (All Stubs)

| Method                                        | Path | Status                                                                   | Returns |
| --------------------------------------------- | ---- | ------------------------------------------------------------------------ | ------- |
| `GET /connectors`                             | STUB | Hardcoded 5 connectors (Google Drive, GitHub, Slack, Notion, Confluence) |
| `GET /users/:userId/integrations`             | STUB | Returns `{ integrations: [] }`                                           |
| `GET /connectors/:connectorId/oauth/start`    | STUB | Returns fake OAuth URL                                                   |
| `GET /connectors/:connectorId/oauth/callback` | STUB | Returns random integration ID                                            |
| `DELETE /integrations/:id`                    | STUB | Returns `{ deleted: true }`                                              |
| `POST /integrations/:id/sync`                 | STUB | Returns random sync ID                                                   |
| `GET /integrations/:id/sync/status`           | STUB | Returns `{ status: "idle" }`                                             |
| `GET /integrations/:id/data`                  | STUB | Returns `{ items: [] }`                                                  |

---

## Database Tables

From `packages/database/src/schema/connectors.ts`:

### `connector_definitions`

Available connector types in the marketplace.

- `type` - Unique string identifier (e.g., "gmail", "github", "slack")
- `name`, `description`, `icon`, `category` (communication, storage, productivity, development, crm, analytics)
- `authType` - "oauth2" | "api_key" | "basic" | "custom"
- `oauthConfig` (JSONB) - `{ authUrl, tokenUrl, scopes, clientId }`
- `capabilities` (JSONB) - String array of what this connector can do
- `isEnabled`, `isPremium`

### `user_connectors`

User's installed/connected integrations.

- `userId`, `connectorDefinitionId`, `organizationId`
- `status` - "connected" | "disconnected" | "error" | "pending" | "syncing"
- `accessToken`, `refreshToken`, `tokenExpiresAt` (OAuth tokens - must be encrypted)
- `apiKey` (for API key auth)
- `credentials` (JSONB) - Additional auth data
- `syncEnabled`, `syncInterval` (seconds, default 3600), `lastSyncAt`
- `lastSyncStatus` - "success" | "failed" | "partial"
- `config` (JSONB) - `{ selectedFolders, selectedChannels, selectedRepos, syncDirection }`

### `connector_sync_logs`

History of sync operations.

- `userConnectorId`, `status` ("started" | "success" | "failed" | "partial")
- `itemsSynced`, `itemsFailed`, `errorMessage`
- `startedAt`, `completedAt`

---

## What Needs to Be Built

### 1. Composio Client Setup

Install `composio-core` and initialize the client:

```typescript
import { Composio } from "composio-core";

const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY!,
});
```

**Environment variables needed:**

- `COMPOSIO_API_KEY` - Composio API key
- `COMPOSIO_BASE_URL` - Composio API base URL (optional, for self-hosted)

### 2. List Available Connectors

Replace the hardcoded connector list:

```typescript
app.get("/connectors", async (request, reply) => {
  // Option A: Fetch from Composio API (dynamic, always up-to-date)
  const apps = await composio.apps.list();

  // Option B: Fetch from our connector_definitions table (curated, faster)
  const definitions = await db
    .select()
    .from(connectorDefinitions)
    .where(eq(connectorDefinitions.isEnabled, true))
    .orderBy(connectorDefinitions.category);

  // Option C: Hybrid -- sync Composio apps to our table periodically
  return { connectors: definitions };
});
```

Recommendation: Use Option C (hybrid). On service startup or via a periodic job, sync the Composio app catalog to the `connector_definitions` table. This gives you control over which connectors are shown and lets you add metadata (icons, categories, premium flags).

### 3. OAuth Flow via Composio

Composio handles the entire OAuth flow. Replace the stub OAuth endpoints:

**Start OAuth:**

```typescript
app.get("/connectors/:connectorId/oauth/start", async (request, reply) => {
  const { connectorId } = request.params as { connectorId: string };
  const { redirectUri, userId } = request.query as { redirectUri: string; userId: string };

  // 1. Look up connector definition
  const [definition] = await db
    .select()
    .from(connectorDefinitions)
    .where(eq(connectorDefinitions.type, connectorId))
    .limit(1);

  if (!definition) {
    return reply.status(404).send({ error: "Connector not found" });
  }

  // 2. Create a pending user_connector record
  const [userConnector] = await db
    .insert(userConnectors)
    .values({
      userId,
      connectorDefinitionId: definition.id,
      status: "pending",
    })
    .returning();

  // 3. Initiate Composio connection
  const connectionRequest = await composio.connectedAccounts.initiate({
    appName: connectorId, // e.g., "github", "slack"
    entityId: userId, // Composio uses this to track the user
    redirectUrl: redirectUri,
  });

  return {
    authUrl: connectionRequest.redirectUrl,
    connectionId: connectionRequest.connectionId,
    userConnectorId: userConnector.id,
  };
});
```

**OAuth Callback:**

```typescript
app.get("/connectors/:connectorId/oauth/callback", async (request, reply) => {
  const { connectorId } = request.params as { connectorId: string };
  const { code, state, connectionId } = request.query as {
    code: string;
    state: string;
    connectionId: string;
  };

  // 1. Complete the OAuth flow via Composio
  const connection = await composio.connectedAccounts.get({ connectionId });

  if (connection.status === "ACTIVE") {
    // 2. Update user_connector status
    await db
      .update(userConnectors)
      .set({
        status: "connected",
        // Store tokens if Composio exposes them (usually it manages them)
        lastSyncAt: null,
      })
      .where(eq(userConnectors.id, state)); // state contains userConnectorId

    return { status: "connected", connectionId };
  }

  return { status: connection.status };
});
```

### 4. Get User's Connected Integrations

```typescript
app.get("/users/:userId/integrations", async (request, reply) => {
  const { userId } = request.params as { userId: string };

  const integrations = await db
    .select({
      connector: userConnectors,
      definition: connectorDefinitions,
    })
    .from(userConnectors)
    .innerJoin(
      connectorDefinitions,
      eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
    )
    .where(eq(userConnectors.userId, userId));

  return { integrations };
});
```

### 5. List Available Tools Per Connected App

This is the bridge between connectors and the agent service. Each connected app exposes tools that the agent can use.

```typescript
app.get("/integrations/:id/tools", async (request, reply) => {
  const { id } = request.params as { id: string };

  // 1. Get the user connector
  const [connector] = await db
    .select({
      connector: userConnectors,
      definition: connectorDefinitions,
    })
    .from(userConnectors)
    .innerJoin(
      connectorDefinitions,
      eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
    )
    .where(eq(userConnectors.id, id))
    .limit(1);

  if (!connector || connector.connector.status !== "connected") {
    return reply.status(404).send({ error: "Integration not connected" });
  }

  // 2. Get available tools from Composio
  const tools = await composio.tools.list({
    apps: [connector.definition.type], // e.g., "github"
  });

  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      appName: connector.definition.type,
    })),
  };
});
```

### 6. Execute Composio Tool

When the agent service needs to use a connected app's tool:

```typescript
app.post("/integrations/tools/execute", async (request, reply) => {
  const {
    userId,
    toolName,
    arguments: args,
    appName,
  } = request.body as {
    userId: string;
    toolName: string;
    arguments: Record<string, unknown>;
    appName: string;
  };

  // 1. Get the user's connection for this app
  const [connector] = await db
    .select()
    .from(userConnectors)
    .innerJoin(
      connectorDefinitions,
      eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
    )
    .where(
      and(
        eq(userConnectors.userId, userId),
        eq(connectorDefinitions.type, appName),
        eq(userConnectors.status, "connected")
      )
    )
    .limit(1);

  if (!connector) {
    return reply.status(403).send({ error: "App not connected" });
  }

  // 2. Execute the tool via Composio
  const result = await composio.tools.execute({
    toolName,
    entityId: userId,
    arguments: args,
  });

  return { success: true, result };
});
```

### 7. Disconnect Integration

```typescript
app.delete("/integrations/:id", async (request, reply) => {
  const { id } = request.params as { id: string };

  const [connector] = await db
    .select()
    .from(userConnectors)
    .where(eq(userConnectors.id, id))
    .limit(1);

  if (!connector) {
    return reply.status(404).send({ error: "Integration not found" });
  }

  // 1. Revoke connection in Composio
  try {
    await composio.connectedAccounts.delete({
      connectionId: connector.metadata?.composioConnectionId,
    });
  } catch (err) {
    logger.warn({ err, id }, "Failed to revoke Composio connection");
  }

  // 2. Delete from database
  await db.delete(userConnectors).where(eq(userConnectors.id, id));

  return { deleted: true };
});
```

### 8. Sync Integration Data

For connectors that sync data (e.g., Google Drive files, GitHub repos):

```typescript
app.post("/integrations/:id/sync", async (request, reply) => {
  const { id } = request.params as { id: string };

  // 1. Create sync log entry
  const [syncLog] = await db
    .insert(connectorSyncLogs)
    .values({
      userConnectorId: id,
      status: "started",
    })
    .returning();

  // 2. Update connector status
  await db.update(userConnectors).set({ status: "syncing" }).where(eq(userConnectors.id, id));

  // 3. Start async sync (don't block the response)
  performSync(id, syncLog.id).catch((err) => {
    logger.error({ err, id }, "Sync failed");
  });

  return { syncId: syncLog.id, status: "syncing" };
});

async function performSync(connectorId: string, syncLogId: string) {
  try {
    // Fetch data from connected app via Composio
    // Store relevant items in knowledge base or other tables
    // Update sync log with results
    await db
      .update(connectorSyncLogs)
      .set({
        status: "success",
        itemsSynced: itemCount,
        completedAt: new Date(),
      })
      .where(eq(connectorSyncLogs.id, syncLogId));

    await db
      .update(userConnectors)
      .set({
        status: "connected",
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
      })
      .where(eq(userConnectors.id, connectorId));
  } catch (err) {
    await db
      .update(connectorSyncLogs)
      .set({
        status: "failed",
        errorMessage: err.message,
        completedAt: new Date(),
      })
      .where(eq(connectorSyncLogs.id, syncLogId));

    await db
      .update(userConnectors)
      .set({
        status: "error",
        lastSyncStatus: "failed",
        lastSyncError: err.message,
      })
      .where(eq(userConnectors.id, connectorId));
  }
}
```

---

## Integration with Agent Service

The agent service at `services/agent/src/routes/tools.py` needs to:

1. When listing tools (`GET /v1/tools`), also fetch the user's available Composio tools by calling `GET /integrations/:id/tools` for each connected integration
2. When the LLM requests a Composio tool, proxy the call to `POST /integrations/tools/execute`
3. The agent tool loop should seamlessly handle both native tools (web_search, execute_code) and Composio tools (gmail.send_email, github.create_issue)

---

## Environment Variables

| Variable            | Default               | Description                            |
| ------------------- | --------------------- | -------------------------------------- |
| `PORT`              | `4009`                | Connector service port                 |
| `COMPOSIO_API_KEY`  | None                  | Composio API key                       |
| `COMPOSIO_BASE_URL` | None                  | Composio API base URL (optional)       |
| `DATABASE_URL`      | (from @repo/database) | PostgreSQL connection                  |
| `ENCRYPTION_KEY`    | None                  | Key for encrypting stored OAuth tokens |
