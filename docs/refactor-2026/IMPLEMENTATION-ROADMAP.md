# Rubic Refactor: Complete Implementation Roadmap

**Date:** 2026-02-10
**Authority:** `docs/manus-architecture-docs/codex-architecture/` (canonical package)
**MADR Reference:** `MADR-001-RUBIC-MANUS-ARCHITECTURE-REFACTOR.md`

---

## Overview

This document provides an **exhaustive, day-by-day breakdown** of the 8-phase migration from current Rubic architecture to Manus-style architecture. Every functionality, test requirement, rollback procedure, and success criterion is documented to prevent bugs and surprises.

**Total Duration:** 15 weeks (72 implementation days + 14-day rollback hold)
**Team Size:** Assumed 2-3 full-time engineers
**Risk Level:** Medium (mitigated by progressive rollout)

---

## Phase 0: Freeze and Baseline (3 Days)

### Days 1-3: February 11-13, 2026

#### Objectives
1. Freeze all net-new architecture changes
2. Capture production baseline for regression testing
3. Build golden task suite for parity validation

#### Tasks

**Day 1: Freeze + Snapshot**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P0.1 | Code freeze: No new services, no new slices, no endpoint changes | Tech Lead | 1h | GitHub branch protection rule |
| P0.2 | Snapshot current API surface: All endpoints, all events, all tool definitions | Eng #1 | 4h | `baseline/api-snapshot.json` |
| P0.3 | Snapshot current Redux slices: State shapes, action types, reducer logic | Eng #2 | 4h | `baseline/redux-snapshot.json` |
| P0.4 | Export production DB schema | Eng #1 | 1h | `baseline/schema.sql` |

**Day 2: Trace Capture**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P0.5 | Identify 20+ representative production sessions | Product | 2h | `baseline/session-list.csv` |
| P0.6 | Capture full traces: HTTP requests, WebSocket events, DB queries, tool calls | Eng #1 | 6h | `baseline/traces/*.jsonl` (20+ files) |
| P0.7 | Capture frontend Redux state transitions per session | Eng #2 | 6h | `baseline/state-transitions/*.json` |

**Day 3: Golden Suite Build**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P0.8 | Transform traces into test fixtures | Eng #1 | 4h | `tests/golden-suite/fixtures/*.json` |
| P0.9 | Build replay harness: Load fixture → run → assert output | Eng #2 | 4h | `tests/golden-suite/harness.ts` |
| P0.10 | Run baseline: All 20+ sessions pass on current architecture | Both | 2h | CI green badge |

#### Exit Criteria
- ✅ Code freeze in effect (branch protection active)
- ✅ 20+ production session traces captured
- ✅ Golden suite harness runs and passes 100% on current architecture
- ✅ Baseline metrics recorded: p95 latency, error rates, event counts

#### Testing
```typescript
// tests/golden-suite/baseline.test.ts
describe('Baseline Golden Suite', () => {
  it('should replay session 1: Simple Q&A', async () => {
    const fixture = await loadFixture('session-1-simple-qa.json');
    const result = await replaySession(fixture, { orchestrator: 'python' });
    expect(result.events).toMatchSnapshot();
    expect(result.finalMessage).toMatchSnapshot();
  });

  it('should replay session 2: Multi-tool coding task', async () => {
    const fixture = await loadFixture('session-2-coding-task.json');
    const result = await replaySession(fixture, { orchestrator: 'python' });
    expect(result.toolCalls).toMatchSnapshot();
    expect(result.fileArtifacts).toMatchSnapshot();
  });

  // ... 18+ more sessions
});
```

---

## Phase 1: Contracts First (1 Week)

### Days 4-10: February 14-20, 2026

#### Objectives
1. Create `packages/contracts` with Zod schemas for all tools, events, APIs
2. Generate TypeScript types from schemas
3. Add CI schema compatibility gate

#### Tasks

**Days 4-5: Tool Contracts**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P1.1 | Create `packages/contracts` monorepo package | Eng #1 | 1h | `packages/contracts/package.json` |
| P1.2 | Define tool intent schemas (12 entrance tools + action/mode variants) | Eng #1 | 8h | `packages/contracts/src/tools/*.zod.ts` |
| P1.3 | Define tool result schemas (12 entrance tools + action/mode variants) | Eng #1 | 8h | `packages/contracts/src/tools/*.result.zod.ts` |
| P1.4 | Generate TypeScript types from Zod schemas | Eng #1 | 2h | `packages/contracts/dist/types.d.ts` |

**Days 6-7: Event Contracts**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P1.5 | Define EventEnvelope schema (Part 10 format) | Eng #2 | 2h | `packages/contracts/src/events/envelope.zod.ts` |
| P1.6 | Define canonical 21-event contract (18 verified + 3 reserved) | Eng #2 | 10h | `packages/contracts/src/events/*.zod.ts` |
| P1.7 | Add event versioning strategy | Eng #2 | 2h | `packages/contracts/src/events/version.ts` |
| P1.8 | Generate EventType union + discriminated union | Eng #2 | 2h | `packages/contracts/dist/events.d.ts` |

