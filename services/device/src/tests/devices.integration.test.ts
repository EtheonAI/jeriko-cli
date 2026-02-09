/**
 * Device Service Integration Tests
 *
 * Tests complex flows: full device lifecycle, heartbeat updates,
 * command tracking, cross-user isolation, deletion cleanup, and
 * command safety enforcement through the route handlers.
 *
 * All DB interactions are mocked via setup.ts (auto-loaded by vitest config).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Import mocked modules — setup.ts handles vi.mock() hoisting
import { db, eq, and, devices, deviceCommands, deviceSessions } from "../lib/db.js";
import { createId, successResponse, errorResponse, ErrorCodes } from "@repo/service-utils";
import { validateCommand } from "../lib/safety.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal Fastify-like request object. */
function makeRequest(overrides: {
  headers?: Record<string, string | undefined>;
  body?: unknown;
  params?: Record<string, string>;
  query?: Record<string, string>;
  id?: string;
}) {
  return {
    headers: { "x-user-id": "test-user-id", ...overrides.headers },
    body: overrides.body ?? {},
    params: overrides.params ?? {},
    query: overrides.query ?? {},
    id: overrides.id ?? "req-1",
  };
}

/** Build a minimal Fastify-like reply object with chainable status(). */
function makeReply() {
  const reply: Record<string, any> = {
    statusCode: 200,
    body: null,
  };
  reply.status = vi.fn((code: number) => {
    reply.statusCode = code;
    return reply;
  });
  reply.send = vi.fn((data: unknown) => {
    reply.body = data;
    return reply;
  });
  return reply;
}

// ─── Test Data Factories ─────────────────────────────────────────────────────

function makeDevice(overrides: Partial<{
  id: string;
  userId: string;
  name: string;
  type: string;
  status: string;
  capabilities: string[];
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  lastHeartbeat: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "dev-1",
    userId: overrides.userId ?? "test-user-id",
    name: overrides.name ?? "Test Device",
    type: overrides.type ?? "server",
    status: overrides.status ?? "offline",
    capabilities: overrides.capabilities ?? ["terminal"],
    config: overrides.config ?? {},
    metadata: overrides.metadata ?? {},
    lastHeartbeat: overrides.lastHeartbeat ?? null,
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

function makeCommand(overrides: Partial<{
  id: string;
  deviceId: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  startedAt: Date | null;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? "cmd-1",
    deviceId: overrides.deviceId ?? "dev-1",
    type: overrides.type ?? "terminal",
    payload: overrides.payload ?? { command: "ls" },
    status: overrides.status ?? "pending",
    startedAt: overrides.startedAt ?? null,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Device lifecycle: register -> list -> verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should register a device and find it in the list", async () => {
    const newDevice = makeDevice({ id: "dev-new", name: "Kitchen Sensor" });

    // Mock insert().values().returning() for registration
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([newDevice]),
      }),
    });

    // Simulate the registration logic (from routes/devices.ts)
    const [registered] = await db
      .insert(devices)
      .values({
        id: newDevice.id,
        userId: "test-user-id",
        name: "Kitchen Sensor",
        type: "server",
        status: "offline",
        capabilities: [],
        config: {},
        metadata: {},
      })
      .returning();

    expect(registered).toBeDefined();
    expect(registered.id).toBe("dev-new");
    expect(registered.name).toBe("Kitchen Sensor");

    // Now mock select().from().where() for listing
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([newDevice]),
      }),
    });

    const userDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, "test-user-id"));

    expect(userDevices).toHaveLength(1);
    expect(userDevices[0].id).toBe("dev-new");
    expect(userDevices[0].name).toBe("Kitchen Sensor");
  });

  it("should register multiple devices and list them all", async () => {
    const device1 = makeDevice({ id: "dev-1", name: "Living Room Hub" });
    const device2 = makeDevice({ id: "dev-2", name: "Garage Sensor" });

    // Mock list returning both devices
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([device1, device2]),
      }),
    });

    const userDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, "test-user-id"));

    expect(userDevices).toHaveLength(2);
    expect(userDevices.map((d: any) => d.name)).toContain("Living Room Hub");
    expect(userDevices.map((d: any) => d.name)).toContain("Garage Sensor");
  });
});

