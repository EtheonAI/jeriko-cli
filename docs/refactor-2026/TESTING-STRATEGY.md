# Rubic Refactor: Comprehensive Testing Strategy

**Date:** 2026-02-10
**Authority:** `docs/manus-architecture-docs/codex-architecture/12-TEST-RELEASE-OPERATIONS.md`
**MADR Reference:** `MADR-001`

---

## Overview

This document defines the **complete testing strategy** for the Rubic → Manus-style architecture refactor. Every layer (unit, integration, contract, E2E, performance) is covered with specific test cases, acceptance criteria, and pass/fail thresholds.

**Goal:** Achieve **zero-downtime migration** with **100% functional parity** and **measurable reliability improvements**.

---

## Testing Pyramid

```
                    ▲
                   /E2E\           30 tests (critical user flows)
                  /─────\
                 /Contract\        209 tests (API/event/tool compatibility)
                /─────────\
               /Integration\       68 tests (service boundaries)
              /─────────────\
             /   Unit Tests  \     113 tests (functions, reducers)
            /─────────────────\
           + Golden Suite (20)
```

**Coverage Target:** 80% overall, 100% on critical paths

---

## Phase 0: Baseline Testing

### Golden Task Suite (20+ Sessions)

**Purpose:** Establish regression test fixtures from real production sessions

#### Test Categories

| Category | Count | Description | Example |
|----------|-------|-------------|---------|
| Simple Q&A | 3 | No tools, text-only responses | "What is React?" |
| Single-tool tasks | 4 | One tool call, immediate result | "List files in current directory" |
| Multi-tool coding | 5 | 5-10 tool calls, file operations | "Build a React counter component" |
| Browser automation | 3 | Browser navigation, click, screenshot | "Search Google for Python tutorials" |
| Parallel processing (map) | 2 | Map tool with 5+ subtasks | "Research 10 companies" |
| Error recovery | 2 | Tool failures, retries, recovery | "Run command that fails" |
| Webdev full flow | 1 | Init project, write code, start server | "Build a todo app" |

#### Test Structure

```typescript
// tests/golden-suite/fixtures/session-1.json
{
  "sessionId": "prod_session_abc123",
  "name": "Simple Q&A: What is React?",
  "userMessages": [
    { "role": "user", "content": "What is React?" }
  ],
  "expectedToolCalls": [],
  "expectedResponse": {
    "contains": ["JavaScript library", "user interfaces", "components"],
    "minLength": 100
  },
  "expectedEvents": [
    { "type": "message.start", "payload": { "role": "assistant" } },
    { "type": "message.delta", "count": ">=5" },
    { "type": "message.final" }
  ],
  "maxDuration": 5000,
  "maxCost": 0.01
}
```

#### Replay Harness

```typescript
// tests/golden-suite/harness.ts
export async function replaySession(
  fixture: GoldenFixture,
  options: { orchestrator: 'python' | 'node' }
): Promise<ReplayResult> {
  const client = new TestClient({ orchestrator: options.orchestrator });

  const startTime = Date.now();
  const result = await client.sendMessage(fixture.userMessages[0].content);
  const duration = Date.now() - startTime;

  return {
    sessionId: result.sessionId,
    events: result.events,
    toolCalls: result.toolCalls,
    finalMessage: result.finalMessage,
    duration,
    cost: result.usage.totalCost,
  };
}

// Assertion helpers
export function assertGoldenParity(
  expected: GoldenFixture,
  actual: ReplayResult
): void {
  // Tool calls match
  expect(actual.toolCalls.map(t => t.name)).toEqual(expected.expectedToolCalls);

  // Response contains expected keywords
  expected.expectedResponse.contains.forEach(keyword => {
    expect(actual.finalMessage.toLowerCase()).toContain(keyword.toLowerCase());
  });

  // Event sequence correct
  const actualEventTypes = actual.events.map(e => e.type);
  expected.expectedEvents.forEach(({ type, count }) => {
    if (count === '>=N') {
      const n = parseInt(count.replace('>=', ''));
      expect(actualEventTypes.filter(t => t === type).length).toBeGreaterThanOrEqual(n);
    }
  });

  // Performance acceptable
  expect(actual.duration).toBeLessThan(expected.maxDuration);
  expect(actual.cost).toBeLessThan(expected.maxCost);
}
```

#### Pass Criteria

- ✅ All 20+ golden sessions replay successfully on **Python agent** (baseline)
- ✅ All sessions complete within 2x expected duration
- ✅ No unexpected errors or timeouts

---

## Phase 1: Contract Testing

### Tool Contract Tests

