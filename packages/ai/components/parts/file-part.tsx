"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import {
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileAudioIcon,
  FileVideoIcon,
  FileCodeIcon,
  FileArchiveIcon,
  DownloadIcon,
  ExternalLinkIcon,
  XIcon,
} from "lucide-react";
import type { FileUIPart } from "../../lib/types/ui-message";

export interface FilePartProps {
  part: FileUIPart;
  className?: string;
  compact?: boolean;
  onRemove?: () => void;
}

/**
 * FilePart - Renders file attachments with preview support
 */
export function FilePart({
  part,
  className,
  compact = false,
  onRemove,
}: FilePartProps) {
  const isImage = part.mediaType.startsWith("image/");
  const isAudio = part.mediaType.startsWith("audio/");
  const isVideo = part.mediaType.startsWith("video/");
  const isPDF = part.mediaType === "application/pdf";

  const Icon = getFileIcon(part.mediaType);
  const filename = part.filename ?? "file";

  // Compact chip for user messages
  if (compact) {
    return (
      <div
        className={cn(
          "group relative flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5",
          className
        )}
      >
        {isImage ? (
          <img
            src={part.url}
            alt={filename}
            className="size-5 rounded object-cover"
          />
        ) : (
          <Icon className="size-4 text-muted-foreground" />
        )}
        <span className="max-w-[120px] truncate text-xs">
          {filename}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
          >
            <XIcon className="size-2.5" />
          </button>
        )}
      </div>
    );
  }

  // Full preview for assistant messages
  if (isImage) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "group relative overflow-hidden rounded-lg border border-border transition-colors hover:border-primary/50",
              className
            )}
          >
            <img
              src={part.url}
              alt={filename}
              className="max-h-64 max-w-full object-contain"
              loading="lazy"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <ExternalLinkIcon className="size-6 text-white" />
            </div>
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl">
          <img
            src={part.url}
            alt={filename}
            className="max-h-[80vh] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    );
  }

  if (isAudio) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/50 p-3",
          className
        )}
      >
        <div className="mb-2 flex items-center gap-2">
          <FileAudioIcon className="size-5 text-muted-foreground" />
          <span className="text-sm font-medium">{filename}</span>
        </div>
        <audio controls className="w-full" preload="metadata">
          <source src={part.url} type={part.mediaType} />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className={cn("overflow-hidden rounded-lg border border-border", className)}>
        <video
          controls
          className="max-h-80 w-full"
          preload="metadata"
        >
          <source src={part.url} type={part.mediaType} />
          Your browser does not support the video element.
        </video>
        <div className="flex items-center gap-2 border-t border-border bg-muted/50 px-3 py-2">
          <FileVideoIcon className="size-4 text-muted-foreground" />
          <span className="text-sm">{filename}</span>
        </div>
      </div>
    );
  }

  if (isPDF) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border bg-muted/50",
          className
        )}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-2">
            <FileTextIcon className="size-5 text-red-500" />
            <span className="text-sm font-medium">{filename}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              asChild
            >
              <a href={part.url} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon className="size-4" />
              </a>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              asChild
            >
              <a href={part.url} download={filename}>
                <DownloadIcon className="size-4" />
              </a>
            </Button>
          </div>
        </div>
        <div className="border-t border-border">
          <iframe
            src={`${part.url}#toolbar=0`}
            className="h-96 w-full"
            title={filename}
          />
        </div>
      </div>
    );
  }

  // Generic file
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-muted-foreground" />
        <div className="flex flex-col">
          <span className="text-sm font-medium">{filename}</span>
          <span className="text-xs text-muted-foreground">
            {part.mediaType}
          </span>
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        asChild
      >
        <a href={part.url} download={filename}>
          <DownloadIcon className="size-4" />
        </a>
      </Button>
    </div>
  );
}

function getFileIcon(mediaType: string) {
  if (mediaType.startsWith("image/")) return FileImageIcon;
  if (mediaType.startsWith("audio/")) return FileAudioIcon;
  if (mediaType.startsWith("video/")) return FileVideoIcon;
  if (mediaType === "application/pdf") return FileTextIcon;
  if (
    mediaType.includes("javascript") ||
    mediaType.includes("typescript") ||
    mediaType.includes("json") ||
    mediaType.includes("xml") ||
    mediaType.includes("html") ||
    mediaType.includes("css")
  ) {
    return FileCodeIcon;
  }
  if (
    mediaType.includes("zip") ||
    mediaType.includes("rar") ||
    mediaType.includes("tar") ||
    mediaType.includes("gzip")
  ) {
    return FileArchiveIcon;
  }
  return FileIcon;
}
