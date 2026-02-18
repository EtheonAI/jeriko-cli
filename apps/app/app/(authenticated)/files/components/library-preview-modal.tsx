"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@repo/design-system/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  DownloadIcon,
  EllipsisIcon,
  Maximize2Icon,
  Minimize2Icon,
  XIcon,
  ExternalLinkIcon,
  CopyIcon,
  StarIcon,
  Loader2Icon,
  FileClockIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import type { LibraryFile } from "./library-file-card";
import { DownloadFormatPicker } from "./download-format-picker";
import { LibraryShareDialog } from "./library-share-dialog";
import { formatDistanceToNow, format } from "date-fns";
import { useAppDispatch, useFilePreviewer, useLibraryData } from "@/lib/store/hooks";
import {
  setPreviewData,
  setFullscreen as setReduxFullscreen,
  closePreview,
} from "@/lib/store/slices/filePreviewer.slice";

// ============================================================================
// Main Preview Modal — Manus exact: Slate-style rich markdown for ALL text
// Header: [Share Download] ... gap ... [Three-dots Maximize Close]
// Content: md:px-24 pl-4 pr-9 py-5, max-w-178, text-base leading-normal
// ============================================================================

interface LibraryPreviewModalProps {
  file: LibraryFile | null;
  onClose: () => void;
  onLocateInTask?: (file: LibraryFile) => void;
  onFavorite?: (file: LibraryFile) => void;
  /** Inline content from chat tool parts — skips DB fetch when provided */
  inlineContent?: string | null;
}

