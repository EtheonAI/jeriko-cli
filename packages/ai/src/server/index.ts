import { convertToModelMessages, type ModelMessage, type UIMessage } from "ai";

export {
  convertToModelMessages,
  createAgentUIStream,
  createAgentUIStreamResponse,
  createTextStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  pipeAgentUIStreamToResponse,
  pipeTextStreamToResponse,
  pipeUIMessageStreamToResponse,
  readUIMessageStream,
  smoothStream,
} from "ai";

export type {
  UIMessageChunk,
  UIMessageStreamOnFinishCallback,
  UIMessageStreamOnStepFinishCallback,
  UIMessageStreamOptions,
  UIMessageStreamWriter,
} from "ai";

/**
 * Thin compatibility helper for code that wants the repo-owned package surface.
 * New route handlers can call AI SDK `convertToModelMessages` directly.
 */
export async function toModelMessages(messages: readonly UIMessage[]): Promise<ModelMessage[]> {
  return convertToModelMessages([...messages]);
}

export function sanitizeUiMessages<TMessage extends UIMessage>(
  messages: readonly TMessage[]
): TMessage[] {
  return messages.filter((message) => Array.isArray(message.parts) && message.parts.length > 0);
}
