# Devices Dashboard - Build Instructions

## Current State

### What's ALREADY Working (Full Stack)

#### Device Service (`services/device/src/index.ts`, 76 lines + route modules) - FULLY IMPLEMENTED

**Main entry** registers 4 route modules + WebSocket support + stale device checker:

**Device Routes** (`services/device/src/routes/devices.ts`, 219 lines):

- `POST /v1/devices` - Register new device (validates body, creates DB record)
- `GET /v1/devices` - List user's devices with live connection status
- `GET /v1/devices/:id` - Get single device with connection info
- `PATCH /v1/devices/:id` - Update device (name, capabilities, metadata)
- `DELETE /v1/devices/:id` - Delete device + close WebSocket connections + cleanup sessions
- Real Drizzle queries, ownership verification, connection tracking

**Command Routes** (`services/device/src/routes/commands.ts`, 283 lines):

- `POST /v1/devices/:id/command` - Send command to device
  - Safety validation (`validateCommand` function)
  - Approval workflow for dangerous commands
  - WebSocket delivery to connected device
  - Command status tracking (pending/executing/completed/failed)
  - Retry logic support
- `GET /v1/devices/:id/commands` - List command history
- `POST /v1/tools/execute` - Tool execution bridge for AI agents

**Heartbeat Routes** (`services/device/src/routes/heartbeat.ts`):

- Keep-alive endpoint for connected devices
- Background stale device checker (marks devices offline when heartbeat stops)

**WebSocket Routes** (`services/device/src/routes/websocket.ts`):

- Real-time bidirectional communication with devices
- Connection tracking by deviceId
- Command delivery via WebSocket

#### Frontend Client Component (`apps/app/app/(authenticated)/devices/devices-page-client.tsx`, 412 lines) - ALREADY EXISTS

**Features implemented:**

- Device grid display with type-specific icons (browser/desktop/mobile/server)
- Status badges (online = green, offline = gray, busy = yellow, error = red)
- Register device dialog (name, type dropdown, platform input)
- Last heartbeat display (relative time via date-fns)
- Capabilities badges
- Delete device with confirmation dialog
- Installation instructions (macOS/Linux/Windows CLI commands)
- Loading/error states with retry
- Refresh button

**tRPC Integration:**

- `devices.list.useQuery()` - Fetches device list
- `devices.register.useMutation()` - Registers new device
- `devices.unregister.useMutation()` - Deletes device

#### tRPC Router (`apps/app/lib/trpc/routers/devices.router.ts`, 178 lines)

Proxies all requests to device microservice:

- `list` - GET `/` with fallback to empty array
- `get` - GET `/:id`
- `register` - POST `/` with { name, type, platform, capabilities, metadata }
- `update` - PATCH `/:id`
- `unregister` - DELETE `/:id`
- `sendCommand` - POST `/:id/command` with { type, payload }
- `getStatus` - GET `/:id` status extraction

#### Database Schema (`packages/database/src/schema/devices.ts`, 150 lines)

**devices table:**

- `id`, `userId`, `organizationId`, `name`, `type` (browser/desktop/mobile/server), `status` (online/offline/busy/error)
- Connection: `connectionId`, `lastHeartbeat`, `ipAddress`, `userAgent`
- Capabilities: `capabilities` (jsonb[]), `config` (jsonb)
- Browser: `browserType`, `browserVersion`, `viewport` (jsonb { width, height })
- `metadata`, `createdAt`, `updatedAt`

**deviceSessions table:**

- `id`, `deviceId`, `agentSessionId`, `userId`, `status` (active/paused/ended)
- `startedAt`, `endedAt`, `lastActivityAt`, `currentUrl`, `currentTitle`, `screenshot`

**deviceCommands table:**

- `id`, `deviceId`, `sessionId`, `type`, `payload` (jsonb)
- `status` (pending/executing/completed/failed), `result` (jsonb), `error`
- `queuedAt`, `startedAt`, `completedAt`, `retryCount`, `maxRetries`

#### Redux Slice (`apps/app/lib/store/slices/devices.slice.ts`)

- `devices[]`, `selectedDeviceId`, `isLoading`, `error`
- Actions: `setDevices`, `addDevice`, `updateDeviceStatus`

