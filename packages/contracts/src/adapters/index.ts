/**
 * Backward compatibility adapters for Python agent protocol
 *
 * Transforms between Python agent events and canonical event protocol
 */

import type { StreamEvent } from '../events/index.js';

/**
 * Transform Python agent event to canonical format
 */
export function pythonToCanonical(pythonEvent: any): StreamEvent[] {
  const events: StreamEvent[] = [];
  const timestamp = new Date().toISOString();

  switch (pythonEvent.type) {
    // Tool use events
    case 'tool_use':
      events.push({
        type: 'tool-input-start',
        toolName: pythonEvent.name,
        toolCallId: pythonEvent.id,
        timestamp,
      });
      events.push({
        type: 'tool-input-available',
        toolName: pythonEvent.name,
        toolCallId: pythonEvent.id,
        args: pythonEvent.input || {},
        timestamp,
      });
      break;

    // Content blocks
    case 'content_block_start':
      if (pythonEvent.content_block?.type === 'text') {
        events.push({ type: 'text-start', timestamp });
      } else if (pythonEvent.content_block?.type === 'tool_use') {
        events.push({
          type: 'tool-input-start',
          toolName: pythonEvent.content_block.name,
          toolCallId: pythonEvent.content_block.id,
          timestamp,
        });
      }
      break;

    case 'content_block_delta':
      if (pythonEvent.delta?.type === 'text_delta') {
        events.push({
          type: 'text-delta',
          delta: pythonEvent.delta.text,
          timestamp,
        });
      } else if (pythonEvent.delta?.type === 'input_json_delta') {
        // Tool input delta - not used in canonical format
      }
      break;

    case 'content_block_stop':
      events.push({ type: 'text-end', timestamp });
      break;

    // Metadata events
    case 'sandbox_info':
      events.push({
        type: 'message-metadata',
        metadata: {
          type: 'sandbox_info',
          sandboxId: pythonEvent.sandbox_id,
        },
        timestamp,
      });
      break;

    case 'browser_frame':
      events.push({
        type: 'message-metadata',
        metadata: {
          type: 'browser_frame',
          screenshot: pythonEvent.screenshot,
          url: pythonEvent.url,
          title: pythonEvent.title,
        },
        timestamp,
      });
      break;

    // Streaming events
    case 'message_start':
      events.push({
        type: 'start',
        sessionId: pythonEvent.session_id || 'unknown',
        timestamp,
      });
      break;

    case 'message_stop':
      events.push({
        type: 'finish',
        finishReason: pythonEvent.stop_reason || 'stop',
        timestamp,
      });
      break;

    // Step events
    case 'step_start':
      events.push({
        type: 'start-step',
        stepId: pythonEvent.step_id || `step-${pythonEvent.step_index || 0}`,
        description: pythonEvent.description || '',
        timestamp,
      });
      break;

    case 'step_finish':
      events.push({
        type: 'finish-step',
        stepId: pythonEvent.step_id || `step-${pythonEvent.step_index || 0}`,
        status: pythonEvent.status || 'completed',
        timestamp,
      });
      break;

    default:
      // Unknown event type - pass through as metadata
      events.push({
        type: 'message-metadata',
        metadata: pythonEvent,
        timestamp,
      });
  }

  return events;
}

/**
 * Transform canonical event to Python agent format
 */
export function canonicalToPython(canonicalEvent: StreamEvent): any[] {
  const events: any[] = [];

  switch (canonicalEvent.type) {
    // Tool events
    case 'tool-input-start':
      // Python doesn't have a separate start event
      break;

    case 'tool-input-available':
      events.push({
        type: 'tool_use',
        id: canonicalEvent.toolCallId,
        name: canonicalEvent.toolName,
        input: canonicalEvent.args,
      });
      break;

    case 'tool-output-available':
      events.push({
        type: 'tool_result',
        tool_use_id: canonicalEvent.toolCallId,
        content: canonicalEvent.result,
      });
      break;

    case 'tool-output-error':
      events.push({
        type: 'tool_result',
        tool_use_id: canonicalEvent.toolCallId,
        is_error: true,
        content: canonicalEvent.error,
      });
      break;

    // Text events
    case 'text-start':
      events.push({
        type: 'content_block_start',
        content_block: { type: 'text' },
      });
      break;

    case 'text-delta':
      events.push({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: canonicalEvent.delta },
      });
      break;

    case 'text-end':
      events.push({ type: 'content_block_stop' });
      break;

    // Message lifecycle
    case 'start':
      events.push({ type: 'message_start' });
      break;

    case 'finish':
      events.push({
        type: 'message_stop',
        stop_reason: canonicalEvent.finishReason,
      });
      break;

    // Step lifecycle
    case 'start-step':
      events.push({
        type: 'step_start',
        step_id: canonicalEvent.stepId,
        description: canonicalEvent.description,
      });
      break;

    case 'finish-step':
      events.push({
        type: 'step_finish',
        step_id: canonicalEvent.stepId,
        status: canonicalEvent.status,
      });
      break;

    // Metadata
    case 'message-metadata':
      const metadata = canonicalEvent.metadata;
      if (metadata && typeof metadata === 'object' && 'type' in metadata) {
        if (metadata.type === 'sandbox_info') {
          events.push({
            type: 'sandbox_info',
            sandbox_id: (metadata as any).sandboxId,
          });
        } else if (metadata.type === 'browser_frame') {
          events.push({
            type: 'browser_frame',
            screenshot: (metadata as any).screenshot,
            url: (metadata as any).url,
            title: (metadata as any).title,
          });
        } else {
          events.push(metadata);
        }
      }
      break;

    // Reasoning (not in Python format)
    case 'reasoning-start':
    case 'reasoning-delta':
    case 'reasoning-end':
      // Skip - Python agent doesn't expose reasoning
      break;

    // Source URLs
    case 'source-url':
      events.push({
        type: 'source_url',
        url: canonicalEvent.url,
      });
      break;

    default:
      // Pass through unknown events
      events.push(canonicalEvent);
  }

  return events;
}
