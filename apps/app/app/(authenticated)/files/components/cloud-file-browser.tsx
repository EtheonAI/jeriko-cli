"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@repo/design-system/components/ui/sheet";
import { Button } from "@repo/design-system/components/ui/button";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import {
  FolderIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
  MailIcon,
  PaperclipIcon,
  RefreshCwIcon,
  Loader2Icon,
  ArchiveIcon,
  TableIcon,
  PresentationIcon,
} from "lucide-react";
import { useExecuteConnectorToolMutation } from "@/lib/store/api/api.slice";
import { cn } from "@repo/design-system/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// Tool name mapping per connector type
const LIST_TOOLS: Record<string, string> = {
  google_drive: "GOOGLEDRIVE_LIST_FILES_IN_A_FOLDER",
  onedrive: "ONEDRIVE_LIST_FILES",
  dropbox: "DROPBOX_LIST_A_FOLDER",
  box: "BOX_LIST_ITEMS_IN_FOLDER",
  sharepoint: "SHAREPOINT_LIST_FILES",
  gmail: "GMAIL_FETCH_EMAILS",
  outlook: "OUTLOOK_LIST_EMAILS",
};

// Folder-type identifiers per provider
const FOLDER_MIMES = new Set([
  "application/vnd.google-apps.folder",
  "folder",
  "Folder",
]);

interface CloudItem {
  id: string;
  name: string;
  mimeType?: string;
  type?: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
  downloadUrl?: string;
  // Email fields
  subject?: string;
  from?: string;
  date?: string;
  snippet?: string;
  hasAttachments?: boolean;
}

