# Applications (App Marketplace / Composio) - Build Instructions

## Current State

### Frontend Page

`apps/app/app/(authenticated)/applications/page.tsx` (62 lines) - Empty placeholder with:

- "No applications connected" empty state with dashed border
- "Connect app" button in header (non-functional)
- "Browse applications" button in empty state (non-functional)
- Server component fetching auth session

### tRPC Router

`apps/app/lib/trpc/routers/connectors.router.ts` (340 lines) - Full CRUD with Drizzle queries:

- `listDefinitions` - List enabled connector definitions, ordered by category + name
- `list` - List user's installed connectors (joins userConnectors with connectorDefinitions)
- `get` - Get single connector by ID (ownership verified)
- `install` - Create userConnector record (checks for duplicates, sets status: "pending")
- `updateConfig` - Update config, syncEnabled, syncInterval
- `saveTokens` - Save OAuth accessToken, refreshToken, tokenExpiresAt; sets status: "connected"
- `disconnect` - Clear tokens, set status: "disconnected"
- `uninstall` - Delete userConnector record
- `sync` - Trigger sync (creates sync log, sets status: "syncing", has TODO for actual sync job)
- `getSyncHistory` - Get sync logs for a connector, ordered by startedAt desc

### Database Schema

`packages/database/src/schema/connectors.ts` (184 lines):

**connectorDefinitions table** (marketplace catalog):

- `id`, `type` (unique, e.g. "gmail", "slack", "github"), `name`, `description`, `icon`
- `category` (enum: communication/storage/productivity/development/crm/analytics/other)
- `authType` (enum: oauth2/api_key/basic/custom)
- `oauthConfig` (jsonb: { authUrl, tokenUrl, scopes, clientId })
- `capabilities` (jsonb string[])
- `isEnabled`, `isPremium`, `createdAt`, `updatedAt`

**userConnectors table** (installed by user):

- `id`, `userId` (FK users), `connectorDefinitionId` (FK connectorDefinitions), `organizationId` (FK organizations)
- `status` (enum: connected/disconnected/error/pending/syncing)
- OAuth: `accessToken`, `refreshToken`, `tokenExpiresAt`
- API Key: `apiKey`
- `credentials` (jsonb for additional auth)
- Sync: `syncEnabled`, `syncInterval` (seconds, default 3600), `lastSyncAt`, `lastSyncStatus`, `lastSyncError`
- `config` (jsonb: { selectedFolders, selectedChannels, selectedRepos, syncDirection, ... })
- `metadata`, `createdAt`, `updatedAt`

**connectorSyncLogs table:**

- `id`, `userConnectorId` (FK), `status` (started/success/failed/partial)
- `itemsSynced`, `itemsFailed`, `errorMessage`, `details` (jsonb)
- `startedAt`, `completedAt`

### Redux State

`apps/app/lib/store/slices/connectors.slice.ts` (8526 bytes) - Manages connector state for the UI.

### Connector Service

`services/connector/src/index.ts` - Microservice for connector operations (exists but needs implementation).

---

## What Needs Building

### 1. App Marketplace Grid

Replace the empty placeholder with a full marketplace UI.

**Create:** `apps/app/app/(authenticated)/applications/applications-page-client.tsx`

**Layout:**

- Top bar: Search input, category filter dropdown, "Connected" / "Available" tab toggle
- Grid of app cards (4 columns on desktop, 2 on tablet, 1 on mobile)
- Each card: app icon, name, category badge, brief description, "Connect" or "Connected" button
- Sort by: Popular, Recently Added, Alphabetical

**Category filters:**

```
Productivity   | Google Workspace, Notion, Linear, Asana, Trello
Communication  | Slack, Discord, Microsoft Teams, Gmail, Outlook
Development    | GitHub, GitLab, Bitbucket, Jira, Confluence
Storage        | Google Drive, Dropbox, OneDrive, Box, SharePoint
CRM            | Salesforce, HubSpot, Pipedrive
Analytics      | Google Analytics, Mixpanel, Amplitude
Marketing      | Mailchimp, SendGrid, Twilio
Finance        | Stripe, QuickBooks, Xero
Other          | Zapier, Make, custom webhooks
```

### 2. Composio Integration

Composio provides 500+ pre-built app integrations with OAuth handling and action definitions.

**Install:**

```
composio-core
```

**Integration points:**

#### Fetching Available Apps

```typescript
// In connectors.router.ts or a new composio.router.ts
import { Composio } from "composio-core";

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

// List all available apps
const apps = await composio.apps.list();

// Get app details
const app = await composio.apps.get({ appKey: "github" });
```

#### OAuth Connection Flow

