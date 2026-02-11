# WebSocket Event Protocol

## Purpose
Define one canonical real-time contract from orchestrator to frontend so timeline, tool cards, plan state, billing indicators, and sandbox surfaces cannot drift.

## Transport and channels
1. Primary transport: `wss://.../ws` from app frontend to orchestrator gateway.
2. Backfill transport: HTTP timeline APIs for pagination/replay.
3. Internal fanout: Redis pub/sub or NATS optional, but payload contract remains identical.

## Envelope (all events)
```ts
type EventEnvelope<T> = {
  eventId: string;            // ULID, globally unique
  sessionId: string;
  segmentId: string;          // pagination segment for timeline
  sequence: number;           // strictly monotonic inside session
  type: EventType;
  ts: string;                 // ISO timestamp
  source: 'orchestrator' | 'sandbox' | 'connector' | 'system'; // data origin, not WS emitter
  correlationId?: string;     // links tool_call.start -> tool_call.result
  payload: T;
};
```

All events are emitted by the orchestrator. The `source` field indicates where the underlying data originated.

## Required event types
1. `message.start`
2. `message.delta`
3. `message.final`
4. `message.info`
5. `message.ask`
6. `plan.update`
7. `plan.advance`
8. `tool_call.start`
9. `tool_call.progress`
10. `tool_call.result`
11. `tool_call.error`
12. `sandbox.status`
13. `sandbox.browser.frame`
14. `sandbox.terminal.chunk`
15. `file.uploaded`
16. `file.ready`
17. `credits.update`
18. `connector.status`
19. `orchestrator.error`
20. `task.finished`
21. `pong`

## State mapping rules
1. `timeline` slice ingests every event by `sequence` order.
2. `chat` slice ingests `message.*` only.
3. `plan` slice ingests `plan.*` only.
4. `toolCalls` slice ingests `tool_call.*` and uses `correlationId` as primary key.
5. `billing` slice ingests `credits.update`.
6. `devices` slice ingests `device.*` events (Rubic extension).

## Ordering and replay
1. Orchestrator emits increasing `sequence` per session.
2. Frontend detects gaps and requests replay from `GET /api/sessions/:id/timeline?fromSequence=N`.
3. Replay events are merged with same reducer logic as live stream.
4. Duplicate `eventId` must be ignored idempotently.

## Error semantics
1. Retriable errors: `tool_timeout`, `transient_network`, `sandbox_busy`.
2. Non-retriable errors: `schema_invalid`, `auth_invalid`, `permission_denied`.
3. `orchestrator.error` always includes:
```json
{
  "code": "string",
  "severity": "warn|error|fatal",
  "userVisible": true,
  "retryable": false,
  "message": "string"
}
```

## Wire examples
```json
{
  "eventId": "01K2...",
  "sessionId": "sess_123",
  "segmentId": "seg_08",
  "sequence": 244,
  "type": "tool_call.start",
  "ts": "2026-02-10T18:37:12.112Z",
  "source": "orchestrator",
  "correlationId": "tool_77",
  "payload": {
    "name": "shell",
    "args": { "action": "exec", "command": "pnpm test", "session": "default" },
    "mode": "workspace"
  }
}
```

```json
{
  "eventId": "01K2...",
  "sessionId": "sess_123",
  "segmentId": "seg_08",
  "sequence": 245,
  "type": "tool_call.result",
  "ts": "2026-02-10T18:37:20.221Z",
  "source": "sandbox",
  "correlationId": "tool_77",
  "payload": {
    "ok": true,
    "exitCode": 0,
    "stdout": "All tests passed",
    "stderr": "",
    "durationMs": 8109
  }
}
```

## Versioning
1. Include `x-event-schema-version` handshake on WS connect.
2. Backward compatible additions only in minor versions.
3. Breaking changes require a new major channel and adapter period.

## References
- `docs/manus-architecture-docs/11-SUPPLEMENT-E-STATE-CHANGE-FLOWS.md`
- `docs/manus-architecture-docs/13-SUPPLEMENT-G-TIMELINE-DATABASE-PERSISTENCE.md`
- `docs/manus-architecture-docs/orchestrator/API-ENDPOINT-INVENTORY.md`
