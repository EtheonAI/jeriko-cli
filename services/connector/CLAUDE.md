# services/connector — Testing Rules

## What This Is
Composio SDK integration: OAuth flows, connector catalog (36 connectors), tool discovery. 800 LOC.

## What to Test

### OAuth Flow (P0)
1. Initiate OAuth → redirect URL with state parameter
2. OAuth callback → token exchange → store access token
3. Invalid state → reject
4. Token refresh on expiry
5. Token revocation on disconnect

### Connector Catalog (P1)
1. List all connectors → 36 entries with categories
2. Filter by category
3. Search by name
4. Connector details (name, description, icon, auth type)

### Tool Discovery (P1)
1. Connected connector → list available tools
2. Tool execution with credentials
3. Disconnected connector → no tools

### User Isolation (P0)
1. User A's connected apps not visible to User B
2. User A's OAuth tokens not accessible by User B

## Composio SDK Mocking
```typescript
vi.mock("composio-core", () => ({
  Composio: vi.fn(() => ({
    getConnectedAccounts: vi.fn(),
    initiateConnection: vi.fn(),
    getTools: vi.fn(),
    executeAction: vi.fn(),
  })),
}));
```
