"use client";

import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";

export function ThinkingIndicator() {
  return (
    <Message from="assistant">
      <MessageContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <span className="animate-bounce delay-0">.</span>
            <span className="animate-bounce delay-100">.</span>
            <span className="animate-bounce delay-200">.</span>
          </div>
          <span>Thinking</span>
        </div>
      </MessageContent>
    </Message>
  );
}