**Days 8-9: API Contracts**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P1.9 | Define session API request/response schemas | Eng #1 | 4h | `packages/contracts/src/api/sessions.zod.ts` |
| P1.10 | Define file API request/response schemas | Eng #1 | 2h | `packages/contracts/src/api/files.zod.ts` |
| P1.11 | Define connector API request/response schemas | Eng #1 | 2h | `packages/contracts/src/api/connectors.zod.ts` |
| P1.12 | Define user/billing API request/response schemas | Eng #2 | 2h | `packages/contracts/src/api/user.zod.ts` |
| P1.13 | Define webdev API request/response schemas | Eng #2 | 4h | `packages/contracts/src/api/webdev.zod.ts` |
| P1.13a | Define Forge/LLM proxy contract schemas (`/api/llm-proxy/v1` and `forge.manus.ai`) | Eng #1 | 4h | `packages/contracts/src/api/forge.zod.ts` |
| P1.13b | Define map `output_schema` validation (including `file` type transfer) | Eng #2 | 4h | `packages/contracts/src/tools/map-output-schema.zod.ts` |

**Day 10: CI Gate + Compatibility**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P1.14 | Build schema diff tool: old vs new | Eng #1 | 4h | `packages/contracts/scripts/schema-diff.ts` |
| P1.15 | Add CI job: Schema compatibility check on PR | Eng #1 | 2h | `.github/workflows/schema-check.yml` |
| P1.16 | Add compatibility adapters for old events → new events | Eng #2 | 6h | `packages/contracts/src/adapters/*.ts` |
| P1.17 | Test old Python agent against new contracts | Both | 2h | Integration test suite green |

#### Exit Criteria
- ✅ `packages/contracts` package published to workspace
- ✅ All 29 tool intents/results have Zod schemas
- ✅ Canonical 21-event contract schemas exist (18 verified + 3 reserved)
- ✅ All API endpoints have Zod request/response schemas
- ✅ CI fails on contract-breaking changes
- ✅ Backward compatibility adapters tested

#### Testing Strategy

**Unit Tests:**
```typescript
// packages/contracts/src/tools/__tests__/shell.test.ts
import { shellToolIntentSchema, shellToolResultSchema } from '../shell.zod';

describe('Shell Tool Contracts', () => {
  it('should validate shell action=exec intent', () => {
    const valid = shellToolIntentSchema.safeParse({
      action: 'exec',
      command: 'ls -la',
      session: 'default',
    });
    expect(valid.success).toBe(true);
  });

  it('should reject invalid action', () => {
    const invalid = shellToolIntentSchema.safeParse({
      action: 'invalid',
      command: 'ls',
    });
    expect(invalid.success).toBe(false);
  });

  it('should validate shell action=exec result', () => {
    const valid = shellToolResultSchema.safeParse({
      ok: true,
      exitCode: 0,
      stdout: 'file1.txt\nfile2.txt',
      stderr: '',
    });
    expect(valid.success).toBe(true);
  });
});
```

**Contract Tests:**
```typescript
// packages/contracts/src/__tests__/backward-compat.test.ts
import { adaptOldEventToNew } from '../adapters/events';

describe('Backward Compatibility', () => {
  it('should adapt old message_chunk to new message.delta', () => {
    const oldEvent = {
      type: 'message_chunk',
      payload: { delta: 'Hello' },
    };
    const newEvent = adaptOldEventToNew(oldEvent);
    expect(newEvent.type).toBe('message.delta');
    expect(newEvent.payload.delta).toBe('Hello');
  });
});
```

---

## Phase 2: New Node Orchestrator Bootstrap (2 Weeks)

### Days 11-24: February 21 - March 6, 2026

#### Objectives
1. Create `services/orchestrator` with AI SDK `streamText`
2. Implement core agent loop with tool registry
3. Run shadow sessions (read-only, no writes)

#### Tasks

**Days 11-12: Service Skeleton**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P2.1 | Create `services/orchestrator` package | Eng #1 | 2h | `services/orchestrator/package.json` |
| P2.2 | Install dependencies: `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `fastify`, `zod` | Eng #1 | 1h | Dependencies installed |
| P2.3 | Setup Fastify server with health check | Eng #1 | 2h | `services/orchestrator/src/server.ts` |
| P2.4 | Add OpenTelemetry instrumentation | Eng #2 | 4h | Spans visible in Jaeger |
| P2.5 | Add structured logging (pino) | Eng #2 | 2h | JSON logs with sessionId |
| P2.5a | Implement system prompt assembly (`<agent_loop>`, `<tool_use>`, `<skills>`, `<related_knowledge>`, `<error_handling>`) | Eng #1 | 8h | `prompt-builder.ts` |
| P2.5b | Implement context compaction (`<compacted_history>`) + token budget manager | Eng #2 | 8h | `context-compactor.ts` |
| P2.5c | Implement skill loader (metadata -> full `SKILL.md` progressive loading) | Eng #1 | 4h | `skills-loader.ts` |
| P2.5d | Implement `plan` and `schedule` local tools (orchestrator-owned) | Eng #2 | 6h | tools wired |

**Days 13-14: Core Loop**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P2.6 | Implement AI SDK agent loop with `streamText` | Eng #1 | 8h | `services/orchestrator/src/agent-loop.ts` |
| P2.7 | Implement system prompt builder (XML sections) | Eng #1 | 6h | `services/orchestrator/src/prompt-builder.ts` |
| P2.8 | Implement tool registry (load from contracts) | Eng #2 | 6h | `services/orchestrator/src/tool-registry.ts` |
| P2.9 | Implement mode manager (expansion vs nested) | Eng #2 | 6h | `services/orchestrator/src/mode-manager.ts` |

**Days 15-17: Tool Execution Router**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P2.10 | Implement tool executor: route to local/sandbox/connector | Eng #1 | 8h | `services/orchestrator/src/tool-executor.ts` |
| P2.11 | Implement local tools: plan, message, search, schedule | Eng #1 | 8h | Tool handlers implemented |
| P2.12 | Implement E2B adapter: TCP → start_server protocol | Eng #2 | 10h | E2B tools execute correctly |
| P2.13 | Implement Composio adapter: dynamic tool loading | Eng #2 | 6h | Connector tools load |

**Days 18-19: Timeline Persistence**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P2.14 | Implement timeline event writer | Eng #1 | 4h | `services/orchestrator/src/timeline-writer.ts` |
| P2.15 | Implement session context loader (DB → messages) | Eng #1 | 4h | History loads correctly |
| P2.16 | Implement event segmentation for pagination | Eng #2 | 6h | Segments created correctly |
| P2.17 | Add event sequence numbering (monotonic) | Eng #2 | 2h | No gaps in sequence |

**Days 20-22: Shadow Mode**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P2.18 | Add feature flag: `ORCHESTRATOR_VERSION=python|node|shadow` | Eng #1 | 2h | Feature flag live |
| P2.19 | Implement shadow router: mirror traffic to new orchestrator | Eng #1 | 6h | Traffic mirrored |
| P2.20 | Add shadow metrics: latency, errors, diff from baseline | Eng #2 | 6h | Metrics dashboard |
| P2.21 | Run shadow mode on 5% of sessions | Both | 2h | Observability confirms parity |

**Days 23-24: Bug Fixes + Testing**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P2.22 | Fix bugs found in shadow mode | Both | 12h | Shadow metrics green |
| P2.23 | Write unit tests for agent loop | Eng #1 | 4h | 80%+ coverage |
| P2.24 | Write integration tests for tool routing | Eng #2 | 4h | All tool categories covered |

#### Exit Criteria
- ✅ `services/orchestrator` runs on port TBD
- ✅ Shadow mode runs on 5% of sessions
- ✅ Latency within 10% of baseline (p95 < 3.4s)
- ✅ Event structure matches contracts (validated by CI)
- ✅ No production writes from shadow orchestrator
- ✅ Unit + integration test coverage >= 80%

#### Testing Strategy

**Unit Tests:**
```typescript
// services/orchestrator/src/__tests__/agent-loop.test.ts
import { runAgentLoop } from '../agent-loop';

