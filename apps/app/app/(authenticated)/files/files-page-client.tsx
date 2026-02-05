"use client";

import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import { useAppDispatch, useFileManagement } from "@/lib/store/hooks";
import {
  clearFileSelection,
  addToUploadQueue,
  updateUploadProgress,
  completeUpload,
  failUpload,
} from "@/lib/store/slices/fileManagement.slice";
import { getMimeCategory } from "@/lib/utils/file-utils";
import { toast } from "sonner";
import { FolderIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";

import { FileToolbar } from "./components/file-toolbar";
import { FileTabs } from "./components/file-tabs";
import { FolderBreadcrumbs } from "./components/folder-breadcrumbs";
import { FileGrid } from "./components/file-grid";
import { FileListTable } from "./components/file-list-table";
import { UploadZone, openFilePicker } from "./components/upload-zone";
import { UploadProgress } from "./components/upload-progress";
import { FilePreviewModal } from "./components/file-preview-modal";
import { RenameDialog } from "./components/rename-dialog";
import { DeleteConfirmDialog } from "./components/delete-confirm-dialog";
import { MoveDialog } from "./components/move-dialog";
import { ShareDialog } from "./components/share-dialog";
import { VersionHistorySheet } from "./components/version-history-sheet";
import { NewFolderDialog } from "./components/new-folder-dialog";
import { StorageUsageBar } from "./components/storage-usage-bar";
import type { FileItem } from "./components/file-card";

export function FilesPageClient() {
  const dispatch = useAppDispatch();
  const { fileTab, selectedFiles } = useFileManagement();
  const utils = trpc.useUtils();

  // Local state
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("files-view-mode") as "grid" | "list") || "grid";
    }
    return "grid";
  });
  const [currentPath, setCurrentPath] = useState("/");
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [moveFile, setMoveFile] = useState<FileItem | null>(null);
  const [versionFile, setVersionFile] = useState<FileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ ids: string[] } | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Queries
  const { data: allFiles, isLoading } = trpc.files.list.useQuery();

  // Mutations
  const updateMutation = trpc.files.update.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      toast.success("File updated");
    },
    onError: () => toast.error("Failed to update file"),
  });

  const deleteMutation = trpc.files.delete.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      utils.files.getStorageUsage.invalidate();
      toast.success("File deleted");
    },
    onError: () => toast.error("Failed to delete file"),
  });

  const bulkDeleteMutation = trpc.files.bulkDelete.useMutation({
    onSuccess: (data) => {
      utils.files.list.invalidate();
      utils.files.getStorageUsage.invalidate();
      dispatch(clearFileSelection());
      toast.success(`Deleted ${data.count} file(s)`);
    },
    onError: () => toast.error("Failed to delete files"),
  });

  const createFolderMutation = trpc.files.createFolder.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      toast.success("Folder created");
    },
    onError: () => toast.error("Failed to create folder"),
  });

  const moveMutation = trpc.files.move.useMutation({
    onSuccess: () => {
      utils.files.list.invalidate();
      toast.success("File moved");
    },
    onError: () => toast.error("Failed to move file"),
  });

  // Filter files by current path, tab, and search
  const filteredFiles = useMemo(() => {
    if (!allFiles) return [];
    let result = allFiles as FileItem[];

    // Filter by path: show only direct children
    result = result.filter((f) => {
      if (currentPath === "/") {
        // Root: show files whose path is "/" (direct root children)
        return f.path === "/";
      }
      return f.path === currentPath;
    });

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) => f.name.toLowerCase().includes(q));
    }

    // Filter by tab
    if (fileTab !== "all") {
      result = result.filter((f) => {
        if (f.mimeType === "application/folder") return true; // always show folders
        return getMimeCategory(f.mimeType) === fileTab;
      });
    }

    return result;
  }, [allFiles, currentPath, searchQuery, fileTab]);

  // All folders (for move dialog)
  const allFolders = useMemo(() => {
    if (!allFiles) return [];
    return (allFiles as FileItem[]).filter((f) => f.mimeType === "application/folder");
  }, [allFiles]);

  // View mode persistence
  const handleViewModeChange = useCallback((mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("files-view-mode", mode);
  }, []);

  // Open file/folder
  const handleOpen = useCallback(
    (file: FileItem) => {
      if (file.mimeType === "application/folder") {
        const newPath = currentPath === "/" ? `/${file.name}` : `${currentPath}/${file.name}`;
        setCurrentPath(newPath);
        dispatch(clearFileSelection());
      } else {
        setPreviewFile(file);
      }
    },
    [currentPath, dispatch]
  );

  // Download
  const handleDownload = useCallback(
    async (file: FileItem) => {
      try {
        const data = await utils.files.getDownloadUrl.fetch({ id: file.id });
        if (data?.url) {
          const a = document.createElement("a");
          a.href = data.url;
          a.download = file.name;
          a.click();
        }
      } catch {
        toast.error("Failed to download file");
      }
    },
    [utils]
  );

  // Upload
  const handleUpload = useCallback(
    (uploadedFiles: File[]) => {
      for (const file of uploadedFiles) {
        const id = crypto.randomUUID();
        dispatch(addToUploadQueue({ id, file: file.name }));

        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", currentPath);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/files/upload");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            dispatch(updateUploadProgress({ id, progress }));
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            dispatch(completeUpload(id));
            utils.files.list.invalidate();
            utils.files.getStorageUsage.invalidate();
          } else {
            dispatch(failUpload({ id, error: "Upload failed" }));
          }
        };

        xhr.onerror = () => {
          dispatch(failUpload({ id, error: "Network error" }));
        };

        xhr.send(formData);
      }
    },
    [dispatch, currentPath, utils]
  );

  // Rename
  const handleRename = useCallback(
    (id: string, name: string) => {
      updateMutation.mutate({ id, name });
    },
    [updateMutation]
  );

  // Delete
  const handleDelete = useCallback((file: FileItem) => {
    setDeleteTarget({ ids: [file.id] });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedFiles.length > 0) {
      setDeleteTarget({ ids: selectedFiles });
    }
  }, [selectedFiles]);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    if (deleteTarget.ids.length === 1) {
      deleteMutation.mutate({ id: deleteTarget.ids[0] });
    } else {
      bulkDeleteMutation.mutate({ ids: deleteTarget.ids });
    }
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation, bulkDeleteMutation]);

  // New folder
  const handleNewFolder = useCallback(
    (name: string) => {
      createFolderMutation.mutate({ name, path: currentPath });
    },
    [createFolderMutation, currentPath]
  );

  // Move
  const handleMove = useCallback(
    (fileId: string, newPath: string) => {
      moveMutation.mutate({ id: fileId, newPath });
    },
    [moveMutation]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (!allFiles || allFiles.length === 0) {
    return (
      <UploadZone onUpload={handleUpload}>
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">Files</h1>
            <p className="text-muted-foreground">
              All your outputted and created files in one place
            </p>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FolderIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No files yet</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
              Upload files or drag and drop them here. Files created by your tasks will also appear
              here.
            </p>
            <Button className="mt-6" onClick={() => openFilePicker(handleUpload)}>
              Upload Files
            </Button>
          </div>
        </div>
        <UploadProgress />
      </UploadZone>
    );
  }

  // Context menu action callbacks
  const contextActions = {
    onPreview: setPreviewFile,
    onDownload: handleDownload,
    onRename: setRenameFile,
    onMove: setMoveFile,
    onShare: setShareFile,
    onVersionHistory: setVersionFile,
    onDelete: handleDelete,
  };

  return (
    <UploadZone onUpload={handleUpload}>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground">All your outputted and created files in one place</p>
        </div>

        {/* Toolbar */}
        <FileToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onUpload={() => openFilePicker(handleUpload)}
          onNewFolder={() => setShowNewFolder(true)}
          onBulkDelete={handleBulkDelete}
        />

        {/* Tabs */}
        <FileTabs files={allFiles as FileItem[]} />

        {/* Breadcrumbs */}
        {currentPath !== "/" && (
          <FolderBreadcrumbs currentPath={currentPath} onNavigate={setCurrentPath} />
        )}

        {/* File list */}
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
            <FolderIcon className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {searchQuery ? "No files match your search" : "This folder is empty"}
            </p>
          </div>
        ) : viewMode === "grid" ? (
          <FileGrid files={filteredFiles} onOpen={handleOpen} {...contextActions} />
        ) : (
          <FileListTable files={filteredFiles} onOpen={handleOpen} {...contextActions} />
        )}

        {/* Storage usage */}
        <StorageUsageBar />
      </div>

      {/* Modals & dialogs */}
      <UploadProgress />
      <FilePreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onDownload={handleDownload}
      />
      <RenameDialog file={renameFile} onClose={() => setRenameFile(null)} onRename={handleRename} />
      <DeleteConfirmDialog
        open={!!deleteTarget}
        count={deleteTarget?.ids.length ?? 0}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
      <MoveDialog
        file={moveFile}
        folders={allFolders}
        onClose={() => setMoveFile(null)}
        onMove={handleMove}
      />
      <ShareDialog file={shareFile} onClose={() => setShareFile(null)} />
      <VersionHistorySheet file={versionFile} onClose={() => setVersionFile(null)} />
      <NewFolderDialog
        open={showNewFolder}
        onClose={() => setShowNewFolder(false)}
        onCreate={handleNewFolder}
      />
    </UploadZone>
  );
}
