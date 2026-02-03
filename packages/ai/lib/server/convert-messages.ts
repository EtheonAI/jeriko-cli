/**
 * @repo/ai - Message Conversion Utilities
 *
 * Converts between UIMessage format and AI SDK CoreMessage format
 */

import type { UIMessage, UIMessagePart } from '../types/ui-message';

// Define local types compatible with AI SDK v6
type CoreUserMessage = {
  role: 'user';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; image: string; mimeType?: string }
  >;
};

type CoreAssistantMessage = {
  role: 'assistant';
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  >;
};

type CoreSystemMessage = {
  role: 'system';
  content: string;
};

type CoreMessage = CoreUserMessage | CoreAssistantMessage | CoreSystemMessage;

/**
 * Convert UIMessages to CoreMessages for the AI SDK
 */
export function convertToModelMessages(messages: UIMessage[]): CoreMessage[] {
  return messages.map(convertUIMessageToCoreMessage);
}

/**
 * Convert a single UIMessage to CoreMessage
 */
function convertUIMessageToCoreMessage(message: UIMessage): CoreMessage {
  switch (message.role) {
    case 'user':
      return convertUserMessage(message);
    case 'assistant':
      return convertAssistantMessage(message);
    case 'system':
      return convertSystemMessage(message);
    default:
      // Fallback for unknown roles
      return {
        role: 'user',
        content: [{ type: 'text', text: extractTextFromParts(message.parts) }],
      } as CoreUserMessage;
  }
}

/**
 * Convert user message
 */
function convertUserMessage(message: UIMessage): CoreUserMessage {
  const content: CoreUserMessage['content'] = [];

  for (const part of message.parts) {
    switch (part.type) {
      case 'text':
        content.push({ type: 'text', text: part.text });
        break;
      case 'file':
        // Handle file parts - could be images or other files
        if (part.mediaType?.startsWith('image/')) {
          content.push({
            type: 'image',
            image: part.url,
            mimeType: part.mediaType,
          });
        } else {
          // For non-image files, add as text reference
          content.push({
            type: 'text',
            text: `[File: ${part.filename || 'attachment'} (${part.mediaType})]`,
          });
        }
        break;
      default:
        // Skip other part types for user messages
        break;
    }
  }

  // If no content parts, add empty text
  if (content.length === 0) {
    content.push({ type: 'text', text: '' });
  }

  return {
    role: 'user',
    content,
  };
}

/**
 * Convert assistant message
 */
function convertAssistantMessage(message: UIMessage): CoreAssistantMessage {
  const content: CoreAssistantMessage['content'] = [];
  const toolCalls: Array<{
    type: 'tool-call';
    toolCallId: string;
    toolName: string;
    args: unknown;
  }> = [];

  for (const part of message.parts) {
    switch (part.type) {
      case 'text':
        content.push({ type: 'text', text: part.text });
        break;
      case 'reasoning':
        // Include reasoning as text (some models support this)
        content.push({ type: 'text', text: `<thinking>${part.text}</thinking>` });
        break;
      default:
        // Handle tool parts
        if (part.type.startsWith('tool-')) {
          const toolName = part.type.slice(5); // Remove 'tool-' prefix
          if ('toolCallId' in part && 'input' in part) {
            toolCalls.push({
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName,
              args: part.input ?? {},
            });
          }
        } else if (part.type === 'dynamic-tool') {
          if ('toolCallId' in part && 'toolName' in part) {
            toolCalls.push({
              type: 'tool-call',
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              args: part.input ?? {},
            });
          }
        }
        break;
    }
  }

  // Build the content array
  const result: CoreAssistantMessage = {
    role: 'assistant',
    content: [
      ...content,
      ...toolCalls,
    ],
  };

  return result;
}

/**
 * Convert system message
 */
function convertSystemMessage(message: UIMessage): CoreSystemMessage {
  return {
    role: 'system',
    content: extractTextFromParts(message.parts),
  };
}

/**
 * Extract text content from message parts
 */
function extractTextFromParts(parts: UIMessagePart[]): string {
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('\n');
}

/**
 * Validate and sanitize messages before sending to model
 * Filters out empty messages and ensures valid structure
 */
export function sanitizeMessages(messages: UIMessage[]): UIMessage[] {
  return messages.filter((msg) => {
    // Must have at least one part
    if (!msg.parts || msg.parts.length === 0) return false;

    // Must have some content
    const hasContent = msg.parts.some((part) => {
      if (part.type === 'text') return part.text.trim().length > 0;
      if (part.type === 'file') return !!part.url;
      if (part.type.startsWith('tool-')) return true;
      if (part.type === 'dynamic-tool') return true;
      return false;
    });

    return hasContent;
  });
}
