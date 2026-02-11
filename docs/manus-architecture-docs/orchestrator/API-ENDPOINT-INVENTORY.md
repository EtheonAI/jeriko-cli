# API Endpoint Inventory (Current Rubic)

## Agent service (`services/agent`)
- `GET /health`
- `GET /ready`
- `POST /v1/complete`
- `GET /v1/tools`
- `POST /v1/tools/execute`
- `POST /browser/navigate`
- `POST /browser/click`
- `POST /browser/move`
- `POST /browser/key`
- `POST /browser/type`
- `POST /test/browser`

## Sandbox service (`services/sandbox`)
- `POST /sandboxes`
- `GET /sandboxes/:id`
- `GET /users/:userId/sandboxes`
- `POST /sandboxes/:id/execute`
- `GET /executions/:id`
- `POST /sandboxes/:id/shell`
- `POST /sandboxes/:id/browser`
- `POST /sandboxes/:id/files`
- `GET /sandboxes/:id/files`
- `GET /sandboxes/:id/files/list`
- `POST /sandboxes/:id/stop`
- `DELETE /sandboxes/:id`
- `GET /sandboxes/:id/browser/stream`
- `GET /sandboxes/:id/terminal/stream`

## File service (`services/file`)
- `POST /upload`
- `POST /upload/bulk`
- `GET /files/:id`
- `GET /files/:id/download`
- `PUT /files/:id`
- `DELETE /files/:id`
- `GET /users/:userId/files`

## Connector service (`services/connector`)
- `GET /connectors`
- `GET /connectors/:type`
- `POST /connectors/sync-catalog`
- `GET /users/:userId/integrations`
- `DELETE /integrations/:id`
- `GET /users/:userId/tools`
- `GET /integrations/:id/tools`
- `POST /tools/execute`

## App API adapters (`apps/app/app/api`)
- `POST /api/chat`
- `GET /api/chat/[id]/stream`
- `GET /api/gateway-token`
- `POST /api/files/upload`
- `GET /api/sandbox/[id]/browser/stream`
- `GET /api/sandbox/[id]/terminal/stream`
- `POST /api/sandbox/browser`
