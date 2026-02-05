# Device Service Instructions

> **VERIFIED against actual codebase -- Feb 2026 audit**

## Overview

The device service (`services/device/`) manages remote device connections, command execution, and real-time device control. It enables the agent to interact with user devices -- browsing the web, running terminal commands, reading/writing files, and controlling smart home devices.

**Port:** 4001 (configurable via `PORT` env)
**Framework:** Node.js / Fastify (with `@fastify/websocket`)
**Status:** FULLY IMPLEMENTED -- 792 LOC across 6 files, with real Drizzle queries, WebSocket support, and complete CRUD

---

## Current State (Fully Implemented)

### File Structure

```
services/device/src/
  index.ts                  # 76 lines  - Main entry, registers 4 route modules + WebSocket + stale device checker
  routes/
    devices.ts              # 219 lines - Full CRUD with Drizzle, ownership verification, connection tracking
    commands.ts             # 283 lines - Command execution, safety validation (validateCommand),
                            #             approval workflow, WebSocket delivery, retry logic, tool execution bridge
    heartbeat.ts            #            - Keep-alive endpoint, background stale device checker
    websocket.ts            #            - Real-time bidirectional communication, connection tracking by deviceId
```

### What's Working

- **Device CRUD** -- Register, list, get, update, and delete devices with full Drizzle ORM queries against the `devices` table
- **Ownership verification** -- All operations verify `userId` matches the device owner
- **Command execution pipeline** -- Queue commands, validate safety via `validateCommand()`, deliver over WebSocket, handle retries
- **Approval workflow** -- High-risk commands go through approval before execution
- **WebSocket** -- Real-time bidirectional connection tracking by `deviceId`, used for command delivery and device state updates
- **Heartbeat** -- Keep-alive endpoint plus a background stale device checker that marks unresponsive devices as offline
- **Tool execution bridge** -- `POST /v1/tools/execute` bridges agent service tool calls to device commands
- **Connection tracking** -- Tracks active WebSocket connections per device, updates `connectionId` and `status` in the database

### Frontend Client (Fully Implemented)

**File:** `apps/app/app/(authenticated)/devices/devices-page-client.tsx` (412 lines)

- Device grid display with status badges (online/offline/busy/error)
- Register device dialog
- Delete device functionality
- Installation instructions for connecting new devices
- Refresh / polling

**tRPC calls used:**

- `devices.list.useQuery` -- Fetch all user devices
- `devices.register.useMutation` -- Register a new device
- `devices.unregister.useMutation` -- Remove a device

### tRPC Router

**File:** `apps/app/lib/trpc/routers/devices.router.ts` (178 lines)

7 procedures that proxy requests to the device service at `http://localhost:4001/v1/...`:

- `list`, `get`, `register`, `update`, `unregister`, `executeCommand`, `executeTool`

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

## What Needs Building

The core device service is complete. The remaining work is **Smart Home Hub Integration**.

### 1. Home Assistant Integration (via REST API)

Home Assistant exposes a REST API that we should integrate for smart home device control. This requires new routes in the device service and corresponding database support.

#### Hub Management (CRUD)

Users need to register their Home Assistant instances as "hubs" within Rubic:

```typescript
// POST /v1/hubs - Register a Home Assistant instance
// GET /v1/hubs - List user's registered hubs
// GET /v1/hubs/:id - Get hub details + connection status
// PUT /v1/hubs/:id - Update hub config (URL, token)
// DELETE /v1/hubs/:id - Remove hub

// Each hub stores:
// - Home Assistant URL (e.g., http://homeassistant.local:8123)
// - Long-lived access token
// - Connection status (connected / unreachable / auth_failed)
// - Last sync timestamp
```

#### Entity Discovery

Fetch all entities from Home Assistant and cache them locally:

```typescript
// POST /v1/hubs/:id/sync - Trigger entity sync from HA
// GET /v1/hubs/:id/entities - List all discovered entities (lights, switches, sensors, etc.)
// GET /v1/hubs/:id/entities/:entityId - Get entity state + attributes

// HA REST API: GET /api/states
// Returns all entity states. Cache in DB, refresh on sync.
```

#### Command Execution (Services)

Call Home Assistant services to control devices:

```typescript
// POST /v1/hubs/:id/command - Execute a HA service call
// Body: { entity_id: "light.living_room", service: "light/turn_on", data: { brightness: 200 } }

// Maps to HA REST API: POST /api/services/<domain>/<service>
// e.g., POST /api/services/light/turn_on { entity_id: "light.living_room", brightness: 200 }
```

#### Areas and Scenes

```typescript
// GET /v1/hubs/:id/areas - List HA areas (rooms)
// GET /v1/hubs/:id/scenes - List HA scenes
// POST /v1/hubs/:id/scenes/:sceneId/activate - Activate a scene
```

#### Implementation Notes

- **Auth:** Each hub stores a long-lived HA access token per user. The token is passed as `Authorization: Bearer <token>` to HA's REST API.
- **Caching:** Entity states should be cached in Redis with a short TTL (30-60 seconds). Full entity list should be stored in DB and refreshed on manual sync or periodically.
- **Error handling:** HA instances may be on local networks and unreachable from the cloud. Handle timeouts gracefully and report connection status back to the user.
- **Security:** Never expose HA tokens to the frontend. All HA communication goes through the device service.

### 2. SmartThings via Composio

For Samsung SmartThings integration, use Composio as the bridge rather than building a direct integration:

- Composio provides a SmartThings connector with OAuth handling
- The agent service can call SmartThings actions through Composio's tool execution
- This avoids building and maintaining another smart home protocol adapter
- Implementation depends on Composio integration being complete (see P0 priorities)

### 3. WebSocket Events for Real-Time Device State on Frontend

The WebSocket infrastructure exists in the service but the frontend does not yet subscribe to real-time device state updates. What's needed:

- **Socket.io events** from the device service to the frontend (via the gateway or directly):
  - `device:status_changed` -- When a device goes online/offline/busy/error
  - `device:command_result` -- When a command completes or fails
  - `device:heartbeat` -- Periodic liveness confirmation
- **Frontend integration** in `devices-page-client.tsx`:
  - Subscribe to device status events on mount
  - Update device grid in real-time without polling
  - Show command execution progress / results live

---

## Environment Variables

| Variable               | Default                    | Description                            |
| ---------------------- | -------------------------- | -------------------------------------- |
| `PORT`                 | `4001`                     | Device service port                    |
| `HOME_ASSISTANT_URL`   | None                       | Home Assistant REST API URL            |
| `HOME_ASSISTANT_TOKEN` | None                       | Home Assistant long-lived access token |
| `DATABASE_URL`         | (from @repo/database)      | PostgreSQL connection                  |
| `REDIS_URL`            | (from @repo/service-utils) | Redis for pub/sub                      |

---

## Inter-Service Communication

The device service is called by:

- **Agent service** -- `POST /v1/tools/execute` for terminal, file read/write tools
- **Task service** -- `POST /v1/devices/:id/command` for approved device commands
- **Gateway** -- Proxies client requests for device management
- **tRPC router** -- Frontend calls proxy through the tRPC devices router (7 procedures)

The device service calls:

- **Redis pub/sub** -- Publishes events on `user:<userId>` channel for approval requests and device status updates
- **Home Assistant REST API** (once hub integration is built) -- For smart home entity discovery and control
