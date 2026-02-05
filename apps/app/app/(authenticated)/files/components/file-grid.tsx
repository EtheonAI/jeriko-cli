"use client";

import { FileCard, type FileItem } from "./file-card";
import { FileContextMenu } from "./file-context-menu";

interface FileGridProps {
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

export function FileGrid({
  files,
  onOpen,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onShare,
  onVersionHistory,
  onDelete,
}: FileGridProps) {
  if (files.length === 0) return null;

  const folders = files.filter((f) => f.mimeType === "application/folder");
  const regularFiles = files.filter((f) => f.mimeType !== "application/folder");

  const renderCard = (file: FileItem) => (
    <FileContextMenu
      key={file.id}
      file={file}
      onPreview={onPreview}
      onDownload={onDownload}
      onRename={onRename}
      onMove={onMove}
      onShare={onShare}
      onVersionHistory={onVersionHistory}
      onDelete={onDelete}
    >
      <FileCard file={file} onOpen={onOpen} />
    </FileContextMenu>
  );

  return (
    <div className="space-y-6">
      {folders.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-medium text-muted-foreground">Folders</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {folders.map(renderCard)}
          </div>
        </div>
      )}
      {regularFiles.length > 0 && (
        <div>
          {folders.length > 0 && (
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">Files</h3>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {regularFiles.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  );
}
