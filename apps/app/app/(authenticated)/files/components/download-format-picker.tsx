"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import type { LibraryFile } from "./library-file-card";
import { convertToPdf, convertToDocx, triggerDownload } from "./library-download-utils";

// ============================================================================
// Manus-style download format picker
// Shows below the download button. Three options:
// - Markdown (instant download)
// - PDF (shows "Converting..." then downloads)
// - Docx (shows "Converting..." then downloads)
// ============================================================================

interface DownloadFormatPickerProps {
  file: LibraryFile;
  content: string | null;
  onClose: () => void;
}

export function DownloadFormatPicker({ file, content, onClose }: DownloadFormatPickerProps) {
  const [converting, setConverting] = useState<"pdf" | "docx" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  async function handleDownload(format: "markdown" | "pdf" | "docx") {
    const rawContent = content || "";
    const baseName = file.name.replace(/\.[^.]+$/, "");

    if (format === "markdown") {
      const blob = new Blob([rawContent], { type: "text/markdown;charset=utf-8" });
      triggerDownload(blob, `${baseName}.md`);
      onClose();
      return;
    }

    setConverting(format);

    try {
      if (format === "pdf") {
        await convertToPdf(rawContent, baseName);
      } else {
        await convertToDocx(rawContent, baseName);
      }
      onClose();
    } catch {
      toast.error(`Failed to convert to ${format.toUpperCase()}`);
      setConverting(null);
    }
  }

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 min-w-40 rounded-xl border-[0.5px] border-border bg-popover p-1 shadow-[0_4px_11px_0px_rgba(0,0,0,0.15)]"
      style={{ animation: "fadeIn 0.15s ease-out" }}
    >
      <DownloadOption
        label="Markdown"
        icon={<FormatIcon type="markdown" />}
        onClick={() => handleDownload("markdown")}
        converting={false}
        disabled={converting !== null}
      />
      <DownloadOption
        label={converting === "pdf" ? "Converting..." : "PDF"}
        icon={converting === "pdf" ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : <FormatIcon type="pdf" />}
        onClick={() => handleDownload("pdf")}
        converting={converting === "pdf"}
        disabled={converting !== null && converting !== "pdf"}
      />
      <DownloadOption
        label={converting === "docx" ? "Converting..." : "Docx"}
        icon={converting === "docx" ? <Loader2Icon className="size-4 animate-spin text-muted-foreground" /> : <FormatIcon type="docx" />}
        onClick={() => handleDownload("docx")}
        converting={converting === "docx"}
        disabled={converting !== null && converting !== "docx"}
      />
    </div>
  );
}

// ============================================================================
// Individual download option row
// ============================================================================

function DownloadOption({
  label,
  icon,
  onClick,
  converting,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  converting: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {icon}
      <span className={converting ? "text-muted-foreground" : ""}>{label}</span>
    </button>
  );
}

// ============================================================================
// Format icons (Manus colored document icons)
// ============================================================================

function FormatIcon({ type }: { type: "markdown" | "pdf" | "docx" }) {
  const config = {
    markdown: { fill: "#4876D3", label: "MD" },
    pdf: { fill: "#D84D4F", label: "PDF" },
    docx: { fill: "#3E74DC", label: "W" },
  };

  const { fill, label } = config[type];

  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-5 shrink-0">
      <path
        d="M5 26C5 27.657 6.343 29 8 29H24C25.657 29 27 27.657 27 26V10L20 3H8C6.343 3 5 4.343 5 6V26Z"
        fill={fill}
      />
      <path d="M20 7C20 8.657 21.343 10 23 10H27L20 3V7Z" fill="white" opacity="0.4" />
      {type === "markdown" && (
        <>
          <path d="M10 17H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          <path d="M10 14H13" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
          <path d="M10 20H22" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        </>
      )}
      {type === "pdf" && (
        <text x="16" y="22" textAnchor="middle" fontSize="8" fontWeight="700" fill="white" fontFamily="system-ui">
          {label}
        </text>
      )}
      {type === "docx" && (
        <text x="16" y="22" textAnchor="middle" fontSize="10" fontWeight="700" fill="white" fontFamily="system-ui">
          {label}
        </text>
      )}
    </svg>
  );
}
