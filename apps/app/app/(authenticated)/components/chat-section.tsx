"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Attachment } from "@repo/ai/lib/types";
import { trpc } from "@/lib/trpc/client";
import { UnifiedPrompt, type SubmitOptions } from "./unified-prompt";

type ChatSectionProps = {
  showConfigBar?: boolean;
};

export function ChatSection({ showConfigBar = true }: ChatSectionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const createSession = trpc.sessions.create.useMutation();

  const handleSubmit = useCallback(
    async (input: string, attachments: Attachment[], options: SubmitOptions) => {
      if (!input.trim() && attachments.length === 0) return;

      setIsLoading(true);

      try {
        const session = await createSession.mutateAsync({
          title: input.slice(0, 100),
        });

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
      <UnifiedPrompt
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
