# Slice-by-Slice Build Specification

## Scope
This file defines the minimum complete behavior per slice for your adapted Rubic model, including renamed and added slices (`biz` -> `billing`, `devices` added).

## Priority tiers
- Tier 1: required for core chat/orchestration UX.
- Tier 2: required for production operations and reliability.
- Tier 3: extended product capabilities.

## Tier 1 slices
1. `auth`
- Responsibilities: session identity, token validity, user profile, org/team context.
- Inputs: auth APIs, refresh events.
- Outputs: auth headers for API/ws, access guards.

2. `sessions`
- Responsibilities: session list, active session, lifecycle status.
- Inputs: session CRUD APIs, `session.created`, `sandbox.status`.
- Outputs: navigation state and replay context.

3. `timeline`
- Responsibilities: canonical event stream storage by segment/page.
- Inputs: all websocket events.
- Outputs: render-ready ordered timeline + replay model.

4. `chat`
- Responsibilities: prompt input, stream state, attachments, send/stop controls.
- Inputs: user actions and message events.
- Outputs: message requests and UI response state.

5. `websocket`
- Responsibilities: socket connection, subscriptions, reconnect policy.
- Inputs: auth/session changes.
- Outputs: normalized event dispatch pipeline.

6. `toolCalls`
- Responsibilities: tool lifecycle cards and states.
- Inputs: `tool_call.start`, `tool_call.result`, `tool_call.error`.
- Outputs: tool cards, retries, diagnostics.

7. `plan`
- Responsibilities: current plan phases and progress.
- Inputs: `plan.update`, `plan.advance`.
- Outputs: plan sidebar/timeline states.

8. `fileManagement`
- Responsibilities: file list, uploads, downloads, references.
- Inputs: file APIs + file events.
- Outputs: attachment metadata for chat and timeline.

9. `myBrowser`
- Responsibilities: browser preview snapshots, console logs, active URL.
- Inputs: browser events.
- Outputs: browser panel and operator takeover UX.

10. `agentWorkspace`
- Responsibilities: orchestration context UI (plan/tools/files/browser summary).
- Inputs: timeline + plan + tool states.
- Outputs: unified workspace panels.

## Tier 2 slices
11. `billing` (renamed from manuscript `biz` concept)
- Responsibilities: credits balance, spend rates, limits, warning thresholds.
- Inputs: `credits.update`, billing APIs.
- Outputs: usage banners, hard/soft limit guards.

12. `devices` (added Rubic capability)
- Responsibilities: connected device inventory, status, command approvals.
- Inputs: device APIs and device websocket events.
- Outputs: safe command execution flow with confirmation model.

13. `connectors`
- Responsibilities: connector catalog, installation state, scopes/health.
- Inputs: Composio APIs and auth callbacks.
- Outputs: runtime tool availability gating.

14. `notifications`
- Responsibilities: in-app notifications and action routing.
- Inputs: event bus notifications.
- Outputs: toast center + activity feed.

15. `ui`
- Responsibilities: global layout mode, panel open states, focus state.
- Inputs: user actions + route changes.
- Outputs: deterministic multi-panel layout.

## Tier 3 slices
16. `webdev`
- Responsibilities: project status, checkpoints, preview URLs.
- Inputs: webdev events + APIs.
- Outputs: management view for generated apps.

17. `scheduledTasks`
- Responsibilities: recurring task list, run history, status.
- Inputs: scheduling APIs/events.
- Outputs: automation dashboard.

18. `knowledge`
- Responsibilities: session-bound and persistent facts used by orchestrator.
- Inputs: knowledge APIs.
- Outputs: knowledge badges/context for user transparency.

19. `voice`
- Responsibilities: recording/transcription control and transcript state.
- Inputs: voice APIs/events.
- Outputs: chat input insertion and transcript artifacts.

20. `debug`
- Responsibilities: dev diagnostics only.
- Inputs: instrumentation channels.
- Outputs: non-production diagnostics panel.

## Done criteria per slice
1. State schema documented and typed.
2. Reducers and selectors covered by tests.
3. Event mappings documented and tested.
4. API side effects idempotent and retriable.
5. E2E path covered for primary user flows.
