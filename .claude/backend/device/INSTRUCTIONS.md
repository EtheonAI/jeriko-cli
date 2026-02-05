# Device Service Instructions

## Overview

The device service (`services/device/`) manages remote device connections, command execution, and real-time device control. It enables the agent to interact with user devices -- browsing the web, running terminal commands, reading/writing files, and controlling smart home devices.

**Port:** 8080 (configurable)
**Framework:** Currently Go (chi router) -- may be rebuilt in Node.js/Fastify for consistency
**Status:** Has a working Go skeleton with chi router, MQTT client, WebSocket hub, and device handler. The handlers have defined route signatures but the actual implementations are minimal.

---

## Current File Structure (Go)

```
services/device/
  go.mod                                    # Go module definition
  Dockerfile                                # Go build Dockerfile
  cmd/server/
    main.go                                 # 139 lines - chi router, MQTT, WebSocket hub, routes
  internal/
    config/
      config.go                             # Environment-based configuration
    models/
      device.go                             # Device data models
    handlers/
      device.go                             # HTTP handlers (RegisterDevice, ExecuteCommand, etc.)
    mqtt/
      client.go                             # MQTT client for IoT devices
    websocket/
      hub.go                                # WebSocket connection hub (broadcast, rooms)
      client.go                             # Individual WebSocket client connection
```

### Go Routes Defined (from `cmd/server/main.go`)

```go
r.Route("/v1", func(r chi.Router) {
    r.Post("/devices", deviceHandler.RegisterDevice)
    r.Get("/devices", deviceHandler.ListDevices)
    r.Get("/devices/{id}", deviceHandler.GetDevice)
    r.Delete("/devices/{id}", deviceHandler.UnregisterDevice)
    r.Post("/devices/{id}/command", deviceHandler.ExecuteCommand)
    r.Get("/devices/{id}/stream", deviceHandler.StreamDevice)
    r.Post("/tools/execute", deviceHandler.ExecuteTool)
    r.Get("/ws", deviceHandler.HandleWebSocket)
})
```

### Go Infrastructure Already Built

- **MQTT Client** (`internal/mqtt/client.go`) - Initialized on startup, used for IoT device communication
- **WebSocket Hub** (`internal/websocket/hub.go`) - Go-based WebSocket hub with `Run()` goroutine for managing connections and broadcasting
- **Structured Logging** - Uses `zerolog` for JSON logging
- **Graceful Shutdown** - Handles SIGINT/SIGTERM, cleans up MQTT and WebSocket

---

## Database Tables

From `packages/database/src/schema/devices.ts`:

### `devices`

Device registry.

- `id` - CUID2 primary key
- `userId` - Owner
- `organizationId` - Optional org association
- `name` - Human-readable device name
- `type` - "browser" | "desktop" | "mobile" | "server"
- `status` - "online" | "offline" | "busy" | "error"
- `connectionId` - Active WebSocket/MQTT connection ID
- `lastHeartbeat` - Last heartbeat timestamp
- `ipAddress`, `userAgent` - Connection details
- `capabilities` (JSONB) - Array of strings like `["terminal", "filesystem", "browser"]`
- `config` (JSONB) - Device-specific configuration
- `browserType`, `browserVersion` - For browser-type devices
- `viewport` (JSONB) - `{ width, height }` for browser devices

### `device_sessions`

Active control sessions on a device.

- `deviceId`, `agentSessionId` (optional link to agent session), `userId`
- `status` - "active" | "paused" | "ended"
- `currentUrl`, `currentTitle` - For browser-type sessions
- `screenshot` - Base64 or URL to latest screenshot

### `device_commands`

Command queue for devices.

- `deviceId`, `sessionId`
- `type` - Command type (navigate, click, type, screenshot, etc.)
- `payload` (JSONB) - Command-specific data
- `status` - "pending" | "executing" | "completed" | "failed"
- `result` (JSONB) - Command result
- `error` - Error message if failed
- `queuedAt`, `startedAt`, `completedAt`
- `retryCount`, `maxRetries` (default 3)

---

## Recommendation: Rebuild vs Keep Go

**Keep Go if:**

- Performance is critical (many concurrent device connections)
- You want to leverage Go's goroutine model for WebSocket management
- The MQTT client integration is important for IoT devices

**Rebuild in Node.js/Fastify if:**

- You want consistency with all other services (shared `@repo/service-utils`, `@repo/database`)
- You want to use Drizzle ORM for database queries
- The development team is more productive in TypeScript
- You want to share the same auth pattern (`x-user-id` header extraction)

**Recommendation:** Rebuild in Node.js/Fastify for now, following the same patterns as other services. The Go service can be reintroduced later as a high-performance replacement once the feature set is stable.

