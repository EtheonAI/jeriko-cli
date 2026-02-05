# Devices Dashboard - Build Instructions

## Current State

### Frontend Page

`apps/app/app/(authenticated)/devices/page.tsx` (122 lines) - Server component with hardcoded mock data. Shows:

- A single "Chrome on macOS" device card with "Active now" and "This device" badge
- "Access Rubic on more devices" empty state with dashed border
- Uses Card/Badge components from `@repo/design-system`
- Simple `DeviceCard` component with props: name, type (desktop/mobile/tablet), lastActive, isCurrent
- Icons: MonitorIcon, SmartphoneIcon, TabletIcon from lucide-react

No backend connection whatsoever. All data is static.

### tRPC Router

`apps/app/lib/trpc/routers/devices.router.ts` (174 lines) - Proxies all requests to a device microservice:

- Uses `fetchDeviceService<T>(endpoint, options, userId)` helper with `DEVICE_SERVICE_URL` (default: `http://localhost:4001/v1/devices`)
- `list` - GET `/` returns `{ devices: Device[] }`, falls back to empty array if service unavailable
- `get` - GET `/:id`
- `register` - POST `/` with { name, type, platform, capabilities, metadata }
- `update` - PATCH `/:id` with { name, capabilities, metadata }
- `unregister` - DELETE `/:id`
- `sendCommand` - POST `/:id/command` with { type, payload } -> returns CommandResult
- `getStatus` - GET `/:id` then extracts { isOnline, status, lastHeartbeat }

**Device type:** `{ id, userId, name, type (browser/desktop/mobile/server), status (online/offline/busy/error), platform, connectionId, lastHeartbeat, ipAddress, userAgent, capabilities, config, metadata, createdAt, updatedAt }`

**CommandResult type:** `{ id, status (pending/executing/completed/failed), result, error }`

### Database Schema

`packages/database/src/schema/devices.ts` (150 lines):

**devices table:**

- `id`, `userId`, `organizationId`, `name`, `type` (browser/desktop/mobile/server), `status` (online/offline/busy/error)
- Connection: `connectionId` (WebSocket/MQTT), `lastHeartbeat`, `ipAddress`, `userAgent`
- Capabilities: `capabilities` (jsonb string[]), `config` (jsonb object)
- Browser-specific: `browserType`, `browserVersion`, `viewport` (jsonb { width, height })
- `metadata` (jsonb), `createdAt`, `updatedAt`

**deviceSessions table:**

- `id`, `deviceId`, `agentSessionId` (link to agent session), `userId`
- `status` (active/paused/ended), `startedAt`, `endedAt`, `lastActivityAt`
- `currentUrl`, `currentTitle`, `screenshot` (base64 or URL)
- `metadata`, `createdAt`, `updatedAt`

**deviceCommands table:**

- `id`, `deviceId`, `sessionId`
- Command: `type` (navigate/click/type/screenshot/etc), `payload` (jsonb)
- Execution: `status` (pending/executing/completed/failed), `result` (jsonb), `error`
- Timing: `queuedAt`, `startedAt`, `completedAt`
- Retry: `retryCount`, `maxRetries` (default 3)

Relations: devices -> user, sessions, commands. deviceSessions -> device, user, commands.

---

## What Needs Building

### 1. Smart Home Hub Management

The devices page should evolve from a simple "logged in devices" view to a full smart home dashboard.

**Hub Integration:**

- Home Assistant: Connect via REST API or WebSocket to Home Assistant instance
- SmartThings: Connect via SmartThings API with OAuth
- Hub configuration panel: enter HA URL, access token, or SmartThings OAuth flow

**Add to `apps/app/lib/trpc/routers/devices.router.ts`:**

```typescript
// New procedures:
registerHub; // { type: "home_assistant" | "smartthings", config: { url, token } }
listHubs; // List connected hubs
discoverDevices; // Trigger device discovery from hub
getDeviceState; // Get current state of a device
setDeviceState; // Send command to change device state
listRooms; // List rooms/areas from hub
listScenes; // List available scenes
activateScene; // Trigger a scene
```

### 2. Device Discovery & Registration

**Build:**

- "Discover Devices" button that queries connected hubs for new devices
- Discovery results shown in a modal with checkboxes to select which to import
- Auto-categorize devices by type (light, climate, sensor, media, security, switch)
- Store discovered devices in `devices` table with hub metadata

### 3. Device Dashboard Cards