### What's Working Summary

| Layer            | Status   | Notes                                         |
| ---------------- | -------- | --------------------------------------------- |
| DB Schema        | Complete | 3 tables with relations                       |
| Device Service   | Complete | 4 route modules, WebSocket, safety validation |
| tRPC Router      | Complete | 7 procedures proxying to service              |
| Client Component | Complete | 412 lines, CRUD, status display               |
| Redux Slice      | Basic    | Needs expansion for real-time state           |

---

## What Needs Building

### 1. Smart Home Hub Integration

The current devices page manages "Rubic devices" (browser agents, desktop agents). Extend it to support **smart home devices** via Home Assistant and SmartThings.

#### Home Assistant Integration

**Create:** `services/device/src/routes/hubs.ts`

```typescript
// Hub registration
POST /v1/hubs
  body: { type: "home_assistant", config: { url: string, accessToken: string } }
  // Validates connection, stores encrypted config

// List hubs
GET /v1/hubs
  // Returns registered hubs with connection status

// Discover devices from hub
POST /v1/hubs/:id/discover
  // Calls Home Assistant REST API: GET /api/states
  // Returns list of discoverable entities

// Get HA entity state
GET /v1/hubs/:id/entities/:entityId
  // Proxies to: GET /api/states/<entity_id>

// Set HA entity state (control device)
POST /v1/hubs/:id/entities/:entityId/command
  // Proxies to: POST /api/services/<domain>/<service>
  // e.g., POST /api/services/light/turn_on { entity_id: "light.living_room" }

// List rooms/areas
GET /v1/hubs/:id/areas
  // GET /api/config/area_registry/list

// List scenes
GET /v1/hubs/:id/scenes
  // GET /api/states filtered by domain "scene"

// Activate scene
POST /v1/hubs/:id/scenes/:sceneId/activate
  // POST /api/services/scene/turn_on
```

**Home Assistant API**: Uses long-lived access tokens or OAuth. REST API at `{HA_URL}/api/`.

#### SmartThings Integration

Similar pattern but using SmartThings API with OAuth via Composio:

```typescript
// Check if SmartThings connector is connected
const hasSmartThings = connectors?.some(
  (c) => c.type === "smartthings" && c.status === "connected"
);
// Use Composio tools for SmartThings actions
```

#### tRPC Router Additions

Add to `apps/app/lib/trpc/routers/devices.router.ts`:

```typescript
// New procedures:
registerHub; // POST /v1/hubs
listHubs; // GET /v1/hubs
discoverDevices; // POST /v1/hubs/:id/discover
getEntityState; // GET /v1/hubs/:id/entities/:entityId
controlEntity; // POST /v1/hubs/:id/entities/:entityId/command
listAreas; // GET /v1/hubs/:id/areas
listScenes; // GET /v1/hubs/:id/scenes
activateScene; // POST /v1/hubs/:id/scenes/:sceneId/activate
```

### 2. Enhanced Device Dashboard UI

The existing `devices-page-client.tsx` (412 lines) works for basic device management. Enhance it with:

#### Tab Layout

```
[My Devices (3)] [Smart Home (12)] [Hubs (1)]
```

- **My Devices**: Current grid of Rubic agents (browser/desktop/mobile/server)
- **Smart Home**: Grid of HA/SmartThings devices with type-specific controls
- **Hubs**: Hub management (add/remove hubs, connection status)

#### Smart Home Device Cards

**Create type-specific control components** in `apps/app/app/(authenticated)/devices/components/`:

##### Light Controls (`light-device-card.tsx`)

- On/off toggle switch
- Brightness slider (0-100%)
- Color picker wheel (for RGB-capable lights)
- Color temperature slider (warm 2000K to cool 6500K)
- Current state: "On at 75%, Warm White"

##### Climate Controls (`climate-device-card.tsx`)

- Current temperature (large display)
- Target temperature with +/- buttons
- Mode selector: Heat / Cool / Auto / Off
- Fan speed: Low / Medium / High / Auto
- Humidity reading if available

##### Sensor Cards (`sensor-device-card.tsx`)

- Large reading display (temperature, humidity, motion, door/window)
- Historical sparkline graph (last 24h)
- Alert threshold configuration
- Last updated timestamp

