"use client";

import {
  FileTextIcon,
  EllipsisIcon,
  DownloadIcon,
  StarIcon,
  ShareIcon,
  ExternalLinkIcon,
  MessageSquarePlusIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export interface LibraryFile {
  id: string;
  sessionId: string | null;
  name: string;
  path: string;
  mimeType: string | null;
  size: number | null;
  storageKey: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  contentPreview?: string | null;
  resolvedUrl?: string | null;
}

interface LibraryFileCardProps {
  file: LibraryFile;
  onPreview: (file: LibraryFile) => void;
  onLocateInTask?: (file: LibraryFile) => void;
  onDownload?: (file: LibraryFile, format: "markdown" | "pdf" | "docx") => void;
  onShare?: (file: LibraryFile) => void;
  onFavorite?: (file: LibraryFile) => void;
  onSendToRubic?: (file: LibraryFile) => void;
}

// ============================================================================
// Manus file type icon SVG (exact path from Manus source)
// ============================================================================

function FileTypeIconSvg({ mimeType, size = 24 }: { mimeType: string | null; size?: number }) {
  const mime = mimeType || "";

  // Manus color scheme per type
  let fillColor = "#4876D3"; // Default blue for documents/markdown
  let cornerColor = "#9CC3F4"; // Manus light blue corner
  if (mime === "application/pdf") { fillColor = "#D10335"; cornerColor = "#F78E8F"; }
  if (mime.startsWith("image/")) { fillColor = "#9B59B6"; cornerColor = "#C39BD3"; }
  if (mime.startsWith("video/")) { fillColor = "#6366F1"; cornerColor = "#A5A6F6"; }
  if (mime.startsWith("audio/")) { fillColor = "#EC4899"; cornerColor = "#F5A3C7"; }
  if (mime.includes("javascript") || mime.includes("typescript") || mime.includes("python") || mime.includes("json")) {
    fillColor = "#10B981"; cornerColor = "#6EE7B7";
  }
  if (mime.includes("html") || mime.includes("css")) { fillColor = "#F59E0B"; cornerColor = "#FCD34D"; }

  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
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

export function getExtFromMime(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "text/markdown" || mime === "text/x-markdown") return "MD";
  if (mime === "text/plain") return "TXT";
  if (mime === "text/html") return "HTML";
  if (mime === "text/css") return "CSS";
  if (mime === "application/json") return "JSON";
  if (mime.includes("javascript")) return "JS";
  if (mime.includes("typescript")) return "TS";
  if (mime.includes("python")) return "PY";
  if (mime.includes("word") || mime.includes("document")) return "DOC";
  if (mime.includes("sheet") || mime.includes("excel")) return "XLS";
  if (mime.includes("presentation")) return "PPT";
  if (mime.startsWith("image/")) return mime.split("/")[1]?.toUpperCase().slice(0, 4) || "IMG";
  if (mime.startsWith("video/")) return "VID";
  if (mime.startsWith("audio/")) return "AUD";
  return "FILE";
}

// ============================================================================
// Inline content preview — Manus renders actual markdown at 50% scale
// ============================================================================

function InlineContentPreview({ file }: { file: LibraryFile }) {
  const isTextLike =
    file.mimeType?.startsWith("text/") ||
    file.mimeType === "application/json" ||
    file.mimeType?.includes("javascript") ||
    file.mimeType?.includes("typescript") ||
    file.mimeType?.includes("python");

  const isImage = file.mimeType?.startsWith("image/");
  const isMarkdown =
    file.mimeType === "text/markdown" ||
    file.mimeType === "text/x-markdown" ||
    file.name.endsWith(".md");

  // Image preview — use server-enriched resolvedUrl
  if (isImage && file.resolvedUrl) {
    return (
      <div className="aspect-video overflow-hidden bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={file.resolvedUrl}
          alt={file.name}
          className="h-full w-full object-cover object-top bg-muted"
          loading="lazy"
        />
      </div>
    );
  }

  // Text/markdown preview — use server-enriched contentPreview
  if (isTextLike && file.contentPreview) {
    return (
      <div className="aspect-video overflow-hidden relative">
        <div className="size-full p-3 relative">
          <div className="scale-[0.5] origin-top-left">
            <div
              className="rubic-markdown w-[200%] h-[200%]"
              dangerouslySetInnerHTML={{
                __html: isMarkdown ? simpleMarkdownToHtml(file.contentPreview) : `<pre><code>${escapeHtml(file.contentPreview)}</code></pre>`,
              }}
            />
          </div>
        </div>
        {/* Gradient fade at bottom — Manus h-13, theme-aware */}
        <div
          className="pointer-events-none absolute left-0 right-0 bottom-0 h-13 bg-linear-to-b from-transparent to-card"
        />
      </div>
    );
  }

  // PDF: type indicator
  if (file.mimeType === "application/pdf") {
    return (
      <div className="aspect-video flex items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-2 text-red-400/60">
          <FileTextIcon className="size-10" />
          <span className="text-xs font-medium">PDF Document</span>
        </div>
      </div>
    );
  }

  // Default: show file type
  return (
    <div className="aspect-video flex items-center justify-center bg-muted/10">
      <div className="flex flex-col items-center gap-1.5 text-muted-foreground/40">
        <span className="text-2xl font-semibold">{getExtFromMime(file.mimeType || "")}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Card Component — Manus exact layout
// ============================================================================

export function LibraryFileCard({
  file,
  onPreview,
  onLocateInTask,
  onDownload,
  onShare,
  onFavorite,
  onSendToRubic,
}: LibraryFileCardProps) {
  const isWebsite =
    file.mimeType === "text/html" &&
    (file.metadata as Record<string, unknown> | null)?.isWebsite === true;

  const isDocumentLike =
    file.mimeType?.startsWith("text/") ||
    file.mimeType === "application/pdf" ||
    file.mimeType === "application/json" ||
    file.mimeType?.includes("word") ||
    file.mimeType?.includes("javascript") ||
    file.mimeType?.includes("typescript");

  return (
    <div
      className="clickable relative flex cursor-pointer flex-col overflow-hidden rounded-[12px] border-[0.5px] border-border bg-card group hover:shadow-[0_7px_16px_0_rgba(0,0,0,0.12)]"
      onClick={() => onPreview(file)}
    >
      {/* Header: icon + filename + three-dots — Manus py-2.5 */}
      <div className="flex items-center gap-2 px-2 py-2.5 relative border-b border-border">
        <div className="flex items-center justify-center shrink-0">
          {isWebsite ? (
            <WebsiteGlobeIcon />
          ) : (
            <FileTypeIconSvg mimeType={file.mimeType} />
          )}
        </div>
        <div className="flex flex-col flex-1 overflow-hidden">
          <span className="truncate text-sm font-medium text-foreground">{file.name}</span>
        </div>

        {/* Three-dots menu — Manus: always visible, size-[24px] */}
        <DropdownMenu>
          <DropdownMenuTrigger
            className="flex size-6 items-center justify-center rounded-[6px] hover:bg-muted"
            onClick={(e) => e.stopPropagation()}
          >
            <EllipsisIcon className="size-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-70" onClick={(e) => e.stopPropagation()}>
            {/* Manus menu items — exact order */}
            {onLocateInTask && file.sessionId && (
              <DropdownMenuItem onClick={() => onLocateInTask(file)}>
                <ExternalLinkIcon className="mr-2.5 size-5" />
                Locate in task
              </DropdownMenuItem>
            )}
            {onSendToRubic && (
              <DropdownMenuItem onClick={() => onSendToRubic(file)}>
                <MessageSquarePlusIcon className="mr-2.5 size-5" />
                Send to Rubic
              </DropdownMenuItem>
            )}
            {onFavorite && (
              <DropdownMenuItem onClick={() => onFavorite(file)}>
                <StarIcon className="mr-2.5 size-5" />
                Add to favorites
              </DropdownMenuItem>
            )}
            {onShare && !isWebsite && (
              <DropdownMenuItem onClick={() => onShare(file)}>
                <ShareIcon className="mr-2.5 size-5" />
                Share
              </DropdownMenuItem>
            )}

            {/* Download sub-menu with format options — only for documents */}
            {onDownload && isDocumentLike && !isWebsite && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <DownloadIcon className="mr-2.5 size-5" />
                  Download
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="min-w-40">
                  <DropdownMenuItem onClick={() => onDownload(file, "markdown")}>
                    <FormatIcon type="markdown" />
                    Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(file, "pdf")}>
                    <FormatIcon type="pdf" />
                    PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(file, "docx")}>
                    <FormatIcon type="docx" />
                    Docx
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            {onDownload && !isDocumentLike && !isWebsite && (
              <DropdownMenuItem onClick={() => onDownload(file, "markdown")}>
                <DownloadIcon className="mr-2.5 size-5" />
                Download
              </DropdownMenuItem>
            )}

            {/* Manus: separator + cloud save options */}
            {!isWebsite && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toast.info("Google Docs integration coming soon")}>
                  <GoogleDocsIcon />
                  Convert to Google Docs
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("Google Drive integration coming soon")}>
                  <GoogleDriveIcon />
                  Save to Google Drive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("OneDrive integration coming soon")}>
                  <OneDriveIcon />
                  Save to OneDrive (personal)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info("OneDrive integration coming soon")}>
                  <OneDriveIcon />
                  Save to OneDrive (work/school)
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Preview area (Manus 16:9 aspect ratio) */}
      <InlineContentPreview file={file} />
    </div>
  );
}

