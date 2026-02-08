"use client";

import { useEffect, useRef } from "react";

interface UseInitialMessageOptions {
  sessionId: string;
  sendMessage: (text: string, options?: { body?: Record<string, unknown> }) => void;
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
      const { parts, model } = JSON.parse(stored) as {
        parts: Array<{ type: string; text?: string }>;
        model?: string;
      };

      const textPart = parts?.find(
        (p): p is { type: "text"; text: string } => p.type === "text"
      );
      if (textPart?.text) {
        setTimeout(() => sendMessage(textPart.text, { body: { model } }), 100);
      }
    } catch {
      // Ignore malformed data
    }
  }, [sessionId, sendMessage]);
}
