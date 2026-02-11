# Data Model and Persistence

## Core entities
1. `users`
2. `sessions`
3. `messages`
4. `tool_calls`
5. `plans`
6. `timeline_events`
7. `files`
8. `connector_integrations`
9. `usage_ledger`
10. `sandbox_allocations`
11. `map_jobs`
12. `map_subtasks`
13. `knowledge_facts`

## Required relationships
- One user to many sessions.
- One session to many messages/tool calls/events.
- One message may reference many file artifacts.
- One map job belongs to one parent tool call and many subtasks.
- One user owns many persistent knowledge facts.

## Persistence strategy
1. Write-ahead timeline event row for every meaningful transition.
2. Message and tool call rows derive from timeline but stay query-optimized.
3. Usage ledger records model/tool costs with immutable entries.
4. Sandbox allocation table tracks lifecycle and ownership.

## Indexing guidelines
1. `sessions(user_id, updated_at desc)`
2. `timeline_events(session_id, created_at asc)`
3. `tool_calls(session_id, created_at desc)`
4. `usage_ledger(user_id, created_at desc)`
5. `map_subtasks(map_job_id, status)`

## Data quality rules
1. Every timeline event has deterministic event id.
2. Tool calls and results are linked by id and session id.
3. No orphan files: reference checks + cleanup jobs.
4. Billing entries must reconcile against tool/model usage records.
5. Knowledge facts include provenance and update timestamps for prompt injection traceability.
