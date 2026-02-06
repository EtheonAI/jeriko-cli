"use client";

import type { Attachment } from "@repo/ai/lib/types";
import { FileIcon, ImageIcon, FileTextIcon, XIcon } from "lucide-react";

interface AttachmentRowProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

function getIcon(type: string) {
  switch (type) {
    case "image":
      return ImageIcon;
    case "document":
      return FileTextIcon;
    default:
      return FileIcon;
  }
}

export function AttachmentRow({ attachments, onRemove }: AttachmentRowProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map((attachment) => {
        const Icon = getIcon(attachment.type);
        return (
          <div
            key={attachment.id}
            className="relative group flex items-center gap-2 px-2.5 py-1.5 bg-muted rounded-lg"
          >
            {attachment.thumbnailUrl ? (
              <img
                src={attachment.thumbnailUrl}
                alt={attachment.name}
                className="size-6 rounded object-cover"
              />
            ) : (
              <Icon className="size-4 text-muted-foreground" />
            )}
            <span className="text-xs text-foreground max-w-[100px] truncate">
              {attachment.name}
            </span>
            {attachment.status === "uploading" && attachment.progress != null && (
              <span className="text-[10px] text-muted-foreground">{attachment.progress}%</span>
            )}
            <button
              type="button"
              onClick={() => onRemove(attachment.id)}
              className="size-4 flex items-center justify-center rounded-full bg-muted-foreground/20 hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <XIcon className="size-2.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