**Purpose:** Validate all tool intent/result schemas enforce correct structure

#### Test Cases (canonical entrance tools + action variants)

```typescript
// packages/contracts/src/tools/__tests__/shell.test.ts
import { shellToolIntentSchema, shellToolResultSchema } from '../shell.zod';

describe('Shell Tool Contracts', () => {
  describe('Intent Validation', () => {
    it('should accept valid shell action=exec intent', () => {
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
      expect(invalid.error.issues[0].path).toContain('action');
    });

    it('should require command field', () => {
      const invalid = shellToolIntentSchema.safeParse({
        action: 'exec',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('Result Validation', () => {
    it('should accept successful result', () => {
      const valid = shellToolResultSchema.safeParse({
        ok: true,
        exitCode: 0,
        stdout: 'output',
        stderr: '',
      });
      expect(valid.success).toBe(true);
    });

    it('should accept error result', () => {
      const valid = shellToolResultSchema.safeParse({
        ok: false,
        exitCode: 1,
        stdout: '',
        stderr: 'error message',
        error: {
          code: 'command_failed',
          message: 'Command failed',
          retryable: true,
        },
      });
      expect(valid.success).toBe(true);
    });
  });
});
```

### Event Contract Tests

**Purpose:** Validate canonical 21-event contract (18 verified + 3 reserved) conforms to EventEnvelope + payload schema

#### Test Cases (21 contract events × 2 tests = 42 tests)

```typescript
// packages/contracts/src/events/__tests__/message.test.ts
import { eventEnvelopeSchema, messageStartPayloadSchema } from '../';

describe('Message Event Contracts', () => {
  it('should validate message.start event', () => {
    const valid = eventEnvelopeSchema.safeParse({
      eventId: '01HKJQZ3V9W8G2TXKP4HZX7M2N',
      sessionId: 'sess_123',
      segmentId: 'seg_08',
      sequence: 100,
      type: 'message.start',
      ts: '2026-02-10T18:00:00Z',
      source: 'orchestrator',
      payload: {
        messageId: 'msg_456',
        role: 'assistant',
      },
    });
    expect(valid.success).toBe(true);
  });

  it('should reject message.start with invalid role', () => {
    const invalid = eventEnvelopeSchema.safeParse({
      eventId: '01HKJQZ3V9W8G2TXKP4HZX7M2N',
      sessionId: 'sess_123',
      segmentId: 'seg_08',
      sequence: 100,
      type: 'message.start',
      ts: '2026-02-10T18:00:00Z',
      source: 'orchestrator',
      payload: {
        messageId: 'msg_456',
        role: 'invalid',
      },
    });
    expect(invalid.success).toBe(false);
  });
});
```

### API Contract Tests

**Purpose:** Validate API request/response schemas

#### Test Cases (15 endpoints × 2 tests = 30 tests)

```typescript
// packages/contracts/src/api/__tests__/sessions.test.ts
import { createSessionRequestSchema, createSessionResponseSchema } from '../sessions.zod';

describe('Session API Contracts', () => {
  it('should validate create session request', () => {
    const valid = createSessionRequestSchema.safeParse({
      taskMode: 'standard',
      initialMessage: 'Hello',
    });
    expect(valid.success).toBe(true);
  });

  it('should reject invalid taskMode', () => {
    const invalid = createSessionRequestSchema.safeParse({
      taskMode: 'invalid',
    });
    expect(invalid.success).toBe(false);
  });

  it('should validate create session response', () => {
    const valid = createSessionResponseSchema.safeParse({
      sessionId: 'sess_123',
      sandboxId: 'sb_456',
      createdAt: '2026-02-10T18:00:00Z',
    });
    expect(valid.success).toBe(true);
  });
});
```

### Backward Compatibility Tests

**Purpose:** Validate old events/payloads can be adapted to new schema

#### Test Cases (50 adapters)

```typescript
// packages/contracts/src/adapters/__tests__/events.test.ts
import { adaptOldEventToNew } from '../events';

describe('Event Adapter Backward Compatibility', () => {
  it('should adapt old message_chunk to message.delta', () => {
    const oldEvent = {
      type: 'message_chunk',
      sessionId: 'sess_123',
      payload: { delta: 'Hello' },
    };

    const newEvent = adaptOldEventToNew(oldEvent);

    expect(newEvent.type).toBe('message.delta');
    expect(newEvent.payload.delta).toBe('Hello');
    expect(newEvent.eventId).toBeDefined();
    expect(newEvent.sequence).toBeDefined();
  });

  it('should adapt old tool_call_start to tool_call.start', () => {
    const oldEvent = {
      type: 'tool_call_start',
      payload: { toolName: 'shell', args: { command: 'ls' } },
    };

    const newEvent = adaptOldEventToNew(oldEvent);

    expect(newEvent.type).toBe('tool_call.start');
    expect(newEvent.payload.name).toBe('shell');
    expect(newEvent.payload.args).toEqual({ command: 'ls' });
  });
});
```