---

## What Needs to Be Built

### 1. Service Bootstrap (Node.js Version)

If rebuilding in Node.js, create `services/device/src/index.ts` following the same pattern as other services:

```typescript
import Fastify from "fastify";
import websocket from "@fastify/websocket";
import { createLogger, getEnv } from "@repo/service-utils";
import { deviceRoutes } from "./routes/devices.js";
import { commandRoutes } from "./routes/commands.js";
import { toolRoutes } from "./routes/tools.js";
import { wsRoutes } from "./routes/websocket.js";

const app = Fastify({ ... });
await app.register(websocket);
await app.register(deviceRoutes);
await app.register(commandRoutes);
await app.register(toolRoutes);
await app.register(wsRoutes);
```

### 2. Device Registration and Heartbeat

```typescript
// POST /devices - Register a device
app.post("/devices", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  const { name, type, capabilities, config } = request.body;

  const [device] = await db
    .insert(devices)
    .values({
      userId,
      name,
      type: type || "browser",
      status: "offline",
      capabilities: capabilities || [],
      config: config || {},
    })
    .returning();

  return reply.status(201).send(device);
});

// POST /devices/:id/heartbeat - Keep device alive
app.post("/devices/:id/heartbeat", async (request, reply) => {
  const { id } = request.params;
  const { status, metadata } = request.body;

  await db
    .update(devices)
    .set({
      status: status || "online",
      lastHeartbeat: new Date(),
      ipAddress: request.ip,
    })
    .where(eq(devices.id, id));

  return { ok: true };
});
```

### 3. Command Execution Pipeline

The agent service calls `POST /v1/devices/:id/command` to send commands to devices.

```typescript
// POST /devices/:id/command - Queue a command
app.post("/devices/:id/command", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  const { id } = request.params;
  const { type, payload, requiresApproval } = request.body;

  // 1. Verify device belongs to user
  const [device] = await db
    .select()
    .from(devices)
    .where(and(eq(devices.id, id), eq(devices.userId, userId)))
    .limit(1);

  if (!device) return reply.status(404).send({ error: "Device not found" });
  if (device.status !== "online") return reply.status(409).send({ error: "Device offline" });

  // 2. Check command whitelist (security)
  if (!isCommandAllowed(type, payload, device.capabilities)) {
    return reply.status(403).send({ error: "Command not allowed" });
  }

  // 3. If requires approval, return 202 and create approval request
  if (requiresApproval || isHighRiskCommand(type, payload)) {
    const [command] = await db
      .insert(deviceCommands)
      .values({
        deviceId: id,
        type,
        payload,
        status: "pending",
      })
      .returning();

    // Emit approval-required event
    await publish(`user:${userId}`, {
      type: "approval:required",
      data: { commandId: command.id, deviceId: id, type, payload },
    });

    return reply.status(202).send({
      commandId: command.id,
      requiresApproval: true,
      approval_id: command.id,
    });
  }

  // 4. Create command record
  const [command] = await db
    .insert(deviceCommands)
    .values({
      deviceId: id,
      type,
      payload,
      status: "pending",
    })
    .returning();

  // 5. Send to device via WebSocket
  const sent = sendToDevice(id, {
    type: "command",
    commandId: command.id,
    command: { type, payload },
  });

  if (!sent) {
    // Device not connected via WebSocket, try MQTT
    // If using MQTT: mqttClient.publish(`device/${id}/commands`, JSON.stringify({...}))
    await db
      .update(deviceCommands)
      .set({ status: "failed", error: "Device not reachable" })
      .where(eq(deviceCommands.id, command.id));
    return reply.status(503).send({ error: "Device not reachable" });
  }

  // 6. Wait for result (with timeout)
  const result = await waitForCommandResult(command.id, 30000);

  return result;
});
```

### 4. Tool Execution (Agent Service Bridge)

The agent service calls `POST /v1/tools/execute` for device-related tools:

```typescript
// POST /tools/execute - Execute a tool on a device
app.post("/tools/execute", async (request, reply) => {
  const userId = request.headers["x-user-id"] as string;
  const { tool_name, arguments: args, device_id } = request.body;

  switch (tool_name) {
    case "terminal_command":
      return executeTerminalCommand(device_id, args.command, args.working_directory, userId);

    case "file_read":
      return executeFileRead(device_id, args.path, userId);

    case "file_write":
      return executeFileWrite(device_id, args.path, args.content, userId);

    default:
      return reply.status(400).send({ error: `Unknown tool: ${tool_name}` });
  }
});
```

### 5. WebSocket for Real-Time Device State

