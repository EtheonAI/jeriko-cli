"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { DownloadIcon } from "lucide-react";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { useGetFileDownloadUrlQuery } from "@/lib/store/api/api.slice";
import type { FileItem } from "./file-card";

interface FilePreviewModalProps {
  file: FileItem | null;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
}

export function FilePreviewModal({ file, onClose, onDownload }: FilePreviewModalProps) {
  const { data: downloadData = null, isLoading } = useGetFileDownloadUrlQuery(
    file?.id ?? "",
    { skip: !file?.id || file?.mimeType === "application/folder" }
  );

  const url = (downloadData as { url?: string } | null)?.url;

  function renderPreview() {
    if (!file) return null;
    if (isLoading) return <Skeleton className="h-96 w-full" />;
    if (!url) {
      return (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          No preview available
        </div>
      );
    }

    const mime = file.mimeType || "";

    if (mime.startsWith("image/")) {
      return (
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={file.name}
            className="max-h-[70vh] max-w-full rounded object-contain"
          />
        </div>
      );
    }

    if (mime === "application/pdf") {
      return <iframe src={url} title={file.name} className="h-[70vh] w-full rounded border" />;
    }

    if (mime.startsWith("video/")) {
      return (
        <video controls className="max-h-[70vh] w-full rounded">
          <source src={url} type={mime} />
        </video>
      );
    }

    if (mime.startsWith("audio/")) {
      return (
        <div className="flex items-center justify-center py-8">
          <audio controls className="w-full max-w-md">
            <source src={url} type={mime} />
          </audio>
        </div>
      );
    }

    if (
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/javascript"
    ) {
      return <TextPreview url={url} />;
    }

    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <p className="text-muted-foreground">Preview not available for this file type</p>
        <Button onClick={() => onDownload(file)}>
          <DownloadIcon className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
    );
  }

  return (
    <Dialog open={!!file} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">{file?.name}</DialogTitle>
            {file && file.mimeType !== "application/folder" && (
              <Button variant="ghost" size="icon" onClick={() => onDownload(file)}>
                <DownloadIcon className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>
        <div className="mt-2">{renderPreview()}</div>
      </DialogContent>
    </Dialog>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then((r) => r.text())
      .then((t) => {
        setText(t);
        setLoading(false);
      })
      .catch(() => {
        setText(null);
        setLoading(false);
      });
  }, [url]);

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <pre className="max-h-[70vh] overflow-auto rounded border bg-muted p-4 text-sm">
      <code>{text || "Empty file"}</code>
    </pre>
  );
}
