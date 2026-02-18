"use client";

import { SparklesIcon } from "lucide-react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";

export function EmptyState() {
  return (
    <ConversationEmptyState
      icon={
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10">
          <SparklesIcon className="size-7 text-violet-500" />
        </div>
      }
      title="What can I help you with?"
      description="I can search the web, write code, manage files, control devices, and more."
    />
  );
}
