"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@repo/design-system/components/ui/context-menu";
import {
  EyeIcon,
  DownloadIcon,
  PencilIcon,
  FolderInputIcon,
  ShareIcon,
  HistoryIcon,
  Trash2Icon,
} from "lucide-react";
import type { FileItem } from "./file-card";
import { isPreviewable } from "@/lib/utils/file-utils";

interface FileContextMenuProps {
  children: React.ReactNode;
  file: FileItem;
  onPreview: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

export function FileContextMenu({
  children,
  file,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onShare,
  onVersionHistory,
  onDelete,
}: FileContextMenuProps) {
  const isFolder = file.mimeType === "application/folder";
  const canPreview = isPreviewable(file.mimeType);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {canPreview && (
          <ContextMenuItem onClick={() => onPreview(file)}>
            <EyeIcon className="mr-2 h-4 w-4" />
            Preview
          </ContextMenuItem>
        )}
        {!isFolder && (
          <ContextMenuItem onClick={() => onDownload(file)}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            Download
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRename(file)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onMove(file)}>
          <FolderInputIcon className="mr-2 h-4 w-4" />
          Move to...
        </ContextMenuItem>
        {!isFolder && (
          <ContextMenuItem onClick={() => onShare(file)}>
            <ShareIcon className="mr-2 h-4 w-4" />
            Share
          </ContextMenuItem>
        )}
        {!isFolder && (
          <ContextMenuItem onClick={() => onVersionHistory(file)}>
            <HistoryIcon className="mr-2 h-4 w-4" />
            Version History
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => onDelete(file)}>
          <Trash2Icon className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
