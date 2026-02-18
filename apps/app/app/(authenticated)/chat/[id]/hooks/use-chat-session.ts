"use client";

import { useCallback, useEffect, useRef, useMemo } from "react";
import type { UIMessage } from "ai";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import type { Attachment } from "@repo/ai/lib/types";
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
 * Deep-sanitize a value to be structuredClone-safe.
 * Strips functions, symbols, class instances, circular refs, etc.
 * Uses JSON round-trip which is the most reliable method.
 *
 * CRITICAL: If JSON.stringify fails (circular refs, BigInt, etc.),
 * returns undefined instead of the original value. The AI SDK calls
 * structuredClone(lastMessage) internally — if it throws, the
 * finally block crashes accessing activeResponse.state.
 */
function sanitize<T>(value: T): T {
  if (value === undefined || value === null) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return undefined as unknown as T;
  }
}

/**
 * Normalize parts from DB — handles old "tool-invocation" format and
 * filters out malformed parts that would crash the renderer.
 * CRITICAL: Every tool part MUST have both `state` and `toolName` fields,
 * otherwise the AI SDK's structuredClone + isStaticToolUIPart checks crash.
 * All parts are JSON-sanitized to prevent structuredClone failures.
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
      normalized.push(sanitize({
        ...p,
        type: `tool-${toolName}`,
        toolName,
        state: p.state || "output-available",
      }));
      continue;
    }

    // ModelMessage parts: "tool-call" and "tool-result" — skip (not UIMessage format)
    if (pType === "tool-call" || pType === "tool-result") continue;

    // Validate UIMessage tool parts (type: "tool-{toolName}")
    if (pType.startsWith("tool-")) {
      if (!p.toolCallId) continue; // Skip malformed — must have toolCallId
      // Derive toolName from type if missing (type is "tool-{toolName}")
      const derivedToolName = (p.toolName as string) || pType.slice(5) || "unknown";
      // Ensure both state AND toolName are always present
      if (!p.state || !p.toolName) {
        normalized.push(sanitize({
          ...p,
          state: p.state || "output-available",
          toolName: derivedToolName,
        }));
        continue;
      }
    }

    // Text parts: ensure they have a text field
    if (pType === "text" && typeof p.text !== "string") {
      continue; // Skip malformed text parts
    }

    normalized.push(sanitize(p));
  }

  return normalized as UIMessage["parts"];
}

export function useChatSession({ sessionId, initialMessages }: UseChatSessionOptions) {
  const dispatch = useAppDispatch();
  const transportRef = useRef(new DefaultChatTransport({ api: "/api/chat" }));

  // Convert ReduxMessage[] → UIMessage[] for initialMessages
  const initialUIMessages = useMemo<UIMessage[]>(
    () =>
      initialMessages.reduce<UIMessage[]>((acc, msg) => {
        try {
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

          // Safety: skip messages with empty parts (would crash structuredClone)
          if (!parts || parts.length === 0) {
            parts = [{ type: "text" as const, text: msg.content || "" }];
          }

          // CRITICAL: Every field must be structuredClone-safe.
          // The AI SDK calls structuredClone(lastMessage) internally during
          // makeRequest — if it throws, the finally block crashes accessing
          // this.activeResponse!.state (activeResponse never set).
          // Sanitize metadata via JSON round-trip to strip non-serializable values.
          acc.push({
            id: msg.id,
            role: msg.role as "user" | "assistant" | "system",
            parts,
            metadata: sanitize(msg.metadata),
          } as any);
        } catch (err) {
          // If a message fails to convert, skip it rather than crashing the whole session
          console.warn("Failed to convert message, skipping:", msg.id, err);
        }
        return acc;
      }, []),
    [initialMessages]
  );

  const {
    messages,
    setMessages,
    status,
    sendMessage: sdkSendMessage,
    stop,
    regenerate,
    resumeStream,
  } = useChat({
    id: sessionId,
    transport: transportRef.current,
    messages: initialUIMessages,
    experimental_throttle: 16,
    // CRITICAL: resume must be false — we call resumeStream manually below.
    // The SDK's built-in resume: true uses a useEffect without a guard,
    // causing React 19 strict mode to double-invoke it. Two concurrent
    // makeRequest calls race on the same Chat instance, and the first
    // call's finally block clears activeResponse before the second's
    // finally can read it → "Cannot read properties of undefined (reading 'state')".
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
      // Only update sidebar date when user actually sent a new message,
      // NOT on stream resume (opening an old chat)
      if (userSentMessageRef.current) {
        userSentMessageRef.current = false;
        dispatch(
          updateSessionInStore({
            id: sessionId,
            updates: { updatedAt: new Date().toISOString() },
          })
        );
      }
    },
    onError: (err) => {
      console.error("Chat error:", err);
      toast.error("Failed to get response. Please try again.");
    },
  });

  function mapAttachmentsToFiles(attachments?: Attachment[]) {
    if (!attachments || attachments.length === 0) return undefined;

    const fileParts = attachments
      .filter((a) => a.status === "ready" && a.url)
      .map((a) => ({
        type: "file" as const,
        url: a.url!,
        mediaType: a.mimeType || "application/octet-stream",
        filename: a.name,
      }));

    if (fileParts.length > 0) return fileParts;

    const localFiles = attachments
      .map((a) => a.file)
      .filter((f): f is File => Boolean(f));

    return localFiles.length > 0 ? localFiles : undefined;
  }

  // Track whether the user actually sent a new message (vs stream resume)
  const userSentMessageRef = useRef(false);

  // Wrap sendMessage to always include chatId in body
  const sendMessage = useCallback(
    (
      text: string,
      options?: {
        body?: Record<string, unknown>;
        attachments?: Attachment[];
      },
    ) => {
      userSentMessageRef.current = true;
      const body = { chatId: sessionId, ...(options?.body ?? {}) };
      const files = mapAttachmentsToFiles(options?.attachments);
      return sdkSendMessage(
        (files ? { text, files } : { text }) as any,
        { body },
      );
    },
    [sdkSendMessage, sessionId]
  );

  // Custom stop: halt local rendering immediately, then tell the server to
  // abort the agent loop. This replaces the old auto-stop-on-disconnect —
  // stop is now an explicit user action (Stop button).
  const customStop = useCallback(async () => {
    // Stop local rendering immediately
    stop();
    // Tell server to abort the agent loop
    try {
      await fetch(`/api/chat/${sessionId}/stop`, { method: "POST" });
    } catch { /* best-effort */ }
  }, [stop, sessionId]);

  // Resume active streams on mount — manually guarded to prevent
  // React 19 strict mode from double-invoking (which causes the
  // "Cannot read properties of undefined (reading 'state')" crash).
  //
  // isResumingRef suppresses the transient "submitted" status that the SDK
  // fires synchronously when resumeStream() is called. Without this,
  // historical chats flash a thinking indicator + sidebar spinner because
  // "submitted" → isStreaming=true before the resume GET returns 404.
  const resumeCalledRef = useRef(false);
  const isResumingRef = useRef(true);
  useEffect(() => {
    if (resumeCalledRef.current) return;
    resumeCalledRef.current = true;
    resumeStream()
      .catch(() => {
        // Swallow resume errors — most common case is "no active stream"
        // which is expected for historical chats.
      })
      .finally(() => {
        isResumingRef.current = false;
      });
  }, [resumeStream]);

  // Compute effective status — suppress false "submitted" during resume.
  // "streaming" passes through even during resume (real active stream).
  const effectiveStatus =
    isResumingRef.current && status === "submitted" ? "ready" : status;

  // Sync streaming state to Redux
  useEffect(() => {
    const isActive = effectiveStatus === "streaming" || effectiveStatus === "submitted";
    dispatch(setStreaming(isActive));
    dispatch(setCurrentStreamingSession(isActive ? sessionId : null));
  }, [effectiveStatus, sessionId, dispatch]);

  const isStreaming = effectiveStatus === "streaming" || effectiveStatus === "submitted";

  return {
    messages: messages as UIMessage[],
    setMessages: setMessages as unknown as (
      msgs: UIMessage[] | ((prev: UIMessage[]) => UIMessage[])
    ) => void,
    status: effectiveStatus,
    isStreaming,
    sendMessage,
    stop: customStop,
    regenerate,
  };
}
