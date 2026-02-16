"use client";

import { CopyIcon, RefreshCcwIcon } from "lucide-react";
import { MessageAction, MessageActions } from "@/components/ai-elements/message";

interface MessageActionsBarProps {
  fullText: string;
  isLastMessage: boolean;
  onCopy: (text: string) => void;
  onRegenerate: () => void;
}

export function MessageActionsBar({
  fullText,
  isLastMessage,
  onCopy,
  onRegenerate,
}: MessageActionsBarProps) {
  return (
    <MessageActions>
      <MessageAction tooltip="Copy" label="Copy" onClick={() => onCopy(fullText)}>
        <CopyIcon className="size-3" />
      </MessageAction>

      {isLastMessage && (
        <MessageAction tooltip="Regenerate" label="Regenerate" onClick={onRegenerate}>
          <RefreshCcwIcon className="size-3" />
        </MessageAction>
      )}
    </MessageActions>
  );
}
