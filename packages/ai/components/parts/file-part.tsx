"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@repo/design-system/components/ui/dialog";
import {
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileAudioIcon,
  FileVideoIcon,
  FileCodeIcon,
  FileArchiveIcon,
  FileSpreadsheetIcon,
  DownloadIcon,
  ExternalLinkIcon,
  EllipsisIcon,
  XIcon,
} from "lucide-react";
import type { FileUIPart } from "../../lib/types/ui-message";

export interface FilePartProps {
  part: FileUIPart;
  className?: string;
  compact?: boolean;
  onRemove?: () => void;
  /** When set, clicking the file card calls this instead of opening a new tab */
  onPreview?: (file: FileUIPart) => void;
}

// ============================================================================
// Manus-style file type icon colors
// ============================================================================

function getFileIconColor(mediaType: string): string {
  if (mediaType === "application/pdf") return "text-red-500";
  if (mediaType.includes("word") || mediaType.includes("document")) return "text-blue-500";
  if (mediaType.includes("sheet") || mediaType.includes("excel") || mediaType.includes("csv"))
    return "text-green-600";
  if (mediaType.includes("presentation") || mediaType.includes("powerpoint"))
    return "text-orange-500";
  if (mediaType.includes("html")) return "text-orange-400";
  if (mediaType.includes("javascript") || mediaType.includes("typescript"))
    return "text-yellow-500";
  if (mediaType.includes("json")) return "text-amber-500";
  if (mediaType.includes("css")) return "text-blue-400";
  if (mediaType.includes("python")) return "text-blue-600";
  if (mediaType.startsWith("image/")) return "text-purple-500";
  if (mediaType.startsWith("audio/")) return "text-pink-500";
  if (mediaType.startsWith("video/")) return "text-indigo-500";
  return "text-muted-foreground";
}

function getFileExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toUpperCase() : "";
}

// ============================================================================
// File card preview content — Manus uses scaled-down markdown
// We show type-appropriate preview placeholders
// ============================================================================

