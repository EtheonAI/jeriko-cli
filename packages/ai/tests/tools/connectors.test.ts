import { createMockConnectorAdapter } from "@repo/connectors/mock";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  PlatformToolApprovalRequiredError,
  createConnectorAiSdkTool,
  executeConnectorPlatformTool,
  requiresConnectorPlatformToolApproval,
  type ConnectorPlatformToolManifest,
} from "../../src/tools/index.js";

const sendEmailManifest = {
  id: "gmail.send_email",
  description: "Send an email through the user's connected Gmail account.",
  inputSchema: z.object({
    to: z.string().email(),
    subject: z.string().min(1),
    body: z.string().min(1),
  }),
  connector: {
    provider: "mock",
    toolSlug: "GMAIL_SEND_EMAIL",
    toolkitSlug: "gmail",
    mode: "session",
  },
  permission: {
    id: "send_email",
  },
  risk: "external_write",
  approval: "external_write",
} satisfies ConnectorPlatformToolManifest;

describe("@repo/ai/tools connector bridge", () => {
  it("requires approval for external write connector tools", async () => {
    await expect(
      requiresConnectorPlatformToolApproval(sendEmailManifest, {
        to: "person@example.com",
        subject: "Hello",
        body: "Body",
      })
    ).resolves.toBe(true);
  });

  it("blocks direct execution until approval is supplied", async () => {
    const connector = createMockConnectorAdapter();

    await expect(
      executeConnectorPlatformTool(
        sendEmailManifest,
        {
          connector,
          userId: "user_123",
          sessionId: "session_123",
        },
        {
          to: "person@example.com",
          subject: "Hello",
          body: "Body",
        }
      )
    ).rejects.toBeInstanceOf(PlatformToolApprovalRequiredError);
  });

  it("delegates approved execution to @repo/connectors", async () => {
    const connector = createMockConnectorAdapter({
      executeHandler: async ({ request }) => ({
        output: {
          providerTool: request.toolSlug,
          delivered: true,
        },
      }),
    });
    const session = await connector.createSession({
      userId: "user_123",
    });

    const result = await executeConnectorPlatformTool(
      sendEmailManifest,
      {
        connector,
        userId: "user_123",
        sessionId: session.sessionId,
        workflowId: "workflow_123",
        runId: "run_123",
      },
      {
        to: "person@example.com",
        subject: "Hello",
        body: "Body",
      },
      {
        approved: true,
        approvalId: "approval_123",
      }
    );

    expect(result).toMatchObject({
      platformToolId: "gmail.send_email",
      connectorToolSlug: "GMAIL_SEND_EMAIL",
      permissionId: "send_email",
      approvalRequired: true,
      success: true,
      output: {
        providerTool: "GMAIL_SEND_EMAIL",
        delivered: true,
      },
    });
  });

  it("creates an AI SDK tool with approval metadata and execution", async () => {
    const connector = createMockConnectorAdapter({
      executeHandler: async () => ({
        output: {
          delivered: true,
        },
      }),
    });
    const session = await connector.createSession({
      userId: "user_123",
    });
    const sdkTool = createConnectorAiSdkTool(sendEmailManifest, {
      connector,
      userId: "user_123",
      sessionId: session.sessionId,
    });
    const needsApproval = sdkTool.needsApproval;

    expect(typeof needsApproval).toBe("function");
    await expect(
      typeof needsApproval === "function"
        ? needsApproval(
            {
              to: "person@example.com",
              subject: "Hello",
              body: "Body",
            },
            {
              messages: [],
              toolCallId: "toolcall_123",
            }
          )
        : needsApproval
    ).resolves.toBe(true);

    await expect(
      sdkTool.execute?.(
        {
          to: "person@example.com",
          subject: "Hello",
          body: "Body",
        },
        {
          messages: [],
          abortSignal: undefined,
          toolCallId: "toolcall_123",
        }
      )
    ).resolves.toMatchObject({
      platformToolId: "gmail.send_email",
      success: true,
      output: {
        delivered: true,
      },
    });
  });
});