##### Media Controls (`media-device-card.tsx`)

- Now playing info (title, artist, album art)
- Playback controls (Play/Pause/Skip/Previous)
- Volume slider
- Source selector dropdown

##### Security Controls (`security-device-card.tsx`)

- Lock/Unlock toggle with confirmation dialog
- Camera feed thumbnail (if camera entity)
- Armed/Disarmed status for alarm panels
- Recent activity log

##### Switch/Plug Controls (`switch-device-card.tsx`)

- Simple On/Off toggle
- Power consumption reading (if smart plug)
- Schedule settings (auto on/off times)

### 3. Room Organization

**Build:** Room/area grouping using Home Assistant areas.

```tsx
// Grouped display:
<div>
  {areas.map(area => (
    <div key={area.id}>
      <h3>{area.name} — {onCount} on, {offCount} off</h3>
      <div className="grid grid-cols-3 gap-4">
        {devicesInArea.map(device => <DeviceCard key={device.id} device={device} />)}
      </div>
    </div>
  ))}
  <div>
    <h3>Unassigned</h3>
    {unassignedDevices.map(...)}
  </div>
</div>
```

- Collapse/expand rooms
- Device count per room
- Aggregate status ("Living Room - 3 on, 2 off")

### 4. Scenes & Quick Actions

**Create:** `apps/app/app/(authenticated)/devices/components/scenes-panel.tsx`

- List scenes from Home Assistant
- One-click activation
- Scene cards with icon + name + description
- "Good Morning", "Movie Night", "Away Mode" etc.
- Create new scene: select devices → set states → save

### 5. Real-Time Device State via WebSocket

The WebSocket provider already handles device events. Expand:

**Add to `apps/app/lib/socket/events.ts`:**

```typescript
// Smart home specific events:
"device:state:update"; // { deviceId, entityId, state, attributes }
"device:online"; // { deviceId }
"device:offline"; // { deviceId }
"device:command:result"; // { deviceId, commandId, status, result }
"hub:state:change"; // { hubId, entityId, newState }
```

**In WebSocket provider**, add listeners that update device state in Redux:

```typescript
socket.on("device:state:update", (data) => {
  dispatch(updateDeviceState(data));
});
socket.on("hub:state:change", (data) => {
  dispatch(updateEntityState(data));
});
```

### 6. Device Command History

**Create:** `apps/app/app/(authenticated)/devices/components/command-history.tsx`

- Table view of commands sent to a device
- Columns: Time, Type, Payload, Status, Result
- Status badges: pending (gray), executing (yellow), completed (green), failed (red)
- Filter by command type
- Use `devices.sendCommand` / device service `GET /v1/devices/:id/commands`

### 7. Home Assistant MCP Tools for AI

Register HA tools in the AI agent tool registry so the AI can control devices via chat:

**Tools to register:**

```typescript
const haTools = [
  {
    name: "get_device_state",
    description: "Get the current state of a smart home device",
    parameters: { entity_id: "string" },
  },
  {
    name: "control_device",
    description: "Control a smart home device (turn on/off, set brightness, etc.)",
    parameters: { entity_id: "string", service: "string", data: "object" },
  },
  {
    name: "list_devices",
    description: "List all smart home devices",
    parameters: { domain: "string (optional)" },
  },
  {
    name: "activate_scene",
    description: "Activate a smart home scene",
    parameters: { scene_id: "string" },
  },
  {
    name: "get_sensor_reading",
    description: "Get sensor readings (temperature, humidity, etc.)",
    parameters: { entity_id: "string" },
  },
];
```

This enables chat commands like:

- "Turn off the living room lights"
- "Set the thermostat to 72 degrees"
- "What's the temperature in the bedroom?"
- "Activate movie night scene"

**Route through:** Device service `POST /v1/tools/execute` endpoint (already exists in commands.ts).

### 8. Hub Configuration Panel

**Create:** `apps/app/app/(authenticated)/devices/components/hub-config-panel.tsx`

**For Home Assistant:**

- Input: Home Assistant URL (e.g., `http://homeassistant.local:8123`)
- Input: Long-lived access token (with link to HA docs on how to create)
- Test connection button
- Device discovery button
- Entity filter (which entity types to show)
- Auto-sync interval

