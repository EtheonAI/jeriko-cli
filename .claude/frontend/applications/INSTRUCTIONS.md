# Applications (App Marketplace / Composio) - Build Instructions

## Current State

### What's ALREADY Working (Backend)

#### Connector Service (`services/connector/src/index.ts`, 93 lines + route modules)

**FULLY IMPLEMENTED** with real DB queries and Composio SDK integration:

**Connectors Routes** (`services/connector/src/routes/connectors.ts`, 109 lines):

- `GET /connectors` - List enabled connector definitions from DB
- `GET /connectors/:type` - Get single definition by type
- `POST /connectors/sync-catalog` - Sync Composio apps to DB (auto-categorization, upsert on conflict)

**OAuth Routes** (`services/connector/src/routes/oauth.ts`, 166 lines):

- `GET /connectors/:type/oauth/start` - Initiate OAuth via Composio
  - Creates pending user_connector record
  - Calls `composio.connectedAccounts.initiate()` with entityId = userId
  - Stores `composioConnectionId` in metadata
  - Returns `authUrl` for frontend to open
- `GET /connectors/:type/oauth/callback` - Handle OAuth callback
  - Verifies connection status (ACTIVE)
  - Updates user_connector status to "connected"
  - Redirects to `/settings/integrations`

**Integration Routes** (`services/connector/src/routes/integrations.ts`, 76 lines):

- `GET /users/:userId/integrations` - List user's integrations with definition join
- `DELETE /integrations/:id` - Revoke via Composio + delete from DB

**Dependencies**: `composio-core` v0.5.0 already installed

#### tRPC Router (`apps/app/lib/trpc/routers/connectors.router.ts`, 374 lines)

**COMPREHENSIVE** with real Drizzle queries:

- `listDefinitions` - List enabled connector definitions, ordered by category + name
- `list` - List user's installed connectors (joins userConnectors with connectorDefinitions)
- `get` - Get single connector by ID (ownership verified)
- `install` - Create userConnector record (duplicate check, status: "pending")
- `updateConfig` - Update config, syncEnabled, syncInterval
- `saveTokens` - Save OAuth accessToken, refreshToken, tokenExpiresAt; status: "connected"
- `disconnect` - Clear tokens, set status: "disconnected"
- `uninstall` - Delete userConnector record
- `sync` - Trigger sync (creates sync log, sets status: "syncing")
- `getSyncHistory` - Get sync logs ordered by startedAt desc
- `initializeOAuth` - Proxies to connector service to get OAuth URL
- `getTools` - Fetches available tools for a connected app (via connector service)

#### Database Schema (`packages/database/src/schema/connectors.ts`, 185 lines)

**connectorDefinitions table** (marketplace catalog):

- `id`, `type` (unique, e.g. "gmail", "slack", "github"), `name`, `description`, `icon`
- `category` (enum: communication/storage/productivity/development/crm/analytics/other)
- `authType` (enum: oauth2/api_key/basic/custom)
- `oauthConfig` (jsonb: { authUrl, tokenUrl, scopes, clientId })
- `capabilities` (jsonb string[])
- `isEnabled`, `isPremium`, `createdAt`, `updatedAt`

**userConnectors table** (installed by user):

- `id`, `userId`, `connectorDefinitionId`, `organizationId`
- `status` (enum: connected/disconnected/error/pending/syncing)
- OAuth: `accessToken`, `refreshToken`, `tokenExpiresAt`
- API Key: `apiKey`, `credentials` (jsonb)
- Sync: `syncEnabled`, `syncInterval`, `lastSyncAt`, `lastSyncStatus`, `lastSyncError`
- `config` (jsonb: selectedFolders, selectedChannels, selectedRepos, syncDirection)
- `metadata`, `createdAt`, `updatedAt`

**connectorSyncLogs table:**

- `id`, `userConnectorId`, `status` (started/success/failed/partial)
- `itemsSynced`, `itemsFailed`, `errorMessage`, `details` (jsonb)
- `startedAt`, `completedAt`

**ConnectorType enum** (35+ types): gmail, outlook, slack, discord, teams, github, gitlab, bitbucket, jira, confluence, notion, linear, asana, trello, google_drive, dropbox, onedrive, box, sharepoint, salesforce, hubspot, pipedrive, google_analytics, mixpanel, amplitude, stripe_connector, quickbooks, xero, mailchimp, sendgrid, twilio, zapier, make_connector, custom_webhook, other