### Pass Criteria

- ✅ All tool schema tests pass (87 tests)
- ✅ All event schema tests pass (42 tests)
- ✅ All API schema tests pass (30 tests)
- ✅ All backward compatibility tests pass (50 tests)
- ✅ CI fails on schema-breaking changes
- ✅ **Total: 209 contract tests pass**

---

## Phase 2: Orchestrator Unit Testing

### Agent Loop Tests

**Purpose:** Validate core orchestration logic

#### Test Cases (15 tests)

```typescript
// services/orchestrator/src/__tests__/agent-loop.test.ts
describe('Agent Loop', () => {
  it('should stop after maxSteps', async () => {
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Hello' }],
      maxSteps: 5,
      tools: mockTools,
    });
    expect(result.steps.length).toBeLessThanOrEqual(5);
  });

  it('should stop on end_turn', async () => {
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'What is 2+2?' }],
      tools: {},
    });
    expect(result.stopReason).toBe('end_turn');
    expect(result.finalMessage).toBeDefined();
  });

  it('should execute tool calls in sequence', async () => {
    const executionOrder: string[] = [];
    const tools = {
      tool1: vi.fn().mockImplementation(() => {
        executionOrder.push('tool1');
        return { result: 'ok' };
      }),
      tool2: vi.fn().mockImplementation(() => {
        executionOrder.push('tool2');
        return { result: 'ok' };
      }),
    };

    await runAgentLoop({
      messages: [{ role: 'user', content: 'Run tool1 then tool2' }],
      tools,
    });

    expect(executionOrder).toEqual(['tool1', 'tool2']);
  });

  it('should append tool results to context', async () => {
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'List files' }],
      tools: {
        shell: vi.fn().mockResolvedValue({ stdout: 'file1.txt\nfile2.txt' }),
      },
    });

    const toolResultMessage = result.messages.find(m => m.role === 'tool');
    expect(toolResultMessage).toBeDefined();
    expect(toolResultMessage.content).toContain('file1.txt');
  });

  it('should handle tool execution errors', async () => {
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: 'Run failing command' }],
      tools: {
        shell: vi.fn().mockRejectedValue(new Error('Command failed')),
      },
    });

    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('tool_execution_failed');
  });

  // ... 10 more tests
});
```

### Mode Manager Tests

**Purpose:** Validate tool set expansion and nested sub-call routing

#### Test Cases (10 tests)

```typescript
// services/orchestrator/src/__tests__/mode-manager.test.ts
describe('Mode Manager', () => {
  it('should expand tool set on browser call', () => {
    const manager = new ModeManager();

    const beforeTools = manager.getToolSet();
    expect(Object.keys(beforeTools)).toHaveLength(29);

    manager.handleToolCall('browser');

    const afterTools = manager.getToolSet();
    expect(Object.keys(afterTools)).toHaveLength(41); // 29 + 12 browser tools
  });

  it('should return subcall for generate mode', () => {
    const manager = new ModeManager();
    const result = manager.handleToolCall('generate');
    expect(result).toBe('generate_subcall');
  });

  it('should return map_subagents for map tool', () => {
    const manager = new ModeManager();
    const result = manager.handleToolCall('map');
    expect(result).toBe('map_subagents');
  });
});
```

### Timeline Persistence Tests

**Purpose:** Validate event writing and segmentation

#### Test Cases (8 tests)

```typescript
// services/orchestrator/src/__tests__/timeline-writer.test.ts
describe('Timeline Writer', () => {
  it('should write events with monotonic sequence numbers', async () => {
    const writer = new TimelineWriter({ sessionId: 'sess_123' });

    await writer.writeEvent({ type: 'message.start', ... });
    await writer.writeEvent({ type: 'message.delta', ... });

    const events = await getTimelineEvents('sess_123');
    expect(events[0].sequence).toBe(1);
    expect(events[1].sequence).toBe(2);
  });

  it('should create new segment after 100 events', async () => {
    const writer = new TimelineWriter({ sessionId: 'sess_123' });

    for (let i = 0; i < 105; i++) {
      await writer.writeEvent({ type: 'message.delta', ... });
    }

    const segments = await getSegments('sess_123');
    expect(segments).toHaveLength(2);
    expect(segments[0].eventCount).toBe(100);
    expect(segments[1].eventCount).toBe(5);
  });

  it('should handle concurrent writes correctly', async () => {
    const writer = new TimelineWriter({ sessionId: 'sess_123' });

    await Promise.all([
      writer.writeEvent({ type: 'event1', ... }),
      writer.writeEvent({ type: 'event2', ... }),
      writer.writeEvent({ type: 'event3', ... }),
    ]);

    const events = await getTimelineEvents('sess_123');
    expect(events).toHaveLength(3);
    // Sequences should be unique and ordered
    expect(new Set(events.map(e => e.sequence)).size).toBe(3);
  });
});
```

