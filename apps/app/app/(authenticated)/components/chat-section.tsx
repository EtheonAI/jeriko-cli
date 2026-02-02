"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PromptInput } from "@repo/ai/components/prompt-input";
import type { MessagePart, Attachment } from "@repo/ai/lib/types";
import { ConnectToolsBanner } from "./prompt-input/connect-tools-banner";

type ChatSectionProps = {
  showConnectBanner?: boolean;
  showTitle?: boolean;
  title?: string;
};

export function ChatSection({
  showConnectBanner = true,
  showTitle = true,
  title = "What can I help with?",
}: ChatSectionProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handleSubmit = async (parts: MessagePart[], attachments?: Attachment[]) => {
    const textPart = parts.find((p): p is Extract<MessagePart, { type: 'text' }> => p.type === 'text');
    const text = textPart?.text ?? '';

    if (!text.trim() && (!attachments || attachments.length === 0)) return;

    setIsLoading(true);

    try {
      const chatId = Math.random().toString(36).substring(2, 15);

      sessionStorage.setItem(`chat-${chatId}-initial`, JSON.stringify({
        parts,
        attachments: attachments?.map(a => ({
          id: a.id,
          name: a.name,
          type: a.type,
          size: a.size,
          mimeType: a.mimeType,
          url: a.url,
        })) ?? [],
      }));

      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setIsLoading(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-0">
      <PromptInput
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        loading={isLoading}
        showTitle={showTitle}
        title={title}
        showVoice
        showAttachments
        showSuggestions={false}
        animatedPlaceholders={[
          'Ask anything...',
          'Write code for a landing page',
          'Help me debug this error',
          'Create a marketing strategy',
          'Design a database schema',
          'Analyze my data',
          'Research a topic',
          'Plan a project timeline',
          'Summarize this document',
          'Generate ideas for...',
        ]}
      />
      {showConnectBanner && !bannerDismissed && (
        <ConnectToolsBanner
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
    </div>
  );
}
