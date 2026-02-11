# API-Event-Slice Matrix

## Purpose
Define exact ownership and mapping between APIs, emitted events, Redux slices, and persistence tables so no state transition is implicit.

## A. Authentication and session bootstrap
| Trigger | API / Channel | Event(s) | Slice(s) | Persistence |
|---|---|---|---|---|
| User submits email | `POST /api/auth/check-email` | none | `login`, `auth` UI state | user lookup only |
| Sign in/up | `app/api/auth/[...all]` (better-auth) | session cookie change | `auth` | auth tables (better-auth) |
| Authenticated WS token | `GET /api/gateway-token` | none | `websocket` connect path | JWT only |

## B. Chat send and streaming
| Trigger | API / Channel | Event(s) | Slice(s) | Persistence |
|---|---|---|---|---|
| Send prompt | `POST /api/chat` | SSE `start`, text/tool deltas, `finish` | `chat`, `timeline`, `sessions` | `messages`, `agent_sessions` |
| Resume stream | `GET /api/chat/:id/stream` | resumed SSE chunks | `chat`, `timeline` | redis stream state |
| Agent tool call stream | SSE from `agent-proxy` | tool lifecycle parts + plan parts | `agentWorkspace`, `timeline`, `myBrowser`, `fileManagement` | `messages.parts` |

## C. WebSocket domain events
| WS Event Type | Slice reducers |
|---|---|
| `connected`, `subscribed`, `pong`, `error` | `websocket` |
| `session:new`, `session:update`, `session:deleted` | `sessions` |
| `message:new`, `message:update` | `chat` |
| `agent:new`, `agent:update`, `task:*` | `agents` |
| `notification:new`, `notification:read` | `notifications` |
| `scheduledTask:*` | `scheduledTasks` |
| `device:status` | `devices` |

## D. File and sandbox adapters
| Trigger | API | Slice(s) | Persistence |
|---|---|---|---|
| Upload file | `POST /api/files/upload` | `fileManagement`, `chat` attachments | file metadata + object store |
| Browser stream | `GET /api/sandbox/:id/browser/stream` | `myBrowser`, `agentWorkspace` | none directly |
| Terminal stream | `GET /api/sandbox/:id/terminal/stream` | `agentWorkspace` | optional logs |
| Browser command | `POST /api/sandbox/browser` | `myBrowser` | none directly |

## E. Planned canonical event protocol alignment
These current events must be normalized into `10-WEBSOCKET-EVENT-PROTOCOL.md` target categories:
1. `message.delta` / `message.final`
2. `tool_call.start` / `tool_call.progress` / `tool_call.result` / `tool_call.error`
3. `plan.update` / `plan.advance`
4. `sandbox.status` / `sandbox.browser.frame` / `sandbox.terminal.chunk`
5. `file.uploaded` / `file.ready`
6. `credits.update`
7. `task.finished`

## F. Slice completion contract (must-have)
1. `auth`: session identity, auth status, token-linked side effects.
2. `sessions`: list + active session + lifecycle updates.
3. `chat`: message timeline for current session.
4. `timeline`: cross-event ordered stream with replay.
5. `websocket`: connection and error state.
6. `agentWorkspace`: plan/tool/file/browser aggregate state.
7. `myBrowser`: URL, screenshot/frame, control state.
8. `fileManagement`: upload/download/reference state.
9. `connectors`: Composio availability and install/auth health.
10. `billing`: credits/usage limits and warnings.
11. `devices`: device state and safety approval path.

## G. Known mismatches to be fixed in migration
1. Legacy `biz` slice remains mounted while `billing` exists.
2. Some domains use SSE parts while others use WS events without a single schema package.
3. Placeholder slices (for example `meeting`) exist without full behavior.
4. Tool/result payload shapes differ between runtime domains.

## H. Required schema package outputs
`packages/contracts` must generate:
1. API request/response DTOs.
2. WS event envelopes and payload schemas.
3. Tool intent/result schemas.
4. Timeline persistence row schemas.
5. Frontend type-safe reducers/selectors contract.
