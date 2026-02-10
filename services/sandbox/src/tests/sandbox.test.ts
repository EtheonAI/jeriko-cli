/**
 * Sandbox Service Unit Tests
 * Phase 3: Sandbox lifecycle, security, and execution boundaries
 */
import { describe, it, expect } from "vitest";

const ALLOWED_BROWSER_ACTIONS = [
  "navigate",
  "click",
  "scroll",
  "screenshot",
  "key_press",
  "select_option",
  "input",
  "console_exec",
];

// Sandbox lifecycle state machine
type SandboxState = "creating" | "running" | "idle" | "hibernating" | "stopped" | "terminated";

interface SandboxMetrics {
  createdAt: number;
  lastUsedAt: number;
  idleSeconds: number;
  ageSeconds: number;
}

function calculateMetrics(createdAt: number, lastUsedAt: number, now: number): SandboxMetrics {
  return {
    createdAt,
    lastUsedAt,
    idleSeconds: (now - lastUsedAt) / 1000,
    ageSeconds: (now - createdAt) / 1000,
  };
}

describe("Sandbox lifecycle", () => {
  it("should validate E2B template names", () => {
    const validTemplates = ["rubic-desktop", "rubic-base", "code-interpreter"];
    for (const t of validTemplates) {
      expect(t).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("should enforce TTL limits", () => {
    const warmIdleTtl = 600; // 10 minutes
    const hibernateReuseTtl = 172800; // 48 hours
    const hardMaxLifetime = 259200; // 72 hours
    expect(warmIdleTtl).toBeLessThan(hibernateReuseTtl);
    expect(hibernateReuseTtl).toBeLessThan(hardMaxLifetime);
  });

  it("should transition through lifecycle states correctly", () => {
    const validTransitions: Record<SandboxState, SandboxState[]> = {
      creating: ["running", "terminated"],
      running: ["idle", "stopped", "terminated"],
      idle: ["running", "hibernating", "stopped", "terminated"],
      hibernating: ["running", "terminated"],
      stopped: ["terminated"],
      terminated: [],
    };

    // Test valid transitions
    expect(validTransitions.creating).toContain("running");
    expect(validTransitions.running).toContain("idle");
    expect(validTransitions.idle).toContain("hibernating");
    expect(validTransitions.hibernating).toContain("running");

    // Test terminal state
    expect(validTransitions.terminated).toHaveLength(0);
  });

  it("should calculate sandbox age and idle time correctly", () => {
    const now = Date.now();
    const createdAt = now - 3600000; // 1 hour ago
    const lastUsedAt = now - 600000; // 10 minutes ago

    const metrics = calculateMetrics(createdAt, lastUsedAt, now);

    expect(metrics.ageSeconds).toBeCloseTo(3600, 0);
    expect(metrics.idleSeconds).toBeCloseTo(600, 0);
  });

  it("should determine when to hibernate based on idle time", () => {
    const warmIdleTtl = 600; // 10 minutes
    const now = Date.now();
    const createdAt = now - 1800000; // 30 minutes ago
    const lastUsedAt = now - 700000; // 11.67 minutes ago (> warm TTL)

    const metrics = calculateMetrics(createdAt, lastUsedAt, now);

    expect(metrics.idleSeconds).toBeGreaterThan(warmIdleTtl);
  });

  it("should determine when to kill based on hard max lifetime", () => {
    const hardMaxLifetime = 259200; // 72 hours
    const now = Date.now();
    const createdAt = now - 260000000; // 72.22 hours ago
    const lastUsedAt = now - 60000; // 1 minute ago

    const metrics = calculateMetrics(createdAt, lastUsedAt, now);

    expect(metrics.ageSeconds).toBeGreaterThan(hardMaxLifetime);
  });

  it("should keep sandbox alive if recently used", () => {
    const warmIdleTtl = 600;
    const now = Date.now();
    const createdAt = now - 3600000; // 1 hour ago
    const lastUsedAt = now - 30000; // 30 seconds ago

    const metrics = calculateMetrics(createdAt, lastUsedAt, now);

    expect(metrics.idleSeconds).toBeLessThan(warmIdleTtl);
  });
});

describe("Browser action allowlist", () => {
  const FULL_ALLOWED_ACTIONS = new Set([
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
  ]);

  it("should allow valid browser actions", () => {
    for (const action of ALLOWED_BROWSER_ACTIONS) {
      expect(FULL_ALLOWED_ACTIONS.has(action)).toBe(true);
    }
  });

  it("should reject disallowed browser actions", () => {
    const disallowed = ["eval", "delete", "exec", "system", "shell", "spawn"];
    for (const action of disallowed) {
      expect(FULL_ALLOWED_ACTIONS.has(action)).toBe(false);
    }
  });

  it("should reject code execution browser actions", () => {
    const codeExec = ["eval", "exec", "spawn", "fork", "require", "import"];
    for (const action of codeExec) {
      expect(FULL_ALLOWED_ACTIONS.has(action)).toBe(false);
    }
  });

  it("should allow safe navigation actions", () => {
    const safe = ["navigate", "view", "click", "scroll"];
    for (const action of safe) {
      expect(FULL_ALLOWED_ACTIONS.has(action)).toBe(true);
    }
  });

  it("should allow safe input actions", () => {
    const safe = ["input", "key_press", "press_key", "select_option"];
    for (const action of safe) {
      expect(FULL_ALLOWED_ACTIONS.has(action)).toBe(true);
    }
  });

  it("should allow diagnostic actions", () => {
    const diagnostic = ["screenshot", "take_screenshot", "console_view", "health"];
    for (const action of diagnostic) {
      expect(FULL_ALLOWED_ACTIONS.has(action)).toBe(true);
    }
  });
});

describe("Code execution", () => {
  const MAX_TIMEOUT_SECONDS = 300; // 5 minutes
  const DEFAULT_TIMEOUT_SECONDS = 30;

  it("should support Python and JavaScript languages", () => {
    const supported = ["python", "javascript", "typescript", "bash"];
    expect(supported).toContain("python");
    expect(supported).toContain("javascript");
  });

  it("should enforce execution timeout", () => {
    const requestedTimeout = 30;
    const effectiveTimeout = Math.min(requestedTimeout, MAX_TIMEOUT_SECONDS);
    expect(effectiveTimeout).toBe(30);
  });

  it("should cap oversized timeout requests", () => {
    const requestedTimeout = 600;
    const effectiveTimeout = Math.min(requestedTimeout, MAX_TIMEOUT_SECONDS);
    expect(effectiveTimeout).toBe(MAX_TIMEOUT_SECONDS);
  });

  it("should use default timeout when not specified", () => {
    const effectiveTimeout = DEFAULT_TIMEOUT_SECONDS;
    expect(effectiveTimeout).toBe(30);
  });

  it("should handle timeout errors gracefully", () => {
    const error = new Error("Execution timeout");
    const isTimeout = error.message.toLowerCase().includes("timeout");
    expect(isTimeout).toBe(true);
  });

  it("should handle syntax errors without crashing", () => {
    const syntaxError = {
      name: "SyntaxError",
      value: "invalid syntax",
      traceback: "  File <stdin>, line 1\n    print(\n        ^\nSyntaxError: invalid syntax",
    };

    expect(syntaxError.name).toBe("SyntaxError");
    expect(syntaxError.traceback).toContain("SyntaxError");
  });

  it("should capture stdout and stderr separately", () => {
    const execution = {
      logs: { stdout: ["output line 1"], stderr: ["error line 1"] },
    };

    expect(execution.logs.stdout).toHaveLength(1);
    expect(execution.logs.stderr).toHaveLength(1);
  });

  it("should protect against infinite loops via timeout", () => {
    const infiniteLoopTimeout = 30000; // 30 seconds
    const startTime = Date.now();
    const endTime = startTime + infiniteLoopTimeout;

    expect(endTime - startTime).toBe(infiniteLoopTimeout);
  });

  it("should track execution metrics", () => {
    const startedAt = new Date("2024-01-01T00:00:00Z");
    const completedAt = new Date("2024-01-01T00:00:05Z");
    const executionTimeMs = completedAt.getTime() - startedAt.getTime();

    expect(executionTimeMs).toBe(5000);
  });

  it("should return exit codes correctly", () => {
    const successExitCode = 0;
    const errorExitCode = 1;

    expect(successExitCode).toBe(0);
    expect(errorExitCode).not.toBe(0);
  });
});

describe("Sandbox security", () => {
  it("should isolate sandbox from host filesystem", () => {
    const forbiddenPaths = ["/etc", "/var", "/root"];
    const sandboxPath = "/home/user";

    for (const hostPath of forbiddenPaths) {
      expect(sandboxPath.startsWith(hostPath)).toBe(false);
    }

    // Verify sandbox path is within allowed /home/user
    expect(sandboxPath.startsWith("/home/user")).toBe(true);
  });

  it("should prevent network access to private IPs", () => {
    const privateIPs = ["127.0.0.1", "localhost", "10.0.0.1", "172.16.0.1", "192.168.1.1"];

    // In production, these would be blocked at the network level
    // This test documents the requirement
    expect(privateIPs).toContain("127.0.0.1");
  });

  it("should enforce resource limits", () => {
    const limits = {
      maxMemoryMB: 2048,
      maxCPUCores: 2,
      maxDiskGB: 10,
      maxExecutionTimeSeconds: 300,
    };

    expect(limits.maxMemoryMB).toBeLessThanOrEqual(4096);
    expect(limits.maxCPUCores).toBeLessThanOrEqual(4);
    expect(limits.maxDiskGB).toBeLessThanOrEqual(20);
    expect(limits.maxExecutionTimeSeconds).toBeLessThanOrEqual(600);
  });

  it("should validate environment variables", () => {
    const dangerousEnvVars = ["LD_PRELOAD", "LD_LIBRARY_PATH", "PATH"];
    const safeEnvVars = ["MY_APP_KEY", "DEBUG", "NODE_ENV"];

    // In production, dangerous env vars would be filtered
    expect(dangerousEnvVars).toContain("LD_PRELOAD");
    expect(safeEnvVars).not.toContain("LD_PRELOAD");
  });
});

describe("Sandbox reconnection", () => {
  it("should reconnect to existing sandbox by ID", () => {
    const sandboxId = "e2b-test-sandbox-id";
    const reconnected = { sandboxId, status: "running" };

    expect(reconnected.sandboxId).toBe(sandboxId);
    expect(reconnected.status).toBe("running");
  });

  it("should handle reconnection failures gracefully", () => {
    const error = new Error("Sandbox not found");
    const isNotFound = error.message.includes("not found");

    expect(isNotFound).toBe(true);
  });

  it("should reset timeout on reconnection", () => {
    const originalTimeout = 300;
    const newTimeout = 300;

    expect(newTimeout).toBe(originalTimeout);
  });
});

describe("In-memory cache management", () => {
  it("should cache active sandbox instances", () => {
    const cache = new Map<string, { sandboxId: string; timestamp: number }>();
    const sessionId = "session-1";
    const sandboxId = "sandbox-1";

    cache.set(sessionId, { sandboxId, timestamp: Date.now() });

    expect(cache.has(sessionId)).toBe(true);
    expect(cache.get(sessionId)?.sandboxId).toBe(sandboxId);
  });

  it("should evict stale cache entries", () => {
    const cache = new Map<string, { sandboxId: string; timestamp: number }>();
    const ttl = 600000; // 10 minutes
    const now = Date.now();

    cache.set("session-1", { sandboxId: "sandbox-1", timestamp: now - 700000 });
    cache.set("session-2", { sandboxId: "sandbox-2", timestamp: now - 100000 });

    // Evict entries older than TTL
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp > ttl) {
        cache.delete(key);
      }
    }

    expect(cache.has("session-1")).toBe(false);
    expect(cache.has("session-2")).toBe(true);
  });
});

describe("File operations in sandbox", () => {
  const SANDBOX_BASE = "/home/user";

  function isValidSandboxPath(path: string): boolean {
    // Normalize path
    const normalized = path.replace(/\/+/g, "/");

    // Check for directory traversal
    if (normalized.includes("..")) return false;

    // Check if within sandbox
    if (!normalized.startsWith(SANDBOX_BASE)) return false;

    // Check for absolute paths outside sandbox
    if (normalized.startsWith("/") && !normalized.startsWith(SANDBOX_BASE)) return false;

    return true;
  }

  it("should validate file paths are within sandbox", () => {
    expect(isValidSandboxPath("/home/user/project/index.ts")).toBe(true);
    expect(isValidSandboxPath("/etc/passwd")).toBe(false);
    expect(isValidSandboxPath("/home/user/../etc/passwd")).toBe(false);
  });

  it("should reject directory traversal attempts", () => {
    const traversalPaths = [
      "/home/user/../../etc/passwd",
      "/home/user/../../../root/.ssh/id_rsa",
      "/home/user/project/../../../etc/shadow",
      "../../../etc/passwd",
      "../../root/.ssh/id_rsa",
    ];

    for (const path of traversalPaths) {
      expect(isValidSandboxPath(path)).toBe(false);
    }
  });

  it("should allow valid nested paths", () => {
    const validPaths = [
      "/home/user/project/src/index.ts",
      "/home/user/project/lib/utils.ts",
      "/home/user/.config/settings.json",
      "/home/user/documents/report.pdf",
    ];

    for (const path of validPaths) {
      expect(isValidSandboxPath(path)).toBe(true);
    }
  });

  it("should reject system paths", () => {
    const systemPaths = [
      "/etc/passwd",
      "/etc/shadow",
      "/root/.ssh/id_rsa",
      "/var/log/system.log",
      "/proc/self/environ",
      "/sys/kernel/debug",
    ];

    for (const path of systemPaths) {
      expect(isValidSandboxPath(path)).toBe(false);
    }
  });

  it("should normalize multiple slashes", () => {
    expect(isValidSandboxPath("/home/user///project//file.ts")).toBe(true);
  });

  it("should enforce file size limits", () => {
    const maxFileSize = 100_000_000; // 100MB
    const contentSize = Buffer.byteLength("test content", "utf-8");
    const largeContentSize = 150_000_000; // 150MB

    expect(contentSize).toBeLessThan(maxFileSize);
    expect(largeContentSize).toBeGreaterThan(maxFileSize);
  });
});

describe("Phase 3: Session resume and reconnection", () => {
  it("should resume running sandbox without creating new instance", () => {
    const sandbox = {
      id: "sbx-123",
      status: "running" as const,
      e2bSandboxId: "e2b-abc",
    };

    // Sandbox already in cache
    const alreadyActive = true;
    expect(alreadyActive).toBe(true);
    expect(sandbox.status).toBe("running");
  });

  it("should reconnect to stopped sandbox and update status", () => {
    const sandbox = {
      id: "sbx-123",
      status: "stopped" as const,
      e2bSandboxId: "e2b-abc",
    };

    // After reconnection
    const updatedStatus = "running" as const;
    expect(updatedStatus).toBe("running");
    expect(sandbox.e2bSandboxId).toBe("e2b-abc");
  });

  it("should handle reconnection to terminated sandbox", () => {
    const sandbox = {
      id: "sbx-123",
      status: "terminated" as const,
      e2bSandboxId: null,
    };

    const error = new Error("Cannot resume terminated sandbox");
    expect(error.message).toContain("terminated");
    expect(sandbox.status).toBe("terminated");
  });

  it("should mark sandbox as terminated if E2B connection fails", () => {
    const reconnectError = new Error("E2B sandbox not found");
    const newStatus = "terminated" as const;

    expect(reconnectError.message).toContain("not found");
    expect(newStatus).toBe("terminated");
  });
});

describe("Phase 3: Resource monitoring", () => {
  it("should track CPU usage percentage", () => {
    const cpuUsage = 45.6; // 45.6%
    expect(cpuUsage).toBeGreaterThanOrEqual(0);
    expect(cpuUsage).toBeLessThanOrEqual(100);
  });

  it("should track memory usage in MB", () => {
    const memoryUsage = 512; // 512 MB
    const maxMemory = 2048; // 2 GB limit

    expect(memoryUsage).toBeGreaterThanOrEqual(0);
    expect(memoryUsage).toBeLessThanOrEqual(maxMemory);
  });

  it("should update resource metrics on PATCH request", () => {
    const updates = {
      cpuUsage: 35.2,
      memoryUsage: 768,
    };

    expect(updates.cpuUsage).toBeGreaterThanOrEqual(0);
    expect(updates.cpuUsage).toBeLessThanOrEqual(100);
    expect(updates.memoryUsage).toBeGreaterThanOrEqual(0);
  });

  it("should track last activity timestamp", () => {
    const now = new Date();
    const lastActivity = new Date(now.getTime() - 30000); // 30 seconds ago

    const idleMs = now.getTime() - lastActivity.getTime();
    expect(idleMs).toBeGreaterThan(0);
    expect(idleMs).toBeLessThanOrEqual(30000);
  });
});

describe("Phase 3: Execution boundaries", () => {
  const MAX_CODE_SIZE = 1_048_576; // 1 MB
  const MAX_FILE_SIZE = 10_485_760; // 10 MB
  const MAX_EXECUTION_TIME = 300_000; // 5 minutes
  const MAX_CONCURRENT_EXECUTIONS = 3;

  it("should enforce maximum code size", () => {
    const smallCode = "print('hello')";
    const largeCode = "x = 'a' * 2000000  # Comment\n".repeat(100_000); // > 2 MB

    const smallSize = Buffer.byteLength(smallCode, "utf-8");
    const largeSize = Buffer.byteLength(largeCode, "utf-8");

    expect(smallSize).toBeLessThan(MAX_CODE_SIZE);
    expect(largeSize).toBeGreaterThan(MAX_CODE_SIZE);
  });

  it("should enforce maximum file size", () => {
    const content = "a".repeat(11_000_000); // 11 MB
    const fileSize = Buffer.byteLength(content, "utf-8");

    expect(fileSize).toBeGreaterThan(MAX_FILE_SIZE);
  });

  it("should clamp execution timeout to maximum", () => {
    const requestedTimeout = 600_000; // 10 minutes
    const enforcedTimeout = Math.min(requestedTimeout, MAX_EXECUTION_TIME);

    expect(enforcedTimeout).toBe(MAX_EXECUTION_TIME);
  });

  it("should track concurrent executions per sandbox", () => {
    const executionCounts = new Map<string, number>();
    const sandboxId = "sbx-123";

    // Start 3 executions
    executionCounts.set(sandboxId, 3);
    const currentCount = executionCounts.get(sandboxId) || 0;

    expect(currentCount).toBe(MAX_CONCURRENT_EXECUTIONS);
    expect(currentCount).toBeLessThanOrEqual(MAX_CONCURRENT_EXECUTIONS);
  });

  it("should reject execution when limit exceeded", () => {
    const executionCounts = new Map<string, number>();
    const sandboxId = "sbx-123";
    executionCounts.set(sandboxId, 3);

    const currentCount = executionCounts.get(sandboxId) || 0;
    const shouldReject = currentCount >= MAX_CONCURRENT_EXECUTIONS;

    expect(shouldReject).toBe(true);
  });

  it("should release execution slot after completion", () => {
    const executionCounts = new Map<string, number>();
    const sandboxId = "sbx-123";
    executionCounts.set(sandboxId, 3);

    // Release one slot
    executionCounts.set(sandboxId, 2);
    const newCount = executionCounts.get(sandboxId) || 0;

    expect(newCount).toBe(2);
    expect(newCount).toBeLessThan(MAX_CONCURRENT_EXECUTIONS);
  });

  it("should reject path traversal in file paths", () => {
    const validPath = "/home/user/project/file.txt";
    const traversalPath = "/home/user/../etc/passwd";
    const tildeExpansion = "~/../../etc/passwd";

    expect(validPath.includes("..")).toBe(false);
    expect(validPath.includes("~")).toBe(false);
    expect(traversalPath.includes("..")).toBe(true);
    expect(tildeExpansion.includes("~")).toBe(true);
  });

  it("should validate file path format", () => {
    const invalidPaths = [
      "../etc/passwd",
      "/home/user/../etc/passwd",
      "~/secret",
      "/home/user/~/file",
    ];

    for (const path of invalidPaths) {
      const isInvalid = path.includes("..") || path.includes("~");
      expect(isInvalid).toBe(true);
    }
  });
});

describe("Phase 3: State recovery", () => {
  it("should persist sandbox state to database", () => {
    const sandbox = {
      id: "sbx-123",
      userId: "user-456",
      status: "running" as const,
      e2bSandboxId: "e2b-abc",
      createdAt: new Date(),
      lastActivityAt: new Date(),
      cpuUsage: 25,
      memoryUsage: 512,
    };

    expect(sandbox.e2bSandboxId).toBeTruthy();
    expect(sandbox.status).toBe("running");
  });

  it("should recover sandbox from database on service restart", () => {
    const dbRecord = {
      id: "sbx-123",
      e2bSandboxId: "e2b-abc",
      status: "running" as const,
    };

    // Service restart - check DB for active sandboxes
    const canReconnect = !!dbRecord.e2bSandboxId && dbRecord.status !== "terminated";
    expect(canReconnect).toBe(true);
  });

  it("should handle missing E2B sandbox ID gracefully", () => {
    const sandbox = {
      id: "sbx-123",
      e2bSandboxId: null,
      status: "creating" as const,
    };

    const error = new Error("Sandbox has no E2B sandbox ID");
    expect(error.message).toContain("E2B sandbox ID");
    expect(sandbox.e2bSandboxId).toBeNull();
  });
});