#### Redux State

- `connectors.slice.ts` (8526 bytes) - Manages connector state for the UI

### What's NOT Working (Frontend)

#### Applications Page (`apps/app/app/(authenticated)/applications/page.tsx`, 62 lines)

- **Empty placeholder** with "No applications connected" dashed border
- "Connect app" button in header - **non-functional**
- "Browse applications" button - **non-functional**
- Server component, NO client component exists
- NO sub-components in the directory

---

## What Needs Building

### 1. Applications Page Client Component

**Create:** `apps/app/app/(authenticated)/applications/applications-page-client.tsx`

**Convert** `page.tsx` to wrap this client component.

**Layout:**

```
┌──────────────────────────────────────────────────────────┐
│ [Connected (3)]  [Available (120+)]  [Search...] [Sort] │
├──────────────────────────────────────────────────────────┤
│ Category: [All] [Productivity] [Communication] [Dev]... │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │   [Gmail]   │ │   [Slack]   │ │  [GitHub]   │       │
│  │   Gmail     │ │   Slack     │ │   GitHub    │       │
│  │Communication│ │Communication│ │ Development │       │
│  │ [Connected] │ │ [Connect]   │ │ [Connected] │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │  [Notion]   │ │  [Linear]   │ │  [Stripe]   │       │
│  │   Notion    │ │   Linear    │ │   Stripe    │       │
│  │Productivity │ │Productivity │ │  Finance    │       │
│  │ [Connect]   │ │ [Connect]   │ │ [Connect]   │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Data Fetching:**

```typescript
// Fetch ALL available apps from DB (seeded from Composio)
const { data: definitions } = api.connectors.listDefinitions.useQuery();

// Fetch user's connected apps
const { data: connected } = api.connectors.list.useQuery();

// Merge: mark definitions that user has connected
const apps = definitions?.map((def) => ({
  ...def,
  connection: connected?.find((c) => c.connectorDefinitionId === def.id),
  isConnected: connected?.some(
    (c) => c.connectorDefinitionId === def.id && c.status === "connected"
  ),
}));
```

**Tab Toggle:**

- **Connected**: Shows only user's installed connectors with status indicators
- **Available**: Shows full marketplace grid from `connectorDefinitions`

**Category Filter Pills:**

```
All | Communication | Storage | Productivity | Development | CRM | Analytics | Finance | Marketing | Other
```

Map to `connectorDefinitions.category` enum values.

**Search:** Client-side filter on `name` and `description` fields.

**Sort Options:** Popular (by usage count), A-Z, Recently Added (by createdAt).

### 2. App Card Component

**Create:** `apps/app/app/(authenticated)/applications/components/app-card.tsx`

```tsx
interface AppCardProps {
  definition: ConnectorDefinition;
  connection?: UserConnector; // null if not connected
  onConnect: (type: string) => void;
  onConfigure: (connectionId: string) => void;
  onDisconnect: (connectionId: string) => void;
}
```

**Card Contents:**

- App icon (from `definition.icon` URL or fallback letter avatar)
- App name
- Category badge (color-coded)
- Brief description (truncated to 2 lines)
- Status: "Connected" (green) / "Error" (red) / "Syncing" (yellow) / "Connect" button (neutral)
- Click card → opens config panel or triggers connect

### 3. OAuth Connection Flow (Already Backend-Ready)

The connector service already handles OAuth. Frontend just needs:

```typescript
const connectApp = api.connectors.initializeOAuth.useMutation();