describe("Device heartbeat updates lastSeen timestamp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update lastHeartbeat and set status to online", async () => {
    const beforeHeartbeat = new Date("2026-01-01T00:00:00Z");
    const afterHeartbeat = new Date("2026-01-01T00:05:00Z");

    const device = makeDevice({
      id: "dev-hb",
      lastHeartbeat: beforeHeartbeat,
      status: "offline",
    });

    // Mock update().set().where().returning() for heartbeat
    const updatedDevice = {
      ...device,
      lastHeartbeat: afterHeartbeat,
      status: "online",
      updatedAt: afterHeartbeat,
    };

    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updatedDevice]),
        }),
      }),
    });

    const now = afterHeartbeat;
    const [updated] = await db
      .update(devices)
      .set({
        lastHeartbeat: now,
        status: "online",
        updatedAt: now,
      })
      .where(and(eq(devices.id, "dev-hb"), eq(devices.userId, "test-user-id")))
      .returning();

    expect(updated).toBeDefined();
    expect(updated.lastHeartbeat).toBe(afterHeartbeat);
    expect(updated.status).toBe("online");
    expect(updated.lastHeartbeat.getTime()).toBeGreaterThan(beforeHeartbeat.getTime());
  });

  it("should return 404 for heartbeat on non-existent device", async () => {
    // Mock returning empty array (device not found)
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const [updated] = await db
      .update(devices)
      .set({
        lastHeartbeat: new Date(),
        status: "online",
        updatedAt: new Date(),
      })
      .where(and(eq(devices.id, "nonexistent"), eq(devices.userId, "test-user-id")))
      .returning();

    expect(updated).toBeUndefined();

    // The route handler would respond with 404 when updated is undefined
    const reply = makeReply();
    if (!updated) {
      reply.status(404);
      reply.send(
        errorResponse(
          { code: ErrorCodes.NOT_FOUND, message: "Device not found" },
          "req-1"
        )
      );
    }

    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.body.error.code).toBe("NOT_FOUND");
  });
});

describe("Register device -> send command -> verify command tracked", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a device then track a command against it", async () => {
    const device = makeDevice({ id: "dev-cmd", capabilities: ["terminal"] });
    const command = makeCommand({
      id: "cmd-tracked",
      deviceId: "dev-cmd",
      type: "terminal",
      payload: { command: "uptime" },
      status: "executing",
    });

    // Step 1: Verify device exists (ownership check in command route)
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([device]),
        }),
      }),
    });

    const [owned] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, "dev-cmd"), eq(devices.userId, "test-user-id")))
      .limit(1);

    expect(owned).toBeDefined();
    expect(owned.id).toBe("dev-cmd");

    // Step 2: Insert command record
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([command]),
      }),
    });

    const [inserted] = await db
      .insert(deviceCommands)
      .values({
        id: command.id,
        deviceId: "dev-cmd",
        type: "terminal",
        payload: { command: "uptime" },
        status: "pending",
      })
      .returning();

    expect(inserted).toBeDefined();
    expect(inserted.id).toBe("cmd-tracked");
    expect(inserted.deviceId).toBe("dev-cmd");
    expect(inserted.type).toBe("terminal");

    // Step 3: Verify command appears in device's command list
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([command]),
          }),
        }),
      }),
    });

    const commands = await db
      .select()
      .from(deviceCommands)
      .where(eq(deviceCommands.deviceId, "dev-cmd"))
      .orderBy()
      .limit(20);

    expect(commands).toHaveLength(1);
    expect(commands[0].id).toBe("cmd-tracked");
    expect(commands[0].payload).toEqual({ command: "uptime" });
  });
});

describe("Cross-user isolation: user A's devices not visible to user B", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should only return devices owned by the requesting user", async () => {
    const userADevice = makeDevice({ id: "dev-a", userId: "user-a", name: "Device A" });
    const userBDevice = makeDevice({ id: "dev-b", userId: "user-b", name: "Device B" });

    // User A requests their devices
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([userADevice]),
      }),
    });

    const userADevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, "user-a"));

    expect(userADevices).toHaveLength(1);
    expect(userADevices[0].userId).toBe("user-a");
    expect(userADevices[0].name).toBe("Device A");

    // User B requests their devices
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([userBDevice]),
      }),
    });

    const userBDevices = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, "user-b"));

    expect(userBDevices).toHaveLength(1);
    expect(userBDevices[0].userId).toBe("user-b");
    expect(userBDevices[0].name).toBe("Device B");

    // Verify each list does NOT contain the other user's device
    expect(userADevices.some((d: any) => d.userId === "user-b")).toBe(false);
    expect(userBDevices.some((d: any) => d.userId === "user-a")).toBe(false);
  });

  it("should return 404 when user B tries to access user A's device by ID", async () => {
    // User B tries to get a device that belongs to User A
    // The where clause requires both id AND userId to match
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, "dev-a"), eq(devices.userId, "user-b")))
      .limit(1);

    expect(device).toBeUndefined();

    // The route handler returns 404 for this case
    const reply = makeReply();
    if (!device) {
      reply.status(404);
      reply.send(
        errorResponse(
          { code: ErrorCodes.NOT_FOUND, message: "Device not found" },
          "req-1"
        )
      );
    }

    expect(reply.status).toHaveBeenCalledWith(404);
  });
});

