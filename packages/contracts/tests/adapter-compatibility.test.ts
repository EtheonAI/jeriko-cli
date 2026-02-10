import { describe, it, expect, beforeAll } from 'vitest';
import { pythonToCanonical, canonicalToPython } from '../src/adapters/index.js';
import { validateStreamEvent } from '../src/events/index.js';
import fs from 'fs';
import path from 'path';

describe('Adapter Backward Compatibility', () => {
  let productionEvents: any[];

  beforeAll(() => {
    // Load real production events from baseline traces
    const tracesDir = path.join(__dirname, '../../../docs/refactor-2026/baseline/traces');
    const traces = fs.readdirSync(tracesDir)
      .filter(f => f.endsWith('.jsonl'))
      .slice(0, 5); // Test first 5 traces

    productionEvents = [];

    for (const traceFile of traces) {
      const trace = JSON.parse(
        fs.readFileSync(path.join(tracesDir, traceFile), 'utf-8')
      );

      for (const message of trace.messages) {
        if (message.role === 'assistant' && message.parts) {
          for (const part of message.parts) {
            if (part.type === 'tool-use') {
              productionEvents.push({
                type: 'tool_use',
                id: part.id,
                name: part.name,
                input: part.input,
              });
            }
          }
        }
      }
    }
  });

  it('should transform all production events without errors', () => {
    for (const pythonEvent of productionEvents) {
      expect(() => pythonToCanonical(pythonEvent)).not.toThrow();
    }
  });

  it('should produce valid canonical events', () => {
    for (const pythonEvent of productionEvents) {
      const canonical = pythonToCanonical(pythonEvent);

      for (const event of canonical) {
        expect(() => validateStreamEvent(event)).not.toThrow();
      }
    }
  });

  it('should round-trip: Python → Canonical → Python', () => {
    const testEvent = {
      type: 'tool_use',
      id: 'test_123',
      name: 'file_read',
      input: { path: '/test.txt' },
    };

    const canonical = pythonToCanonical(testEvent);
    const backToPython = canonical.flatMap(canonicalToPython);

    expect(backToPython).toHaveLength(1);
    expect(backToPython[0].type).toBe('tool_use');
    expect(backToPython[0].id).toBe('test_123');
  });

  it('should preserve tool names exactly', () => {
    const uniqueTools = new Set(
      productionEvents
        .filter(e => e.type === 'tool_use')
        .map(e => e.name)
    );

    for (const toolName of uniqueTools) {
      const pythonEvent = {
        type: 'tool_use',
        id: 'test',
        name: toolName,
        input: {},
      };

      const canonical = pythonToCanonical(pythonEvent);
      const toolEvent = canonical.find(e => e.type === 'tool-input-available');

      expect(toolEvent).toBeDefined();
      expect((toolEvent as any).toolName).toBe(toolName);
    }
  });

  it('should handle all content block types', () => {
    const contentBlocks = [
      { type: 'content_block_start', content_block: { type: 'text' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_stop' },
    ];

    for (const block of contentBlocks) {
      expect(() => pythonToCanonical(block)).not.toThrow();
    }
  });

  it('should handle metadata events', () => {
    const metadataEvents = [
      { type: 'sandbox_info', sandbox_id: 'sb_123' },
      {
        type: 'browser_frame',
        screenshot: 'base64...',
        url: 'https://example.com',
        title: 'Example',
      },
    ];

    for (const event of metadataEvents) {
      const canonical = pythonToCanonical(event);
      expect(canonical).toHaveLength(1);
      expect(canonical[0].type).toBe('message-metadata');
    }
  });
});