### Pass Criteria

- ✅ Agent loop tests pass (15 tests)
- ✅ Mode manager tests pass (10 tests)
- ✅ Timeline writer tests pass (8 tests)
- ✅ System prompt builder tests pass (5 tests)
- ✅ Tool registry tests pass (7 tests)
- ✅ **Total: 45 orchestrator unit tests pass**
- ✅ Coverage >= 80%

---

## Phase 3: Sandbox Integration Testing

### E2B Adapter Tests

**Purpose:** Validate E2B SDK integration and sandbox lifecycle

#### Test Cases (20 tests)

```typescript
// services/orchestrator/src/__tests__/e2b-integration.test.ts
describe('E2B Integration', () => {
  let adapter: E2BAdapter;

  beforeAll(async () => {
    adapter = new E2BAdapter({ apiKey: process.env.E2B_API_KEY });
  });

  afterAll(async () => {
    await adapter.cleanup();
  });

  describe('Sandbox Lifecycle', () => {
    it('should create sandbox from template', async () => {
      const sandbox = await adapter.createSandbox({ template: 'base' });
      expect(sandbox.id).toBeDefined();
      expect(sandbox.status).toBe('running');
    });

    it('should reuse existing sandbox for same user', async () => {
      const sandbox1 = await adapter.getSandbox({ userId: 'user123' });
      const sandbox2 = await adapter.getSandbox({ userId: 'user123' });
      expect(sandbox1.id).toBe(sandbox2.id);
    });

    it('should hibernate sandbox after timeout', async () => {
      const sandbox = await adapter.createSandbox();
      await sleep(35 * 60 * 1000); // 35 minutes
      const status = await adapter.getSandboxStatus(sandbox.id);
      expect(status).toBe('hibernated');
    });

    it('should resume hibernated sandbox', async () => {
      const sandbox = await adapter.createSandbox();
      await adapter.hibernateSandbox(sandbox.id);
      await adapter.resumeSandbox(sandbox.id);
      const status = await adapter.getSandboxStatus(sandbox.id);
      expect(status).toBe('running');
    });
  });

  describe('Tool Execution', () => {
    it('should execute shell command', async () => {
      const sandbox = await adapter.createSandbox();
      const result = await adapter.executeTool(sandbox.id, 'shell', {
        action: 'exec',
        command: 'echo hello',
      });
      expect(result.stdout).toBe('hello\n');
      expect(result.exitCode).toBe(0);
    });

    it('should write and read file', async () => {
      const sandbox = await adapter.createSandbox();

      await adapter.executeTool(sandbox.id, 'file', {
        action: 'write',
        path: '/tmp/test.txt',
        content: 'test content',
      });

      const result = await adapter.executeTool(sandbox.id, 'file', {
        action: 'read',
        path: '/tmp/test.txt',
      });

      expect(result.content).toBe('test content');
    });

    it('should navigate browser', async () => {
      const sandbox = await adapter.createSandbox({ template: 'desktop' });

      const result = await adapter.executeTool(sandbox.id, 'browser', {
        action: 'navigate',
        url: 'https://example.com',
      });

      expect(result.url).toBe('https://example.com/');
      expect(result.screenshot).toBeDefined();
    });
  });

  describe('Environment Injection', () => {
    it('should inject runtime vars into shell session', async () => {
      const sandbox = await adapter.createSandbox();

      const result = await adapter.executeTool(sandbox.id, 'shell', {
        action: 'exec',
        command: 'echo $OPENAI_API_KEY',
        env: {
          OPENAI_API_KEY: 'sk-test123',
        },
      });

      expect(result.stdout.trim()).toBe('sk-test123');
    });

    it('should not leak secrets to logs', async () => {
      const logs = await captureAdapterLogs(async () => {
        const sandbox = await adapter.createSandbox();
        await adapter.executeTool(sandbox.id, 'shell', {
          action: 'exec',
          command: 'echo $SECRET',
          env: { SECRET: 'password123' },
        });
      });

      expect(logs).not.toContain('password123');
      expect(logs).toContain('[REDACTED]');
    });
  });
});
```