const handleConnect = async (connectorType: string) => {
  // 1. Call tRPC which proxies to connector service
  const { authUrl } = await connectApp.mutateAsync({ type: connectorType });

  // 2. Open popup for OAuth
  const popup = window.open(authUrl, "oauth", "width=600,height=700,popup=true");

  // 3. Listen for popup close / message
  const checkClosed = setInterval(() => {
    if (popup?.closed) {
      clearInterval(checkClosed);
      // 4. Refetch connected apps
      utils.connectors.list.invalidate();
    }
  }, 500);
};
```

**OAuth callback** already handled by connector service at `GET /connectors/:type/oauth/callback` → redirects to `/settings/integrations`.

**For popup-based flow**, create a lightweight callback page:

**Create:** `apps/app/app/api/connectors/callback/route.ts`

```typescript
// Proxy to connector service callback, then close popup:
// After success, render a page that does window.opener.postMessage("oauth-complete") + window.close()
```

### 4. App Configuration Panel

**Create:** `apps/app/app/(authenticated)/applications/components/app-config-panel.tsx`

Opens as a **Sheet** (slide-out panel) or **Dialog** when clicking a connected app.

**Sections:**

#### Connection Status

- Green/Red/Yellow status dot + label
- Connected since: date
- Last synced: relative time
- Connection health check (test the OAuth token)

#### Sync Settings

```typescript
// Uses connectors.updateConfig mutation
<Switch checked={syncEnabled} onCheckedChange={toggle} /> Auto-sync
<Select value={syncInterval}>
  <SelectItem value={900}>Every 15 minutes</SelectItem>
  <SelectItem value={3600}>Every hour</SelectItem>
  <SelectItem value={14400}>Every 4 hours</SelectItem>
  <SelectItem value={86400}>Daily</SelectItem>
  <SelectItem value={0}>Manual only</SelectItem>
