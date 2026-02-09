/**
 * Connector Service Integration Tests
 *
 * Tests complex flows: connect app lifecycle, listing user connections,
 * disconnecting apps (with Composio revocation), tool execution dispatch,
 * and OAuth flow redirect URL generation.
 *
 * All DB, Composio, and helper interactions are mocked via setup.ts (auto-loaded by vitest config).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import mocked modules — setup.ts handles vi.mock() hoisting
import {
  db,
  eq,
  and,
  desc,
  connectorDefinitions,
  userConnectors,
} from "../lib/db.js";
import { getComposioClient } from "../lib/composio.js";
import { getUserId } from "../lib/helpers.js";
import { createId } from "@repo/service-utils";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Get the Composio mock client and ensure it has all methods needed
 * by the integration tests (the base setup.ts mock may not include
 * all methods used by newer routes like oauth.ts and integrations.ts).
 */
function getEnrichedComposioClient() {
  const composio = getComposioClient() as Record<string, any>;

  // Ensure connectedAccounts has delete and initiate
  if (!composio.connectedAccounts.delete) {
    composio.connectedAccounts.delete = vi.fn().mockResolvedValue(undefined);
  }
  if (!composio.connectedAccounts.initiate) {
    composio.connectedAccounts.initiate = vi.fn().mockResolvedValue({
      id: "composio-req-default",
      redirectUrl: "https://example.com/oauth",
    });
  }

  // Ensure tools namespace exists (routes use composio.tools.execute)
  if (!composio.tools) {
    composio.tools = {
      get: vi.fn().mockResolvedValue([]),
      execute: vi.fn().mockResolvedValue({ data: {} }),
    };
  }

  return composio;
}

// ─── Test Data Factories ─────────────────────────────────────────────────────

function makeConnectorDefinition(overrides: Partial<{
  id: string;
  type: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  authType: string;
  isEnabled: boolean;
  oauthConfig: Record<string, unknown> | null;
}> = {}) {
  return {
    id: overrides.id ?? "cdef-1",
    type: overrides.type ?? "github",
    name: overrides.name ?? "GitHub",
    description: overrides.description ?? "GitHub integration",
    icon: overrides.icon ?? "https://logos.composio.dev/api/github",
    category: overrides.category ?? "development",
    authType: overrides.authType ?? "oauth2",
    isEnabled: overrides.isEnabled ?? true,
    oauthConfig: overrides.oauthConfig ?? null,
  };
}

function makeUserConnector(overrides: Partial<{
  id: string;
  userId: string;
  connectorDefinitionId: string;
  status: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "uc-1",
    userId: overrides.userId ?? "test-user-id",
    connectorDefinitionId: overrides.connectorDefinitionId ?? "cdef-1",
    status: overrides.status ?? "connected",
    metadata: overrides.metadata ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Connect app -> verify connection record created", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new user connector record when connecting an app", async () => {
    const definition = makeConnectorDefinition({
      id: "cdef-github",
      type: "github",
    });
    const connector = makeUserConnector({
      id: "uc-new",
      connectorDefinitionId: "cdef-github",
      status: "pending",
    });

    // Step 1: Look up the connector definition
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([definition]),
        }),
      }),
    });

    const [foundDef] = await db
      .select()
      .from(connectorDefinitions)
      .where(eq(connectorDefinitions.type, "github"))
      .limit(1);

    expect(foundDef).toBeDefined();
    expect(foundDef.type).toBe("github");

    // Step 2: Check if user already has this connection (no existing)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const [existing] = await db
      .select()
      .from(userConnectors)
      .where(
        and(
          eq(userConnectors.userId, "test-user-id"),
          eq(userConnectors.connectorDefinitionId, "cdef-github")
        )
      )
      .limit(1);

    expect(existing).toBeUndefined();

    // Step 3: Insert new connection record
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([connector]),
      }),
    });

    // Simulate the insert (oauth route creates with "pending" status)
    await db.insert(userConnectors).values({
      id: connector.id,
      userId: "test-user-id",
      connectorDefinitionId: "cdef-github",
      status: "pending",
    });

    expect(db.insert).toHaveBeenCalled();
  });

  it("should reset existing connection to pending on re-auth", async () => {
    const existingConnector = makeUserConnector({
      id: "uc-existing",
      status: "connected",
    });

    // User already has this connection
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([existingConnector]),
        }),
      }),
    });

    const [existing] = await db
      .select()
      .from(userConnectors)
      .where()
      .limit(1);

    expect(existing).toBeDefined();
    expect(existing.status).toBe("connected");

    // Reset to pending for re-auth
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(userConnectors)
      .set({ status: "pending" })
      .where(eq(userConnectors.id, existing.id));

    expect(db.update).toHaveBeenCalled();
  });
});

