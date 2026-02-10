/**
 * Sandbox Contracts Validation Tests
 *
 * Ensures all sandbox schemas validate correctly and reject invalid inputs
 */

import { describe, it, expect } from "vitest";
import {
  CreateSandboxRequestSchema,
  CreateSandboxResponseSchema,
  ExecuteCodeRequestSchema,
  ExecuteCodeResponseSchema,
  ShellCommandRequestSchema,
  ShellCommandResponseSchema,
  BrowserActionRequestSchema,
  BrowserActionSchema,
  WriteFileRequestSchema,
  ReadFileQuerySchema,
  ListFilesResponseSchema,
  SandboxStatusSchema,
  ExecutionStatusSchema,
  isAllowedBrowserAction,
  isSafeFilePath,
} from "../src/sandbox/schemas.js";

describe("Sandbox Schema Validation", () => {
  describe("CreateSandboxRequestSchema", () => {
    it("should validate minimal request", () => {
      const result = CreateSandboxRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should validate full request", () => {
      const result = CreateSandboxRequestSchema.safeParse({
        projectId: "proj_123",
        template: "rubic-desktop",
        config: {
          timeout: 300000,
          memory: 2048,
          env: { NODE_ENV: "production" },
        },
      });
      expect(result.success).toBe(true);
    });

    it("should reject negative timeout", () => {
      const result = CreateSandboxRequestSchema.safeParse({
        config: { timeout: -1000 },
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative memory", () => {
      const result = CreateSandboxRequestSchema.safeParse({
        config: { memory: -512 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("CreateSandboxResponseSchema", () => {
    it("should validate valid response", () => {
      const result = CreateSandboxResponseSchema.safeParse({
        id: "sbx_123",
        status: "running",
        e2bSandboxId: "e2b_xyz",
        hostname: "123-abc.e2b.app",
        template: "rubic-desktop",
        vncUrl: "https://6080-e2b-xyz.e2b.app",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid status", () => {
      const result = CreateSandboxResponseSchema.safeParse({
        id: "sbx_123",
        status: "stopped", // Must be "running" for create response
        e2bSandboxId: "e2b_xyz",
        hostname: "123-abc.e2b.app",
        template: "rubic-desktop",
        vncUrl: "https://6080-e2b-xyz.e2b.app",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid VNC URL", () => {
      const result = CreateSandboxResponseSchema.safeParse({
        id: "sbx_123",
        status: "running",
        e2bSandboxId: "e2b_xyz",
        hostname: "123-abc.e2b.app",
        template: "rubic-desktop",
        vncUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ExecuteCodeRequestSchema", () => {
    it("should validate Python code execution", () => {
      const result = ExecuteCodeRequestSchema.safeParse({
        code: "print('hello world')",
        language: "python",
        timeout: 30000,
      });
      expect(result.success).toBe(true);
    });

    it("should validate JavaScript code execution", () => {
      const result = ExecuteCodeRequestSchema.safeParse({
        code: "console.log('hello world')",
        language: "javascript",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty code", () => {
      const result = ExecuteCodeRequestSchema.safeParse({
        code: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing code", () => {
      const result = ExecuteCodeRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it("should reject negative timeout", () => {
      const result = ExecuteCodeRequestSchema.safeParse({
        code: "print('test')",
        timeout: -1000,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ExecuteCodeResponseSchema", () => {
    it("should validate successful execution", () => {
      const result = ExecuteCodeResponseSchema.safeParse({
        id: "exec_123",
        status: "completed",
        stdout: "hello world\n",
        stderr: "",
        exitCode: 0,
        error: null,
        results: [],
        text: "hello world",
        executionTimeMs: 125,
      });
      expect(result.success).toBe(true);
    });

    it("should validate failed execution with error", () => {
      const result = ExecuteCodeResponseSchema.safeParse({
        id: "exec_123",
        status: "failed",
        stdout: "",
        stderr: "SyntaxError: invalid syntax\n",
        exitCode: 1,
        error: {
          name: "SyntaxError",
          value: "invalid syntax",
          traceback: "Traceback...",
        },
        results: [],
        text: "",
        executionTimeMs: 50,
      });
      expect(result.success).toBe(true);
    });

    it("should validate timeout status", () => {
      const result = ExecuteCodeResponseSchema.safeParse({
        id: "exec_123",
        status: "timeout",
        stdout: "",
        stderr: "",
        exitCode: 124,
        error: null,
        results: [],
        text: "",
        executionTimeMs: 30000,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ShellCommandRequestSchema", () => {
    it("should validate shell command", () => {
      const result = ShellCommandRequestSchema.safeParse({
        command: "ls -la",
        timeout: 10000,
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty command", () => {
      const result = ShellCommandRequestSchema.safeParse({
        command: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing command", () => {
      const result = ShellCommandRequestSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("ShellCommandResponseSchema", () => {
    it("should validate successful command", () => {
      const result = ShellCommandResponseSchema.safeParse({
        id: "exec_123",
        stdout: "total 24\n-rw-r--r-- 1 user user 1234 Jan 1 12:00 file.txt",
        stderr: "",
        exitCode: 0,
        executionTimeMs: 85,
      });
      expect(result.success).toBe(true);
    });

    it("should validate failed command", () => {
      const result = ShellCommandResponseSchema.safeParse({
        id: "exec_123",
        stdout: "",
        stderr: "ls: cannot access 'missing': No such file or directory",
        exitCode: 2,
        executionTimeMs: 45,
      });
      expect(result.success).toBe(true);
    });
  });

  describe("BrowserActionSchema", () => {
    it("should validate all allowed actions", () => {
      const allowedActions = [
        "navigate",
        "view",
        "click",
        "input",
        "scroll",
        "scroll_up",
        "scroll_down",
        "key_press",
        "press_key",
        "move_mouse",
        "select_option",
        "console_exec",
        "console_view",
        "screenshot",
        "take_screenshot",
        "restart",
        "health",
      ];

      for (const action of allowedActions) {
        const result = BrowserActionSchema.safeParse(action);
        expect(result.success).toBe(true);
      }
    });

    it("should reject disallowed actions", () => {
      const disallowedActions = ["eval", "delete", "exec", "system", "hack"];

      for (const action of disallowedActions) {
        const result = BrowserActionSchema.safeParse(action);
        expect(result.success).toBe(false);
      }
    });
  });

  describe("BrowserActionRequestSchema", () => {
    it("should validate screenshot action", () => {
      const result = BrowserActionRequestSchema.safeParse({
        action: "screenshot",
        params: {},
      });
      expect(result.success).toBe(true);
    });

    it("should validate navigate action with URL", () => {
      const result = BrowserActionRequestSchema.safeParse({
        action: "navigate",
        params: { url: "https://example.com" },
      });
      expect(result.success).toBe(true);
    });

    it("should validate click action with selector", () => {
      const result = BrowserActionRequestSchema.safeParse({
        action: "click",
        params: { selector: "#submit-btn" },
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid action", () => {
      const result = BrowserActionRequestSchema.safeParse({
        action: "malicious_action",
        params: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe("File Operations Schemas", () => {
    it("should validate write file request", () => {
      const result = WriteFileRequestSchema.safeParse({
        path: "/home/user/project/index.ts",
        content: "console.log('Hello, world!');",
      });
      expect(result.success).toBe(true);
    });

    it("should reject write file with empty path", () => {
      const result = WriteFileRequestSchema.safeParse({
        path: "",
        content: "test",
      });
      expect(result.success).toBe(false);
    });

    it("should validate read file query", () => {
      const result = ReadFileQuerySchema.safeParse({
        path: "/home/user/project/index.ts",
      });
      expect(result.success).toBe(true);
    });

    it("should reject read file with empty path", () => {
      const result = ReadFileQuerySchema.safeParse({
        path: "",
      });
      expect(result.success).toBe(false);
    });

    it("should validate list files response", () => {
      const result = ListFilesResponseSchema.safeParse({
        files: [
          {
            name: "index.ts",
            path: "/home/user/project/index.ts",
            type: "file",
            size: 1234,
          },
          {
            name: "src",
            path: "/home/user/project/src",
            type: "dir",
          },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("SandboxStatusSchema", () => {
    it("should validate all sandbox statuses", () => {
      const statuses = ["pending", "running", "stopped", "terminated", "error"];
      for (const status of statuses) {
        const result = SandboxStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid status", () => {
      const result = SandboxStatusSchema.safeParse("unknown");
      expect(result.success).toBe(false);
    });
  });

  describe("ExecutionStatusSchema", () => {
    it("should validate all execution statuses", () => {
      const statuses = ["pending", "running", "completed", "failed", "timeout"];
      for (const status of statuses) {
        const result = ExecutionStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid status", () => {
      const result = ExecutionStatusSchema.safeParse("cancelled");
      expect(result.success).toBe(false);
    });
  });
});

describe("Validation Helpers", () => {
  describe("isAllowedBrowserAction", () => {
    it("should return true for allowed actions", () => {
      expect(isAllowedBrowserAction("navigate")).toBe(true);
      expect(isAllowedBrowserAction("screenshot")).toBe(true);
      expect(isAllowedBrowserAction("click")).toBe(true);
    });

    it("should return false for disallowed actions", () => {
      expect(isAllowedBrowserAction("eval")).toBe(false);
      expect(isAllowedBrowserAction("delete")).toBe(false);
      expect(isAllowedBrowserAction("malicious")).toBe(false);
    });
  });

  describe("isSafeFilePath", () => {
    it("should allow safe paths in /home/user", () => {
      expect(isSafeFilePath("/home/user/project/index.ts")).toBe(true);
      expect(isSafeFilePath("/home/user/file.txt")).toBe(true);
      expect(isSafeFilePath("relative/path/file.txt")).toBe(true);
    });

    it("should reject path traversal attempts", () => {
      expect(isSafeFilePath("/home/user/../etc/passwd")).toBe(false);
      expect(isSafeFilePath("../../etc/passwd")).toBe(false);
      expect(isSafeFilePath("/home/user/project/../../../etc")).toBe(false);
    });

    it("should reject absolute paths outside /home/user", () => {
      expect(isSafeFilePath("/etc/passwd")).toBe(false);
      expect(isSafeFilePath("/var/log/system.log")).toBe(false);
      expect(isSafeFilePath("/root/.ssh/id_rsa")).toBe(false);
    });
  });
});