```typescript
// Initiate OAuth connection
const connection = await composio.connectedAccounts.initiate({
  appName: "github",
  authMode: "OAUTH2",
  authConfig: {},
  redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/callback`,
  entityId: userId,
});
// Returns { redirectUrl } - open in popup window
```

#### Registering Tools

```typescript
// After connection, get available actions for the app
const actions = await composio.actions.list({
  appNames: ["github"],
  connectedAccountId: connectionId,
});
// Register these as AI agent tools in packages/ai/lib/tools/
```

### 3. OAuth Connection Flow (Popup-Based)

**Build:**

1. User clicks "Connect" on an app card
2. Frontend calls `connectors.router.ts` `install` mutation (creates pending record)
3. Frontend calls new `initializeOAuth` mutation which calls Composio
4. Composio returns OAuth redirect URL
5. Frontend opens popup window to OAuth URL
6. After OAuth completes, popup redirects to `/api/connectors/callback`
7. Callback endpoint receives auth code, exchanges for tokens
8. Tokens saved via `connectors.router.ts` `saveTokens` mutation
9. Popup closes, parent window refreshes connector status

**Create:**

- `apps/app/app/api/connectors/callback/route.ts` - OAuth callback handler
- `apps/app/app/(authenticated)/applications/components/oauth-popup.tsx` - Popup manager component

### 4. App Configuration Panel

When a connected app is clicked, show a configuration side panel or modal.

**Sections:**

- **Connection Status**: Connected/Disconnected badge, last synced time, connection health
- **Permissions**: List of granted scopes/permissions
- **Sync Settings**: Enable/disable sync, sync interval dropdown (15min/1hr/4hr/daily/manual)
- **Data Selection**: Which folders/channels/repos to sync (using `config` jsonb field)
- **Sync History**: Table of recent syncs from `connectorSyncLogs` with status, items synced, errors
- **Actions**: Disconnect button, Force Sync button, View Logs button

**Create:** `apps/app/app/(authenticated)/applications/components/app-config-panel.tsx`

### 5. Connected App Management

**Features:**

- "Connected" tab shows only user's installed connectors
- Status indicators: green dot (connected), yellow (syncing), red (error), gray (disconnected)
- Quick actions: Sync Now, Disconnect, Configure
- Error recovery: Re-authenticate button for expired tokens
- Auto-refresh tokens when `tokenExpiresAt` approaches

### 6. AI Tool Registration

Each connected app should register its available actions as tools for the AI agent system.

**Integration with `packages/ai/lib/tools/tool-registry.ts`:**

```typescript
// When app is connected, register its Composio actions as tools
const toolDefinitions = composioActions.map((action) => ({
  name: `${appName}_${action.name}`,
  description: action.description,
  parameters: action.parameters,
  execute: async (params) => {
    return composio.actions.execute({
      actionName: action.name,
      connectedAccountId: connectionId,
      input: params,
    });
  },
}));
toolRegistry.registerMany(toolDefinitions);
```

This means when a user connects GitHub, the AI can automatically use actions like `github_create_issue`, `github_create_pr`, `github_list_repos`.

---

## Components to Create

In `apps/app/app/(authenticated)/applications/components/`:

| Component                 | Purpose                                             |
| ------------------------- | --------------------------------------------------- |
| `app-grid.tsx`            | Grid layout of app cards                            |
| `app-card.tsx`            | Individual app card with icon, name, connect button |
| `app-search.tsx`          | Search input with debounced filtering               |
| `category-filter.tsx`     | Category filter pills/dropdown                      |
| `connected-apps-list.tsx` | List view of connected apps with status             |
| `app-config-panel.tsx`    | Configuration side panel for connected app          |
| `oauth-popup.tsx`         | OAuth popup window manager                          |
| `sync-history-table.tsx`  | Table of sync logs                                  |
| `app-status-badge.tsx`    | Status indicator badge                              |

---

## Key File Paths

| Purpose                 | Path                                                                       |
| ----------------------- | -------------------------------------------------------------------------- |
| Applications page       | `apps/app/app/(authenticated)/applications/page.tsx`                       |
| Connectors router       | `apps/app/lib/trpc/routers/connectors.router.ts`                           |
| Connectors schema       | `packages/database/src/schema/connectors.ts`                               |
| Connectors slice        | `apps/app/lib/store/slices/connectors.slice.ts`                            |
| Settings connectors tab | `apps/app/app/(authenticated)/components/settings/tabs/connectors-tab.tsx` |
| Connector service       | `services/connector/src/index.ts`                                          |
| AI tool registry        | `packages/ai/lib/tools/tool-registry.ts`                                   |
| AI tools directory      | `packages/ai/tools/`                                                       |

## tRPC Router Additions

Add to `apps/app/lib/trpc/routers/connectors.router.ts`:

```typescript
// New procedures:
initializeOAuth; // Call Composio to get OAuth URL
handleCallback; // Process OAuth callback, save tokens
refreshTokens; // Refresh expired OAuth tokens
listActions; // Get available actions for a connected app
getAppDetails; // Get detailed info about a Composio app
listCategories; // Get unique categories for filtering
searchApps; // Search available apps by name/description
```

## Priority Order

1. Convert page to client component with grid layout and category filters
2. Seed `connectorDefinitions` table with common apps (Gmail, Slack, GitHub, etc.)
3. Display available apps from DB (or Composio API) in grid
4. OAuth connection flow with popup
5. Connected apps tab with status indicators
6. App configuration panel
7. Composio integration for dynamic app catalog
8. Sync management and history
9. AI tool registration for connected apps