**For SmartThings:**

- OAuth connection via Composio (same pattern as Applications page)
- Location selector (if multiple SmartThings locations)
- Device filter

---

## Components to Create/Modify

In `apps/app/app/(authenticated)/devices/components/`:

| Component                  | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `light-device-card.tsx`    | Light controls (toggle, brightness, color)         |
| `climate-device-card.tsx`  | Thermostat controls (temp, mode, fan)              |
| `sensor-device-card.tsx`   | Sensor display (reading, sparkline, alerts)        |
| `media-device-card.tsx`    | Media controls (playback, volume, source)          |
| `security-device-card.tsx` | Lock/camera/alarm controls                         |
| `switch-device-card.tsx`   | Simple on/off toggle + power reading               |
| `hub-config-panel.tsx`     | Hub registration and configuration                 |
| `scenes-panel.tsx`         | Scene list with activation buttons                 |
| `command-history.tsx`      | Command log table                                  |
| `device-type-card.tsx`     | Router component that renders correct card by type |
| `room-group.tsx`           | Room header + collapsible device grid              |

**Modify:** `devices-page-client.tsx` - Add tabs (My Devices / Smart Home / Hubs), integrate hub features

---

## Key File Paths

| Purpose                    | Path                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| Devices page (server)      | `apps/app/app/(authenticated)/devices/page.tsx`                         |
| Devices page client        | `apps/app/app/(authenticated)/devices/devices-page-client.tsx`          |
| Device components (CREATE) | `apps/app/app/(authenticated)/devices/components/`                      |
| Devices router             | `apps/app/lib/trpc/routers/devices.router.ts`                           |
| Devices schema             | `packages/database/src/schema/devices.ts`                               |
| Devices slice              | `apps/app/lib/store/slices/devices.slice.ts`                            |
| Device service (main)      | `services/device/src/index.ts`                                          |
| Device routes              | `services/device/src/routes/devices.ts`                                 |
| Command routes             | `services/device/src/routes/commands.ts`                                |
| Heartbeat routes           | `services/device/src/routes/heartbeat.ts`                               |
| WebSocket routes           | `services/device/src/routes/websocket.ts`                               |
| Hub routes (CREATE)        | `services/device/src/routes/hubs.ts`                                    |
| Settings devices tab       | `apps/app/app/(authenticated)/components/settings/tabs/devices-tab.tsx` |
| WebSocket provider         | `apps/app/lib/socket/provider.tsx`                                      |
| WebSocket events           | `apps/app/lib/socket/events.ts`                                         |
| AI tools directory         | `packages/ai/tools/`                                                    |

---

## Important Notes

1. **Device service is FULLY IMPLEMENTED** - CRUD, commands, heartbeat, WebSocket all working with real DB queries. Do NOT rewrite.
2. **Client component exists** (412 lines) - Has device grid, registration dialog, deletion, installation instructions. EXTEND, don't replace.
3. **Command safety validation** exists in the service - `validateCommand` function checks for dangerous operations. Approval workflow built in.
4. **Tool execution bridge** exists - `POST /v1/tools/execute` in commands.ts bridges AI agent tool calls to device commands.
5. **WebSocket real-time** already set up in device service. Frontend needs to listen for device state events.
6. **Stale device checker** runs as background job in service, automatically marks devices offline.
7. **Home Assistant is additive** - All HA features are NEW routes in the device service, not modifications to existing routes.
8. **SmartThings via Composio** - Use the existing Composio integration pattern from the connector service.

## Priority Order

1. Add smart home device type cards (light, climate, sensor, media, security, switch)
2. Tab layout in devices-page-client.tsx (My Devices / Smart Home / Hubs)
3. Hub configuration panel (Home Assistant URL + token)
4. Hub routes in device service (`services/device/src/routes/hubs.ts`)
5. Device discovery from Home Assistant
6. Room organization / area grouping
7. Real-time state updates via WebSocket
8. Scenes panel with one-click activation
9. Command history view
10. Home Assistant MCP tools for AI agent
11. SmartThings integration via Composio
12. Automations builder (IF trigger THEN action)
