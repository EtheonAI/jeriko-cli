"use client";

import {
  Message,
  MessageContent,
} from "@/components/ai-elements/message";
import { Loader2 } from "lucide-react";

interface ThinkingIndicatorProps {
  /** Label to display — defaults to "Thinking" */
  label?: string;
  /** Compact inline variant (no message wrapper) */
  inline?: boolean;
}

function ThinkingDots({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin text-primary/60" />
      <span className="animate-pulse">{label}</span>
    </div>
  );
}

export function ThinkingIndicator({ label, inline }: ThinkingIndicatorProps) {
  if (inline) {
    return (
      <div className="py-2">
        <ThinkingDots label={label} />
      </div>
    );
  }

  return (
    <Message from="assistant">
      <MessageContent>
        <ThinkingDots label={label} />
      </MessageContent>
    </Message>
  );
}