Replace the simple DeviceCard with type-specific controls.

**Create:** `apps/app/app/(authenticated)/devices/components/`

#### Light Controls (`light-device-card.tsx`)

- On/off toggle switch
- Brightness slider (0-100%)
- Color picker (for color-capable lights)
- Color temperature slider (warm to cool)
- Show current state: "On at 75%, Warm White"

#### Climate Controls (`climate-device-card.tsx`)

- Current temperature display (large number)
- Target temperature +/- buttons
- Mode selector: Heat / Cool / Auto / Off
- Fan speed: Low / Medium / High / Auto
- Humidity reading if available

#### Sensor Cards (`sensor-device-card.tsx`)

- Large reading display (temperature, humidity, motion, etc.)
- Historical graph (last 24h sparkline)
- Alert thresholds configuration
- Last updated timestamp

#### Media Controls (`media-device-card.tsx`)

- Now playing: title, artist, album art
- Play/Pause/Skip/Previous buttons
- Volume slider
- Source selector (Spotify, TV, etc.)

#### Security Controls (`security-device-card.tsx`)

- Lock/Unlock toggle with confirmation
- Camera feed thumbnail (if camera)
- Armed/Disarmed status for alarm
- Activity log (last 10 events)

#### Switch/Plug Controls (`switch-device-card.tsx`)

- On/Off toggle
- Power consumption reading (if smart plug)
- Schedule: auto on/off times

### 4. Room Organization

**Build:**

- Room/area grouping of devices
- Drag-and-drop devices between rooms
- Room header with aggregate status ("Living Room - 3 on, 2 off")
- Room view with floor plan layout (stretch goal)
- Collapse/expand rooms

**Add to database:** Consider adding a `deviceRooms` table or use the `metadata` field on devices to store room assignment.

### 5. Scenes & Automations Builder

**Build:**

- Scene creation: select devices, set desired states, save as named scene
- Scene activation: one-click to apply all device states
- Automation builder: IF (trigger) THEN (action)
  - Triggers: time-based, device state change, sunrise/sunset, presence
  - Actions: set device state, activate scene, send notification
- Automation list with enable/disable toggles

### 6. Real-Time Device State via WebSocket

The WebSocket provider (`apps/app/lib/socket/provider.tsx`) already handles device-like events. Add device-specific events.

**Add to `apps/app/lib/socket/events.ts`:**

```typescript
// New server-to-client events:
"device:state:update"; // { deviceId, state: Record<string, unknown> }
"device:online"; // { deviceId }
"device:offline"; // { deviceId }
"device:command:result"; // { deviceId, commandId, result }
```

**Add to WebSocket provider** new listeners that dispatch to a device state slice.

### 7. Home Assistant MCP Integration

For AI agent integration with smart home devices.

**Build:**

- MCP (Model Context Protocol) server that wraps Home Assistant API
- Register HA tools in the AI agent tool registry at `packages/ai/lib/tools/`
- Tools: `get_device_state`, `set_device_state`, `list_devices`, `activate_scene`, `get_sensor_reading`
- Allow chat-based device control: "Turn off the living room lights"

---

## Key File Paths

| Purpose              | Path                                                                    |
| -------------------- | ----------------------------------------------------------------------- |
| Devices page         | `apps/app/app/(authenticated)/devices/page.tsx`                         |
| Devices router       | `apps/app/lib/trpc/routers/devices.router.ts`                           |
| Devices schema       | `packages/database/src/schema/devices.ts`                               |
| Settings devices tab | `apps/app/app/(authenticated)/components/settings/tabs/devices-tab.tsx` |
| WebSocket provider   | `apps/app/lib/socket/provider.tsx`                                      |
| WebSocket events     | `apps/app/lib/socket/events.ts`                                         |
| AI tools directory   | `packages/ai/tools/`                                                    |
| Device service       | `services/` (needs new device service or extend existing)               |

## Reference

- Manus device specification: `docs/features_manus_reverse_engineering/Manus_Application_Feature_Specification.md` (Section 8)
- Device service URL: `DEVICE_SERVICE_URL` env var (default `http://localhost:4001/v1/devices`)

## Priority Order

1. Convert page from static to client component with real data from `devices.router.ts`
2. Device registration flow (manual add)
3. Type-specific device control cards
4. Room organization
5. Real-time state updates via WebSocket
6. Hub integration (Home Assistant first)
7. Device discovery
8. Scenes & automations builder
9. MCP integration for AI control
