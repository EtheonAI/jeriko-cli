# @repo/database

`@repo/database` owns Drizzle schema, relations, migrations, client factories, and database env contracts.

## Resume-Reconnect Note

Current schema contains old resume-related hints:

- `agent_sessions.activeStreamId`
- `messages.parts`

These are not a complete workflow resume model.

Future workflow-native persistence must be designed under `MADR-096` before workflow/chat rebuild:

- `workflow_runs`
- `run_events`
- task events
- artifacts
- active stream/run mapping
- event cursor/sequence
- cancellation requests

Browser refresh/tab close must not cancel a workflow run. Cancellation must be explicit and persisted.

## Boundaries

This package must not own:

- route handlers;
- workflow parser/runtime logic;
- AI SDK execution;
- sandbox provider SDKs;
- app UI.
