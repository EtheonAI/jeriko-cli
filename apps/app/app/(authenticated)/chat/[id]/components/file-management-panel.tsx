"use client";

import { useEffect, useMemo } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  FileIcon,
  FileTextIcon,
  ImageIcon,
  FileCodeIcon,
  XIcon,
  DownloadIcon,
  ExternalLinkIcon,
} from "lucide-react";
import type { UIMessage } from "@repo/ai/lib/types";

interface ChatFile {
  id: string;
  name: string;
  type: string;
  url?: string;
  size?: number;
  createdAt?: string;
}

interface FileManagementPanelProps {
  messages: UIMessage[];
  sessionId: string;
  onClose: () => void;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return ImageIcon;
  if (type.includes("code") || type.includes("javascript") || type.includes("python"))
    return FileCodeIcon;
  if (type.includes("text") || type.includes("pdf") || type.includes("document"))
    return FileTextIcon;
  return FileIcon;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileManagementPanel({
  messages,
  sessionId,
  onClose,
}: FileManagementPanelProps) {
  // Update URL hash when panel is open
  useEffect(() => {
    window.location.hash = "file-management";
    return () => {
      if (window.location.hash === "#file-management") {
        history.replaceState(null, "", window.location.pathname);
      }
    };
  }, []);

  // Extract files from messages (attachments + tool outputs)
  const files = useMemo<ChatFile[]>(() => {
    const extracted: ChatFile[] = [];
    const seen = new Set<string>();

    for (const msg of messages) {
      // Check message parts for file references
      for (const part of msg.parts) {
        if (part.type === "file" && "file" in part) {
          const file = part.file as { name?: string; url?: string; mimeType?: string; size?: number };
          const id = file.url ?? file.name ?? `file-${extracted.length}`;
          if (!seen.has(id)) {
            seen.add(id);
            extracted.push({
              id,
              name: file.name ?? "Untitled file",
              type: file.mimeType ?? "application/octet-stream",
              url: file.url,
              size: file.size,
              createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt ?? ""),
            });
          }
        }
        // Check tool results for file outputs
        if (part.type === "tool-invocation" && "toolInvocation" in part) {
          const invocation = part.toolInvocation as { result?: { files?: Array<{ name: string; url: string; mimeType?: string; size?: number }> } };
          if (invocation.result?.files) {
            for (const file of invocation.result.files) {
              const id = file.url ?? file.name;
              if (!seen.has(id)) {
                seen.add(id);
                extracted.push({
                  id,
                  name: file.name,
                  type: file.mimeType ?? "application/octet-stream",
                  url: file.url,
                  size: file.size,
                  createdAt: msg.createdAt instanceof Date ? msg.createdAt.toISOString() : String(msg.createdAt ?? ""),
                });
              }
            }
          }
        }
      }
    }

    return extracted;
  }, [messages]);

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h3 className="font-semibold text-sm">Files</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <XIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* File list */}
      <ScrollArea className="flex-1">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <FileIcon className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">No files yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Files created during this chat will appear here
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {files.map((file) => {
              const Icon = getFileIcon(file.type);
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 group"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    {file.size && (
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.url && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => window.open(file.url, "_blank")}
                        >
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          asChild
                        >
                          <a href={file.url} download={file.name}>
                            <DownloadIcon className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {files.length > 0 && (
        <div className="border-t px-4 py-2">
          <p className="text-xs text-muted-foreground">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
