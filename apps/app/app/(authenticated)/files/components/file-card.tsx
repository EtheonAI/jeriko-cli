"use client";

import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { useAppDispatch, useFileManagement } from "@/lib/store/hooks";
import { toggleFileSelection } from "@/lib/store/slices/fileManagement.slice";
import { getFileIcon, formatFileSize } from "@/lib/utils/file-utils";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@repo/design-system/lib/utils";

export interface FileItem {
  id: string;
  name: string;
  mimeType: string | null;
  size: number | null;
  path: string;
  storageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface FileCardProps {
  file: FileItem;
  onOpen: (file: FileItem) => void;
}

export function FileCard({ file, onOpen }: FileCardProps) {
  const dispatch = useAppDispatch();
  const { selectedFiles } = useFileManagement();
  const isSelected = selectedFiles.includes(file.id);
  const Icon = getFileIcon(file.mimeType);
  const isFolder = file.mimeType === "application/folder";

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer flex-col items-center rounded-lg border p-4 transition-colors hover:bg-muted/50",
        isSelected && "border-primary bg-primary/5"
      )}
      onClick={() => onOpen(file)}
    >
      <div className="absolute left-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => dispatch(toggleFileSelection(file.id))}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-lg",
          isFolder ? "bg-blue-500/10" : "bg-muted"
        )}
      >
        <Icon className={cn("h-7 w-7", isFolder ? "text-blue-500" : "text-muted-foreground")} />
      </div>
      <p className="mt-3 w-full truncate text-center text-sm font-medium">{file.name}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {isFolder ? "Folder" : formatFileSize(file.size)}
        {" \u00b7 "}
        {formatDistanceToNow(new Date(file.updatedAt), { addSuffix: true })}
      </p>
    </div>
  );
}
