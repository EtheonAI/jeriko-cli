"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  SearchIcon,
  UploadIcon,
  FolderPlusIcon,
  LayoutGridIcon,
  ListIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useAppDispatch, useFileManagement } from "@/lib/store/hooks";
import { clearFileSelection } from "@/lib/store/slices/fileManagement.slice";

interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onBulkDelete: () => void;
}

export function FileToolbar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onUpload,
  onNewFolder,
  onBulkDelete,
}: FileToolbarProps) {
  const dispatch = useAppDispatch();
  const { selectedFiles } = useFileManagement();
  const hasSelection = selectedFiles.length > 0;

  if (hasSelection) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{selectedFiles.length} selected</span>
          <Button variant="ghost" size="sm" onClick={() => dispatch(clearFileSelection())}>
            <XIcon className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
        <Button variant="destructive" size="sm" onClick={onBulkDelete}>
          <Trash2Icon className="mr-1 h-3 w-3" />
          Delete
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onUpload}>
          <UploadIcon className="mr-1 h-4 w-4" />
          Upload
        </Button>
        <Button variant="outline" size="sm" onClick={onNewFolder}>
          <FolderPlusIcon className="mr-1 h-4 w-4" />
          New Folder
        </Button>
      </div>
      <div className="flex items-center rounded-md border">
        <Button
          variant={viewMode === "grid" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-r-none"
          onClick={() => onViewModeChange("grid")}
        >
          <LayoutGridIcon className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === "list" ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8 rounded-l-none"
          onClick={() => onViewModeChange("list")}
        >
          <ListIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
