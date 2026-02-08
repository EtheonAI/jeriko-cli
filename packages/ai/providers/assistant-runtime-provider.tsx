"use client";

/**
 * @repo/ai - ExternalStoreRuntime Adapter
 *
 * Bridges useRealTimeChat (our data layer) to assistant-ui's component system.
 * Keeps all existing streaming, tool handling, and SSE transformation working
 * while providing assistant-ui's primitives for future UI composition.
 */

import { type ReactNode, useCallback, useMemo } from "react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  type ThreadMessageLike,
  type AppendMessage,
  type ExternalStoreAdapter,
} from "@assistant-ui/react";

import type {
  UIMessage,
  UIMessagePart,
  TextUIPart,
  StaticToolUIPart,
  DynamicToolUIPart,
} from "../lib/types/ui-message";

// Inline type for the chat hook interface (was UseRealTimeChatReturn)
interface UseRealTimeChatReturn {
  messages: UIMessage[];
  status: "idle" | "streaming" | "submitted" | "error";
  sendMessage: (opts: { text: string }) => Promise<void>;
  stop: () => void;
  regenerate: (opts: { messageId: string }) => Promise<void>;
}

// ============================================================================
// Message Conversion
// ============================================================================

// The content part type from assistant-ui's ThreadMessageLike
type ContentArray = Exclude<ThreadMessageLike["content"], string>;
type ContentPart = ContentArray[number];

/**
 * Converts a Rubic UIMessage part into assistant-ui content parts.
 */
function convertPartToContent(part: UIMessagePart): ContentPart | null {
  switch (part.type) {
    case "text":
      return { type: "text" as const, text: (part as TextUIPart).text } as ContentPart;

    case "dynamic-tool": {
      const toolPart = part as DynamicToolUIPart;
      return {
        type: "tool-call",
        toolCallId: toolPart.toolCallId,
        toolName: toolPart.toolName,
        args: (toolPart.input ?? {}) as Record<string, never>,
        result:
          toolPart.state === "output-available" || toolPart.state === "output-error"
            ? (toolPart.output ?? toolPart.errorText ?? undefined)
            : undefined,
        isError: toolPart.state === "output-error" ? true : undefined,
      } as ContentPart;
    }

    default:
      // Static tool parts (type starts with "tool-")
      if (typeof part.type === "string" && part.type.startsWith("tool-")) {
        const toolPart = part as StaticToolUIPart;
        const toolName = part.type.slice(5); // Remove "tool-" prefix
        return {
          type: "tool-call",
          toolCallId: toolPart.toolCallId,
          toolName,
          args: (toolPart.input ?? {}) as Record<string, never>,
          result:
            toolPart.state === "output-available" || toolPart.state === "output-error"
              ? (toolPart.output ?? toolPart.errorText ?? undefined)
              : undefined,
          isError: toolPart.state === "output-error" ? true : undefined,
        } as ContentPart;
      }
      // Skip non-convertible parts (reasoning, source-url, etc.)
      return null;
  }
}

/**
 * Converts a Rubic UIMessage into assistant-ui's ThreadMessageLike format.
 */
function convertUIMessageToThread(message: UIMessage): ThreadMessageLike {
  const parts: ContentPart[] = [];

  for (const part of message.parts) {
    const converted = convertPartToContent(part);
    if (converted) {
      parts.push(converted);
    }
  }

  // Ensure at least one content part
  if (parts.length === 0) {
    parts.push({ type: "text" as const, text: "" } as ContentPart);
  }

  return {
    role: message.role as "user" | "assistant" | "system",
    content: parts as unknown as ContentArray,
    id: message.id,
    createdAt: message.createdAt,
  };
}

// ============================================================================
// Adapter Hook
// ============================================================================

/**
 * Creates an ExternalStoreAdapter from useRealTimeChat state.
 */
function useRubicExternalStore(chatHook: UseRealTimeChatReturn): ExternalStoreAdapter<UIMessage> {
  const convertMessage = useCallback(
    (message: UIMessage): ThreadMessageLike => convertUIMessageToThread(message),
    []
  );

  const onNew = useCallback(
    async (message: AppendMessage) => {
      const textPart = message.content.find(
        (p): p is { type: "text"; text: string } => p.type === "text"
      );
      if (textPart) {
        await chatHook.sendMessage({ text: textPart.text });
      }
    },
    [chatHook.sendMessage]
  );

  const onCancel = useCallback(async () => {
    chatHook.stop();
  }, [chatHook.stop]);

  const onReload = useCallback(
    async (parentId: string | null) => {
      if (parentId) {
        await chatHook.regenerate({ messageId: parentId });
      }
    },
    [chatHook.regenerate]
  );

  return useMemo(
    () => ({
      isRunning: chatHook.status === "streaming" || chatHook.status === "submitted",
      messages: chatHook.messages,
      convertMessage,
      onNew,
      onCancel,
      onReload,
    }),
    [chatHook.status, chatHook.messages, convertMessage, onNew, onCancel, onReload]
  );
}

// ============================================================================
// Provider Component
// ============================================================================

export interface RubicRuntimeProviderProps {
  chatHook: UseRealTimeChatReturn;
  children: ReactNode;
}

/**
 * Wraps children with assistant-ui's runtime, powered by our useRealTimeChat hook.
 *
 * Usage:
 * ```tsx
 * const chatHook = useRealTimeChat({ ... });
 * return (
 *   <RubicRuntimeProvider chatHook={chatHook}>
 *     <Thread />
 *   </RubicRuntimeProvider>
 * );
 * ```
 */
export function RubicRuntimeProvider({ chatHook, children }: RubicRuntimeProviderProps) {
  const adapter = useRubicExternalStore(chatHook);
  const runtime = useExternalStoreRuntime(adapter);

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}