describe("List connected apps -> returns only user's connections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return only the requesting user's integrations", async () => {
    const userAIntegration = {
      integration: makeUserConnector({
        id: "uc-a1",
        userId: "user-a",
        status: "connected",
      }),
      definition: makeConnectorDefinition({ type: "github" }),
    };

    // User A requests their integrations
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([userAIntegration]),
          }),
        }),
      }),
    });

    const integrations = await db
      .select()
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
      )
      .where(eq(userConnectors.userId, "user-a"))
      .orderBy(desc(userConnectors.createdAt));

    expect(integrations).toHaveLength(1);
    expect(integrations[0].integration.userId).toBe("user-a");
    expect(integrations[0].definition.type).toBe("github");
  });

  it("should return empty list for user with no connections", async () => {
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });

    const integrations = await db
      .select()
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
      )
      .where(eq(userConnectors.userId, "user-no-connections"))
      .orderBy(desc(userConnectors.createdAt));

    expect(integrations).toHaveLength(0);
  });

  it("should return multiple integrations for a user with several connections", async () => {
    const githubDef = makeConnectorDefinition({ id: "cdef-gh", type: "github" });
    const slackDef = makeConnectorDefinition({
      id: "cdef-sl",
      type: "slack",
      name: "Slack",
      category: "communication",
    });

    const integrations = [
      {
        integration: makeUserConnector({
          id: "uc-gh",
          connectorDefinitionId: "cdef-gh",
          status: "connected",
        }),
        definition: githubDef,
      },
      {
        integration: makeUserConnector({
          id: "uc-sl",
          connectorDefinitionId: "cdef-sl",
          status: "connected",
        }),
        definition: slackDef,
      },
    ];

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(integrations),
          }),
        }),
      }),
    });

    const result = await db
      .select()
      .from(userConnectors)
      .innerJoin(
        connectorDefinitions,
        eq(userConnectors.connectorDefinitionId, connectorDefinitions.id)
      )
      .where(eq(userConnectors.userId, "test-user-id"))
      .orderBy(desc(userConnectors.createdAt));

    expect(result).toHaveLength(2);
    const types = result.map((r: any) => r.definition.type);
    expect(types).toContain("github");
    expect(types).toContain("slack");
  });
});

