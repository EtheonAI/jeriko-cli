import { describe, expect, it } from "vitest";

import { createMockConnectorAdapter } from "../src/mock.js";

describe("createMockConnectorAdapter", () => {
  it("models sessions, auth, execution, and triggers without provider calls", async () => {
    let count = 0;
    const adapter = createMockConnectorAdapter({
      actions: [
        {
          provider: "mock",
          slug: "GITHUB_CREATE_ISSUE",
          toolkitSlug: "github",
          name: "Create GitHub issue",
          description: "Creates an issue.",
          risk: "external_write",
        },
      ],
      executeHandler: async ({ request }) => ({
        output: {
          issueNumber: 42,
          title: request.arguments.title,
        },
      }),
      idFactory: (kind) => `${kind}_${++count}`,
      now: () => new Date("2026-05-26T12:00:00.000Z"),
      toolkits: [
        {
          provider: "mock",
          slug: "github",
          name: "GitHub",
          authState: "needs_auth",
        },
      ],
    });

    const session = await adapter.createSession({
      userId: "user_123",
      toolkits: ["github"],
      workflowId: "workflow_123",
    });

    expect(session).toMatchObject({
      provider: "mock",
      sessionId: "session_1",
      userId: "user_123",
      workflowId: "workflow_123",
    });

    const auth = await adapter.authorize({
      userId: "user_123",
      toolkitSlug: "github",
      callbackUrl: "https://app.local/integrations/callback",
    });

    expect(auth.redirectUrl).toBe("https://connect.local/connection_2");

    const connection = await adapter.waitForConnection({
      connectedAccountId: "connection_2",
    });

    expect(connection).toMatchObject({
      id: "connection_2",
      status: "connected",
      isActive: true,
    });

    const connections = await adapter.listConnections({
      userIds: ["user_123"],
      toolkitSlugs: ["github"],
    });

    expect(connections.items).toHaveLength(1);

    const actions = await adapter.listActions({
      query: "issue",
      toolkits: ["github"],
    });

    expect(actions.items[0]?.slug).toBe("GITHUB_CREATE_ISSUE");

    const result = await adapter.execute({
      userId: "user_123",
      sessionId: session.sessionId,
      toolSlug: "GITHUB_CREATE_ISSUE",
      arguments: {
        title: "Fix login",
      },
    });

    expect(result).toMatchObject({
      success: true,
      output: {
        issueNumber: 42,
        title: "Fix login",
      },
    });

    const trigger = await adapter.createTrigger({
      userId: "user_123",
      triggerSlug: "GITHUB_COMMIT_EVENT",
      connectedAccountId: connection.id,
    });

    expect(trigger).toMatchObject({
      id: "trigger_3",
      status: "enabled",
    });

    await adapter.disableTrigger({ triggerId: trigger.id });

    expect((await adapter.listTriggers({ showDisabled: true })).items[0]).toMatchObject({
      id: trigger.id,
      status: "disabled",
    });
  });
});