// ============================================================================
// List View Row — compact single-row layout for list mode
// ============================================================================

export function LibraryFileRow({
  file,
  onPreview,
  onLocateInTask,
  onDownload,
  onShare,
  onFavorite,
  onSendToRubic,
}: LibraryFileCardProps) {
  const ext = getExtFromMime(file.mimeType || "");
  const sizeLabel = file.size ? formatFileSize(file.size) : "";
  const dateLabel = (() => {
    try {
      const d = new Date(file.createdAt);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  })();

  const isWebsite =
    file.mimeType === "text/html" &&
    (file.metadata as Record<string, unknown> | null)?.isWebsite === true;

  const isDocumentLike =
    file.mimeType?.startsWith("text/") ||
    file.mimeType === "application/pdf" ||
    file.mimeType === "application/json" ||
    file.mimeType?.includes("word") ||
    file.mimeType?.includes("javascript") ||
    file.mimeType?.includes("typescript");

  return (
    <div
      className="flex items-center gap-3 px-2 py-2 cursor-pointer rounded-lg hover:bg-muted/50 transition-colors group"
      onClick={() => onPreview(file)}
    >
      {/* Icon */}
      <div className="shrink-0">
        {isWebsite ? <WebsiteGlobeIcon /> : <FileTypeIconSvg mimeType={file.mimeType} size={20} />}
      </div>

      {/* Name */}
      <span className="flex-1 min-w-0 truncate text-sm font-medium text-foreground">
        {file.name}
      </span>

      {/* Type badge */}
      <span className="shrink-0 text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted hidden sm:inline">
        {ext}
      </span>

      {/* Size */}
      {sizeLabel && (
        <span className="shrink-0 text-xs text-muted-foreground w-16 text-right hidden md:inline">
          {sizeLabel}
        </span>
      )}

      {/* Date */}
      <span className="shrink-0 text-xs text-muted-foreground w-24 text-right hidden md:inline">
        {dateLabel}
      </span>

      {/* Three-dots menu — same as card */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-6 items-center justify-center rounded-[6px] hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <EllipsisIcon className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-70" onClick={(e) => e.stopPropagation()}>
          {onLocateInTask && file.sessionId && (
            <DropdownMenuItem onClick={() => onLocateInTask(file)}>
              <ExternalLinkIcon className="mr-2.5 size-5" />
              Locate in task
            </DropdownMenuItem>
          )}
          {onSendToRubic && (
            <DropdownMenuItem onClick={() => onSendToRubic(file)}>
              <MessageSquarePlusIcon className="mr-2.5 size-5" />
              Send to Rubic
            </DropdownMenuItem>
          )}
          {onFavorite && (
            <DropdownMenuItem onClick={() => onFavorite(file)}>
              <StarIcon className="mr-2.5 size-5" />
              Add to favorites
            </DropdownMenuItem>
          )}
          {onShare && !isWebsite && (
            <DropdownMenuItem onClick={() => onShare(file)}>
              <ShareIcon className="mr-2.5 size-5" />
              Share
            </DropdownMenuItem>
          )}
          {onDownload && isDocumentLike && !isWebsite && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <DownloadIcon className="mr-2.5 size-5" />
                Download
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-40">
                <DropdownMenuItem onClick={() => onDownload(file, "markdown")}>
                  <FormatIcon type="markdown" />
                  Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownload(file, "pdf")}>
                  <FormatIcon type="pdf" />
                  PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDownload(file, "docx")}>
                  <FormatIcon type="docx" />
                  Docx
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          {onDownload && !isDocumentLike && !isWebsite && (
            <DropdownMenuItem onClick={() => onDownload(file, "markdown")}>
              <DownloadIcon className="mr-2.5 size-5" />
              Download
            </DropdownMenuItem>
          )}
          {!isWebsite && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast.info("Google Docs integration coming soon")}>
                <GoogleDocsIcon />
                Convert to Google Docs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("Google Drive integration coming soon")}>
                <GoogleDriveIcon />
                Save to Google Drive
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("OneDrive integration coming soon")}>
                <OneDriveIcon />
                Save to OneDrive (personal)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info("OneDrive integration coming soon")}>
                <OneDriveIcon />
                Save to OneDrive (work/school)
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// Manus website globe icon (blue rounded-rect with white globe)
// ============================================================================

function WebsiteGlobeIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
      <rect x="2.5" y="2.5" width="27" height="27" rx="6" fill="#0081F2" />
      <path
        d="M16 8.385C20.206 8.385 23.616 11.794 23.616 16C23.616 20.206 20.206 23.616 16 23.616C11.794 23.616 8.385 20.206 8.385 16C8.385 11.794 11.794 8.385 16 8.385ZM9.809 16.693C10.093 19.265 11.943 21.364 14.385 22.018C13.318 20.442 12.685 18.605 12.562 16.693H9.809ZM19.439 16.693C19.315 18.605 18.682 20.442 17.615 22.018C20.057 21.364 21.907 19.265 22.192 16.693H19.439ZM13.949 16.693C14.09 18.588 14.806 20.396 16 21.873C17.194 20.396 17.911 18.588 18.051 16.693H13.949ZM17.615 9.982C18.682 11.558 19.315 13.396 19.439 15.308H22.192C21.907 12.735 20.057 10.635 17.615 9.982ZM16 10.126C14.806 11.604 14.09 13.412 13.949 15.308H18.051C17.911 13.412 17.194 11.604 16 10.126ZM14.385 9.982C11.943 10.635 10.093 12.735 9.809 15.308H12.562C12.685 13.396 13.318 11.558 14.385 9.982Z"
        fill="white"
      />
    </svg>
  );
}