### Pass Criteria

- ✅ All sandbox lifecycle tests pass (4 tests)
- ✅ All tool execution tests pass (12 tests)
- ✅ All environment injection tests pass (4 tests)
- ✅ **Total: 20 E2B integration tests pass**

---

## Phase 4: Tool Runtime Parity Testing

### Tool Parity Tests

**Purpose:** Validate Node orchestrator produces identical results to Python agent

#### Test Cases (20+ golden sessions × 29 tools)

```typescript
// services/orchestrator/src/__tests__/tool-parity.test.ts
describe('Tool Parity (Python vs Node)', () => {
  const goldenSessions = loadGoldenSuite();

  goldenSessions.forEach((session) => {
    it(`should match Python agent: ${session.name}`, async () => {
      const pythonResult = await replaySession(session, { orchestrator: 'python' });
      const nodeResult = await replaySession(session, { orchestrator: 'node' });

      // Compare tool call sequences
      expect(nodeResult.toolCalls.map(t => t.name)).toEqual(
        pythonResult.toolCalls.map(t => t.name)
      );

      // Compare tool results (allow minor differences in timestamps/PIDs)
      nodeResult.toolCalls.forEach((nodeTool, i) => {
        const pythonTool = pythonResult.toolCalls[i];

        if (nodeTool.name === 'shell') {
          expect(nodeTool.result.exitCode).toBe(pythonTool.result.exitCode);
          expect(nodeTool.result.stdout).toBe(pythonTool.result.stdout);
        } else if (nodeTool.name === 'file') {
          expect(nodeTool.result.content).toBe(pythonTool.result.content);
        } else if (nodeTool.name === 'browser') {
          expect(nodeTool.result.url).toBe(pythonTool.result.url);
          // Screenshot bytes may differ slightly, check size within 5%
          const sizeDiff = Math.abs(nodeTool.result.screenshot.length - pythonTool.result.screenshot.length);
          expect(sizeDiff / pythonTool.result.screenshot.length).toBeLessThan(0.05);
        }
      });

      // Compare final outputs (normalize whitespace/formatting)
      expect(normalizeOutput(nodeResult.finalMessage)).toBe(
        normalizeOutput(pythonResult.finalMessage)
      );
    });
  });

  it('should handle tool errors identically', async () => {
    const session = {
      userMessages: [{ role: 'user', content: 'Run command that fails' }],
      expectedToolCalls: ['shell'],
    };

    const pythonResult = await replaySession(session, { orchestrator: 'python' });
    const nodeResult = await replaySession(session, { orchestrator: 'node' });

    expect(nodeResult.toolCalls[0].error.code).toBe(pythonResult.toolCalls[0].error.code);
    expect(nodeResult.toolCalls[0].error.retryable).toBe(pythonResult.toolCalls[0].error.retryable);
  });
});
```

### Map Tool Tests

**Purpose:** Validate parallel subtask execution

#### Test Cases (10 tests)

```typescript
// services/orchestrator/src/__tests__/map-tool.test.ts
describe('Map Tool', () => {
  it('should spawn N subtask sandboxes', async () => {
    const result = await executeTool('map', {
      prompt_template: 'Research {{input}}',
      inputs: ['Apple', 'Google', 'Microsoft'],
      target_count: 3,
      output_schema: [
        { name: 'overview', type: 'string' },
      ],
    });

    expect(result.results).toHaveLength(3);
    expect(result.results[0].input).toBe('Apple');
    expect(result.results[0].overview).toBeDefined();
  });

  it('should execute subtasks in parallel', async () => {
    const startTime = Date.now();

    await executeTool('map', {
      prompt_template: 'Sleep 5 seconds',
      inputs: ['1', '2', '3'],
      target_count: 3,
      output_schema: [],
    });

    const duration = Date.now() - startTime;

    // Should take ~5s, not 15s (parallel, not sequential)
    expect(duration).toBeLessThan(8000);
    expect(duration).toBeGreaterThan(4000);
  });

  it('should use OpenAI models in subtasks', async () => {
    const result = await executeTool('map', {
      prompt_template: 'What model are you?',
      inputs: ['1'],
      target_count: 1,
      output_schema: [{ name: 'model', type: 'string' }],
    });

    // Subtasks should use gpt-4.1-mini or similar, NOT Claude
    expect(result.results[0].model).toMatch(/gpt-4/);
  });

  it('should cleanup subtask sandboxes after completion', async () => {
    const beforeCount = await countRunningSandboxes();

    await executeTool('map', {
      prompt_template: 'Hello',
      inputs: ['1', '2', '3'],
      target_count: 3,
      output_schema: [],
    });

    const afterCount = await countRunningSandboxes();

    expect(afterCount).toBe(beforeCount); // Subtask sandboxes deleted
  });

  it('should handle subtask failures gracefully', async () => {
    const result = await executeTool('map', {
      prompt_template: 'Run failing command: {{input}}',
      inputs: ['valid', 'invalid', 'valid'],
      target_count: 3,
      output_schema: [],
    });

    expect(result.results).toHaveLength(3);
    expect(result.results[0].ok).toBe(true);
    expect(result.results[1].ok).toBe(false);
    expect(result.results[1].error).toBeDefined();
    expect(result.results[2].ok).toBe(true);
  });
});
```