describe('Agent Loop', () => {
  it('should stop after maxSteps', async () => {
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Hello' }],
      maxSteps: 5,
      tools: mockTools,
    });
    expect(result.steps.length).toBeLessThanOrEqual(5);
  });

  it('should handle tool execution errors gracefully', async () => {
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Run failing command' }],
      tools: {
        shell: vi.fn().mockRejectedValue(new Error('Command failed')),
      },
    });
    expect(result.error).toBeDefined();
    expect(result.error.retryable).toBe(true);
  });
});
```

**Integration Tests:**
```typescript
// services/orchestrator/src/__tests__/e2b-integration.test.ts
import { E2BAdapter } from '../adapters/e2b';

describe('E2B Integration', () => {
  let adapter: E2BAdapter;

  beforeAll(async () => {
    adapter = new E2BAdapter({ apiKey: process.env.E2B_API_KEY });
    await adapter.connect();
  });

  it('should execute shell command in sandbox', async () => {
    const result = await adapter.executeTool('shell', {
      action: 'exec',
      command: 'echo hello',
    });
    expect(result.stdout).toBe('hello\n');
    expect(result.exitCode).toBe(0);
  });

  it('should write and read file in sandbox', async () => {
    await adapter.executeTool('file', {
      action: 'write',
      path: '/tmp/test.txt',
      content: 'test content',
    });
    const result = await adapter.executeTool('file', {
      action: 'read',
      path: '/tmp/test.txt',
    });
    expect(result.content).toBe('test content');
  });
});
```

**Shadow Mode Validation:**
```typescript
// services/orchestrator/src/__tests__/shadow-parity.test.ts
describe('Shadow Mode Parity', () => {
  it('should produce equivalent events for simple Q&A', async () => {
    const fixture = loadFixture('session-1-simple-qa.json');

    const pythonResult = await replaySession(fixture, { orchestrator: 'python' });
    const nodeResult = await replaySession(fixture, { orchestrator: 'node' });

    expect(nodeResult.events.length).toBe(pythonResult.events.length);
    expect(nodeResult.finalMessage.content).toBe(pythonResult.finalMessage.content);
  });
});
```

---

## Phase 3: Sandbox Control-Plane Consolidation (1 Week)

### Days 25-29: March 7-13, 2026

#### Objectives
1. Move E2B lifecycle authority to orchestrator
2. Convert `services/sandbox` into thin adapter or retire it
3. Implement template decision function

#### Tasks

**Days 25-26: Lifecycle Migration**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P3.1 | Implement E2B sandbox manager in orchestrator | Eng #1 | 8h | `services/orchestrator/src/sandbox-manager.ts` |
| P3.2 | Implement per-user sandbox lookup/reuse logic | Eng #1 | 6h | One sandbox per user enforced |
| P3.3 | Implement hibernation/resume handling | Eng #1 | 4h | Sandboxes hibernate after 30min idle |
| P3.4 | Implement template selector: base \| desktop \| code-interpreter | Eng #2 | 4h | Correct template chosen |

**Days 27-28: Environment Injection**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P3.5 | Implement 4-layer env injection pipeline | Eng #2 | 8h | Template → boot → user → runtime |
| P3.6 | Implement secret redaction in logs | Eng #2 | 4h | No plaintext secrets in logs |
| P3.7 | Test runtime injection: OPENAI_API_KEY, VITE_*, JWT_SECRET | Both | 4h | Env vars present in PTY |

**Day 29: Sandbox Service Retirement**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P3.8 | Migrate existing callers from `services/sandbox` to orchestrator | Eng #1 | 6h | No direct calls to sandbox service |
| P3.9 | Convert `services/sandbox` to thin proxy or delete | Eng #1 | 2h | Decision documented |
| P3.10 | Update deployment: remove sandbox service or keep as adapter | Both | 2h | Deploy successful |

#### Exit Criteria
- ✅ Orchestrator is sole authority for E2B lifecycle
- ✅ Per-user sandbox policy enforced (no duplicate sandboxes)
- ✅ Template selection logic tested
- ✅ 4-layer env injection verified via integration tests
- ✅ `services/sandbox` deleted or converted to thin adapter
- ✅ No direct E2B SDK calls outside orchestrator

#### Testing Strategy

**Unit Tests:**
```typescript
// services/orchestrator/src/__tests__/sandbox-manager.test.ts
import { SandboxManager } from '../sandbox-manager';