```typescript
// GET /ws - WebSocket connection for devices
app.get("/ws", { websocket: true }, async (socket, request) => {
  const deviceId = (request.query as { deviceId?: string }).deviceId;
  const userId = request.headers["x-user-id"] as string;

  // Register device connection
  registerDeviceConnection(deviceId, socket);

  // Update device status
  await db
    .update(devices)
    .set({
      status: "online",
      connectionId: socket.id,
      lastHeartbeat: new Date(),
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    })
    .where(eq(devices.id, deviceId));

  socket.on("message", async (data) => {
    const message = JSON.parse(data.toString());

    switch (message.type) {
      case "command_result":
        // Device is reporting back a command result
        await db
          .update(deviceCommands)
          .set({
            status: message.success ? "completed" : "failed",
            result: message.result,
            error: message.error,
            completedAt: new Date(),
          })
          .where(eq(deviceCommands.id, message.commandId));

        // Notify waiting command handlers
        resolveCommandResult(message.commandId, message);
        break;

      case "heartbeat":
        await db.update(devices).set({ lastHeartbeat: new Date() }).where(eq(devices.id, deviceId));
        break;

      case "status":
        await db
          .update(devices)
          .set({
            status: message.status,
            ...(message.currentUrl ? { currentUrl: message.currentUrl } : {}),
          })
          .where(eq(devices.id, deviceId));
        break;
    }
  });

  socket.on("close", async () => {
    unregisterDeviceConnection(deviceId);
    await db
      .update(devices)
      .set({ status: "offline", connectionId: null })
      .where(eq(devices.id, deviceId));
  });
});
```

### 6. Command Whitelisting (Security)

```typescript
const ALLOWED_COMMANDS: Record<string, string[]> = {
  browser: ["navigate", "click", "type", "screenshot", "scroll", "select", "wait"],
  terminal: ["execute"], // Commands are further filtered by a deny-list
  filesystem: ["read", "write", "list", "delete", "mkdir"],
};

const TERMINAL_DENY_LIST = [
  "rm -rf /",
  "mkfs",
  "dd if=",
  ":(){ :|:& };:",
  "chmod -R 777 /",
  "curl | sh",
  "wget | sh",
];

function isCommandAllowed(
  type: string,
  payload: Record<string, unknown>,
  capabilities: string[]
): boolean {
  // 1. Check if the device has the required capability
  const category = getCommandCategory(type);
  if (!capabilities.includes(category)) return false;

  // 2. For terminal commands, check deny list
  if (type === "execute" && payload.command) {
    const cmd = (payload.command as string).toLowerCase();
    return !TERMINAL_DENY_LIST.some((denied) => cmd.includes(denied));
  }

  // 3. Check if command type is in allowed list
  return ALLOWED_COMMANDS[category]?.includes(type) ?? false;
}

function isHighRiskCommand(type: string, payload: Record<string, unknown>): boolean {
  // Commands that modify the system require approval
  const highRisk = ["execute", "write", "delete", "install"];
  return highRisk.includes(type);
}
```

### 7. Home Assistant Integration (Future)

For smart home device control, integrate with Home Assistant via its REST API:

```typescript
// Future: Home Assistant MCP server integration
app.post("/devices/:id/ha/command", async (request, reply) => {
  const { entity_id, service, data } = request.body;

  const haUrl = process.env.HOME_ASSISTANT_URL;
  const haToken = process.env.HOME_ASSISTANT_TOKEN;

  const response = await fetch(`${haUrl}/api/services/${service}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${haToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ entity_id, ...data }),
  });

  return response.json();
});
```

---

## Environment Variables

| Variable               | Default                    | Description                            |
| ---------------------- | -------------------------- | -------------------------------------- |
| `PORT`                 | `8080`                     | Device service port                    |
| `MQTT_BROKER_URL`      | None                       | MQTT broker URL for IoT devices        |
| `MQTT_USERNAME`        | None                       | MQTT credentials                       |
| `MQTT_PASSWORD`        | None                       | MQTT credentials                       |
| `HOME_ASSISTANT_URL`   | None                       | Home Assistant REST API URL            |
| `HOME_ASSISTANT_TOKEN` | None                       | Home Assistant long-lived access token |
| `DATABASE_URL`         | (from @repo/database)      | PostgreSQL connection                  |
| `REDIS_URL`            | (from @repo/service-utils) | Redis for pub/sub                      |

---

## Inter-Service Communication

The device service is called by:

- **Agent service** - `POST /v1/tools/execute` for terminal, file read/write tools
- **Task service** - `POST /v1/devices/:id/command` for approved device commands
- **Gateway** - Proxies client requests for device management

The device service calls:

- **Redis pub/sub** - Publishes events on `user:<userId>` channel for approval requests and device status updates
