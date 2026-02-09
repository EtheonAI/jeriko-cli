"use client";

import { useEffect, useRef } from "react";
import type { Attachment } from "@repo/ai/lib/types";

interface UseInitialMessageOptions {
  sessionId: string;
  sendMessage: (
    text: string,
    options?: { body?: Record<string, unknown>; attachments?: Attachment[] },
  ) => void;
}

export function useInitialMessage({ sessionId, sendMessage }: UseInitialMessageOptions) {
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    const key = `chat-${sessionId}-initial`;
    const stored = sessionStorage.getItem(key);
    if (!stored) return;

    consumedRef.current = true;
    sessionStorage.removeItem(key);

    try {
      const { parts, model, attachments } = JSON.parse(stored) as {
        parts: Array<{ type: string; text?: string }>;
        model?: string;
        attachments?: Attachment[];
      };

      const textPart = parts?.find(
        (p): p is { type: "text"; text: string } => p.type === "text"
      );
      if (textPart?.text || (attachments?.length ?? 0) > 0) {
        setTimeout(
          () => sendMessage(textPart?.text ?? "", { body: { model }, attachments }),
          100
        );
      }
    } catch {
      // Ignore malformed data
    }
  }, [sessionId, sendMessage]);
}