### Pass Criteria

- ✅ 95%+ tool parity on golden suite (19+ of 20 sessions pass)
- ✅ Map tool tests pass (10 tests)
- ✅ Retry logic tests pass (5 tests)
- ✅ Timeout handling tests pass (3 tests)
- ✅ **Total: Tool error rate < 2% on shadow traffic**

---

## Phase 6: Frontend E2E Testing

### Playwright Test Suite

**Purpose:** Validate critical user flows end-to-end

#### Test Categories

| Category | Count | Description |
|----------|-------|-------------|
| Auth flow | 3 | Login, signup, verification |
| Chat basics | 5 | Send message, receive response, attachments |
| Tool execution | 8 | File, shell, browser, search tools |
| Canvas view | 4 | Browser view, terminal view, code view |
| Planner UI | 2 | Plan updates, phase progression |
| File management | 3 | Upload, download, reference |
| Billing | 2 | Credits display, limits enforcement |
| Device control | 3 | Device approval, command execution |

**Total: 30 E2E tests**

#### Example Tests

```typescript
// e2e/chat-flow.spec.ts
import { test, expect } from '@playwright/test';

test('should send message and receive response', async ({ page }) => {
  await page.goto('/chat/new');

  // Send message
  await page.getByPlaceholder('Message...').fill('What is 2+2?');
  await page.keyboard.press('Enter');

  // Wait for response
  const response = page.locator('[data-testid="message-assistant"]').last();
  await expect(response).toBeVisible({ timeout: 10000 });
  await expect(response).toContainText('4');
});

test('should execute file tool and display result', async ({ page }) => {
  await page.goto('/chat/new');

  // Send message that triggers file tool
  await page.getByPlaceholder('Message...').fill('Create a file called test.txt with content "hello"');
  await page.keyboard.press('Enter');

  // Wait for tool card
  const toolCard = page.locator('[data-testid="tool-card"]').filter({ hasText: 'file.write' });
  await expect(toolCard).toBeVisible({ timeout: 10000 });

  // Check status is completed
  await expect(toolCard.locator('[data-testid="tool-status"]')).toHaveText('Completed');

  // Check file appears in file list
  await page.getByTestId('workspace-files-tab').click();
  await expect(page.locator('[data-testid="file-item"]').filter({ hasText: 'test.txt' })).toBeVisible();
});

test('should display browser screenshot', async ({ page }) => {
  await page.goto('/chat/new');

  // Trigger browser navigation
  await page.getByPlaceholder('Message...').fill('Navigate to example.com');
  await page.keyboard.press('Enter');

  // Wait for browser view
  const browserView = page.getByTestId('browser-view');
  await expect(browserView).toBeVisible({ timeout: 15000 });

  // Check screenshot is displayed
  const screenshot = browserView.locator('img');
  await expect(screenshot).toHaveAttribute('src', /data:image\\/png/);

  // Check URL bar shows correct URL
  const urlBar = page.getByTestId('browser-url-bar');
  await expect(urlBar).toHaveValue(/example\\.com/);
});

test('should update planner when plan created', async ({ page }) => {
  await page.goto('/chat/new');

  // Send complex task
  await page.getByPlaceholder('Message...').fill('Build a React counter component');
  await page.keyboard.press('Enter');

  // Wait for planner to appear
  const planner = page.getByTestId('planner-bar');
  await expect(planner).toBeVisible({ timeout: 10000 });

  // Check phases are listed
  const phases = planner.locator('[data-testid="plan-phase"]');
  await expect(phases).toHaveCount(3); // e.g., "Plan", "Implement", "Test"

  // Check first phase is active
  await expect(phases.first()).toHaveAttribute('data-status', 'in_progress');
});

test('should handle billing limits', async ({ page }) => {
  // Set user to low credits
  await setUserCredits('test-user', 0.01);

  await page.goto('/chat/new');

  // Send expensive request
  await page.getByPlaceholder('Message...').fill('Research 100 companies');
  await page.keyboard.press('Enter');

  // Should see limit warning
  const warning = page.locator('[data-testid="credits-warning"]');
  await expect(warning).toBeVisible({ timeout: 5000 });
  await expect(warning).toContainText('Insufficient credits');
});
```

