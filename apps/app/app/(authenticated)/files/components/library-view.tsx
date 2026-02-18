"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLibraryData } from "@/lib/store/hooks";
import { getTrpcClient } from "@/lib/trpc/vanilla";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { FolderOpenIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { LibraryFileCard, LibraryFileRow, type LibraryFile } from "./library-file-card";
import { LibraryPreviewModal } from "./library-preview-modal";
import { LibraryShareDialog } from "./library-share-dialog";
import { fetchAndDownload } from "./library-download-utils";
import { toast } from "sonner";

// ============================================================================
// Main Library View — Manus exact: session-grouped files, search, no filters
// ============================================================================

interface LibraryViewProps {
  viewType?: "grid" | "list";
  favoritesOnly?: boolean;
  searchQuery?: string;
}

export function LibraryView({ viewType = "grid", favoritesOnly = false, searchQuery = "" }: LibraryViewProps) {
  const [previewFile, setPreviewFile] = useState<LibraryFile | null>(null);
  const [shareFile, setShareFile] = useState<LibraryFile | null>(null);
  const [groups, setGroups] = useState<any[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  const { toggleFavorite } = useLibraryData({ autoFetch: false });

  // Fetch session-grouped files
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    setIsLoading(true);
    getTrpcClient()
      .files.listBySession.query({ favoritesOnly: favoritesOnly || undefined })
      .then((data) => setGroups(data as any[]))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [favoritesOnly]);

  const refetchGroups = useCallback(() => {
    getTrpcClient()
      .files.listBySession.query({ favoritesOnly: favoritesOnly || undefined })
      .then((data) => setGroups(data as any[]))
      .catch(() => {});
  }, [favoritesOnly]);

  const filteredGroups = useMemo(() => {
    if (!groups) return [];
    if (!searchQuery.trim()) return groups;
    const q = searchQuery.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        files: g.files.filter((f: { name: string }) => f.name.toLowerCase().includes(q)),
      }))
      .filter((g) => g.files.length > 0);
  }, [groups, searchQuery]);

  // ============================================================================
  // Handlers
  // ============================================================================

  function handleLocateInTask(file: LibraryFile) {
    if (file.sessionId) {
      window.open(`/chat/${file.sessionId}`, "_blank");
    }
  }

  async function handleDownload(file: LibraryFile, fmt: "markdown" | "pdf" | "docx") {
    const url = file.resolvedUrl ?? null;
    if (!url) {
      toast.error("File URL not available");
      return;
    }

    try {
      await fetchAndDownload(url, file.name, fmt);
    } catch {
      toast.error(`Failed to download as ${fmt.toUpperCase()}`);
    }
  }

  function handleShare(file: LibraryFile) {
    setShareFile(file);
  }

  async function handleFavorite(file: LibraryFile) {
    try {
      await toggleFavorite(file.id);
      refetchGroups();
      toast.success("Favorite updated");
    } catch {
      toast.error("Failed to update favorite");
    }
  }

  function handleSendToRubic(file: LibraryFile) {
    if (file.sessionId) {
      window.open(`/chat/${file.sessionId}`, "_blank");
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="max-w-250 mx-auto w-full space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-48 rounded-xl" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-250 mx-auto w-full flex flex-col md:gap-6 gap-3">
      {/* Empty state */}
      {(!filteredGroups || filteredGroups.length === 0) && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="flex size-16 items-center justify-center rounded-full bg-muted">
            <FolderOpenIcon className="size-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No files yet</h3>
          <p className="mt-2 text-sm text-muted-foreground text-center max-w-sm">
            {favoritesOnly
              ? "You haven't favorited any files yet."
              : "Files created by your tasks will appear here, grouped by session."}
          </p>
        </div>
      )}

      {/* Session groups */}
      {filteredGroups?.map((group) => (
        <SessionGroup
          key={group.sessionId}
          viewType={viewType}
          sessionId={group.sessionId}
          sessionTitle={group.sessionTitle}
          sessionCreatedAt={group.sessionCreatedAt}
          files={group.files as unknown as LibraryFile[]}
          onPreview={setPreviewFile}
          onLocateInTask={handleLocateInTask}
          onDownload={handleDownload}
          onShare={handleShare}
          onFavorite={handleFavorite}
          onSendToRubic={handleSendToRubic}
        />
      ))}

      {/* Preview Modal */}
      <LibraryPreviewModal
        file={previewFile}
        onClose={() => setPreviewFile(null)}
        onLocateInTask={handleLocateInTask}
        onFavorite={handleFavorite}
      />

      {/* Share Dialog — standalone (from card menu) */}
      {shareFile && (
        <LibraryShareDialog
          file={shareFile}
          open={!!shareFile}
          onClose={() => setShareFile(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// Session Group — Manus: No chevrons, 3-card limit with "N more" pill
// ============================================================================

function SessionGroup({
  viewType,
  sessionId,
  sessionTitle,
  sessionCreatedAt,
  files,
  onPreview,
  onLocateInTask,
  onDownload,
  onShare,
  onFavorite,
  onSendToRubic,
}: {
  viewType: "grid" | "list";
  sessionId: string;
  sessionTitle: string;
  sessionCreatedAt: string;
  files: LibraryFile[];
  onPreview: (file: LibraryFile) => void;
  onLocateInTask: (file: LibraryFile) => void;
  onDownload: (file: LibraryFile, format: "markdown" | "pdf" | "docx") => void;
  onShare: (file: LibraryFile) => void;
  onFavorite: (file: LibraryFile) => void;
  onSendToRubic: (file: LibraryFile) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const INITIAL_SHOW = 3;
  const hasMore = files.length > INITIAL_SHOW;
  const visibleFiles = expanded ? files : files.slice(0, INITIAL_SHOW);
  const hiddenCount = files.length - INITIAL_SHOW;

  const timeLabel = useMemo(() => {
    try {
      const d = new Date(sessionCreatedAt);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      if (diff < 86400000) return format(d, "HH:mm");
      if (diff < 7 * 86400000) return formatDistanceToNow(d, { addSuffix: true });
      return format(d, "EEEE");
    } catch {
      return "";
    }
  }, [sessionCreatedAt]);

  return (
    <div className="flex flex-col md:gap-3 gap-2">
      {/* Group header — Manus: ps-[6px], title link opens in new tab, hover:underline */}
      <div className="ps-1.5 flex items-center justify-between gap-2 pt-3">
        <a
          href={`/chat/${sessionId}`}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate text-sm md:text-base font-medium leading-5.5 text-foreground hover:underline"
          title={sessionTitle}
        >
          {sessionTitle}
        </a>
        <span className="text-[13px] leading-4.5 text-muted-foreground shrink-0">
          {timeLabel}
        </span>
      </div>

      {/* File grid or list */}
      {viewType === "grid" ? (
        <div className="grid gap-4 items-start grid-cols-1 md:grid-cols-3">
          {visibleFiles.map((file) => (
            <LibraryFileCard
              key={file.id}
              file={file}
              onPreview={onPreview}
              onLocateInTask={onLocateInTask}
              onDownload={onDownload}
              onShare={onShare}
              onFavorite={onFavorite}
              onSendToRubic={onSendToRubic}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col">
          {visibleFiles.map((file) => (
            <LibraryFileRow
              key={file.id}
              file={file}
              onPreview={onPreview}
              onLocateInTask={onLocateInTask}
              onDownload={onDownload}
              onShare={onShare}
              onFavorite={onFavorite}
              onSendToRubic={onSendToRubic}
            />
          ))}
        </div>
      )}

      {/* Manus "N more files" pill — border + chevron, no fill */}
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1.5 px-3 py-1 hover:opacity-80 rounded-full border border-border w-fit"
        >
          <span className="text-[13px] leading-4.5 text-muted-foreground">{hiddenCount} more file{hiddenCount > 1 ? "s" : ""}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </button>
      )}
      {hasMore && expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex items-center gap-1.5 px-3 py-1 hover:opacity-80 rounded-full border border-border w-fit"
        >
          <span className="text-[13px] leading-4.5 text-muted-foreground">Show less</span>
          <ChevronUpIcon className="size-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
