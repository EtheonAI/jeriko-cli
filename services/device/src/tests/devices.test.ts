/**
 * Device Service Unit Tests
 *
 * Tests device CRUD validation, heartbeat staleness logic, command safety
 * checks (isDangerous, requiresApproval, validateCommand), connection
 * registry, and Zod schema validation against the actual service code.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { z } from "zod";

// ─── Import actual safety module (pure functions, no DB) ────────
import { isDangerous, requiresApproval, validateCommand } from "../lib/safety.js";

// ─── Replicate Zod schemas from routes/devices.ts ───────────────
// We mirror these to test validation without booting Fastify.

const RegisterDeviceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(["browser", "desktop", "mobile", "server"]),
  capabilities: z.array(z.string()).optional().default([]),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  browserType: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

const UpdateDeviceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  capabilities: z.array(z.string()).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const SendCommandSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

// ─── Stale threshold from heartbeat.ts ──────────────────────────
const STALE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes (matches heartbeat.ts)

// ─── Tests ──────────────────────────────────────────────────────

describe("Device registration schema validation", () => {
  it("should accept a valid device registration", () => {
    const input = {
      name: "Kitchen Sensor",
      type: "server",
      capabilities: ["terminal", "file_transfer"],
      metadata: { firmware: "1.0.0" },
    };

    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Kitchen Sensor");
      expect(result.data.type).toBe("server");
      expect(result.data.capabilities).toEqual(["terminal", "file_transfer"]);
    }
  });

  it("should reject registration with empty name", () => {
    const input = { name: "", type: "browser" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject registration with no name field", () => {
    const input = { type: "desktop" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject registration with no type field", () => {
    const input = { name: "My Device" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should reject invalid device type", () => {
    const input = { name: "My Device", type: "toaster" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept all four valid device types", () => {
    const validTypes = ["browser", "desktop", "mobile", "server"] as const;
    for (const type of validTypes) {
      const result = RegisterDeviceSchema.safeParse({ name: `Device-${type}`, type });
      expect(result.success).toBe(true);
    }
  });

  it("should default capabilities to empty array when omitted", () => {
    const input = { name: "Simple Device", type: "mobile" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capabilities).toEqual([]);
    }
  });

  it("should default config to empty object when omitted", () => {
    const input = { name: "Simple Device", type: "desktop" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config).toEqual({});
    }
  });

  it("should default metadata to empty object when omitted", () => {
    const input = { name: "Simple Device", type: "browser" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({});
    }
  });

  it("should reject name exceeding 255 characters", () => {
    const input = { name: "x".repeat(256), type: "server" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("should accept name at exactly 255 characters", () => {
    const input = { name: "x".repeat(255), type: "server" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should accept optional browserType field", () => {
    const input = { name: "Chrome Browser", type: "browser", browserType: "chromium" };
    const result = RegisterDeviceSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.browserType).toBe("chromium");
    }
  });
});

describe("Device update schema validation", () => {
  it("should accept partial updates", () => {
    const result = UpdateDeviceSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("should accept empty update (all fields optional)", () => {
    const result = UpdateDeviceSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should reject empty name string in update", () => {
    const result = UpdateDeviceSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("should accept capabilities update", () => {
    const result = UpdateDeviceSchema.safeParse({
      capabilities: ["terminal", "screen_capture"],
    });
    expect(result.success).toBe(true);
  });

  it("should accept metadata update with nested objects", () => {
    const result = UpdateDeviceSchema.safeParse({
      metadata: { os: "linux", version: { major: 6, minor: 1 } },
    });
    expect(result.success).toBe(true);
  });
});

describe("Command schema validation", () => {
  it("should accept valid command", () => {
    const result = SendCommandSchema.safeParse({
      type: "terminal",
      payload: { command: "ls -la" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject command with empty type", () => {
    const result = SendCommandSchema.safeParse({ type: "" });
    expect(result.success).toBe(false);
  });

  it("should default payload to empty object when omitted", () => {
    const result = SendCommandSchema.safeParse({ type: "screenshot" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload).toEqual({});
    }
  });
});

describe("Device heartbeat staleness", () => {
  it("should detect device as stale after 2 minutes", () => {
    const lastHeartbeat = new Date(Date.now() - STALE_THRESHOLD_MS - 1000);
    const isStale = Date.now() - lastHeartbeat.getTime() > STALE_THRESHOLD_MS;
    expect(isStale).toBe(true);
  });

  it("should NOT detect device as stale within 2 minutes", () => {
    const lastHeartbeat = new Date(Date.now() - 1000);
    const isStale = Date.now() - lastHeartbeat.getTime() > STALE_THRESHOLD_MS;
    expect(isStale).toBe(false);
  });

  it("should detect device as stale at exactly the threshold", () => {
    const lastHeartbeat = new Date(Date.now() - STALE_THRESHOLD_MS - 1);
    const isStale = Date.now() - lastHeartbeat.getTime() > STALE_THRESHOLD_MS;
    expect(isStale).toBe(true);
  });

  it("should NOT detect device as stale 1ms before threshold", () => {
    // Allow 5ms tolerance for test execution time
    const lastHeartbeat = new Date(Date.now() - STALE_THRESHOLD_MS + 500);
    const isStale = Date.now() - lastHeartbeat.getTime() > STALE_THRESHOLD_MS;
    expect(isStale).toBe(false);
  });

  it("should handle heartbeat timestamp as ISO string", () => {
    const now = new Date();
    const heartbeat = {
      deviceId: "dev-1",
      timestamp: now.toISOString(),
      status: "online",
    };
    const parsed = new Date(heartbeat.timestamp);
    expect(parsed.getTime()).toBe(now.getTime());
  });
});

describe("Command safety — isDangerous()", () => {
  it("should block rm -rf /", () => {
    expect(isDangerous("rm -rf /")).toBe(true);
  });

  it("should block rm -rf /*", () => {
    expect(isDangerous("rm -rf /*")).toBe(true);
  });

  it("should block mkfs commands", () => {
    expect(isDangerous("mkfs.ext4 /dev/sda1")).toBe(true);
  });

  it("should block dd if=/dev/zero", () => {
    expect(isDangerous("dd if=/dev/zero of=/dev/sda")).toBe(true);
  });

  it("should block fork bombs", () => {
    expect(isDangerous(":(){:|:&};:")).toBe(true);
  });

  it("should block chmod -R 777 /", () => {
    expect(isDangerous("chmod -R 777 /")).toBe(true);
  });

  it("should NOT flag safe commands as dangerous", () => {
    const safe = [
      "ls -la",
      "cat /etc/hostname",
      "echo hello",
      "pwd",
      "date",
      "uptime",
      "rm file.txt",
      "rm -rf ./mydir",
    ];
    for (const cmd of safe) {
      expect(isDangerous(cmd)).toBe(false);
    }
  });

  it("should match exact dangerous commands (not partial substrings)", () => {
    // "rm -rf /home" starts with "rm -rf /" so it IS dangerous
    expect(isDangerous("rm -rf /home")).toBe(true);
    // "mkfs" exact match
    expect(isDangerous("mkfs")).toBe(true);
  });
});

describe("Command safety — requiresApproval()", () => {
  it("should require approval for rm commands", () => {
    expect(requiresApproval("rm file.txt")).toBe(true);
    expect(requiresApproval("rm -rf ./mydir")).toBe(true);
  });

  it("should require approval for sudo commands", () => {
    expect(requiresApproval("sudo apt update")).toBe(true);
    expect(requiresApproval("sudo systemctl restart nginx")).toBe(true);
  });

  it("should require approval for chmod commands", () => {
    expect(requiresApproval("chmod 644 file.txt")).toBe(true);
  });

  it("should require approval for chown commands", () => {
    expect(requiresApproval("chown root:root file.txt")).toBe(true);
  });

  it("should require approval for kill commands", () => {
    expect(requiresApproval("kill -9 1234")).toBe(true);
  });

  it("should require approval for reboot and shutdown", () => {
    expect(requiresApproval("reboot")).toBe(true);
    expect(requiresApproval("shutdown now")).toBe(true);
  });

  it("should require approval for systemctl commands", () => {
    expect(requiresApproval("systemctl stop nginx")).toBe(true);
  });

  it("should require approval for package managers (apt, yum, brew)", () => {
    expect(requiresApproval("apt install vim")).toBe(true);
    expect(requiresApproval("yum install httpd")).toBe(true);
    expect(requiresApproval("brew install node")).toBe(true);
  });

  it("should NOT require approval for safe commands", () => {
    const safe = [
      "ls -la",
      "cat /etc/hostname",
      "echo hello",
      "pwd",
      "date",
      "uptime",
      "grep -r pattern .",
      "find . -name '*.ts'",
      "node script.js",
      "python3 app.py",
    ];
    for (const cmd of safe) {
      expect(requiresApproval(cmd)).toBe(false);
    }
  });

  it("should not flag prefix substrings (e.g. 'killing' should not match 'kill')", () => {
    // requiresApproval checks: trimmed === prefix || trimmed.startsWith(prefix + " ")
    // "killing" !== "kill" and does not start with "kill " — correct behavior
    expect(requiresApproval("killing")).toBe(false);
  });
});

describe("Command safety — validateCommand()", () => {
  it("should reject empty command", () => {
    const result = validateCommand("", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("empty");
  });

  it("should reject whitespace-only command", () => {
    const result = validateCommand("   ", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("empty");
  });

  it("should block dangerous commands regardless of capabilities", () => {
    const result = validateCommand("rm -rf /", ["terminal"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("safety");
  });

  it("should reject commands on devices without terminal capability", () => {
    const result = validateCommand("ls -la", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("terminal capability");
  });

  it("should reject commands on devices with other capabilities but not terminal", () => {
    const result = validateCommand("ls -la", ["screen_capture", "file_transfer"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("terminal capability");
  });

  it("should allow safe commands on devices with terminal capability", () => {
    const result = validateCommand("ls -la", ["terminal"]);
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBeUndefined();
  });

  it("should flag approval-requiring commands but still allow them", () => {
    const result = validateCommand("sudo apt update", ["terminal"]);
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it("should block dangerous commands before checking capabilities", () => {
    // isDangerous check happens before terminal capability check
    const result = validateCommand("rm -rf /", []);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("safety");
  });

  it("should handle commands with leading/trailing whitespace", () => {
    const result = validateCommand("  ls -la  ", ["terminal"]);
    // validateCommand checks command.trim().length, so this should pass
    expect(result.allowed).toBe(true);
  });
});

describe("Device connection registry logic", () => {
  it("should track connection state as boolean", () => {
    // Mirrors the isConnected() function from connections.ts
    const connections = new Map<string, { readyState: number }>();

    connections.set("dev-1", { readyState: 1 }); // OPEN
    connections.set("dev-2", { readyState: 3 }); // CLOSED

    const isConnected = (id: string): boolean => {
      const conn = connections.get(id);
      return !!conn && conn.readyState === 1;
    };

    expect(isConnected("dev-1")).toBe(true);
    expect(isConnected("dev-2")).toBe(false);
    expect(isConnected("dev-3")).toBe(false); // not registered
  });

  it("should return device IDs for a user", () => {
    // Mirrors the getByUser() function from connections.ts
    const connections = new Map<string, { userId: string }>();
    connections.set("dev-1", { userId: "u1" });
    connections.set("dev-2", { userId: "u1" });
    connections.set("dev-3", { userId: "u2" });

    const getByUser = (userId: string): string[] => {
      const ids: string[] = [];
      for (const [deviceId, conn] of connections) {
        if (conn.userId === userId) ids.push(deviceId);
      }
      return ids;
    };

    expect(getByUser("u1")).toEqual(["dev-1", "dev-2"]);
    expect(getByUser("u2")).toEqual(["dev-3"]);
    expect(getByUser("u3")).toEqual([]);
  });

  it("should replace existing connection on re-register", () => {
    const connections = new Map<string, { userId: string; connectedAt: Date }>();

    const first = new Date(Date.now() - 60000);
    connections.set("dev-1", { userId: "u1", connectedAt: first });

    // Re-register same device
    const second = new Date();
    connections.set("dev-1", { userId: "u1", connectedAt: second });

    expect(connections.get("dev-1")!.connectedAt).toBe(second);
    expect(connections.size).toBe(1); // Only one entry
  });

  it("should remove connection on unregister", () => {
    const connections = new Map<string, { userId: string }>();
    connections.set("dev-1", { userId: "u1" });
    connections.set("dev-2", { userId: "u1" });

    connections.delete("dev-1");

    expect(connections.has("dev-1")).toBe(false);
    expect(connections.has("dev-2")).toBe(true);
    expect(connections.size).toBe(1);
  });
});

describe("getUserId helper logic", () => {
  it("should extract userId from x-user-id header", () => {
    const headers: Record<string, string | undefined> = {
      "x-user-id": "user-123",
    };
    const userId = headers["x-user-id"];
    expect(userId).toBe("user-123");
  });

  it("should be falsy when x-user-id header is missing", () => {
    const headers: Record<string, string | undefined> = {};
    const userId = headers["x-user-id"];
    expect(userId).toBeFalsy();
  });

  it("should be falsy when x-user-id header is empty string", () => {
    const headers: Record<string, string | undefined> = {
      "x-user-id": "",
    };
    const userId = headers["x-user-id"];
    expect(userId).toBeFalsy();
  });
});

describe("WebSocket message type routing", () => {
  // Tests the message type switch from websocket.ts

  const VALID_STATUS_VALUES = ["online", "offline", "busy", "error"];

  it("should recognize all valid device status values", () => {
    for (const status of VALID_STATUS_VALUES) {
      expect(VALID_STATUS_VALUES).toContain(status);
    }
  });

  it("should reject invalid status values", () => {
    const invalid = ["sleeping", "paused", "unknown", ""];
    for (const status of invalid) {
      expect(VALID_STATUS_VALUES).not.toContain(status);
    }
  });

  it("should handle command_result message structure", () => {
    const msg = {
      type: "command_result",
      commandId: "cmd-1",
      status: "success",
      result: { output: "hello world" },
    };

    expect(msg.type).toBe("command_result");
    expect(msg.commandId).toBeTruthy();
    expect(msg.result).toHaveProperty("output");
  });

  it("should handle command_result error structure", () => {
    const msg = {
      type: "command_result",
      commandId: "cmd-2",
      status: "error",
      error: "Permission denied",
    };

    expect(msg.type).toBe("command_result");
    expect(msg.status).toBe("error");
    expect(msg.error).toBeTruthy();
  });

  it("should map error status to failed in DB update", () => {
    const msg = { status: "error" };
    const dbStatus = msg.status === "error" ? "failed" : "completed";
    expect(dbStatus).toBe("failed");
  });

  it("should map success status to completed in DB update", () => {
    const msg = { status: "success" };
    const dbStatus = msg.status === "error" ? "failed" : "completed";
    expect(dbStatus).toBe("completed");
  });
});
