"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import type { UIMessage, FileUIPart, TextUIPart } from "../../lib/types/ui-message";
import { FilePart } from "../parts/file-part";

export interface UserMessageProps {
  message: UIMessage;
  className?: string;
  user?: { name?: string | null; image?: string | null };
  onAction?: (action: string) => void;
  showAvatar?: boolean;
}

/**
 * UserMessage - Right-aligned user bubble, visually distinct from assistant.
 */
export function UserMessage({
  message,
  className,
  user,
  onAction,
  showAvatar = true,
}: UserMessageProps) {
  const textParts = message.parts.filter((p): p is TextUIPart => p.type === "text");
  const fileParts = message.parts.filter((p): p is FileUIPart => p.type === "file");
  const textContent = textParts.map((p) => p.text).join("");

  return (
    <div className={cn("flex justify-end", className)}>
      <div className="max-w-[85%] space-y-2">
        {/* File attachments */}
        {fileParts.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {fileParts.map((file, index) => (
              <FilePart key={`file-${index}`} part={file} compact />
            ))}
          </div>
        )}

        {/* Text bubble */}
        {textContent && (
          <div className="rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-7 text-primary-foreground whitespace-pre-wrap">
            {textContent}
          </div>
        )}
      </div>
    </div>
  );
}
