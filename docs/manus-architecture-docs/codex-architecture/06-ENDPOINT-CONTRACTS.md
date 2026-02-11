# Endpoint Contracts (Target)

## Intent
Provide a clean product-facing contract set aligned with Manus-style behavior and Rubic naming.

## Public HTTP API (excluding LLM proxy)
### Auth
- `POST /api/auth/login`
- `POST /api/auth/callback`
- `GET /api/auth/me`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

### Sessions
- `POST /v1/sessions`
- `GET /v1/sessions`
- `GET /v1/sessions/:id`
- `DELETE /v1/sessions/:id`
- `POST /v1/sessions/:id/messages`
- `GET /v1/sessions/:id/messages`
- `GET /v1/sessions/:id/timeline`
- `POST /v1/sessions/:id/stop`
- `POST /v1/sessions/:id/resume`

### Files
- `POST /v1/files/upload`
- `GET /v1/files/:id`
- `GET /v1/files/:id/download`

### Connectors
- `GET /v1/connectors`
- `POST /v1/connectors/:id/enable`
- `POST /v1/connectors/:id/disable`
- `GET /v1/connectors/:id/oauth`
- `POST /v1/connectors/:id/oauth/callback`

### User/Billing
- `GET /v1/user/plan`
- `GET /v1/user/credits`
- `GET /v1/user/usage`
- `PUT /v1/user/settings`

### Webdev (optional but planned)
- `POST /v1/webdev/projects`
- `GET /v1/webdev/projects/:id`
- `POST /v1/webdev/projects/:id/checkpoint`
- `POST /v1/webdev/projects/:id/rollback`
- `GET /v1/webdev/projects/:id/files`
- `GET /v1/webdev/projects/:id/files/:path`
- `POST /v1/webdev/projects/:id/restart`
- `GET /v1/webdev/projects/:id/status`
- `POST /v1/webdev/projects/:id/publish`
- `POST /v1/webdev/projects/:id/sql`

### LLM proxy (sandbox-facing)
- `GET /api/llm-proxy/v1/models`
- `POST /api/llm-proxy/v1/chat/completions`

### Forge and media utility APIs (sandbox-facing)
- `POST /api/v1/images/generate`
- `POST /api/v1/audio/transcribe`
- `POST /api/v1/notifications/send`
- `POST /api/v1/storage/upload`
- `GET /api/v1/storage/download/:key`

## WebSocket endpoint
- `wss://<host>/ws?token=<jwt>&session_id=<id>`

## Gateway token bootstrap
- `GET /api/gateway-token` returns a signed access token used to establish WS connection.

## Contract rules
1. Every response includes request id and server timestamp.
2. Idempotency key required on write endpoints with side effects.
3. Version all payload schemas in `packages/contracts`.
4. Backward-incompatible changes require a new endpoint version.
5. LLM proxy follows OpenAI-compatible wire format and must expose model discovery endpoint.
