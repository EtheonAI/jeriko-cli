"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { useAppDispatch, useFileManagement } from "@/lib/store/hooks";
import { toggleFileSelection, setSelectedFiles } from "@/lib/store/slices/fileManagement.slice";
import { getFileIcon, formatFileSize } from "@/lib/utils/file-utils";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@repo/design-system/lib/utils";
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
import { isPreviewable } from "@/lib/utils/file-utils";
import type { FileItem } from "./file-card";

interface FileListTableProps {
  files: FileItem[];
  onOpen: (file: FileItem) => void;
  onPreview: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onVersionHistory: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
}

export function FileListTable({
  files,
  onOpen,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onShare,
  onVersionHistory,
  onDelete,
}: FileListTableProps) {
  const dispatch = useAppDispatch();
  const { selectedFiles } = useFileManagement();

  if (files.length === 0) return null;

  const allSelected = files.length > 0 && files.every((f) => selectedFiles.includes(f.id));
  const someSelected = files.some((f) => selectedFiles.includes(f.id));

  const sorted = [...files].sort((a, b) => {
    const aFolder = a.mimeType === "application/folder" ? 0 : 1;
    const bFolder = b.mimeType === "application/folder" ? 0 : 1;
    if (aFolder !== bFolder) return aFolder - bFolder;
    return a.name.localeCompare(b.name);
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el) {
                  (el as unknown as HTMLInputElement).indeterminate = someSelected && !allSelected;
                }
              }}
              onCheckedChange={(checked) => {
                dispatch(setSelectedFiles(checked ? files.map((f) => f.id) : []));
              }}
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="w-28">Size</TableHead>
          <TableHead className="w-40">Modified</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((file) => {
          const Icon = getFileIcon(file.mimeType);
          const isSelected = selectedFiles.includes(file.id);
          const isFolder = file.mimeType === "application/folder";
          const canPreview = isPreviewable(file.mimeType);

          return (
            <ContextMenu key={file.id}>
              <ContextMenuTrigger asChild>
                <TableRow
                  className={cn("cursor-pointer", isSelected && "bg-primary/5")}
                  onDoubleClick={() => onOpen(file)}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => dispatch(toggleFileSelection(file.id))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          isFolder ? "text-blue-500" : "text-muted-foreground"
                        )}
                      />
                      <span className="truncate">{file.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {isFolder ? "\u2014" : formatFileSize(file.size)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              </ContextMenuTrigger>
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
        })}
      </TableBody>
    </Table>
  );
}