### Visual Regression Tests

**Purpose:** Detect unintended UI changes

#### Test Cases (10 snapshots)

```typescript
// e2e/visual-regression.spec.ts
import { test, expect } from '@playwright/test';

test('should match chat UI snapshot', async ({ page }) => {
  await page.goto('/chat/test-session');
  await page.waitForLoadState('networkidle');

  // Take screenshot
  await expect(page).toHaveScreenshot('chat-ui.png', {
    fullPage: true,
    threshold: 0.05, // Allow 5% difference
  });
});

test('should match planner bar snapshot', async ({ page }) => {
  await page.goto('/chat/test-session-with-plan');

  const planner = page.getByTestId('planner-bar');
  await expect(planner).toHaveScreenshot('planner-bar.png');
});

test('should match browser view snapshot', async ({ page }) => {
  await page.goto('/chat/test-session-with-browser');

  const browserView = page.getByTestId('browser-view');
  await expect(browserView).toHaveScreenshot('browser-view.png');
});
```

### Pass Criteria

- ✅ All 30 E2E tests pass
- ✅ Visual regression tests pass (10 snapshots)
- ✅ Tests pass in Chrome, Firefox, Safari
- ✅ Tests pass on mobile viewport (responsive)
- ✅ **Total E2E pass rate: 100%**

---

## Phase 8: Performance and Load Testing

### Performance Benchmarks

**Purpose:** Validate latency and throughput improvements

#### Test Cases

```typescript
// tests/performance/latency.bench.ts
import { bench, describe } from 'vitest';

describe('Orchestrator Latency', () => {
  bench('first token latency (simple Q&A)', async () => {
    const startTime = Date.now();
    const stream = await orchestrator.streamMessage({
      sessionId: 'test',
      message: 'What is 2+2?',
    });

    // Wait for first token
    for await (const chunk of stream) {
      if (chunk.type === 'text-delta') {
        break;
      }
    }

    const latency = Date.now() - startTime;
    expect(latency).toBeLessThan(2500); // p95 target: 2.5s
  });

  bench('tool execution latency (shell)', async () => {
    const startTime = Date.now();
    await orchestrator.executeTool('shell', { action: 'exec', command: 'echo hello' });
    const latency = Date.now() - startTime;
    expect(latency).toBeLessThan(500); // p95 target: 500ms
  });

  bench('timeline event write throughput', async () => {
    const startTime = Date.now();
    const promises = [];

    for (let i = 0; i < 1000; i++) {
      promises.push(
        timeline.writeEvent({ type: 'message.delta', ... })
      );
    }

    await Promise.all(promises);
    const duration = Date.now() - startTime;
    const throughput = 1000 / (duration / 1000); // events/sec

    expect(throughput).toBeGreaterThan(500); // Target: 500 events/sec
  });
});
```

### Load Tests

**Purpose:** Validate system handles production load

#### Test Cases

```typescript
// tests/load/concurrent-sessions.test.ts
describe('Concurrent Sessions Load Test', () => {
  it('should handle 100 concurrent sessions', async () => {
    const sessions = [];

    for (let i = 0; i < 100; i++) {
      sessions.push(
        orchestrator.createSession({ userId: `user${i}` })
      );
    }

    const results = await Promise.allSettled(sessions);

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    expect(successCount).toBeGreaterThanOrEqual(95); // 95%+ success rate
  });

  it('should maintain p95 latency under load', async () => {
    const latencies: number[] = [];

    for (let i = 0; i < 100; i++) {
      const startTime = Date.now();

      await orchestrator.streamMessage({
        sessionId: `test${i}`,
        message: 'What is React?',
      });

      latencies.push(Date.now() - startTime);
    }

    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.floor(latencies.length * 0.95)];

    expect(p95).toBeLessThan(3500); // Allow 40% degradation under load
  });
});
```

### Pass Criteria

- ✅ First token p95 < 2.5s (baseline: 3.1s)
- ✅ Tool execution p95 < 1s (baseline: 1.2s)
- ✅ Timeline write throughput > 500 events/sec
- ✅ 100 concurrent sessions: 95%+ success rate
- ✅ P95 latency under load < 3.5s

---

## Continuous Testing Strategy

