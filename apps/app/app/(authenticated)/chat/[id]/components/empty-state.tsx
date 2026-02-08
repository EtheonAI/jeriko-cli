"use client";

import { SparklesIcon } from "lucide-react";
import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";

const STARTER_SUGGESTIONS = [
  "Search the web for the latest news",
  "Write a Python script to analyze data",
  "Help me draft a professional email",
  "Explain how machine learning works",
];

interface EmptyStateProps {
  onSuggestionClick: (suggestion: string) => void;
}

export function EmptyState({ onSuggestionClick }: EmptyStateProps) {
  return (
    <ConversationEmptyState
      icon={
        <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/10">
          <SparklesIcon className="size-7 text-violet-500" />
        </div>
      }
      title="How can I help you today?"
      description="Ask me anything. I can search the web, write code, analyze files, and more."
    >
      <div className="mt-4 flex flex-col items-center gap-4">
        <Suggestions className="justify-center px-4">
          {STARTER_SUGGESTIONS.map((suggestion) => (
            <Suggestion
              key={suggestion}
              onClick={onSuggestionClick}
              suggestion={suggestion}
            />
          ))}
        </Suggestions>
      </div>
    </ConversationEmptyState>
  );
}
