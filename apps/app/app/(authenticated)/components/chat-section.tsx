"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createId } from "@paralleldrive/cuid2";
import type { MessagePart, Attachment } from "@repo/ai/lib/types";
import { RubicInput, type InputConfig } from "./rubic-input";

type ChatSectionProps = {
  showConfigBar?: boolean;
};

export function ChatSection({ showConfigBar = true }: ChatSectionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<InputConfig>({
    model: "cloud",
    agent: "agent",
    performance: "high",
    autoMode: false,
  });

  const handleSubmit = useCallback(
    async (parts: MessagePart[], attachments?: Attachment[], inputConfig?: InputConfig) => {
      const textPart = parts.find(
        (p): p is Extract<MessagePart, { type: "text" }> => p.type === "text"
      );
      const text = textPart?.text ?? "";

      if (!text.trim() && (!attachments || attachments.length === 0)) return;

      setIsLoading(true);

      try {
        const chatId = createId();

        // Store initial message and config in session storage for the chat page
        sessionStorage.setItem(
          `chat-${chatId}-initial`,
          JSON.stringify({
            parts,
            attachments:
              attachments?.map((a) => ({
                id: a.id,
                name: a.name,
                type: a.type,
                size: a.size,
                mimeType: a.mimeType,
                url: a.url,
              })) ?? [],
            config: inputConfig ?? config,
          })
        );

        router.push(`/chat/${chatId}`);
      } catch (error) {
        console.error("Failed to create chat:", error);
        setIsLoading(false);
      }
    },
    [router, config]
  );

  const handleCancel = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleConfigChange = useCallback((newConfig: InputConfig) => {
    setConfig(newConfig);
  }, []);

  const handleToolSelect = useCallback((tool: string) => {
    // Handle tool selection - can be extended for specific tool behaviors
    console.log("Tool selected:", tool);
  }, []);

  return (
    <div className="w-full flex justify-center">
      <RubicInput
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={isLoading}
        initialConfig={config}
        onConfigChange={handleConfigChange}
        onToolSelect={handleToolSelect}
        showConfigBar={showConfigBar}
      />
    </div>
  );
}
