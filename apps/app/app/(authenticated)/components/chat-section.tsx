"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Attachment } from "@repo/ai/lib/types";
import { trpc } from "@/lib/trpc/client";
import { ChatPrompt, type SubmitOptions } from "./unified-prompt";
import { useAppDispatch } from "@/lib/store/hooks";
import { createAndSelectSession, type AgentSession } from "@/lib/store/slices/sessions.slice";

type ChatSectionProps = {
  showConfigBar?: boolean;
};

export function ChatSection({ showConfigBar = true }: ChatSectionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const dispatch = useAppDispatch();

  const utils = trpc.useUtils();
  const createSession = trpc.sessions.create.useMutation({
    onSuccess: () => {
      // Invalidate sessions list so sidebar picks up the new session
      utils.sessions.list.invalidate();
    },
  });

  const handleSubmit = useCallback(
    async (input: string, attachments: Attachment[], options: SubmitOptions) => {
      if (!input.trim() && attachments.length === 0) return;

      setIsLoading(true);

      try {
        const session = await createSession.mutateAsync({
          title: input.slice(0, 100),
        });

        // Update Redux session list so sidebar renders immediately
        const normalized: AgentSession = {
          ...(session as unknown as AgentSession),
          createdAt:
            typeof session.createdAt === "string"
              ? session.createdAt
              : new Date(session.createdAt).toISOString(),
          updatedAt:
            typeof session.updatedAt === "string"
              ? session.updatedAt
              : new Date(session.updatedAt).toISOString(),
          mode: (session as any).mode ?? "chat",
          isShared: (session as any).isShared ?? false,
          status: (session as any).status ?? "active",
        };
        dispatch(createAndSelectSession(normalized));

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
    [router, createSession, dispatch]
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
