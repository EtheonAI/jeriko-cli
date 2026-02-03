"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/ui/avatar";
import { Button } from "@repo/design-system/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { MoreHorizontalIcon, PencilIcon, CopyIcon, TrashIcon, UserIcon } from "lucide-react";
import type { UIMessage, FileUIPart, TextUIPart } from "../../lib/types/ui-message";
import { FilePart } from "../parts/file-part";

export interface UserMessageProps {
  message: UIMessage;
  className?: string;
  user?: {
    name?: string | null;
    image?: string | null;
  };
  onAction?: (action: string) => void;
  showAvatar?: boolean;
}

/**
 * UserMessage - Renders user messages with attachments
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

  const handleCopy = () => {
    navigator.clipboard.writeText(textContent);
    onAction?.("copy");
  };

  return (
    <div className={cn("group flex justify-end gap-3", className)}>
      {/* Actions */}
      <div className="flex items-start opacity-0 transition-opacity group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAction?.("edit")}>
              <PencilIcon className="mr-2 size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopy}>
              <CopyIcon className="mr-2 size-4" />
              Copy
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onAction?.("delete")}
              className="text-destructive"
            >
              <TrashIcon className="mr-2 size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Message content */}
      <div className="flex max-w-[80%] flex-col items-end gap-2">
        {/* File attachments */}
        {fileParts.length > 0 && (
          <div className="flex flex-wrap justify-end gap-2">
            {fileParts.map((file, index) => (
              <FilePart
                key={`${message.id}-file-${index}`}
                part={file}
                compact
              />
            ))}
          </div>
        )}

        {/* Text content */}
        {textContent && (
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground">
            <p className="whitespace-pre-wrap text-sm">{textContent}</p>
          </div>
        )}

        {/* Timestamp */}
        {message.createdAt && (
          <span className="text-xs text-muted-foreground">
            {formatTime(message.createdAt)}
          </span>
        )}
      </div>

      {/* Avatar */}
      {showAvatar && (
        <Avatar className="size-8 flex-shrink-0">
          <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
          <AvatarFallback>
            <UserIcon className="size-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}
