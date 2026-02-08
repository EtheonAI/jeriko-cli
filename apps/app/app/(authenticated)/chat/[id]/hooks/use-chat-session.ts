"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import { useAppDispatch } from "@/lib/store/hooks";
import {
  setMessages as setReduxMessages,
  setStreaming,
  setCurrentStreamingSession,
  type Message as ReduxMessage,
} from "@/lib/store/slices/chat.slice";
import { updateSession as updateSessionInStore } from "@/lib/store/slices/sessions.slice";

interface UseChatSessionOptions {
  sessionId: string;
  initialMessages: ReduxMessage[];
}

/**
 * Detect old assistant messages where parts is null/empty and content is
 * concatenated JSON objects from the pre-parts agent format. Splits on
 * `}\n\n{` boundaries, parses each chunk, and converts recognized shapes
 * to proper UIMessage tool parts. Unrecognized text becomes `{ type: "text" }`.
 */
function migrateContentToParts(content: string): UIMessage["parts"] | null {
  if (!content || !content.includes("{")) return null;

  // Try to detect concatenated JSON objects (old agent format)
  // Old format example: {"type":"tool_start","tool":"show_plan",...}\n\n{"type":"tool_result",...}
  const chunks: string[] = [];
  const raw = content.trim();

  // Try splitting on }\n\n{ boundaries (common in old agent SSE concatenation)
  const parts = raw.split(/\}\s*\n\n\s*\{/);
  if (parts.length > 1) {
    for (let i = 0; i < parts.length; i++) {
      let chunk = parts[i]!;
      if (i > 0) chunk = "{" + chunk;
      if (i < parts.length - 1) chunk = chunk + "}";
      chunks.push(chunk);
    }
  } else {
    // Maybe it's a single JSON object or just text
    chunks.push(raw);
  }

  const migrated: UIMessage["parts"] = [];
  let hadToolParts = false;

  for (const chunk of chunks) {
    try {
      const obj = JSON.parse(chunk) as Record<string, unknown>;

      // Detect tool_start / tool_result shapes from old agent SSE format
      if (obj.type === "tool_start" || obj.type === "tool_result") {
        const toolName = (obj.tool as string) || "unknown";
        const toolCallId = (obj.toolCallId as string) || `legacy-${toolName}-${Date.now()}`;
        const isResult = obj.type === "tool_result";

        migrated.push({
          type: `tool-${toolName}`,
          toolCallId,
          toolName,
          state: isResult ? "output-available" : "input-available",
          input: (obj.input ?? {}) as Record<string, unknown>,
          ...(isResult ? { output: obj.result ?? obj.output ?? {} } : {}),
        } as unknown as UIMessage["parts"][number]);
        hadToolParts = true;
        continue;
      }

      // Detect old content chunks
      if (obj.type === "content" && typeof obj.content === "string") {
        migrated.push({ type: "text" as const, text: obj.content });
        continue;
      }

      // If it parsed as JSON but we don't recognize the shape, render as text
      migrated.push({ type: "text" as const, text: chunk });
    } catch {
      // Not JSON — keep as plain text
      if (chunk.trim()) {
        migrated.push({ type: "text" as const, text: chunk });
      }
    }
  }

  // Only return migrated parts if we found actual tool parts; otherwise let
  // the default text fallback handle it (avoids breaking simple text messages)
  return hadToolParts ? migrated : null;
}

/**
 * Normalize parts from DB — handles old "tool-invocation" format and
 * filters out malformed parts that would crash the renderer.
 */
function normalizeParts(rawParts: unknown[]): UIMessage["parts"] {
  const normalized: unknown[] = [];

  for (const part of rawParts) {
    if (!part || typeof part !== "object") continue;

    const p = part as Record<string, unknown>;
    const pType = typeof p.type === "string" ? p.type : "";

    // Migrate legacy "tool-invocation" format → "tool-{toolName}"
    if (pType === "tool-invocation") {
      const toolName = (p.toolName as string) || "unknown";
      if (!p.toolCallId) continue; // Skip malformed
      normalized.push({
        ...p,
        type: `tool-${toolName}`,
        state: p.state || "output-available",
      });
      continue;
    }

    // ModelMessage parts: "tool-call" and "tool-result" — skip (not UIMessage format)
    if (pType === "tool-call" || pType === "tool-result") continue;

    // Validate UIMessage tool parts (type: "tool-{toolName}")
    if (pType.startsWith("tool-")) {
      if (!p.toolCallId) continue; // Skip malformed — must have toolCallId
      // Ensure state is always present (old DB records may lack it)
      if (!p.state) {
        normalized.push({ ...p, state: "output-available" });
        continue;
      }
    }

    normalized.push(p);
  }

  return normalized as UIMessage["parts"];
}

