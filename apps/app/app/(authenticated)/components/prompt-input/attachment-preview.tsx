"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Progress } from "@repo/design-system/components/ui/progress";
import { cn } from "@repo/design-system/lib/utils";
import {
  FileIcon,
  FileImageIcon,
  FileTextIcon,
  FileAudioIcon,
  FileVideoIcon,
  XIcon,
  AlertCircleIcon,
} from "lucide-react";
import type { Attachment, AttachmentType } from "./types";

type AttachmentPreviewProps = {
  attachments: Attachment[];
  onRemove: (id: string) => void;
  className?: string;
};

const fileIcons: Record<AttachmentType, React.ReactNode> = {
  file: <FileIcon className="h-4 w-4" />,
  image: <FileImageIcon className="h-4 w-4" />,
  document: <FileTextIcon className="h-4 w-4" />,
  audio: <FileAudioIcon className="h-4 w-4" />,
  video: <FileVideoIcon className="h-4 w-4" />,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentItem({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove: () => void;
}) {
  const isImage = attachment.type === "image";
  const hasError = !!attachment.error;
  const isUploading = attachment.uploading;

  return (
    <div
      className={cn(
        "relative group flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50",
        "hover:bg-muted transition-colors",
        hasError && "border-destructive/50 bg-destructive/5"
      )}
    >
      {isImage && attachment.url ? (
        <div className="h-8 w-8 rounded overflow-hidden shrink-0">
          <img
            src={attachment.url}
            alt={attachment.name}
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded shrink-0",
            hasError ? "bg-destructive/10 text-destructive" : "bg-muted"
          )}
        >
          {hasError ? (
            <AlertCircleIcon className="h-4 w-4" />
          ) : (
            fileIcons[attachment.type]
          )}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.name}</p>
        {hasError ? (
          <p className="text-xs text-destructive truncate">{attachment.error}</p>
        ) : isUploading ? (
          <div className="flex items-center gap-2">
            <Progress value={attachment.progress} className="h-1 flex-1" />
            <span className="text-xs text-muted-foreground">
              {attachment.progress}%
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(attachment.size)}
          </p>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className={cn(
          "h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity",
          "hover:bg-background"
        )}
      >
        <XIcon className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function AttachmentPreview({
  attachments,
  onRemove,
  className,
}: AttachmentPreviewProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2 px-4 pb-2", className)}>
      {attachments.map((attachment) => (
        <AttachmentItem
          key={attachment.id}
          attachment={attachment}
          onRemove={() => onRemove(attachment.id)}
        />
      ))}
    </div>
  );
}