// ============================================================================
// Format download icons (Manus document shapes)
// ============================================================================

function FormatIcon({ type }: { type: "markdown" | "pdf" | "docx" }) {
  const config = {
    markdown: { fill: "#4876D3", corner: "#9CC3F4" },
    pdf: { fill: "#D84D4F", corner: "#F78E8F" },
    docx: { fill: "#3E74DC", corner: "#6E9CF4" },
  };
  const { fill, corner } = config[type];

  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2.5 size-5">
      <path
        d="M3.556 26.889C3.556 28.607 4.949 30 6.667 30H25.333C27.052 30 28.444 28.607 28.444 26.889V9.778L20.667 2H6.667C4.949 2 3.556 3.393 3.556 5.111V26.889Z"
        fill={fill}
      />
      <path d="M20.668 6.667C20.668 8.385 22.061 9.778 23.78 9.778H28.446L20.668 2V6.667Z" fill={corner} />
      {type === "markdown" && (
        <>
          <path d="M10 17H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          <path d="M10 14H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          <path d="M10 20H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        </>
      )}
      {type === "pdf" && (
        <text x="16" y="22" textAnchor="middle" fontSize="8" fontWeight="700" fill="white" fontFamily="system-ui">
          PDF
        </text>
      )}
      {type === "docx" && (
        <text x="16" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="white" fontFamily="system-ui">
          W
        </text>
      )}
    </svg>
  );
}

// ============================================================================
// Simple markdown → HTML for card preview (lightweight, no external deps)
// ============================================================================

function simpleMarkdownToHtml(md: string): string {
  let html = escapeHtml(md);

  // Code blocks (fenced)
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Headings
  html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Lists
  html = html.replace(/^[-*]\s+(.+)$/gm, "<li>$1</li>");
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
  // Paragraphs
  html = html.replace(/^(?!<[hpuolc]|<li|<pre|<strong)(.+)$/gm, "<p>$1</p>");

  return html;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ============================================================================
// Cloud service icons (Manus exact SVGs from three-dots-header-modal.html)
// ============================================================================

function GoogleDocsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2.5 size-5">
      <path d="M12.5 2.5H5.833A1.667 1.667 0 004.167 4.167v11.666A1.667 1.667 0 005.833 17.5h8.334a1.667 1.667 0 001.666-1.667V6.667L12.5 2.5z" fill="#4285F4" />
      <path d="M12.5 2.5v4.167h4.167L12.5 2.5z" fill="#A1C2FA" />
      <path d="M7.5 10h5M7.5 12.5h5M7.5 7.5h2.5" stroke="white" strokeWidth="0.833" strokeLinecap="round" />
    </svg>
  );
}

function GoogleDriveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2.5 size-5">
      <path d="M3.333 13.333L6.667 7.5h6.666l-3.333 5.833H3.333z" fill="#0066DA" />
      <path d="M13.333 7.5L10 13.333h6.667L20 7.5h-6.667z" fill="#00AC47" />
      <path d="M6.667 7.5L3.333 13.333 6.667 7.5 10 1.667 13.333 7.5H6.667z" fill="#EA4335" />
      <path d="M10 1.667l3.333 5.833H6.667L10 1.667z" fill="#FFBA00" />
    </svg>
  );
}

function OneDriveIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2.5 size-5">
      <path d="M8.196 7.902a4.093 4.093 0 013.804-2.569c1.752 0 3.244 1.098 3.833 2.644A3.148 3.148 0 0118.333 11.1c0 1.739-1.41 3.148-3.148 3.148H5.37A2.87 2.87 0 012.5 11.377a2.87 2.87 0 012.314-2.816 3.426 3.426 0 013.382-.659z" fill="#0364B8" />
      <path d="M8.196 7.902a3.426 3.426 0 00-3.382.659A2.87 2.87 0 002.5 11.377a2.87 2.87 0 002.87 2.87h9.815a3.148 3.148 0 002.648-4.27" fill="#0078D4" opacity="0.8" />
    </svg>
  );
}