export function LibraryPreviewModal({ file, onClose, onLocateInTask, onFavorite, inlineContent }: LibraryPreviewModalProps) {
  const dispatch = useAppDispatch();
  const { fullscreen } = useFilePreviewer();
  const [showShare, setShowShare] = useState(false);
  const [showDownload, setShowDownload] = useState(false);

  const setFullscreen = useCallback((val: boolean) => {
    dispatch(setReduxFullscreen(val));
  }, [dispatch]);

  const { getContent } = useLibraryData({ autoFetch: false });

  // Only fetch full text content for text files (modal needs full content, not just 3KB preview)
  const isTextFile =
    file?.mimeType?.startsWith("text/") ||
    file?.mimeType === "application/json" ||
    file?.mimeType?.includes("javascript") ||
    file?.mimeType?.includes("typescript") ||
    file?.mimeType?.includes("python");

  // Skip DB fetch if inline content is provided (from chat tool parts)
  const hasInlineContent = !!inlineContent;

  const [contentData, setContentData] = useState<{ content?: string; url?: string } | null>(null);
  const [isResolvingContent, setIsResolvingContent] = useState(false);

  useEffect(() => {
    if (!file?.id || !isTextFile || hasInlineContent) {
      setContentData(null);
      return;
    }
    setIsResolvingContent(true);
    getContent(file.id)
      .then((data) => setContentData(data as any))
      .catch(() => setContentData(null))
      .finally(() => setIsResolvingContent(false));
  }, [file?.id, isTextFile, hasInlineContent, getContent]);

  // For text files, use getContent response. For others, use enriched resolvedUrl from listBySession.
  const resolvedUrl = contentData?.url ?? file?.resolvedUrl ?? null;

  // When opened from chat (no DB id), fetch text content directly from URL
  const [fetchedContent, setFetchedContent] = useState<string | null>(null);
  useEffect(() => {
    if (!file || !isTextFile || inlineContent || contentData?.content || file.id) return;
    const url = file.resolvedUrl;
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => r.ok ? r.text() : null)
      .then((text) => { if (!cancelled && text) setFetchedContent(text); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [file, file?.resolvedUrl, isTextFile, inlineContent, contentData?.content, file?.id]);

  // Reset fetched content when file changes
  useEffect(() => { setFetchedContent(null); }, [file?.id, file?.resolvedUrl]);

  const content = inlineContent ?? contentData?.content ?? fetchedContent ?? null;

  // Sync preview data to Redux when file changes
  useEffect(() => {
    if (!file) {
      setShowShare(false);
      setShowDownload(false);
      dispatch(closePreview());
      return;
    }
    const url = resolvedUrl;
    if (url) {
      dispatch(setPreviewData({
        url,
        mimeType: file.mimeType || "text/plain",
        fileName: file.name,
        fileSize: file.size ?? undefined,
      }));
    }
  }, [file, resolvedUrl, dispatch]);

  const handleClose = useCallback(() => {
    dispatch(closePreview());
    onClose();
  }, [onClose, dispatch]);

  // Last modified label — Manus exact format
  const lastModifiedLabel = file
    ? (() => {
        try {
          const d = new Date(file.updatedAt);
          const now = new Date();
          const diff = now.getTime() - d.getTime();
          if (diff < 60000) return "Last modified: just now";
          if (diff < 86400000) return `Last modified: ${format(d, "HH:mm")} Today`;
          return `Last modified: ${format(d, "HH:mm")} ${formatDistanceToNow(d, { addSuffix: false })} ago`;
        } catch {
          return "";
        }
      })()
    : "";

  if (!file) return null;

  const isImage = file.mimeType?.startsWith("image/");
  const isPDF = file.mimeType === "application/pdf";
  const isVideo = file.mimeType?.startsWith("video/");
  const isAudio = file.mimeType?.startsWith("audio/");
  const fileUrl = resolvedUrl;

  return (
    <>
      <Dialog open={!!file} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "p-0 gap-0 border-0 overflow-hidden bg-card",
            fullscreen
              ? "w-screen h-screen max-w-none sm:max-w-none rounded-none"
              : "md:w-[calc(100vw-80px)] md:h-[calc(100vh-80px)] w-[calc(100vw-32px)] h-[calc(100vh-32px)] max-w-300 sm:max-w-300 rounded-2xl"
          )}
        >
          <DialogTitle className="sr-only">{file.name}</DialogTitle>

          {/* ================================================================ */}
          {/* Header — Manus exact layout from file-modal.html */}
          {/* Mobile: flex-col-reverse, Desktop: flex-row */}
          {/* ================================================================ */}
          <div className="px-4 pt-2 pb-3 gap-4 flex items-center justify-between shrink-0 border-b border-border flex-col-reverse md:flex-row md:py-3">
            {/* Left: icon + filename column */}
            <div className="flex justify-between self-stretch flex-1 truncate">
              <div className="flex flex-row gap-1 items-center text-muted-foreground font-medium truncate [&_svg]:shrink-0">
                <a href="" className="p-1 shrink-0 cursor-default" target="_blank" rel="noreferrer">
                  <FileTypeIcon mimeType={file.mimeType} />
                </a>
                <div className="truncate flex flex-col text-foreground">
                  <span className="truncate" title={file.name}>{file.name}</span>
                  <span className="truncate text-muted-foreground text-xs" title={lastModifiedLabel}>
                    {lastModifiedLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: action buttons — Manus: two groups with justify-between */}
            <div className="flex items-center justify-between gap-2 w-full py-3 md:w-auto md:py-0 select-none">
              {/* Group 1: Share + Download */}
              <div className="flex items-center gap-2">
                <ModalHeaderButton
                  onClick={() => setShowShare(true)}
                  label="Share"
                >
                  <ShareArrowIcon />
                </ModalHeaderButton>
                <div className="relative">
                  <ModalHeaderButton
                    onClick={() => setShowDownload(!showDownload)}
                    label="Download"
                  >
                    <DownloadIcon className="size-4.5 text-muted-foreground" />
                  </ModalHeaderButton>
                  {showDownload && (
                    <DownloadFormatPicker
                      file={file}
                      content={content}
                      onClose={() => setShowDownload(false)}
                    />
                  )}
                </div>
              </div>

              {/* Group 2: Three-dots + Maximize + Close */}
              <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex size-7 items-center justify-center cursor-pointer rounded-md hover:bg-muted transition-colors"
                    >
                      <EllipsisIcon className="size-4.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-62">
                    {onLocateInTask && file.sessionId && (
                      <DropdownMenuItem
                        onClick={() => {
                          handleClose();
                          onLocateInTask(file);
                        }}
                      >
                        <ExternalLinkIcon className="mr-2 size-4" />
                        Locate in task
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        if (content) {
                          navigator.clipboard.writeText(content);
                          toast.success("Content copied");
                        }
                      }}
                    >
                      <CopyIcon className="mr-2 size-4" />
                      Copy
                    </DropdownMenuItem>
                    {onFavorite && (
                      <DropdownMenuItem
                        onClick={() => {
                          onFavorite(file);
                        }}
                      >
                        <StarIcon className="mr-2 size-4" />
                        Add to favorite
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem>
                      <FileClockIcon className="mr-2 size-4" />
                      History
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => toast.info("Google Docs integration coming soon")}
                    >
                      <GoogleDocsModalIcon />
                      Edit in Google Docs
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ModalHeaderButton
                  onClick={() => setFullscreen(!fullscreen)}
                  label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                >
                  {fullscreen ? (
                    <Minimize2Icon className="size-4.5 text-muted-foreground" />
                  ) : (
                    <Maximize2Icon className="size-4.5 text-muted-foreground" />
                  )}
                </ModalHeaderButton>
                <ModalHeaderButton onClick={handleClose} label="Close">
                  <XIcon className="size-5 text-muted-foreground" />
                </ModalHeaderButton>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* Content Area — Manus: ALL text rendered as rich markdown */}
          {/* Padding: md:px-[96px] pl-[16px] pr-[36px] py-[20px] */}
          {/* Max width: 712px, text-[16px] leading-normal */}
          {/* ================================================================ */}
          <div className="flex flex-1 min-h-0 w-full relative">
            <div className="flex-1 min-h-0 w-full flex justify-center p-0!">
              <div className="overflow-auto relative w-full md:px-24 pl-4 pr-9 py-5">
                <div
                  className="relative w-full text-base leading-normal text-foreground max-w-178 mx-auto"
                  style={{ minHeight: "calc(100vh - 200px)" }}
                >
                  {isResolvingContent ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : content ? (
                    /* ALL text content → markdown preview (Manus behavior) */
                    <MarkdownPreview content={content} />
                  ) : isImage && fileUrl ? (
                    <ImagePreview url={fileUrl} alt={file.name} />
                  ) : isPDF && fileUrl ? (
                    <PDFPreview url={fileUrl} title={file.name} />
                  ) : isVideo && fileUrl ? (
                    <VideoPreview url={fileUrl} type={file.mimeType || ""} />
                  ) : isAudio && fileUrl ? (
                    <AudioPreview url={fileUrl} type={file.mimeType || ""} />
                  ) : (
                    <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
                      <p>Preview not available for this file type</p>
                      {fileUrl && (
                        <a
                          href={fileUrl}
                          download={file.name}
                          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
                        >
                          <DownloadIcon className="size-4" />
                          Download
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share dialog */}
      {showShare && file && (
        <LibraryShareDialog
          file={file}
          open={showShare}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}

// ============================================================================
// Markdown Preview — Manus: Slate-style rich text rendering
// All text files rendered through this single renderer
// ============================================================================

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="rubic-markdown max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          /* Manus code block: header bar (language + copy) + code area */
          pre({ children, ...props }: React.ComponentProps<"pre">) {
            return (
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <div className="h-9 pe-4 flex items-center justify-between select-none border-b border-border/50">
                  <div className="flex items-center h-10 px-4 gap-1">
                    <span className="text-foreground text-sm leading-5">Plain Text</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const el = children as React.ReactElement<{ children?: string }>;
                      const text = el?.props?.children;
                      if (typeof text === "string") {
                        navigator.clipboard.writeText(text);
                        toast.success("Code copied");
                      }
                    }}
                    className="flex size-7 items-center justify-center cursor-pointer rounded-md hover:bg-muted"
                  >
                    <CopyIcon className="size-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="p-4 text-sm text-foreground overflow-x-auto" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
                  <pre className="m-0! bg-transparent! border-0! p-0! rounded-none!" {...props}>{children}</pre>
                </div>
              </div>
            );
          },
          /* Manus inline code: 85% size, rounded, muted bg */
          code({ className, children, ...props }: React.ComponentProps<"code">) {
            return (
              <code className={cn(className, "text-[85%] rounded px-[0.4em] py-[0.2em] bg-muted")} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

// ============================================================================
// Media Renderers — only for non-text types
// ============================================================================

function ImagePreview({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="flex items-center justify-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="max-h-[70vh] max-w-full rounded-lg object-contain" />
    </div>
  );
}

function PDFPreview({ url, title }: { url: string; title: string }) {
  return <iframe src={url} title={title} className="w-full h-[calc(100vh-200px)] rounded-lg border" />;
}

function VideoPreview({ url, type }: { url: string; type: string }) {
  return (
    <video controls className="max-h-[70vh] w-full rounded-lg">
      <source src={url} type={type} />
    </video>
  );
}

function AudioPreview({ url, type }: { url: string; type: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <audio controls className="w-full max-w-md">
        <source src={url} type={type} />
      </audio>
    </div>
  );
}

// ============================================================================
// Header button — Manus: h-7 w-7, rounded-md, hover:bg-muted
// ============================================================================

function ModalHeaderButton({
  children,
  onClick,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex size-7 items-center justify-center cursor-pointer rounded-md hover:bg-muted transition-colors"
      title={label}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Manus Share arrow icon (custom SVG from file-modal.html)
// ============================================================================

function ShareArrowIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 18 18" fill="none" width="16" height="16" className="text-muted-foreground size-4.5">
      <path
        d="M9.44678 1.92167C9.90519 1.76531 10.3033 1.98157 10.511 2.11796C10.7471 2.27305 11.0194 2.51595 11.2991 2.76322L14.614 5.69364L15.5522 6.51908C15.8505 6.78232 16.1272 7.03026 16.3608 7.25151C16.5947 7.47292 16.8095 7.68955 16.9702 7.88652C17.0503 7.98467 17.1323 8.0959 17.1973 8.21464C17.2549 8.32004 17.3415 8.5067 17.3416 8.73686C17.3416 8.96637 17.2552 9.15278 17.1973 9.25907C17.1323 9.37818 17.0504 9.4896 16.9702 9.58793C16.8093 9.78529 16.5947 10.0024 16.3608 10.2237C16.1272 10.4447 15.8499 10.6922 15.5515 10.9554L14.614 11.7801L11.2991 14.7105C11.0194 14.9578 10.7471 15.2007 10.511 15.3558C10.2894 15.5012 9.85081 15.7376 9.35376 15.5154V15.5147C8.8556 15.2917 8.74069 14.8068 8.70264 14.5442C8.66217 14.2649 8.66382 13.9004 8.66382 13.5284V12.3638C7.51116 12.4593 6.34925 12.771 5.3291 13.2654C4.16079 13.8317 3.22279 14.6151 2.67261 15.5396L2.56787 15.7264C2.40696 16.0312 2.05873 16.1871 1.72412 16.1043C1.38948 16.0214 1.1543 15.721 1.1543 15.3763C1.15435 11.4316 2.31556 8.84293 3.99463 7.24491C5.41986 5.88852 7.14748 5.31467 8.66382 5.17655V3.94535C8.66382 3.57338 8.66217 3.2088 8.70264 2.92948C8.74073 2.66678 8.85572 2.18107 9.35449 1.95829L9.44678 1.92167ZM10.1638 5.8914C10.1638 6.30559 9.828 6.64138 9.41382 6.6414C8.0268 6.6414 6.35199 7.07253 5.02881 8.33183C4.01602 9.29575 3.15063 10.8008 2.80957 13.116C3.36833 12.6428 4.00247 12.2415 4.67505 11.9156C6.12368 11.2135 7.80003 10.8323 9.41382 10.8323C9.82796 10.8323 10.1637 11.1682 10.1638 11.5823V13.5284C10.1638 13.5924 10.1644 13.6525 10.1646 13.7093C10.2085 13.6706 10.2563 13.6308 10.3059 13.587L13.6201 10.6565L14.5598 9.83036C14.8482 9.57618 15.1082 9.3433 15.3296 9.13383C15.4961 8.97633 15.6271 8.84467 15.7236 8.73759C15.6269 8.63038 15.4961 8.49826 15.3296 8.34062C15.1083 8.13105 14.8482 7.89778 14.5598 7.64335L13.6201 6.81718L10.3059 3.88676C10.2561 3.84276 10.2086 3.80248 10.1646 3.76371C10.1644 3.82068 10.1638 3.88107 10.1638 3.94535V5.8914Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ============================================================================
// File type icon — Manus exact SVG with per-type colors
// ============================================================================

function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  const mime = mimeType || "";

  let fillColor = "#4876D3";
  let cornerColor = "#9CC3F4";
  if (mime === "application/pdf") { fillColor = "#D10335"; cornerColor = "#F78E8F"; }
  if (mime.startsWith("image/")) { fillColor = "#9B59B6"; cornerColor = "#C39BD3"; }
  if (mime.startsWith("video/")) { fillColor = "#6366F1"; cornerColor = "#A5A6F6"; }
  if (mime.startsWith("audio/")) { fillColor = "#EC4899"; cornerColor = "#F5A3C7"; }
  if (mime.includes("javascript") || mime.includes("typescript")) { fillColor = "#10B981"; cornerColor = "#6EE7B7"; }

  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="32" height="32" className="shrink-0">
      <path
        d="M3.556 26.889C3.556 28.607 4.949 30 6.667 30H25.333C27.052 30 28.444 28.607 28.444 26.889V9.778L20.667 2H6.667C4.949 2 3.556 3.393 3.556 5.111V26.889Z"
        fill={fillColor}
      />
      <path
        d="M20.668 6.667C20.668 8.385 22.061 9.778 23.78 9.778H28.446L20.668 2V6.667Z"
        fill={cornerColor}
      />
      <path opacity="0.9" d="M10.168 18.236H21.835" stroke="white" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="round" />
      <path opacity="0.9" d="M10.168 14.347H12.113" stroke="white" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="round" />
      <path opacity="0.9" d="M15.029 14.347H16.974" stroke="white" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="round" />
      <path opacity="0.9" d="M10.168 21.833H21.835" stroke="white" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="round" />
    </svg>
  );
}

// ============================================================================
// Google Docs icon for modal menu (Manus three-dots-header.html)
// ============================================================================

function GoogleDocsModalIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2 size-4">
      <path d="M12.5 2.5H5.833A1.667 1.667 0 004.167 4.167v11.666A1.667 1.667 0 005.833 17.5h8.334a1.667 1.667 0 001.666-1.667V6.667L12.5 2.5z" fill="#4285F4" />
      <path d="M12.5 2.5v4.167h4.167L12.5 2.5z" fill="#A1C2FA" />
      <path d="M7.5 10h5M7.5 12.5h5M7.5 7.5h2.5" stroke="white" strokeWidth="0.833" strokeLinecap="round" />
    </svg>
  );
}
