"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Attachment } from "@repo/ai/lib/types";
import { ChatPrompt, type SubmitOptions } from "../../../components/unified-prompt";
import { useSessionsIntegration } from "@/lib/store/hooks";
import { getTrpcClient } from "@/lib/trpc/vanilla";

type ProjectChatSectionProps = {
  projectId: string;
  projectName: string;
};

export function ProjectChatSection({ projectId, projectName }: ProjectChatSectionProps) {
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

        // Link session to project
        const client = getTrpcClient();
        await client.projects.addSession.mutate({
          projectId,
          sessionId: session.id,
        });

        // Store initial message with projectId for the chat page
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
            projectId,
          })
        );

        router.push(`/chat/${session.id}`);
      } catch (error) {
        console.error("Failed to create chat:", error);
        setIsLoading(false);
      }
    },
    [router, createSession, projectId]
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
        showQuickActions={false}
        showConfigBar
        placeholder={`Ask anything in ${projectName}...`}
      />
    </div>
  );
}