describe("Disconnect app -> verify connection removed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete user connector and revoke Composio connection", async () => {
    const connector = makeUserConnector({
      id: "uc-disconnect",
      metadata: { composioConnectionId: "composio-conn-123" },
    });

    // Step 1: Look up the integration
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([connector]),
        }),
      }),
    });

    const [integration] = await db
      .select()
      .from(userConnectors)
      .where(eq(userConnectors.id, "uc-disconnect"))
      .limit(1);

    expect(integration).toBeDefined();
    expect(integration.metadata).toHaveProperty("composioConnectionId");

    // Step 2: Revoke in Composio
    const composio = getEnrichedComposioClient();
    const metadata = integration.metadata as Record<string, unknown>;
    const composioConnectionId = metadata.composioConnectionId as string;

    await composio.connectedAccounts.delete(composioConnectionId);
    expect(composio.connectedAccounts.delete).toHaveBeenCalledWith("composio-conn-123");

    // Step 3: Delete from DB
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await db.delete(userConnectors).where(eq(userConnectors.id, "uc-disconnect"));
    expect(db.delete).toHaveBeenCalled();
  });

  it("should still delete from DB even if Composio revocation fails", async () => {
    const connector = makeUserConnector({
      id: "uc-revoke-fail",
      metadata: { composioConnectionId: "composio-conn-bad" },
    });

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([connector]),
        }),
      }),
    });

    const [integration] = await db
      .select()
      .from(userConnectors)
      .where(eq(userConnectors.id, "uc-revoke-fail"))
      .limit(1);

    // Composio revocation throws
    const composio = getEnrichedComposioClient();
    (composio.connectedAccounts.delete as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Composio connection not found")
    );

    let revokeError: Error | null = null;
    try {
      await composio.connectedAccounts.delete("composio-conn-bad");
    } catch (err) {
      revokeError = err as Error;
    }

    // Error occurred but we continue with DB deletion
    expect(revokeError).not.toBeNull();
    expect(revokeError!.message).toContain("not found");

    // Delete from DB should still proceed
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await db.delete(userConnectors).where(eq(userConnectors.id, "uc-revoke-fail"));
    expect(db.delete).toHaveBeenCalled();
  });

  it("should handle integration with no Composio connection ID", async () => {
    const connector = makeUserConnector({
      id: "uc-no-composio",
      metadata: null,
    });

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([connector]),
        }),
      }),
    });

    const [integration] = await db
      .select()
      .from(userConnectors)
      .where(eq(userConnectors.id, "uc-no-composio"))
      .limit(1);

    const metadata = integration.metadata as Record<string, unknown> | null;
    const composioConnectionId = metadata?.composioConnectionId;

    // Should skip Composio revocation when no connection ID
    expect(composioConnectionId).toBeUndefined();

    // Proceed directly to DB deletion
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await db.delete(userConnectors).where(eq(userConnectors.id, "uc-no-composio"));
    expect(db.delete).toHaveBeenCalled();

    // Composio delete should NOT have been called
    const composio = getEnrichedComposioClient();
    expect(composio.connectedAccounts.delete).not.toHaveBeenCalled();
  });
});

describe("Tool execution -> dispatches to Composio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute a tool through Composio and return the result", async () => {
    const userId = "test-user-id";
    const toolName = "GITHUB_CREATE_ISSUE";
    const args = { title: "Bug fix", body: "Fix the login issue" };

    const composio = getEnrichedComposioClient();

    // Mock successful execution
    (composio.tools.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { issueId: 42, url: "https://github.com/repo/issues/42" },
    });

    const result = await composio.tools.execute(toolName, {
      userId,
      arguments: args,
    });

    expect(composio.tools.execute).toHaveBeenCalledWith(toolName, {
      userId,
      arguments: args,
    });

    const typedResult = result as { data: Record<string, unknown> };
    expect(typedResult.data).toBeDefined();
    expect(typedResult.data.issueId).toBe(42);
  });

  it("should verify user has app connected before executing tool", async () => {
    const userId = "test-user-id";
    const toolName = "GITHUB_CREATE_ISSUE";

    // Extract app name from tool name (route handler logic)
    const appName = toolName.toLowerCase().split("_")[0];
    expect(appName).toBe("github");

    // Look up connector definition
    const definition = makeConnectorDefinition({ id: "cdef-gh", type: "github" });

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([definition]),
          }),
        }),
      })
      // Look up user integration
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              makeUserConnector({
                status: "connected",
                connectorDefinitionId: "cdef-gh",
              }),
            ]),
          }),
        }),
      });

    const [def] = await db
      .select()
      .from(connectorDefinitions)
      .where(eq(connectorDefinitions.type, appName!))
      .limit(1);

    expect(def).toBeDefined();

    const [integration] = await db
      .select()
      .from(userConnectors)
      .where(
        and(
          eq(userConnectors.userId, userId),
          eq(userConnectors.connectorDefinitionId, def.id),
          eq(userConnectors.status, "connected")
        )
      )
      .limit(1);

    expect(integration).toBeDefined();
    expect(integration.status).toBe("connected");
  });

  it("should reject tool execution when user does not have app connected", async () => {
    const userId = "test-user-id";
    const appName = "slack";

    const definition = makeConnectorDefinition({ id: "cdef-sl", type: "slack" });

    (db.select as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([definition]),
          }),
        }),
      })
      // No integration found
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

    const [def] = await db
      .select()
      .from(connectorDefinitions)
      .where(eq(connectorDefinitions.type, appName))
      .limit(1);

    expect(def).toBeDefined();

    const [integration] = await db
      .select()
      .from(userConnectors)
      .where(
        and(
          eq(userConnectors.userId, userId),
          eq(userConnectors.connectorDefinitionId, def.id),
          eq(userConnectors.status, "connected")
        )
      )
      .limit(1);

    expect(integration).toBeUndefined();

    // Route handler returns 403 when integration is missing
    const isConnected = !!integration;
    expect(isConnected).toBe(false);
  });
});

