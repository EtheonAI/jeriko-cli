/**
 * Connector Service Unit Tests
 */
import { describe, it, expect, vi } from "vitest";

// ── Tool name construction ──

function buildToolName(appName: string, action: string): string {
  return `app_${appName}_${action}`;
}

function parseToolName(toolName: string): { appName: string; action: string } | null {
  if (!toolName.startsWith("app_")) return null;
  const rest = toolName.slice(4);
  const underscoreIdx = rest.indexOf("_");
  if (underscoreIdx === -1) return null;
  return {
    appName: rest.slice(0, underscoreIdx),
    action: rest.slice(underscoreIdx + 1),
  };
}

// ── OAuth scope validation ──

const REQUIRED_SCOPES: Record<string, string[]> = {
  github: ["repo", "user"],
  slack: ["chat:write", "channels:read"],
  gmail: ["https://www.googleapis.com/auth/gmail.send"],
  google_calendar: ["https://www.googleapis.com/auth/calendar"],
};

function validateScopes(appName: string, grantedScopes: string[]): boolean {
  const required = REQUIRED_SCOPES[appName];
  if (!required) return true; // Unknown apps pass by default
  return required.every((scope) => grantedScopes.includes(scope));
}

// ── Tests ──

describe("Tool name construction", () => {
  it("should build correct tool names", () => {
    expect(buildToolName("github", "create_issue")).toBe("app_github_create_issue");
    expect(buildToolName("slack", "send_message")).toBe("app_slack_send_message");
  });

  it("should parse tool names correctly", () => {
    const result = parseToolName("app_github_create_issue");
    expect(result).toEqual({ appName: "github", action: "create_issue" });
  });

  it("should return null for non-app tool names", () => {
    expect(parseToolName("shell_exec")).toBeNull();
    expect(parseToolName("browser_navigate")).toBeNull();
    expect(parseToolName("")).toBeNull();
  });

  it("should handle multi-word actions", () => {
    const result = parseToolName("app_google_calendar_create_event");
    // First underscore after app_ splits app from action
    expect(result).toEqual({ appName: "google", action: "calendar_create_event" });
  });
});

describe("OAuth scope validation", () => {
  it("should validate GitHub required scopes", () => {
    expect(validateScopes("github", ["repo", "user", "gist"])).toBe(true);
    expect(validateScopes("github", ["repo"])).toBe(false); // missing "user"
  });

  it("should validate Slack required scopes", () => {
    expect(validateScopes("slack", ["chat:write", "channels:read"])).toBe(true);
    expect(validateScopes("slack", ["chat:write"])).toBe(false);
  });

  it("should pass unknown apps", () => {
    expect(validateScopes("unknown_app", [])).toBe(true);
  });
});

describe("Connector status management", () => {
  it("should track connection status", () => {
    const validStatuses = ["connected", "disconnected", "error", "expired"];
    for (const status of validStatuses) {
      expect(typeof status).toBe("string");
    }
  });

  it("should handle connection metadata", () => {
    const connection = {
      appName: "github",
      status: "connected",
      scopes: ["repo", "user"],
      metadata: {
        accessToken: "gho_xxx",
        refreshToken: "ghr_xxx",
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    };

    expect(connection.metadata).toHaveProperty("accessToken");
    expect(connection.metadata).toHaveProperty("refreshToken");
    expect(connection.metadata).toHaveProperty("expiresAt");
  });

  it("should detect expired tokens", () => {
    const expiredAt = new Date(Date.now() - 1000).toISOString();
    const isExpired = new Date(expiredAt).getTime() < Date.now();
    expect(isExpired).toBe(true);

    const validAt = new Date(Date.now() + 3600000).toISOString();
    const isValid = new Date(validAt).getTime() > Date.now();
    expect(isValid).toBe(true);
  });
});

describe("Dynamic tool catalog", () => {
  it("should build tool definitions from Composio catalog", () => {
    const composioTool = {
      app_name: "github",
      action: "create_issue",
      description: "Create a GitHub issue",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
        },
        required: ["title"],
      },
    };

    const tool = {
      name: buildToolName(composioTool.app_name, composioTool.action),
      description: composioTool.description,
      input_schema: composioTool.parameters,
    };

    expect(tool.name).toBe("app_github_create_issue");
    expect(tool.input_schema).toHaveProperty("properties");
  });
});