describe('Sandbox Manager', () => {
  it('should reuse existing sandbox for same user', async () => {
    const manager = new SandboxManager();
    const sandbox1 = await manager.getSandbox({ userId: 'user123' });
    const sandbox2 = await manager.getSandbox({ userId: 'user123' });
    expect(sandbox1.id).toBe(sandbox2.id);
  });

  it('should select correct template based on mode', () => {
    const manager = new SandboxManager();
    expect(manager.selectTemplate({ mode: 'base' })).toBe('base-template');
    expect(manager.selectTemplate({ mode: 'desktop' })).toBe('desktop-template');
  });
});
```

**Integration Tests:**
```typescript
// services/orchestrator/src/__tests__/env-injection.test.ts
describe('Environment Injection', () => {
  it('should inject runtime vars into PTY session', async () => {
    const sandbox = await createTestSandbox();
    const result = await sandbox.executeTool('shell', {
      action: 'exec',
      command: 'echo $OPENAI_API_KEY',
    });
    expect(result.stdout).toMatch(/^sk-/);
  });

  it('should redact secrets from logs', async () => {
    const logs = await captureOrchestratorLogs(() => {
      return executeSandboxCommand({ env: { API_KEY: 'secret123' } });
    });
    expect(logs).not.toContain('secret123');
    expect(logs).toContain('[REDACTED]');
  });
});
```

---

## Phase 4: Tool Runtime Parity (2 Weeks)

### Days 30-43: March 14-27, 2026

#### Objectives
1. Implement canonical tool model (12 entrance tools + action/mode expansions) with parity
2. Add map fanout with temporary subtask sandboxes
3. Add deterministic retries, timeouts, cancellation

#### Tasks

**Days 30-33: File/Match Tools**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P4.1 | Implement file.read | Eng #1 | 2h | Tool working |
| P4.2 | Implement file.write | Eng #1 | 2h | Tool working |
| P4.3 | Implement file.edit (structured edits: find/replace) | Eng #1 | 4h | Tool working |
| P4.4 | Implement match tool `action=grep` | Eng #1 | 4h | Tool working |
| P4.5 | Implement match tool `action=glob` | Eng #1 | 4h | Tool working |
| P4.6 | Test all file tools against golden suite | Eng #1 | 4h | All pass |

**Days 34-36: Shell Tool (5 actions)**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P4.7 | Implement shell tool `action=exec` with persistent PTY sessions | Eng #2 | 8h | Tool working |
| P4.8 | Implement shell tool `action=view` (read PTY output) | Eng #2 | 2h | Tool working |
| P4.9 | Implement shell tool `action=wait` (wait for process) | Eng #2 | 2h | Tool working |
| P4.10 | Implement shell tool `action=send` (stdin) | Eng #2 | 4h | Tool working |
| P4.11 | Implement shell tool `action=kill` | Eng #2 | 2h | Tool working |
| P4.12 | Test all shell tools against golden suite | Eng #2 | 4h | All pass |

**Days 37-39: Browser Mode (1 entrance + 12 browser tools)**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P4.13 | Implement `browser` entrance tool (activates browser mode toolset) | Eng #1 | 4h | Tool working |
| P4.14 | Implement `browser_view` and `browser_click` | Eng #1 | 6h | Tools working |
| P4.15 | Implement `browser_input` and `browser_scroll` | Eng #1 | 2h | Tools working |
| P4.16 | Implement remaining browser tools (`browser_select`, `browser_hover`, etc.) | Eng #2 | 8h | All working |
| P4.17 | Implement mode-manager toolset expansion for browser mode | Eng #2 | 4h | Mode expansion works |
| P4.19 | Test all browser tools against golden suite | Both | 4h | All pass |

**Days 40-41: Other Orchestrator Tools**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P4.20 | Implement search tool (orchestrator-owned) | Eng #1 | 6h | Tool working |
| P4.21 | Implement expose tool (`expose`) and remove `apply_deployment` references | Eng #2 | 4h | Tool working |
| P4.22 | Implement message tool (`type=info|ask|result`) | Eng #1 | 4h | Tool working |
| P4.22a | Implement generate/slides nested sub-call flow | Eng #1 | 6h | Sub-calls working |
| P4.22b | Implement webdev toolset (`webdev_init_project`, `webdev_add_feature`, checkpoints, restart, SQL) | Eng #2 | 8h | Webdev tools working |
| P4.23 | Test all other tools against golden suite | Both | 2h | All pass |

**Days 42-43: Map Tool + Retry Logic**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P4.24 | Implement map tool: spawn subtask sandboxes | Eng #1 | 10h | Map tool working |
| P4.25 | Implement subtask agent loop (OpenAI inside sandbox) | Eng #1 | 6h | Subtasks execute |
| P4.25a | Implement map output aggregation + `file` output transfer back to main sandbox | Eng #1 | 6h | Aggregation contract enforced |
| P4.26 | Implement deterministic retry logic (transient/auth/fatal) | Eng #2 | 6h | Retries work |
| P4.27 | Implement timeout handling with cancellation tokens | Eng #2 | 4h | Timeouts enforced |
| P4.28 | Test map tool with 10 parallel subtasks | Both | 2h | All complete |

#### Exit Criteria
- ✅ Canonical tool model implemented (entrance tools + action/mode expansions)
- ✅ 95%+ tool parity on golden task suite
- ✅ Map tool spawns temporary sandboxes correctly
- ✅ Retry logic handles transient errors
- ✅ Timeout enforcement prevents infinite hangs
- ✅ Tool execution error rate < 2% on shadow traffic

#### Testing Strategy

**Unit Tests:**
```typescript
// services/orchestrator/src/tools/__tests__/file.test.ts
describe('File Tools', () => {
  it('should read file content', async () => {
    const sandbox = await createTestSandbox();
    await sandbox.executeTool('file', { action: 'write', path: '/tmp/test.txt', content: 'hello' });
    const result = await sandbox.executeTool('file', { action: 'read', path: '/tmp/test.txt' });
    expect(result.content).toBe('hello');
  });

  it('should perform string replacement', async () => {
    const sandbox = await createTestSandbox();
    await sandbox.executeTool('file', { action: 'write', path: '/tmp/test.txt', content: 'old text' });
    await sandbox.executeTool('file', { action: 'str_replace', path: '/tmp/test.txt', old_str: 'old', new_str: 'new' });
    const result = await sandbox.executeTool('file', { action: 'read', path: '/tmp/test.txt' });
    expect(result.content).toBe('new text');
  });
});
```

**Golden Suite Parity:**
```typescript
// services/orchestrator/src/__tests__/tool-parity.test.ts
describe('Tool Parity (Python vs Node)', () => {
  const goldenSessions = loadGoldenSuite();

  goldenSessions.forEach((session) => {
    it(`should match Python agent on: ${session.name}`, async () => {
      const pythonResult = await replaySession(session, { orchestrator: 'python' });
      const nodeResult = await replaySession(session, { orchestrator: 'node' });

      // Compare tool call sequences
      expect(nodeResult.toolCalls.map(t => t.name)).toEqual(pythonResult.toolCalls.map(t => t.name));

      // Compare final outputs (allow minor formatting differences)
      expect(normalizeOutput(nodeResult.finalMessage)).toBe(normalizeOutput(pythonResult.finalMessage));
    });
  });
});
```

---

## Phase 5: Media Path Hardening (1 Week)

### Days 44-48: March 28 - April 1, 2026

#### Objectives
1. Create/standardize `services/webrtc-media` (Go + Neko)
2. Move browser/desktop stream routing through media service
3. Unify session → sandbox → media lookup

#### Tasks

**Days 44-45: WebRTC Service**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P5.1 | Create `services/webrtc-media` (Go) | Eng #2 | 4h | Service skeleton |
| P5.2 | Implement Neko session manager | Eng #2 | 8h | Neko lifecycle controlled |
| P5.3 | Implement TURN proxy configuration | Eng #2 | 4h | TURN working |
| P5.4 | Implement stream RPC interface | Eng #2 | 4h | gRPC/REST endpoint |

**Days 46-47: Stream Routing**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P5.5 | Implement orchestrator → media service lookup | Eng #1 | 4h | Lookup returns stream URL |
| P5.6 | Implement browser stream proxy route | Eng #1 | 4h | `/api/sandbox/:id/browser/stream` |
| P5.7 | Implement terminal stream proxy route | Eng #1 | 4h | `/api/sandbox/:id/terminal/stream` |
| P5.8 | Test stream reconnect behavior | Both | 4h | Reconnect works |

**Day 48: Integration + Testing**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P5.9 | Integration test: Full desktop streaming flow | Both | 4h | Stream visible in frontend |
| P5.10 | Load test: 50 concurrent streams | Eng #2 | 2h | No degradation |
| P5.11 | Fix bugs found in integration | Both | 4h | Streams stable |

#### Exit Criteria
- ✅ `services/webrtc-media` deployed
- ✅ Browser/desktop streams route through media service
- ✅ Stream URLs stable and documented
- ✅ Reconnect behavior tested and working
- ✅ Load test passes (50 concurrent streams)

#### Testing Strategy

**Integration Tests:**
```typescript
// services/webrtc-media/__tests__/neko-integration.test.ts
describe('Neko Integration', () => {
  it('should create Neko session for sandbox', async () => {
    const session = await nekoManager.createSession({ sandboxId: 'test-sandbox' });
    expect(session.url).toMatch(/^wss:\/\//);
    expect(session.password).toBeDefined();
  });

  it('should clean up Neko session on sandbox close', async () => {
    const session = await nekoManager.createSession({ sandboxId: 'test-sandbox' });
    await nekoManager.closeSession(session.id);
    const exists = await nekoManager.getSession(session.id);
    expect(exists).toBeNull();
  });
});
```

**E2E Tests:**
```typescript
// e2e/browser-streaming.spec.ts
import { test, expect } from '@playwright/test';

test('should stream browser view', async ({ page }) => {
  await page.goto('/chat/test-session');

  // Agent navigates to a URL
  await page.getByPlaceholder('Message...').fill('Navigate to example.com');
  await page.keyboard.press('Enter');

  // Wait for browser view to appear
  const browserView = page.getByTestId('browser-view');
  await expect(browserView).toBeVisible({ timeout: 10000 });

  // Check screenshot is displayed
  const screenshot = browserView.locator('img');
  await expect(screenshot).toHaveAttribute('src', /data:image\/png/);
});
```

---

## Phase 6: Frontend Slice Consolidation (2 Weeks)

### Days 49-62: April 2-15, 2026

#### Objectives
1. Keep and harden Tier-1 slices (10 slices)
2. Migrate Tier-2 slices (5 slices) to canonical event reducers
3. Remove placeholder and dead slices

#### Tasks

**Days 49-52: Tier-1 Slices (Core)**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P6.1 | Audit `auth` slice: Ensure state shape matches contracts | Eng #1 | 4h | Schema aligned |
| P6.2 | Audit `sessions` slice: Add lifecycle status field | Eng #1 | 4h | Events mapped |
| P6.3 | Audit `timeline` slice: Implement segment pagination | Eng #1 | 6h | Pagination working |
| P6.4 | Audit `chat` slice: Normalize message parts | Eng #1 | 6h | Parts structure canonical |
| P6.5 | Audit `websocket` slice: Add reconnect policy | Eng #2 | 4h | Reconnect working |
| P6.6 | Audit `toolCalls` slice: Use correlationId as key | Eng #2 | 4h | Tool cards render correctly |
| P6.7 | Audit `plan` slice: Map plan.update/advance events | Eng #2 | 4h | Planner UI updates |
| P6.8 | Audit `fileManagement` slice: Add upload progress | Eng #2 | 4h | Progress bars work |
| P6.9 | Audit `myBrowser` slice: Add frame metadata | Eng #2 | 4h | Screenshots + URL display |
| P6.10 | Audit `agentWorkspace` slice: Aggregate state | Eng #2 | 6h | Workspace panels render |

**Days 53-56: Tier-2 Slices (Production)**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P6.11 | Migrate `billing` slice (replace `biz`) | Eng #1 | 6h | Credits display correctly |
| P6.12 | Migrate `devices` slice: Add approval flow | Eng #1 | 8h | Device commands require approval |
| P6.13 | Migrate `connectors` slice: Map Composio events | Eng #1 | 6h | Connector status accurate |
| P6.14 | Migrate `notifications` slice: Add action routing | Eng #2 | 6h | Toasts work |
| P6.15 | Migrate `ui` slice: Deterministic panel layout | Eng #2 | 4h | Layout stable |

**Days 57-59: Dead Slice Removal**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P6.16 | Identify dead slices via telemetry (14-day window) | Eng #1 | 4h | List of unused slices |
| P6.17 | Remove legacy `biz` slice (replaced by `billing`) | Eng #1 | 2h | Slice deleted |
| P6.18 | Remove placeholder slices (e.g., `meeting`) | Eng #1 | 2h | Slices deleted |
| P6.19 | Remove unused selectors and actions | Eng #2 | 6h | Code cleanup |

**Days 60-62: Testing + Bug Fixes**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P6.20 | Write unit tests for all slice reducers | Eng #1 | 12h | 80%+ coverage |
| P6.21 | Write integration tests for event → slice flow | Eng #2 | 12h | All events tested |
| P6.22 | Fix bugs found in testing | Both | 8h | All tests green |

#### Exit Criteria
- ✅ Tier-1 slices (10) aligned with canonical event protocol
- ✅ Tier-2 slices (5) migrated and tested
- ✅ Dead slices removed (legacy `biz`, placeholders)
- ✅ Store size reduced by >= 30%
- ✅ All event types have documented slice mappings
- ✅ Unit test coverage >= 80% for all slices

#### Testing Strategy

**Unit Tests:**
```typescript
// apps/app/lib/store/slices/__tests__/timeline.test.ts
import { timelineSlice } from '../timeline';

describe('Timeline Slice', () => {
  it('should append events in sequence order', () => {
    let state = timelineSlice.reducer(undefined, { type: '@@INIT' });

    state = timelineSlice.reducer(state, {
      type: 'timeline/addEvent',
      payload: { eventId: 'e1', sequence: 1, type: 'message.start', ... },
    });

    state = timelineSlice.reducer(state, {
      type: 'timeline/addEvent',
      payload: { eventId: 'e2', sequence: 2, type: 'message.delta', ... },
    });

    expect(state.events.map(e => e.sequence)).toEqual([1, 2]);
  });

  it('should handle out-of-order events', () => {
    let state = timelineSlice.reducer(undefined, { type: '@@INIT' });

    // Receive sequence 3 before sequence 2
    state = timelineSlice.reducer(state, {
      type: 'timeline/addEvent',
      payload: { sequence: 3, ... },
    });

    state = timelineSlice.reducer(state, {
      type: 'timeline/addEvent',
      payload: { sequence: 2, ... },
    });

    // Should re-sort
    expect(state.events.map(e => e.sequence)).toEqual([2, 3]);
  });
});
```

**Integration Tests:**
```typescript
// apps/app/lib/store/__tests__/websocket-integration.test.ts
describe('WebSocket → Redux Flow', () => {
  it('should update timeline on message.delta event', async () => {
    const store = createTestStore();
    const ws = mockWebSocket();

    ws.emit({
      eventId: 'e1',
      type: 'message.delta',
      payload: { delta: 'Hello' },
    });

    await waitFor(() => {
      const state = store.getState();
      expect(state.timeline.events).toHaveLength(1);
      expect(state.timeline.events[0].type).toBe('message.delta');
    });
  });
});
```

---

## Phase 7: File and Billing Correctness (1 Week)

### Days 63-67: April 16-22, 2026

#### Objectives
1. Fix file transfer contract mismatches
2. Enforce S3 metadata + checksum + provenance
3. Add per-step/per-tool usage metering

#### Tasks

**Days 63-64: File Service**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P7.1 | Add checksum validation to upload flow | Eng #1 | 4h | SHA-256 checked |
| P7.2 | Add provenance metadata (userId, sessionId, toolCallId) | Eng #1 | 4h | Metadata stored |
| P7.3 | Add CDN URL promotion for artifacts | Eng #1 | 4h | URLs stable |
| P7.4 | Test upload/download e2e | Eng #1 | 4h | Round-trip works |
| P7.4a | Document sandbox-internal upload utility boundary (`manus-upload-file` equivalent behavior is contract-driven, not binary-clone driven) | Eng #1 | 1h | Boundary note in runbook |

**Days 65-66: Billing Service**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P7.5 | Implement usage ledger (immutable entries) | Eng #2 | 8h | Ledger table created |
| P7.6 | Implement per-step metering (onStepFinish) | Eng #2 | 6h | Costs tracked |
| P7.7 | Implement per-tool metering | Eng #2 | 4h | Tool costs tracked |
| P7.8 | Implement credits.update event emission | Eng #2 | 2h | Frontend shows balance |

**Day 67: Testing**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P7.9 | Test file provenance roundtrip | Eng #1 | 2h | Metadata correct |
| P7.10 | Test billing ledger accuracy | Eng #2 | 4h | Costs match actual usage |
| P7.11 | Test credits exhaustion flow | Both | 2h | Hard block prevents execution |

#### Exit Criteria
- ✅ File uploads include checksum + provenance
- ✅ CDN URLs stable and documented
- ✅ Usage ledger has immutable entries
- ✅ Per-step and per-tool costs tracked
- ✅ Credits balance updates in real-time
- ✅ Hard/soft limits enforced

#### Testing Strategy

**Integration Tests:**
```typescript
// services/orchestrator/src/__tests__/billing-integration.test.ts
describe('Billing Integration', () => {
  it('should track credits per tool call', async () => {
    const session = await createTestSession({ credits: 1000 });

    await session.executeTool('shell', { command: 'ls' });

    const ledger = await getLedgerEntries(session.userId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].toolName).toBe('shell');
    expect(ledger[0].cost).toBeGreaterThan(0);
  });

  it('should block execution when credits exhausted', async () => {
    const session = await createTestSession({ credits: 0 });

    await expect(
      session.executeTool('shell', { command: 'ls' })
    ).rejects.toThrow('Insufficient credits');
  });
});
```

---

## Phase 8: Cutover and Retirement (1 Week)

### Days 68-86: April 23 - May 13, 2026

#### Objectives
1. Progressive rollout: 5% → 25% → 50% → 100%
2. Monitor SLO parity for 14-day rollback hold
3. Retire Python agent and duplicated paths after rollback window

#### Tasks

**Day 68: 5% Rollout**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P8.1 | Enable feature flag: 5% traffic to Node orchestrator | Tech Lead | 1h | Traffic shifted |
| P8.2 | Monitor metrics: latency, errors, event gaps | Both | 4h | Dashboard green |
| P8.3 | Triage any incidents | Both | 3h | Issues resolved |

**Day 69: 25% Rollout**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P8.4 | Increase to 25% traffic | Tech Lead | 1h | Traffic shifted |
| P8.5 | Monitor metrics for 4 hours | Both | 4h | Metrics stable |

**Day 70: 50% Rollout**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P8.6 | Increase to 50% traffic | Tech Lead | 1h | Traffic shifted |
| P8.7 | Monitor metrics for 4 hours | Both | 4h | Metrics stable |

**Day 71: 100% Rollout**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P8.8 | Increase to 100% traffic | Tech Lead | 1h | Traffic shifted |
| P8.9 | Monitor metrics for 8 hours | Both | 8h | Metrics stable |

**Days 72-85: Rollback Hold Window**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P8.10 | Hold at 100% Node traffic, monitor rollback gates for 14 days | Both | 20h | Stable hold window |
| P8.11 | Validate no rollback triggers for full hold window | Tech Lead | 2h | Retirement approval |
| P8.12 | Keep Python agent hot-standby during hold window | Eng #1 | 2h | Fast rollback preserved |
| P8.13 | Update runbooks and release notes before retirement | Both | 2h | Docs updated |

**Day 86: Retirement**

| Task ID | Description | Owner | Hours | Deliverable |
|---------|-------------|-------|-------|-------------|
| P8.14 | Delete Python agent code (`services/agent`) | Eng #1 | 2h | Service deleted |
| P8.15 | Delete sandbox service (if not kept as adapter) | Eng #1 | 2h | Service deleted |
| P8.16 | Finalize deployment scripts | Both | 2h | Deployments updated |

#### Exit Criteria
- ✅ 100% traffic on Node orchestrator
- ✅ SLO parity maintained for 7 consecutive days
- ✅ Python agent retired only after 14-day rollback hold
- ✅ Documentation updated
- ✅ Rollback plan documented (but not executed)

#### Success Metrics

| Metric | Baseline | Target | Actual |
|--------|----------|--------|--------|
| First token p95 | 3.1s | < 2.5s | [TBD] |
| Tool success rate | 96.2% | >= 98.5% | [TBD] |
| WS uptime | 99.7% | >= 99.9% | [TBD] |
| Timeline replay correctness | N/A | 100% | [TBD] |

---

## Rollback Procedures

### Automatic Rollback Gates

```typescript
// services/orchestrator/src/health/rollback-detector.ts
export class RollbackDetector {
  async checkMetrics(): Promise<{ shouldRollback: boolean; reason: string }> {
    const metrics = await getMetrics({ window: '5m' });

    // Gate 1: Tool error rate
    if (metrics.toolErrorRate > BASELINE_TOOL_ERROR_RATE * 2) {
      return { shouldRollback: true, reason: 'Tool error rate > 2x baseline' };
    }

    // Gate 2: WS reconnect failures
    if (metrics.wsReconnectFailureRate > 0.05) {
      return { shouldRollback: true, reason: 'WS reconnect failures > 5%' };
    }

    // Gate 3: Timeline gaps
    if (metrics.timelineGapRate > 0.002) {
      return { shouldRollback: true, reason: 'Timeline event gap rate > 0.2%' };
    }

    // Gate 4: Credits miscalculation
    if (metrics.creditsMiscalculations > 0) {
      return { shouldRollback: true, reason: 'Credits miscalculation detected' };
    }

    return { shouldRollback: false, reason: '' };
  }
}
```

### Manual Rollback Steps

1. **Set feature flag:** `ORCHESTRATOR_VERSION=python`
2. **Wait 60 seconds** for in-flight requests to complete
3. **Verify Python agent** receiving traffic
4. **Investigate root cause** before attempting re-rollout

---

## Risk Mitigation

### High-Risk Areas

1. **Event protocol breaking changes**
   - Mitigation: Backward compatibility adapters (Phase 1)
   - Validation: Contract tests in CI

2. **Tool behavior regression**
   - Mitigation: Golden task suite (Phase 0)
   - Validation: 95%+ parity before cutover

3. **Billing accuracy**
   - Mitigation: Immutable ledger + reconciliation jobs
   - Validation: Daily ledger audit vs actual usage

4. **Timeline replay**
   - Mitigation: Event sequence numbering + gap detection
   - Validation: 100% replay correctness

### Contingency Plans

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Python → Node regression | Medium | High | Golden suite + progressive rollout |
| E2B lifecycle race condition | Low | High | Single control plane + integration tests |
| WebSocket stability issues | Medium | Medium | Reconnect policy + circuit breaker |
| Cost explosion (map tool) | Low | High | Hard limits + quota monitoring |

---

## Daily Standup Template

```markdown
## Date: YYYY-MM-DD
## Phase: N
## Day: X of Y