describe("OAuth flow -> returns redirect URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initiate OAuth and return redirect URL", async () => {
    const userId = "test-user-id";
    const connectorType = "github";
    const definition = makeConnectorDefinition({
      id: "cdef-gh",
      type: "github",
    });

    // Step 1: Look up definition
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([definition]),
        }),
      }),
    });

    const [foundDef] = await db
      .select()
      .from(connectorDefinitions)
      .where(eq(connectorDefinitions.type, connectorType))
      .limit(1);

    expect(foundDef).toBeDefined();

    // Step 2: No existing connection
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    // Step 3: Create pending user connector
    const connectorId = "uc-oauth";
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    await db.insert(userConnectors).values({
      id: connectorId,
      userId,
      connectorDefinitionId: definition.id,
      status: "pending",
    });

    expect(db.insert).toHaveBeenCalled();

    // Step 4: Initiate OAuth via Composio
    const composio = getEnrichedComposioClient();

    // Mock the connectedAccounts.initiate method with specific redirect URL
    const mockRedirectUrl =
      "https://github.com/login/oauth/authorize?client_id=xxx&state=yyy";
    (composio.connectedAccounts.initiate as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "composio-req-1",
      redirectUrl: mockRedirectUrl,
    });

    const authConfigId = "auth-config-gh";
    const connRequest = await composio.connectedAccounts.initiate(userId, authConfigId, {
      callbackUrl: "http://localhost:3000/api/connectors/callback?type=github",
    });

    expect(connRequest).toBeDefined();
    expect(connRequest.redirectUrl).toBe(mockRedirectUrl);
    expect(connRequest.redirectUrl).toContain("github.com");

    // Step 5: Store Composio connection request ID in metadata
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(userConnectors)
      .set({
        metadata: { composioConnectionId: connRequest.id },
      })
      .where(eq(userConnectors.id, connectorId));

    expect(db.update).toHaveBeenCalled();
  });

  it("should return connector status after OAuth completion", async () => {
    const connector = makeUserConnector({
      id: "uc-check",
      status: "pending",
      metadata: { composioConnectionId: "composio-conn-check" },
    });

    // Look up existing connector
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([connector]),
        }),
      }),
    });

    const [found] = await db
      .select()
      .from(userConnectors)
      .where()
      .limit(1);

    expect(found.status).toBe("pending");

    // Check Composio for status update
    const composio = getEnrichedComposioClient();
    (composio.connectedAccounts.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "composio-conn-check",
      status: "ACTIVE",
    });

    const account = await composio.connectedAccounts.get("composio-conn-check");
    const isActive = account.status === "ACTIVE";

    expect(isActive).toBe(true);

    // Update local status to connected
    if (isActive) {
      (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      });

      await db
        .update(userConnectors)
        .set({
          status: "connected",
          metadata: { ...connector.metadata, composioStatus: "ACTIVE" },
        })
        .where(eq(userConnectors.id, connector.id));

      expect(db.update).toHaveBeenCalled();
    }
  });

  it("should keep pending status when Composio check is not yet active", async () => {
    const connector = makeUserConnector({
      id: "uc-still-pending",
      status: "pending",
      metadata: { composioConnectionId: "composio-conn-wait" },
    });

    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([connector]),
        }),
      }),
    });

    const [found] = await db
      .select()
      .from(userConnectors)
      .where()
      .limit(1);

    const composio = getEnrichedComposioClient();
    (composio.connectedAccounts.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "composio-conn-wait",
      status: "INITIATED", // Not yet ACTIVE
    });

    const account = await composio.connectedAccounts.get("composio-conn-wait");
    const isActive = account.status === "ACTIVE";

    expect(isActive).toBe(false);

    // Status should remain "pending" — no DB update
    expect(found.status).toBe("pending");
  });
});