export function useChatSession({ sessionId, initialMessages }: UseChatSessionOptions) {
  const dispatch = useAppDispatch();
  const transportRef = useRef(new DefaultChatTransport({ api: "/api/chat" }));

  // Convert ReduxMessage[] → UIMessage[] for initialMessages
  const initialUIMessages = useMemo<UIMessage[]>(
    () =>
      initialMessages.map((msg) => {
        let parts: UIMessage["parts"];
        if (msg.parts && (msg.parts as unknown[]).length > 0) {
          parts = normalizeParts(msg.parts as unknown[]);
        } else if (msg.role === "assistant") {
          // Try to migrate old concatenated JSON content to proper parts
          const migrated = migrateContentToParts(msg.content);
          parts = migrated ?? [{ type: "text" as const, text: msg.content }];
        } else {
          parts = [{ type: "text" as const, text: msg.content }];
        }

        return {
          id: msg.id,
          role: msg.role as "user" | "assistant" | "system",
          parts,
          metadata: msg.metadata,
          createdAt: new Date(msg.createdAt),
        };
      }),
    [initialMessages]
  );

  const {
    messages,
    setMessages,
    status,
    sendMessage: sdkSendMessage,
    stop,
    regenerate,
  } = useChat({
    id: sessionId,
    transport: transportRef.current,
    messages: initialUIMessages,
    experimental_throttle: 16,
    // resume: false — disabled because the AI SDK's resumeStream internally
    // calls structuredClone + isStaticToolUIPart on old assistant message parts
    // and crashes with "Cannot read properties of undefined (reading 'state')"
    // when parts from the DB don't perfectly match the SDK's expected shape.
    // Old chat state is already loaded from DB via initialMessages, so resume
    // is only useful for reconnecting to an active Redis-backed stream mid-flight.
    // Re-enable when SDK fixes the null-safety issue in chat.ts:688.
    resume: false,
    onFinish: ({ messages: finishedMessages }) => {
      const reduxMsgs: ReduxMessage[] = finishedMessages.map((m) => ({
        id: m.id,
        sessionId,
        role: m.role,
        content: (m.parts ?? [])
          .filter((p) => p.type === "text" && "text" in p)
          .map((p) => (p as { type: "text"; text: string }).text ?? "")
          .join(""),
        parts: m.parts as unknown as ReduxMessage["parts"],
        createdAt: new Date().toISOString(),
        metadata: m.metadata as Record<string, unknown> | undefined,
      }));
      dispatch(setReduxMessages({ sessionId, messages: reduxMsgs }));
      dispatch(
        updateSessionInStore({
          id: sessionId,
          updates: { updatedAt: new Date().toISOString() },
        })
      );
    },
    onError: (err) => {
      console.error("Chat error:", err);
      toast.error("Failed to get response. Please try again.");
    },
  });

  // Wrap sendMessage to always include chatId in body
  const sendMessage = useCallback(
    (text: string, options?: { body?: Record<string, unknown> }) => {
      const body = { chatId: sessionId, ...(options?.body ?? {}) };
      return sdkSendMessage({ text }, { ...options, body });
    },
    [sdkSendMessage, sessionId]
  );

  // Sync streaming state to Redux
  useEffect(() => {
    const isActive = status === "streaming" || status === "submitted";
    dispatch(setStreaming(isActive));
    dispatch(setCurrentStreamingSession(isActive ? sessionId : null));
  }, [status, sessionId, dispatch]);

  const isStreaming = status === "streaming" || status === "submitted";

  return {
    messages: messages as UIMessage[],
    setMessages: setMessages as unknown as (
      msgs: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
    ) => void,
    status,
    isStreaming,
    sendMessage,
    stop,
    regenerate,
  };
}