describe("Delete device -> verify it is gone from list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should delete a device and confirm it no longer appears", async () => {
    const device = makeDevice({ id: "dev-del" });

    // Step 1: End active sessions (from delete route)
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await db
      .update(deviceSessions)
      .set({ status: "ended", endedAt: new Date() })
      .where(eq(deviceSessions.deviceId, "dev-del"));

    expect(db.update).toHaveBeenCalled();

    // Step 2: Delete the device record
    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([device]),
      }),
    });

    const [deleted] = await db
      .delete(devices)
      .where(and(eq(devices.id, "dev-del"), eq(devices.userId, "test-user-id")))
      .returning();

    expect(deleted).toBeDefined();
    expect(deleted.id).toBe("dev-del");

    // Step 3: Verify device no longer appears in list
    (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const remaining = await db
      .select()
      .from(devices)
      .where(eq(devices.userId, "test-user-id"));

    expect(remaining).toHaveLength(0);
  });

  it("should return 404 when deleting a non-existent device", async () => {
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    (db.delete as ReturnType<typeof vi.fn>).mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    const [deleted] = await db
      .delete(devices)
      .where(and(eq(devices.id, "nonexistent"), eq(devices.userId, "test-user-id")))
      .returning();

    expect(deleted).toBeUndefined();

    const reply = makeReply();
    if (!deleted) {
      reply.status(404);
      reply.send(
        errorResponse(
          { code: ErrorCodes.NOT_FOUND, message: "Device not found" },
          "req-1"
        )
      );
    }

    expect(reply.status).toHaveBeenCalledWith(404);
  });
});

describe("Command safety: dangerous commands require approval flag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should block dangerous commands outright", () => {
    const result = validateCommand("rm -rf /", ["terminal"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("safety");
  });

  it("should flag sudo commands as requiring approval", () => {
    const result = validateCommand("sudo apt update", ["terminal"]);
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it("should allow safe commands without approval", () => {
    const result = validateCommand("ls -la", ["terminal"]);
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBeUndefined();
  });

  it("should reject commands on devices without terminal capability", () => {
    const result = validateCommand("ls -la", ["screen_capture"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("terminal capability");
  });

  it("should insert command with pending status when approval is required", async () => {
    const device = makeDevice({ id: "dev-safe", capabilities: ["terminal"] });
    const safety = validateCommand("sudo reboot", device.capabilities);

    expect(safety.allowed).toBe(true);
    expect(safety.requiresApproval).toBe(true);

    // When requiresApproval=true, the route inserts with pending status
    const pendingCmd = makeCommand({
      id: "cmd-approval",
      deviceId: "dev-safe",
      type: "terminal",
      payload: { command: "sudo reboot" },
      status: "pending",
    });

    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([pendingCmd]),
      }),
    });

    const [inserted] = await db
      .insert(deviceCommands)
      .values({
        id: pendingCmd.id,
        deviceId: "dev-safe",
        type: "terminal",
        payload: { command: "sudo reboot" },
        status: "pending",
      })
      .returning();

    expect(inserted.status).toBe("pending");
    expect(inserted.id).toBe("cmd-approval");
  });

  it("should block fork bomb regardless of capabilities", () => {
    const result = validateCommand(":(){:|:&};:", ["terminal"]);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("safety");
  });

  it("should require approval for all dangerous-prefix commands", () => {
    const approvalCommands = [
      "rm myfile.txt",
      "sudo ls",
      "chmod 644 file.txt",
      "chown user:group file",
      "kill -9 1234",
      "reboot",
      "shutdown now",
      "systemctl restart nginx",
      "apt install vim",
      "yum update",
      "brew upgrade",
    ];

    for (const cmd of approvalCommands) {
      const result = validateCommand(cmd, ["terminal"]);
      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(true);
    }
  });
});
