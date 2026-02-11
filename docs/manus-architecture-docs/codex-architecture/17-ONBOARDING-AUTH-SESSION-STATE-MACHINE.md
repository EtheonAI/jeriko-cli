# Onboarding, Auth, and Session State Machine

## Purpose
Define explicit state machines for onboarding/auth/session/chat so all transitions are deterministic and testable.

## 1. Onboarding/Auth state machine

### States
1. `unauthenticated`
2. `email_entry`
3. `password_entry_existing_user`
4. `password_entry_new_user`
5. `verification_pending`
6. `authenticated`
7. `auth_error`

### Transitions
1. `unauthenticated` -> `email_entry` on `/login` load.
2. `email_entry` -> `password_entry_existing_user` on `check-email exists=true`.
3. `email_entry` -> `password_entry_new_user` on `check-email exists=false`.
4. `password_entry_new_user` -> `verification_pending` on signup success requiring verification.
5. `password_entry_existing_user` -> `authenticated` on successful sign-in.
6. `verification_pending` -> `authenticated` on verified session.
7. Any auth request failure -> `auth_error` with recoverable return to prior state.

### Guards
1. Rate limit and constant-time response on email check.
2. Session cookie existence for proxy-level auth decision.
3. Server `getSession` verification in authenticated layout.

## 2. Application session state machine

### States
1. `no_session`
2. `session_loading`
3. `session_ready`
4. `session_streaming`
5. `session_paused`
6. `session_error`
7. `session_completed`

### Transitions
1. `no_session` -> `session_loading` on route `/chat/[id]` open.
2. `session_loading` -> `session_ready` after DB messages hydrate.
3. `session_ready` -> `session_streaming` on prompt submit (`POST /api/chat`).
4. `session_streaming` -> `session_ready` on stream finish.
5. `session_streaming` -> `session_paused` on client disconnect + resumable stream active.
6. `session_paused` -> `session_streaming` on `GET /api/chat/[id]/stream` success.
7. any state -> `session_error` on unrecoverable failures.
8. `session_ready` -> `session_completed` when orchestrator marks task complete and no active stream.

### Side effects per transition
1. Enter `session_streaming`:
- set `chat.isStreaming=true`
- set `chat.currentStreamingSession=sessionId`
2. Exit `session_streaming`:
- persist messages and parts server-side
- clear active stream id
3. Enter `session_error`:
- emit user-visible toast
- preserve unsent input where possible

## 3. WebSocket connectivity machine

### States
1. `disconnected`
2. `connecting`
3. `connected`
4. `reconnecting`
5. `failed`

### Transitions
1. `disconnected` -> `connecting` on `wsConnect`.
2. `connecting` -> `connected` on socket open.
3. `connected` -> `reconnecting` on close/error.
4. `reconnecting` -> `connected` on successful reconnect.
5. `reconnecting` -> `failed` after max attempts.

### Health rules
1. Ping every configured interval.
2. Missing pong in timeout window forces socket close and reconnect.
3. Queue outbound messages while disconnected with bounded queue.

## 4. Billing and limit machine (required for safe release)

### States
1. `credits_ok`
2. `credits_warning`
3. `credits_soft_block`
4. `credits_hard_block`

### Transitions
1. `credits_ok` -> `credits_warning` at warning threshold.
2. `credits_warning` -> `credits_soft_block` at soft threshold.
3. `credits_soft_block` -> `credits_hard_block` at exhausted threshold.
4. any blocked state -> `credits_ok` after recharge + ledger confirmation.

### Enforcement points
1. Before prompt send.
2. Before tool execution with side effects.
3. Before spawning map subtasks.

## 5. Device safety approval machine

### States
1. `idle`
2. `approval_required`
3. `approved`
4. `rejected`
5. `timed_out`

### Transitions
1. `idle` -> `approval_required` on sensitive device command.
2. `approval_required` -> `approved` on explicit user consent.
3. `approval_required` -> `rejected` on deny.
4. `approval_required` -> `timed_out` on timeout.
5. terminal states -> `idle` on next command cycle.

## 6. Test obligations for these machines
1. Unit tests for every transition and guard.
2. Integration tests for auth + session + stream resume paths.
3. E2E tests for signup/login, first chat, reconnect, and blocked billing/device paths.

## 7. Open details to finalize during implementation
1. Exact MFA branch and provider behavior in better-auth config.
2. Exact verification redirect and callback semantics.
3. Canonical code list for orchestrator and tool errors.
4. Final threshold policy values for billing warnings/blocks.