### Completed Yesterday
- [Task ID] Task description (Eng #N)

### Planned Today
- [Task ID] Task description (Eng #N)

### Blockers
- None / [Blocker description]

### Metrics
- Shadow traffic errors: N
- Test coverage: N%
- Golden suite pass rate: N%

### Next Milestone
- [Exit criteria for current phase]
```

---

## Definition of Done (Per Phase)

### Code Quality
- [ ] Unit test coverage >= 80%
- [ ] Integration tests pass
- [ ] E2E tests pass (if applicable)
- [ ] Code reviewed and approved
- [ ] No lint errors or warnings

### Documentation
- [ ] API contracts documented
- [ ] Event protocol documented
- [ ] Runbook updated (if applicable)
- [ ] Architecture diagrams updated

### Operations
- [ ] Deployed to staging
- [ ] Smoke tests pass in staging
- [ ] Metrics dashboard updated
- [ ] Rollback procedure tested

### Product
- [ ] Exit criteria met
- [ ] Product owner approval
- [ ] User-facing changes communicated

---

## Appendices

### Appendix A: Tool Inventory (Canonical Model)

| Category | Canonical Tool Model | Count |
|----------|----------------------|-------|
| File + Match | `file` (`read/write/edit`) + `match` (`grep/glob`) | 2 tools, 5 actions |
| Shell | `shell` (`exec/view/wait/send/kill`) | 1 tool, 5 actions |
| Browser | `browser` entrance + `browser_*` subtools after mode entry | 1 + 12 |
| Search | `search` | 1 |
| Message | `message` (`info/ask/result`) | 1 tool, 3 types |
| Planning | `plan`, `schedule` | 2 |
| Parallel | `map` | 1 |
| Deploy | `expose` | 1 |
| Generate/Slides | `generate`, `slides` (nested sub-calls) | 2 |

**Total:** 12 entrance-level tools with mode/action expansion

Additional mode-specific tools:
- Generate mode: nested sub-call toolset (image/asset generation)
- Slides mode: nested sub-call toolset (presentation building)
- Webdev mode: `webdev_init_project`, `webdev_add_feature`, `webdev_save_checkpoint`, `webdev_check_status`, `webdev_restart_server`, `webdev_rollback_checkpoint`, `webdev_execute_sql`
- Map mode: `map` coordinator with isolated temporary sandboxes

### Appendix B: Event Taxonomy (21 Types)

From `10-WEBSOCKET-EVENT-PROTOCOL.md`:

1. message.start
2. message.delta
3. message.final
4. message.info
5. message.ask
6. plan.update
7. plan.advance
8. tool_call.start
9. tool_call.progress
10. tool_call.result
11. tool_call.error
12. sandbox.status
13. sandbox.browser.frame
14. sandbox.terminal.chunk
15. file.uploaded
16. file.ready
17. credits.update
18. connector.status
19. orchestrator.error
20. task.finished
21. pong

### Appendix C: Service Port Assignments

| Service | Port | Protocol |
|---------|------|----------|
| orchestrator | 4015 | HTTP/WS |
| webrtc-media | 4016 | gRPC |
| connector | 4009 | HTTP |
| file | 4005 | HTTP |
| gateway (deprecated) | 4001 | HTTP/WS |

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-10
**Next Review:** After Phase 0 completion