function FilePreview({ part, filename }: { part: FileUIPart; filename: string }) {
  const isImage = part.mediaType.startsWith("image/");
  const isPDF = part.mediaType === "application/pdf";
  const ext = getFileExtension(filename);

  // Images: show actual thumbnail
  if (isImage) {
    return (
      <div className="aspect-[16/9] overflow-hidden bg-muted/30">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={part.url} alt={filename} className="h-full w-full object-cover" loading="lazy" />
      </div>
    );
  }

  // PDFs: show embedded first page
  if (isPDF) {
    return (
      <div className="aspect-[16/9] overflow-hidden bg-muted/20">
        <iframe
          src={`${part.url}#toolbar=0&navpanes=0&scrollbar=0`}
          className="h-full w-full origin-top-left scale-75 pointer-events-none"
          title={filename}
          tabIndex={-1}
        />
      </div>
    );
  }

  // Code/text files: show placeholder with file type
  return (
    <div className="aspect-[16/9] flex items-center justify-center bg-muted/20">
      <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
        <span className="text-2xl font-semibold">{ext || "FILE"}</span>
        <span className="text-xs">{part.mediaType}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Ellipsis dropdown menu
// ============================================================================

function FileMenu({ url, filename }: { url: string; filename: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        aria-label="File actions"
      >
        <EllipsisIcon className="size-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            onKeyDown={() => {}}
            role="presentation"
          />
          {/* Menu */}
          <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-popover p-1 shadow-md">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <ExternalLinkIcon className="size-3.5" />
              Open
            </a>
            <a
              href={url}
              download={filename}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              <DownloadIcon className="size-3.5" />
              Download
            </a>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

/**
 * FilePart — Manus-style file card with header + preview area.
 * Compact mode for user message attachments, full card for assistant files.
 */
export function FilePart({ part, className, compact = false, onRemove, onPreview }: FilePartProps) {
  const isImage = part.mediaType.startsWith("image/");
  const isAudio = part.mediaType.startsWith("audio/");
  const isVideo = part.mediaType.startsWith("video/");

  const iconColor = getFileIconColor(part.mediaType);
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
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={part.url} alt={filename} className="size-5 rounded object-cover" />
        ) : (
          <FileTypeIcon mediaType={part.mediaType} className={cn("size-4", iconColor)} />
        )}
        <span className="max-w-[120px] truncate text-xs">{filename}</span>
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

  // Full image — use onPreview modal when provided, otherwise inline Dialog lightbox
  if (isImage) {
    if (onPreview) {
      return (
        <button
          type="button"
          onClick={() => onPreview(part)}
          className={cn(
            "group relative overflow-hidden rounded-xl border border-border/50 transition-colors hover:border-border",
            className
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
      );
    }
    return (
      <Dialog>
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "group relative overflow-hidden rounded-xl border border-border/50 transition-colors hover:border-border",
              className
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
          <DialogTitle className="sr-only">{filename}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={part.url} alt={filename} className="max-h-[80vh] w-full object-contain" />
        </DialogContent>
      </Dialog>
    );
  }

  // Audio player
  if (isAudio) {
    return (
      <div className={cn("rounded-xl border border-border/50 bg-card p-3", className)}>
        <div className="mb-2 flex items-center gap-2">
          <FileAudioIcon className={cn("size-5", iconColor)} />
          <span className="text-sm font-medium">{filename}</span>
        </div>
        <audio controls className="w-full" preload="metadata">
          <source src={part.url} type={part.mediaType} />
          Your browser does not support the audio element.
        </audio>
      </div>
    );
  }

  // Video player
  if (isVideo) {
    return (
      <div className={cn("overflow-hidden rounded-xl border border-border/50", className)}>
        <video controls className="max-h-80 w-full" preload="metadata">
          <source src={part.url} type={part.mediaType} />
          Your browser does not support the video element.
        </video>
        <div className="flex items-center gap-2 border-t border-border/50 bg-card px-3 py-2">
          <FileVideoIcon className={cn("size-4", iconColor)} />
          <span className="text-sm">{filename}</span>
        </div>
      </div>
    );
  }

  // ======================================================================
  // Manus-style file card: header + preview area
  // ======================================================================
  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card",
        className
      )}
    >
      {/* Header: icon + filename + ellipsis menu */}
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-3">
        <FileTypeIcon
          mediaType={part.mediaType}
          className={cn("size-5 flex-shrink-0", iconColor)}
        />
        <span className="flex-1 min-w-0 text-sm font-medium truncate">{filename}</span>
        <FileMenu url={part.url} filename={filename} />
      </div>

      {/* Preview area — Manus aspect-[16/9] scaled content */}
      {onPreview ? (
        <button
          type="button"
          onClick={() => onPreview(part)}
          className="block w-full text-left transition-opacity hover:opacity-80"
        >
          <FilePreview part={part} filename={filename} />
        </button>
      ) : (
        <a
          href={part.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block transition-opacity hover:opacity-80"
        >
          <FilePreview part={part} filename={filename} />
        </a>
      )}
    </div>
  );
}

// ============================================================================
// Icon mapping
// ============================================================================

function FileTypeIcon({ mediaType, className }: { mediaType: string; className?: string }) {
  return React.createElement(getFileIcon(mediaType), { className });
}

function getFileIcon(mediaType: string) {
  if (mediaType.startsWith("image/")) return FileImageIcon;
  if (mediaType.startsWith("audio/")) return FileAudioIcon;
  if (mediaType.startsWith("video/")) return FileVideoIcon;
  if (mediaType === "application/pdf") return FileTextIcon;
  if (mediaType.includes("sheet") || mediaType.includes("excel") || mediaType.includes("csv"))
    return FileSpreadsheetIcon;
  if (
    mediaType.includes("javascript") ||
    mediaType.includes("typescript") ||
    mediaType.includes("json") ||
    mediaType.includes("xml") ||
    mediaType.includes("html") ||
    mediaType.includes("css") ||
    mediaType.includes("python")
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
