# services/device — Testing Rules

## What This Is
Device CRUD, Home Assistant integration, WebSocket command execution, safety checks. Port 4001.

## What to Test

### Device CRUD (P0)
1. Register device → 201 with ID
2. List devices → filtered by user (isolation)
3. Get device → 200 or 404
4. Update device → modified fields
5. Delete device → 200, subsequent get → 404
6. Heartbeat → updates lastSeen timestamp

### Home Assistant Hub (P1)
1. Register hub → store URL + access token
2. Test connection → verify reachable
3. Discover entities → return list with domain types
4. List entities → paginated, filtered by domain
5. Delete hub → cascade delete entities
6. 19 supported domains: light, climate, sensor, binary_sensor, switch, media_player, lock, scene, cover, fan, vacuum, camera, alarm_control_panel, humidifier, water_heater, remote, siren, automation, input_boolean

### Command Safety (P0)
1. Safe commands → execute
2. Dangerous commands (factory_reset, format) → 403
3. Unknown commands → 400

### User Isolation (P0)
1. User A's devices not visible to User B
2. User A can't control User B's hub
3. User A can't discover User B's entities

### WebSocket (P1)
1. Connection registry tracks active connections
2. Commands dispatched to correct device
3. Disconnect cleanup

## Gotchas
- `initDb()` pattern required — must call before using Drizzle
- `drizzle-orm` is a direct dependency (not from @repo/database)
- SaaS model: each user connects their OWN HA instance
- Tables: `smart_home_hubs`, `smart_home_entities`, `device_sessions`, `device_commands`
