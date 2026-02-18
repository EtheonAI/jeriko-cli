"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Attachment } from "@repo/ai/lib/types";
import { ChatPrompt, type SubmitOptions } from "./unified-prompt";
import { useSessionsIntegration } from "@/lib/store/hooks";

type ChatSectionProps = {
  showConfigBar?: boolean;
};

export function ChatSection({ showConfigBar = true }: ChatSectionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { createSession } = useSessionsIntegration();

  const handleSubmit = useCallback(
    async (input: string, attachments: Attachment[], options: SubmitOptions) => {
      if (!input.trim() && attachments.length === 0) return;

      setIsLoading(true);

      try {
        const result = await createSession(input.slice(0, 100));
        if (!result.success || !result.session) throw new Error("Failed to create session");

        const session = result.session as Record<string, any>;

        // Store initial message, attachments, and model for the chat page
        sessionStorage.setItem(
          `chat-${session.id}-initial`,
          JSON.stringify({
            parts: [{ type: "text", text: input }],
            attachments: attachments.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type,
              size: a.size,
              mimeType: a.mimeType,
              url: a.url,
            })),
            model: options.model,
            skills: options.skills,
            connections: options.connections,
          })
        );

        router.push(`/chat/${session.id}`);
      } catch (error) {
        console.error("Failed to create chat:", error);
        setIsLoading(false);
      }
    },
    [router, createSession]
  );

  const handleCancel = useCallback(() => {
    setIsLoading(false);
  }, []);

  return (
    <div className="w-full flex justify-center">
      <ChatPrompt
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        disabled={isLoading}
        showQuickActions
        showConfigBar={showConfigBar}
        placeholder="Ask anything..."
      />
    </div>
  );
}
