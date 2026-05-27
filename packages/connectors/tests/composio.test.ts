import { describe, expect, it } from "vitest";

import {
  type CreateComposioConnectorAdapterOptions,
  createComposioConnectorAdapter,
} from "../src/composio.js";

describe("createComposioConnectorAdapter", () => {
  it("wraps current Composio session, connection, execution, and trigger APIs", async () => {
    const session = {
      sessionId: "sess_123",
      mcp: {
        url: "https://mcp.composio.local/sess_123",
        headers: {
          Authorization: "Bearer test",
        },
      },
      authorize: async () => ({
        id: "ca_auth",
        redirectUrl: "https://connect.composio.local/link/ca_auth",
      }),
      execute: async (toolSlug: string, args?: Record<string, unknown>) => ({
        data: {
          toolSlug,
          args,
        },
        error: null,
        logId: "log_session",
      }),
      search: async () => ({
        items: [
          {
            slug: "GMAIL_SEND_EMAIL",
            name: "Send Email",
            description: "Sends an email.",
            toolkit: {
              slug: "gmail",
            },
          },
        ],
      }),
      toolkits: async () => ({
        items: [
          {
            slug: "gmail",
            name: "Gmail",
            connection: {
              isActive: true,
              connectedAccount: {
                id: "ca_gmail",
              },
            },
          },
        ],
      }),
      tools: async () => [],
    };

    const client: NonNullable<CreateComposioConnectorAdapterOptions["client"]> = {
      create: async () => session,
      use: async () => session,
      connectedAccounts: {
        link: async () => ({
          id: "ca_link",
          redirectUrl: "https://connect.composio.local/link/ca_link",
        }),
        list: async () => ({
          items: [
            {
              id: "ca_gmail",
              userId: "user_123",
              status: "ACTIVE",
              toolkit: {
                slug: "gmail",
              },
            },
          ],
        }),
        waitForConnection: async () => ({
          id: "ca_gmail",
          userId: "user_123",
          status: "ACTIVE",
          toolkit: {
            slug: "gmail",
          },
        }),
      },
      tools: {
        execute: async () => ({
          data: {
            ok: true,
          },
          error: null,
          logId: "log_direct",
        }),
        getRawComposioToolBySlug: async () => ({
          slug: "GMAIL_SEND_EMAIL",
          name: "Send Email",
          description: "Sends an email.",
          toolkit: {
            slug: "gmail",
          },
          inputParameters: {
            type: "object",
          },
        }),
        getRawComposioTools: async () => ({
          items: [
            {
              slug: "GMAIL_SEND_EMAIL",
              name: "Send Email",
              toolkit: {
                slug: "gmail",
              },
            },
          ],
        }),
      },
      triggers: {
        create: async () => ({
          triggerId: "trig_123",
        }),
        delete: async () => ({
          triggerId: "trig_123",
        }),
        disable: async () => ({
          triggerId: "trig_123",
          disabledAt: "2026-05-26T12:00:00.000Z",
        }),
        enable: async () => ({
          triggerId: "trig_123",
        }),
        listActive: async () => ({
          items: [
            {
              id: "trig_123",
              triggerName: "GMAIL_NEW_EMAIL",
              connectedAccountId: "ca_gmail",
            },
          ],
        }),
      },
    };

    const adapter = createComposioConnectorAdapter({ client });

    await expect(
      adapter.createSession({ userId: "user_123", toolkits: ["gmail"] })
    ).resolves.toMatchObject({
      provider: "composio",
      sessionId: "sess_123",
      mcp: {
        url: "https://mcp.composio.local/sess_123",
      },
    });

    await expect(adapter.listToolkits({ sessionId: "sess_123" })).resolves.toMatchObject({
      items: [
        {
          slug: "gmail",
          authState: "connected",
          connectedAccountId: "ca_gmail",
        },
      ],
    });

    await expect(
      adapter.authorize({
        userId: "user_123",
        authConfigId: "ac_gmail",
      })
    ).resolves.toMatchObject({
      authConfigId: "ac_gmail",
      redirectUrl: "https://connect.composio.local/link/ca_link",
    });

    await expect(
      adapter.execute({
        userId: "user_123",
        sessionId: "sess_123",
        toolSlug: "GMAIL_SEND_EMAIL",
        arguments: {
          to: "person@example.com",
        },
      })
    ).resolves.toMatchObject({
      mode: "session",
      success: true,
      logId: "log_session",
    });

    await expect(
      adapter.execute({
        userId: "user_123",
        mode: "direct",
        toolSlug: "GMAIL_SEND_EMAIL",
        arguments: {
          to: "person@example.com",
        },
        dangerouslySkipVersionCheck: true,
      })
    ).resolves.toMatchObject({
      mode: "direct",
      success: true,
      logId: "log_direct",
    });

    const trigger = await adapter.createTrigger({
      userId: "user_123",
      triggerSlug: "GMAIL_NEW_EMAIL",
      connectedAccountId: "ca_gmail",
    });

    expect(trigger).toMatchObject({
      id: "trig_123",
      triggerSlug: "GMAIL_NEW_EMAIL",
      status: "enabled",
    });

    expect(
      adapter.normalizeEvent({
        type: "composio.trigger.message",
        metadata: {
          trigger_slug: "GMAIL_NEW_EMAIL",
          connected_account_id: "ca_gmail",
        },
      })
    ).toMatchObject({
      provider: "composio",
      triggerSlug: "GMAIL_NEW_EMAIL",
      connectedAccountId: "ca_gmail",
    });
  });
});
