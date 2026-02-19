"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  XIcon,
  DownloadIcon,
  LinkIcon,
  ZoomInIcon,
  ZoomOutIcon,
  PencilIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ScreenshotOverlayProps {
  /** Screenshot data URI or URL */
  imageUrl: string;
  /** Close the overlay */
  onClose: () => void;
  /** Switch to AI Canvas editor with this image */
  onEditInCanvas: () => void;
  /** Download the image */
  onDownload?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ScreenshotOverlay({
  imageUrl,
  onClose,
  onEditInCanvas,
  onDownload,
}: ScreenshotOverlayProps) {
  const [zoom, setZoom] = useState(100);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) {
        onClose();
      }
    },
    [onClose]
  );

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 25, 300));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 25, 25));
  }, []);

  const handleDownload = useCallback(() => {
    if (onDownload) {
      onDownload();
      return;
    }
    // Default download behavior
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `screenshot-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [imageUrl, onDownload]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(imageUrl).catch(() => {
      // Silently fail if clipboard API unavailable
    });
  }, [imageUrl]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      {/* Close button — top right */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
      >
        <XIcon className="size-5" />
      </button>

      {/* Image */}
      <div className="flex max-h-[80vh] max-w-[80vw] items-center justify-center overflow-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Screenshot preview"
          className="object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom / 100})`,
            maxHeight: "80vh",
            maxWidth: "80vw",
          }}
          draggable={false}
        />
      </div>

      {/* Bottom floating toolbar */}
      <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl bg-gray-900/90 px-4 py-2.5 shadow-2xl backdrop-blur-md">
        {/* Edit in canvas — primary action */}
        <button
          type="button"
          onClick={onEditInCanvas}
          className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
        >
          <PencilIcon className="size-4" />
          Edit in canvas
        </button>

        <div className="mx-1 h-6 w-px bg-white/10" />

        {/* Download */}
        <button
          type="button"
          onClick={handleDownload}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          title="Download"
        >
          <DownloadIcon className="size-4" />
        </button>

        {/* Copy link */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          title="Copy link"
        >
          <LinkIcon className="size-4" />
        </button>

        <div className="mx-1 h-6 w-px bg-white/10" />

        {/* Zoom controls */}
        <button
          type="button"
          onClick={handleZoomOut}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          title="Zoom out"
        >
          <ZoomOutIcon className="size-4" />
        </button>
        <span className="min-w-[3rem] text-center text-sm tabular-nums text-white/60">
          {zoom}%
        </span>
        <button
          type="button"
          onClick={handleZoomIn}
          className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          title="Zoom in"
        >
          <ZoomInIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