interface CloudFileBrowserProps {
  connectorType: string;
  connectorName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CloudFileBrowser({
  connectorType,
  connectorName,
  open,
  onOpenChange,
}: CloudFileBrowserProps) {
  const [items, setItems] = useState<CloudItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [folderStack, setFolderStack] = useState<Array<{ id: string; name: string }>>([]);
  const [executeTool] = useExecuteConnectorToolMutation();

  const isEmail = connectorType === "gmail" || connectorType === "outlook";
  const toolName = LIST_TOOLS[connectorType];

  const fetchItems = useCallback(
    async (folderId?: string) => {
      if (!toolName) {
        toast.error(`Browsing not supported for ${connectorName}`);
        return;
      }

      setLoading(true);
      try {
        const args: Record<string, unknown> = {};
        if (folderId) {
          args.folder_id = folderId;
          args.folderId = folderId;
        }
        if (isEmail) {
          args.max_results = 25;
          args.limit = 25;
        }

        const result = await executeTool({
          toolName,
          arguments: args,
        }).unwrap();

        // Normalize result — Composio returns different shapes
        const rawItems =
          (result as any).files ??
          (result as any).items ??
          (result as any).entries ??
          (result as any).messages ??
          (result as any).emails ??
          (result as any).data ??
          (result as any).value ??
          [];

        const normalized: CloudItem[] = Array.isArray(rawItems)
          ? rawItems.map((item: any) => ({
              id: item.id ?? item.fileId ?? item.messageId ?? String(Math.random()),
              name: item.name ?? item.title ?? item.subject ?? item.fileName ?? "Untitled",
              mimeType: item.mimeType ?? item.contentType ?? item.type,
              type: item[".tag"] ?? item.type,
              size: item.size ?? item.fileSize,
              modifiedTime: item.modifiedTime ?? item.lastModifiedDateTime ?? item.date ?? item.receivedDateTime,
              webViewLink: item.webViewLink ?? item.webUrl ?? item.link ?? item.url,
              downloadUrl: item.downloadUrl ?? item.webContentLink,
              // Email
              subject: item.subject,
              from: item.from?.emailAddress?.address ?? item.from?.name ?? item.from ?? item.sender,
              date: item.date ?? item.receivedDateTime ?? item.internalDate,
              snippet: item.snippet ?? item.bodyPreview,
              hasAttachments: item.hasAttachments ?? (item.attachments?.length > 0),
            }))
          : [];

        setItems(normalized);
        setLoaded(true);
      } catch (error: any) {
        toast.error(error?.data || error?.message || `Failed to load from ${connectorName}`);
        setItems([]);
        setLoaded(true);
      } finally {
        setLoading(false);
      }
    },
    [connectorName, executeTool, isEmail, toolName]
  );

  // Load on first open
  const handleOpen = useCallback(
    (isOpen: boolean) => {
      onOpenChange(isOpen);
      if (isOpen && !loaded && !loading) {
        fetchItems();
      }
    },
    [onOpenChange, loaded, loading, fetchItems]
  );

  const handleFolderClick = useCallback(
    (item: CloudItem) => {
      setFolderStack((prev) => [...prev, { id: item.id, name: item.name }]);
      fetchItems(item.id);
    },
    [fetchItems]
  );

  const handleBack = useCallback(() => {
    setFolderStack((prev) => {
      const next = prev.slice(0, -1);
      const parentId = next.length > 0 ? next[next.length - 1]!.id : undefined;
      fetchItems(parentId);
      return next;
    });
  }, [fetchItems]);

  const handleRefresh = useCallback(() => {
    const currentFolder = folderStack.length > 0 ? folderStack[folderStack.length - 1]!.id : undefined;
    fetchItems(currentFolder);
  }, [fetchItems, folderStack]);

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col">
        <SheetHeader className="space-y-0 pb-3 border-b">
          <div className="flex items-center gap-2">
            {folderStack.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleBack}
              >
                <ArrowLeftIcon className="size-4" />
              </Button>
            )}
            <SheetTitle className="flex-1 truncate">
              {folderStack.length > 0
                ? folderStack[folderStack.length - 1]!.name
                : connectorName}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCwIcon className={cn("size-3.5", loading && "animate-spin")} />
            </Button>
          </div>
          {/* Breadcrumb */}
          {folderStack.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setFolderStack([]);
                  fetchItems();
                }}
                className="hover:text-foreground transition-colors shrink-0"
              >
                {connectorName}
              </button>
              {folderStack.map((folder, i) => (
                <span key={folder.id} className="flex items-center gap-1 shrink-0">
                  <span>/</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newStack = folderStack.slice(0, i + 1);
                      setFolderStack(newStack);
                      fetchItems(folder.id);
                    }}
                    className={cn(
                      "hover:text-foreground transition-colors",
                      i === folderStack.length - 1 && "text-foreground font-medium"
                    )}
                  >
                    {folder.name}
                  </button>
                </span>
              ))}
            </div>
          )}
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading && !items.length ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <FolderIcon className="size-10 mb-2 opacity-40" />
              <p className="text-sm">
                {loaded ? "No items found" : "Loading..."}
              </p>
            </div>
          ) : isEmail ? (
            <EmailList items={items} />
          ) : (
            <FileList
              items={items}
              onFolderClick={handleFolderClick}
              loading={loading}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============================================================================
// File list view
// ============================================================================

function FileList({
  items,
  onFolderClick,
  loading,
}: {
  items: CloudItem[];
  onFolderClick: (item: CloudItem) => void;
  loading: boolean;
}) {
  // Sort: folders first, then by name
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const aIsFolder = isFolder(a);
      const bIsFolder = isFolder(b);
      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  return (
    <div className="space-y-0.5">
      {loading && (
        <div className="flex items-center justify-center py-2">
          <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {sorted.map((item) => {
        const itemIsFolder = isFolder(item);
        const Icon = itemIsFolder ? FolderIcon : getFileIcon(item);

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (itemIsFolder) {
                onFolderClick(item);
              } else if (item.webViewLink) {
                window.open(item.webViewLink, "_blank");
              }
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted group"
          >
            <div className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              itemIsFolder ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
            )}>
              <Icon className="size-4.5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">
                {item.size ? formatSize(item.size) : ""}
                {item.size && item.modifiedTime ? " \u00B7 " : ""}
                {item.modifiedTime ? formatDistanceToNow(new Date(item.modifiedTime), { addSuffix: true }) : ""}
              </p>
            </div>
            {!itemIsFolder && item.webViewLink && (
              <ExternalLinkIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Email list view (Gmail / Outlook)
// ============================================================================

function EmailList({ items }: { items: CloudItem[] }) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => {
            if (item.webViewLink) {
              window.open(item.webViewLink, "_blank");
            }
          }}
          className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted group"
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
            <MailIcon className="size-4.5" />
          </div>
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate flex-1">
                {item.subject || item.name}
              </p>
              {item.hasAttachments && (
                <PaperclipIcon className="size-3 shrink-0 text-muted-foreground" />
              )}
            </div>
            {item.from && (
              <p className="text-xs text-muted-foreground truncate">{item.from}</p>
            )}
            {item.snippet && (
              <p className="text-xs text-muted-foreground/70 truncate">{item.snippet}</p>
            )}
            {item.date && (
              <p className="text-xs text-muted-foreground/50">
                {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
              </p>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function isFolder(item: CloudItem): boolean {
  if (item.mimeType && FOLDER_MIMES.has(item.mimeType)) return true;
  if (item.type && FOLDER_MIMES.has(item.type)) return true;
  if (item.type === "folder" || item.type === "Folder") return true;
  return false;
}

function getFileIcon(item: CloudItem) {
  const mime = item.mimeType?.toLowerCase() ?? "";
  const name = item.name?.toLowerCase() ?? "";
  if (mime.startsWith("image/") || /\.(jpg|jpeg|png|gif|svg|webp)$/.test(name))
    return ImageIcon;
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm)$/.test(name))
    return VideoIcon;
  if (mime.startsWith("audio/") || /\.(mp3|wav|flac|ogg|m4a)$/.test(name))
    return MusicIcon;
  if (mime.includes("spreadsheet") || mime.includes("excel") || /\.(xlsx|xls|csv)$/.test(name))
    return TableIcon;
  if (mime.includes("presentation") || mime.includes("powerpoint") || /\.(pptx|ppt)$/.test(name))
    return PresentationIcon;
  if (mime.includes("zip") || mime.includes("archive") || /\.(zip|tar|gz|rar|7z)$/.test(name))
    return ArchiveIcon;
  if (
    mime.includes("text") ||
    mime.includes("document") ||
    mime.includes("pdf") ||
    /\.(txt|md|doc|docx|pdf|rtf)$/.test(name)
  )
    return FileTextIcon;
  return FileIcon;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
