"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
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
  DownloadIcon,
  XIcon,
} from "lucide-react";
import type { FileUIPart } from "../../lib/types/ui-message";

// ============================================================================
// Types
// ============================================================================

export type AttachmentsVariant = "grid" | "inline" | "list";

export interface AttachmentsGridProps {
  files: FileUIPart[];
  variant?: AttachmentsVariant;
  className?: string;
  onRemove?: (index: number) => void;
}

// ============================================================================
// Component
// ============================================================================

export function AttachmentsGrid({
  files,
  variant = "grid",
  className,
  onRemove,
}: AttachmentsGridProps) {
  if (files.length === 0) return null;

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-wrap gap-1.5", className)}>
        {files.map((file, i) => (
          <InlineAttachment
            key={i}
            file={file}
            onRemove={onRemove ? () => onRemove(i) : undefined}
          />
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-1", className)}>
        {files.map((file, i) => (
          <ListAttachment
            key={i}
            file={file}
            onRemove={onRemove ? () => onRemove(i) : undefined}
          />
        ))}
      </div>
    );
  }

  // Grid variant
  const images = files.filter((f) => f.mediaType.startsWith("image/"));
  const others = files.filter((f) => !f.mediaType.startsWith("image/"));

  return (
    <div className={cn("space-y-2", className)}>
      {/* Image grid */}
      {images.length > 0 && (
        <div
          className={cn(
            "grid gap-2",
            images.length === 1 && "grid-cols-1",
            images.length === 2 && "grid-cols-2",
            images.length >= 3 && "grid-cols-3"
          )}
        >
          {images.map((file, i) => (
            <GridImage
              key={i}
              file={file}
              onRemove={onRemove ? () => onRemove(files.indexOf(file)) : undefined}
            />
          ))}
        </div>
      )}

      {/* Other files */}
      {others.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {others.map((file, i) => (
            <InlineAttachment
              key={i}
              file={file}
              onRemove={onRemove ? () => onRemove(files.indexOf(file)) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Grid Image
// ============================================================================

function GridImage({
  file,
  onRemove,
}: {
  file: FileUIPart;
  onRemove?: () => void;
}) {
  return (
    <Dialog>
      <div className="group relative">
        <DialogTrigger asChild>
          <button
            type="button"
            className="block w-full overflow-hidden rounded-lg border border-border/50 transition-colors hover:border-border"
          >
            <img
              src={file.url}
              alt={file.filename ?? "Image"}
              className="aspect-video w-full object-cover"
              loading="lazy"
            />
          </button>
        </DialogTrigger>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          >
            <XIcon className="size-3" />
          </button>
        )}
      </div>
      <DialogContent className="max-w-4xl">
        <img
          src={file.url}
          alt={file.filename ?? "Image"}
          className="max-h-[80vh] w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Inline Attachment
// ============================================================================

function InlineAttachment({
  file,
  onRemove,
}: {
  file: FileUIPart;
  onRemove?: () => void;
}) {
  const Icon = getFileIcon(file.mediaType);
  const isImage = file.mediaType.startsWith("image/");

  return (
    <div className="group relative flex items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-2 py-1">
      {isImage ? (
        <img
          src={file.url}
          alt={file.filename ?? ""}
          className="size-4 rounded object-cover"
        />
      ) : (
        <Icon className="size-3.5 text-muted-foreground/60" />
      )}
      <span className="max-w-[100px] truncate text-xs text-foreground/70">
        {file.filename ?? "File"}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 flex size-3.5 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <XIcon className="size-2.5" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// List Attachment
// ============================================================================

function ListAttachment({
  file,
  onRemove,
}: {
  file: FileUIPart;
  onRemove?: () => void;
}) {
  const Icon = getFileIcon(file.mediaType);

  return (
    <div className="group flex items-center gap-2.5 rounded-lg border border-border/40 px-2.5 py-2 transition-colors hover:bg-muted/20">
      <div className="flex size-8 items-center justify-center rounded-md bg-muted/50">
        <Icon className="size-4 text-muted-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm text-foreground/80">
          {file.filename ?? "File"}
        </span>
        <span className="block text-xs text-muted-foreground/40">
          {file.mediaType}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <a
          href={file.url}
          download={file.filename}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <DownloadIcon className="size-3.5" />
        </a>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <XIcon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

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
  return FileIcon;
}