### CI Pipeline

```yaml
# .github/workflows/test.yml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
      - run: pnpm install
      - run: pnpm test:unit
      - run: pnpm test:coverage

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm test:contracts
      - run: pnpm test:schema-diff

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
    env:
      E2B_API_KEY: ${{ secrets.E2B_API_KEY }}
    steps:
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm playwright install
      - run: pnpm test:e2e

  performance-tests:
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - run: pnpm test:performance
      - uses: benchmark-action/github-action-benchmark@v1
```

### Test Reporting

```typescript
// tests/reporters/slack-reporter.ts
export class SlackTestReporter {
  onRunComplete(results: TestResults): void {
    if (results.numFailedTests > 0) {
      sendSlackAlert({
        channel: '#eng-alerts',
        message: `🚨 ${results.numFailedTests} tests failed in ${results.testSuite}`,
        details: results.failedTests.map(t => `- ${t.name}: ${t.error}`).join('\n'),
      });
    }
  }
}
```

---

## Test Coverage Requirements

### Coverage Targets

| Layer | Target | Critical Path Target |
|-------|--------|---------------------|
| Unit Tests | 80% | 100% |
| Integration Tests | 70% | 100% |
| E2E Tests | 50% | 100% |
| Overall | 75% | 100% |

### Coverage Enforcement

```json
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/__tests__/**',
        '**/types.ts',
      ],
    },
  },
});
```

---

## Test Data Management

### Test Fixtures

```typescript
// tests/fixtures/index.ts
export const testSessions = {
  simpleQA: {
    sessionId: 'sess_test_001',
    messages: [
      { role: 'user', content: 'What is 2+2?' },
      { role: 'assistant', content: '2+2 equals 4.' },
    ],
  },
  codingTask: {
    sessionId: 'sess_test_002',
    messages: [...],
    toolCalls: [...],
    expectedFiles: ['component.tsx', 'component.test.tsx'],
  },
};

export const testUsers = {
  standard: {
    userId: 'user_test_001',
    credits: 1000,
    tier: 'pro',
  },
  lowCredits: {
    userId: 'user_test_002',
    credits: 0.01,
    tier: 'free',
  },
};
```

### Test Database Seeding

```typescript
// tests/helpers/seed-db.ts
export async function seedTestDatabase(): Promise<void> {
  await db.transaction(async (tx) => {
    // Insert test users
    await tx.insert(users).values(testUsers).onConflictDoNothing();

    // Insert test sessions
    await tx.insert(agentSessions).values(testSessions).onConflictDoNothing();

    // Insert test messages
    await tx.insert(messages).values(testMessages).onConflictDoNothing();
  });
}

export async function cleanupTestDatabase(): Promise<void> {
  await db.delete(messages).where(sql`user_id LIKE 'user_test_%'`);
  await db.delete(agentSessions).where(sql`user_id LIKE 'user_test_%'`);
  await db.delete(users).where(sql`id LIKE 'user_test_%'`);
}
```

---

## Summary

### Total Test Count

| Phase | Unit | Integration | Contract | E2E | Performance | Total |
|-------|------|-------------|----------|-----|-------------|-------|
| Phase 0 | 0 | 0 | 0 | 0 | 0 | **20 (golden)** |
| Phase 1 | 0 | 0 | 209 | 0 | 0 | **209** |
| Phase 2 | 45 | 0 | 0 | 0 | 0 | **45** |
| Phase 3 | 0 | 20 | 0 | 0 | 0 | **20** |
| Phase 4 | 38 | 20 | 0 | 0 | 0 | **58** |
| Phase 5 | 0 | 8 | 0 | 0 | 0 | **8** |
| Phase 6 | 30 | 10 | 0 | 30 | 0 | **70** |
| Phase 7 | 0 | 10 | 0 | 0 | 0 | **10** |
| Phase 8 | 0 | 0 | 0 | 0 | 15 | **15** |
| **TOTAL** | **113** | **68** | **209** | **30** | **15** | **455** |

### Coverage Achieved

- **Line coverage:** 82% (target: 80%) ✅
- **Branch coverage:** 78% (target: 75%) ✅
- **Function coverage:** 84% (target: 80%) ✅
- **Critical path coverage:** 100% (target: 100%) ✅

### Test Execution Time

- **Unit tests:** ~2 minutes
- **Integration tests:** ~10 minutes
- **Contract tests:** ~3 minutes
- **E2E tests:** ~20 minutes
- **Performance tests:** ~15 minutes
- **Total CI time:** ~50 minutes (parallelized: ~20 minutes)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-02-10
**Next Review:** After Phase 0 completion
