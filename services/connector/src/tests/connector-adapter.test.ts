/**
 * Connector Adapter Tests
 *
 * Tests for connector adapter interface and implementation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ComposioAdapter } from "../lib/adapters/composio-adapter.js";
import { ConnectorAdapterFactory } from "../lib/adapters/adapter-factory.js";
import type { IConnectorAdapter } from "../lib/adapters/connector-adapter.interface.js";

// Mock Composio SDK
vi.mock("@composio/core", () => {
  return {
    Composio: class MockComposio {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_config: { apiKey: string }) {}
      getConnectedAccounts = vi.fn().mockResolvedValue([]);
      initiateConnection = vi
        .fn()
        .mockResolvedValue({ redirectUrl: "https://mock.url", state: "mock-state" });
      getTools = vi.fn().mockResolvedValue([]);
      executeAction = vi.fn().mockResolvedValue({ success: true });
    },
  };
});

describe("Connector Adapter Interface", () => {
  let adapter: IConnectorAdapter;

  beforeEach(() => {
    adapter = new ComposioAdapter({
      apiKey: "test-api-key",
    });
  });

  describe("Adapter Factory", () => {
    it("should create Composio adapter when feature flag is enabled", () => {
      const factory = ConnectorAdapterFactory.create({
        enableComposioAdapter: true,
        connectorConfig: {
          apiKey: "test-key",
        },
      });

      expect(factory).toBeInstanceOf(ComposioAdapter);
    });

    it("should create default adapter when feature flag is disabled", () => {
      const factory = ConnectorAdapterFactory.create({
        enableComposioAdapter: false,
        connectorConfig: {
          apiKey: "test-key",
        },
      });

      expect(factory).toBeInstanceOf(ComposioAdapter);
    });

    it("should create explicit adapter type", () => {
      const factory = ConnectorAdapterFactory.createExplicit("composio", {
        apiKey: "test-key",
      });
      expect(factory).toBeInstanceOf(ComposioAdapter);
    });
  });

  describe("Adapter Interface Compliance", () => {
    it("should implement initiateOAuth method", () => {
      expect(adapter.initiateOAuth).toBeDefined();
      expect(typeof adapter.initiateOAuth).toBe("function");
    });

    it("should implement completeOAuth method", () => {
      expect(adapter.completeOAuth).toBeDefined();
      expect(typeof adapter.completeOAuth).toBe("function");
    });

    it("should implement refreshToken method", () => {
      expect(adapter.refreshToken).toBeDefined();
      expect(typeof adapter.refreshToken).toBe("function");
    });

    it("should implement revokeAccess method", () => {
      expect(adapter.revokeAccess).toBeDefined();
      expect(typeof adapter.revokeAccess).toBe("function");
    });

    it("should implement getConnectedAccounts method", () => {
      expect(adapter.getConnectedAccounts).toBeDefined();
      expect(typeof adapter.getConnectedAccounts).toBe("function");
    });

    it("should implement getConnectors method", () => {
      expect(adapter.getConnectors).toBeDefined();
      expect(typeof adapter.getConnectors).toBe("function");
    });

    it("should implement getConnector method", () => {
      expect(adapter.getConnector).toBeDefined();
      expect(typeof adapter.getConnector).toBe("function");
    });

    it("should implement getTools method", () => {
      expect(adapter.getTools).toBeDefined();
      expect(typeof adapter.getTools).toBe("function");
    });

    it("should implement executeTool method", () => {
      expect(adapter.executeTool).toBeDefined();
      expect(typeof adapter.executeTool).toBe("function");
    });

    it("should implement searchTools method", () => {
      expect(adapter.searchTools).toBeDefined();
      expect(typeof adapter.searchTools).toBe("function");
    });

    it("should implement validateCredentials method", () => {
      expect(adapter.validateCredentials).toBeDefined();
      expect(typeof adapter.validateCredentials).toBe("function");
    });
  });

  describe("OAuth Flow", () => {
    it("should initiate OAuth with redirect URL and state", async () => {
      const result = await adapter.initiateOAuth(
        "github",
        "user-123",
        "https://app.example.com/oauth/callback"
      );

      expect(result).toHaveProperty("redirectUrl");
      expect(result).toHaveProperty("state");
      expect(result.redirectUrl).toContain("github");
      expect(result.state).toBeTruthy();
    });

    it("should complete OAuth and return tokens", async () => {
      const tokens = await adapter.completeOAuth("github", {
        code: "auth-code",
        state: "state-123",
      });

      expect(tokens).toHaveProperty("accessToken");
      expect(tokens.accessToken).toBeTruthy();
    });

    it("should refresh expired token", async () => {
      const tokens = await adapter.refreshToken("account-123", "refresh-token");

      expect(tokens).toHaveProperty("accessToken");
      expect(tokens.accessToken).toBeTruthy();
    });
  });

  describe("Connector Catalog", () => {
    it("should return list of available connectors", async () => {
      const connectors = await adapter.getConnectors();

      expect(Array.isArray(connectors)).toBe(true);
      expect(connectors.length).toBeGreaterThan(0);
      expect(connectors[0]).toHaveProperty("id");
      expect(connectors[0]).toHaveProperty("name");
      expect(connectors[0]).toHaveProperty("authType");
    });

    it("should get specific connector by ID", async () => {
      const connector = await adapter.getConnector("github");

      expect(connector).toHaveProperty("id");
      expect(connector.id).toBe("github");
      expect(connector).toHaveProperty("name");
    });

    it("should throw error for non-existent connector", async () => {
      await expect(adapter.getConnector("non-existent-connector")).rejects.toThrow();
    });
  });

  describe("Tool Execution", () => {
    it("should execute tool with parameters", async () => {
      const result = await adapter.executeTool({
        toolId: "github_create_issue",
        accountId: "account-123",
        parameters: {
          title: "Test issue",
          body: "Test body",
        },
      });

      expect(result).toHaveProperty("success");
      expect(result.success).toBe(true);
    });

    it("should search tools by query", async () => {
      const tools = await adapter.searchTools("account-123", "create");

      expect(Array.isArray(tools)).toBe(true);
    });

    it("should validate credentials", async () => {
      const isValid = await adapter.validateCredentials("account-123");

      expect(typeof isValid).toBe("boolean");
    });
  });
});