</Select>
```

#### Data Selection (per app type)

- **Google Drive**: Folder picker for which folders to sync
- **GitHub**: Repository selector
- **Slack**: Channel selector
- **Gmail**: Label/folder selector
- Config stored in `userConnectors.config` jsonb field

#### Available Actions/Tools

```typescript
const { data: tools } = api.connectors.getTools.useQuery({ connectorId });
// Shows list of actions this app provides to the AI (e.g., "Create Issue", "Send Message")
```

#### Sync History

```typescript
const { data: history } = api.connectors.getSyncHistory.useQuery({ connectorId });
// Table: timestamp, status (success/failed/partial), items synced, errors
```

#### Actions

- **Sync Now** → `connectors.sync.useMutation()`
- **Disconnect** → `connectors.disconnect.useMutation()` with confirmation
- **Reconnect** → Re-trigger OAuth flow
- **Remove** → `connectors.uninstall.useMutation()` with confirmation

### 5. Connected Apps Status Indicators

For the "Connected" tab, show rich status for each app:

| Status         | Visual             | Meaning                           |
| -------------- | ------------------ | --------------------------------- |
| `connected`    | Green dot          | OAuth active, ready               |
| `syncing`      | Yellow pulse       | Sync in progress                  |
| `error`        | Red dot            | Token expired or sync failed      |
| `pending`      | Gray dot           | OAuth flow started, not completed |
| `disconnected` | Gray strikethrough | Explicitly disconnected           |

**Error recovery**: When status is `error`, show "Reconnect" button that re-triggers OAuth.

**Auto-refresh tokens**: When `tokenExpiresAt` is approaching, the connector service should handle token refresh. Frontend shows a warning if token is about to expire.

### 6. Catalog Seeding

Before the marketplace shows apps, `connectorDefinitions` table must be seeded.

**Option A**: Call `POST /connectors/sync-catalog` endpoint once to sync from Composio:

```bash
curl -X POST http://localhost:4004/connectors/sync-catalog
```

This already exists in the connector service and auto-categorizes apps.

**Option B**: Add a seed script in `packages/database/src/seed/`:

```typescript
// Seed popular apps manually for faster page load
const popularApps = [
  { type: "gmail", name: "Gmail", category: "communication", ... },
  { type: "slack", name: "Slack", category: "communication", ... },
  { type: "github", name: "GitHub", category: "development", ... },
  // ... 20-30 popular apps
];
```

**Recommended**: Use Option A (Composio sync) for full catalog + Option B for fallback/initial data.

### 7. AI Tool Registration

When a user connects an app, its actions become available to the AI agent.

**In `packages/ai/lib/tools/`**:

```typescript
// During agent session init, fetch user's connected apps and their tools:
const connectedApps = await trpc.connectors.list();
for (const app of connectedApps.filter((a) => a.status === "connected")) {
  const tools = await trpc.connectors.getTools({ connectorId: app.id });
  // Register each tool for the agent to use
  toolRegistry.register(
    tools.map((t) => ({
      name: `${app.type}_${t.name}`,
      description: t.description,
      parameters: t.parameters,
      execute: async (params) => {
        // Route through connector service → Composio
        return fetch(`${CONNECTOR_SERVICE_URL}/tools/execute`, {
          method: "POST",
          body: JSON.stringify({ toolName: t.name, connectorId: app.id, params }),
        });
      },
    }))
  );
}
```

This means when a user connects GitHub, the AI can automatically use: `github_create_issue`, `github_create_pr`, `github_list_repos`, `github_star_repo`, etc.

---

## Components to Create

In `apps/app/app/(authenticated)/applications/components/`:

| Component                 | Purpose                                                     |
| ------------------------- | ----------------------------------------------------------- |
| `app-grid.tsx`            | Responsive grid layout of app cards                         |
| `app-card.tsx`            | Individual app card with icon, name, status, connect button |
| `app-search.tsx`          | Search input with debounced client-side filtering           |
| `category-filter.tsx`     | Category filter pills with counts                           |
| `connected-apps-list.tsx` | Rich list view of connected apps with status                |
| `app-config-panel.tsx`    | Configuration Sheet for connected app                       |
| `sync-history-table.tsx`  | Table of sync logs with status badges                       |
| `app-status-badge.tsx`    | Status indicator (green/red/yellow/gray dot + label)        |
| `tool-list.tsx`           | List of available AI tools for a connected app              |
| `data-selector.tsx`       | Per-app data selection (folders, repos, channels)           |

---

## Key File Paths

| Purpose                      | Path                                                                       |
| ---------------------------- | -------------------------------------------------------------------------- |
| Applications page (server)   | `apps/app/app/(authenticated)/applications/page.tsx`                       |
| Applications client (CREATE) | `apps/app/app/(authenticated)/applications/applications-page-client.tsx`   |
| Components (CREATE)          | `apps/app/app/(authenticated)/applications/components/`                    |
| Connectors router            | `apps/app/lib/trpc/routers/connectors.router.ts`                           |
| Connectors schema            | `packages/database/src/schema/connectors.ts`                               |
| Connectors slice             | `apps/app/lib/store/slices/connectors.slice.ts`                            |
| Connector service            | `services/connector/src/index.ts`                                          |
| OAuth routes                 | `services/connector/src/routes/oauth.ts`                                   |
| Connectors routes            | `services/connector/src/routes/connectors.ts`                              |
| Integration routes           | `services/connector/src/routes/integrations.ts`                            |
| Settings connectors tab      | `apps/app/app/(authenticated)/components/settings/tabs/connectors-tab.tsx` |
| AI tool registry             | `packages/ai/lib/tools/tool-registry.ts`                                   |
| OAuth callback (CREATE)      | `apps/app/app/api/connectors/callback/route.ts`                            |

---

## Important Notes

1. **Composio is ALREADY integrated** - `composio-core` v0.5.0 installed in connector service. OAuth flow works. Do NOT re-implement.
2. **tRPC router is COMPREHENSIVE** - 12 procedures with real Drizzle queries. Just use them from the frontend.
3. **Connector service has real routes** - OAuth start/callback, catalog sync, integrations CRUD. All working with Composio SDK.
4. **`initializeOAuth` already exists** in tRPC router - Proxies to connector service. Frontend just needs to call it and open the popup.
5. **`getTools` already exists** in tRPC router - Fetches available Composio actions for a connected app.
6. **Catalog sync endpoint exists** - `POST /connectors/sync-catalog` syncs Composio apps to DB with auto-categorization.
7. **35+ connector types defined** in the schema enum - All major apps included.
8. **Settings tab already exists** - `connectors-tab.tsx` in settings. The Applications page should be the marketplace; settings tab is for management.

## Priority Order

1. Create `applications-page-client.tsx` with tab toggle (Connected/Available)
2. Seed connectorDefinitions table (call sync-catalog endpoint)
3. App card component with connect/connected status
4. Category filter pills
5. OAuth popup connection flow (already backend-ready)
6. Connected apps status indicators
7. App configuration panel (Sheet)
8. Sync history and management
9. AI tool registration for connected apps
10. Data selection per app type (folders, repos, channels)
