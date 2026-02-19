"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import {
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@repo/design-system/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { ScrollArea } from "@repo/design-system/components/ui/scroll-area";
import {
  BotIcon,
  CloudSunIcon,
  CodeIcon,
  DatabaseIcon,
  MailIcon,
  PaletteIcon,
  SearchIcon,
  ActivityIcon,
  EllipsisIcon,
  PenLineIcon,
  ShareIcon,
  StarIcon,
  ExternalLinkIcon,
  FolderIcon,
  Trash2Icon,
  Loader2Icon,
  CheckIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  removeSession,
  updateSession as updateSessionAction,
  toggleSessionFavorite,
} from "@/lib/store/slices/sessions.slice";
import {
  useUpdateSessionMutation,
  useAddSessionToProjectMutation,
  useDeleteSessionMutation,
} from "@/lib/store/api/api.slice";
import { toast } from "sonner";

const chatIconMap: Record<string, LucideIcon> = {
  weather: CloudSunIcon,
  email: MailIcon,
  mail: MailIcon,
  code: CodeIcon,
  coding: CodeIcon,
  programming: CodeIcon,
  design: PaletteIcon,
  ui: PaletteIcon,
  data: DatabaseIcon,
  database: DatabaseIcon,
  research: SearchIcon,
  search: SearchIcon,
  meeting: ActivityIcon,
  recording: ActivityIcon,
  default: BotIcon,
};

function getIconForChat(title: string): LucideIcon {
  const lowerTitle = title.toLowerCase();
  for (const [keyword, icon] of Object.entries(chatIconMap)) {
    if (keyword !== "default" && lowerTitle.includes(keyword)) {
      return icon;
    }
  }
  return chatIconMap.default!;
}

type Chat = {
  id: string;
  title: string;
  isFavorite?: boolean;
  projectId?: string | null;
};

type ChatItemProps = {
  chat: Chat;
};

export const ChatItem = memo(function ChatItem({ chat }: ChatItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveSearch, setMoveSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    chat.projectId ?? null
  );
  const [linkCopied, setLinkCopied] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const isActive = pathname === `/chat/${chat.id}`;
  // Narrow selectors: each returns a primitive, so ChatItem only re-renders
  // when that specific value changes — not when any session is updated.
  const isLoading = useAppSelector(
    (state) => state.chat.isStreaming && state.chat.currentStreamingSessionId === chat.id
  );
  const isFavoriteFromRedux = useAppSelector(
    (state) => state.sessions.sessions?.find((s: { id: string }) => s.id === chat.id)?.isFavorite ?? false
  );
  const dispatch = useAppDispatch();
  const [updateSession] = useUpdateSessionMutation();
  const [addSessionToProject] = useAddSessionToProjectMutation();
  const [deleteSession] = useDeleteSessionMutation();
  const [isMoving, setIsMoving] = useState(false);

  const Icon = getIconForChat(chat.title);

  const projects = useAppSelector((state) => state.projects.projects);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleShare = useCallback(() => {
    const link = `${window.location.origin}/chat/${chat.id}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    toast.success("Link copied to clipboard");
    setTimeout(() => setLinkCopied(false), 2000);
  }, [chat.id]);

  const handleOpenInNewTab = useCallback(() => {
    window.open(`/chat/${chat.id}`, "_blank");
  }, [chat.id]);

  const handleRenameStart = useCallback(() => {
    setRenameValue(chat.title);
    setIsRenaming(true);
  }, [chat.title]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== chat.title) {
      dispatch(updateSessionAction({ id: chat.id, updates: { title: trimmed } }));
      updateSession({ id: chat.id, title: trimmed }).catch(() => {});
    }
    setIsRenaming(false);
  }, [renameValue, chat.title, chat.id, dispatch, updateSession]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleRenameSubmit();
      } else if (e.key === "Escape") {
        setIsRenaming(false);
      }
    },
    [handleRenameSubmit]
  );

  const handleToggleFavorite = useCallback(() => {
    dispatch(toggleSessionFavorite(chat.id));
    const isFav = !(isFavoriteFromRedux ?? chat.isFavorite ?? false);
    updateSession({ id: chat.id, metadata: { isFavorite: isFav } }).catch(() => {});
    toast.success(isFav ? "Added to favorites" : "Removed from favorites");
  }, [chat.id, chat.isFavorite, isFavoriteFromRedux, dispatch, updateSession]);

  const handleMoveToProject = useCallback(async () => {
    if (!selectedProjectId) return;
    setIsMoving(true);
    try {
      await addSessionToProject({
        projectId: selectedProjectId,
        sessionId: chat.id,
      }).unwrap();
      const project = projects?.find((p: any) => p.id === selectedProjectId);
      toast.success(`Moved to ${project?.name ?? "project"}`);
      dispatch(updateSessionAction({ id: chat.id, updates: { projectId: selectedProjectId } }));
      setShowMoveDialog(false);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to move to project");
    } finally {
      setIsMoving(false);
    }
  }, [selectedProjectId, chat.id, projects, dispatch, addSessionToProject]);

  const handleDelete = useCallback(() => {
    dispatch(removeSession(chat.id));
    deleteSession(chat.id).catch(() => {});
    setShowDeleteDialog(false);
    if (isActive) {
      router.push("/");
    }
  }, [chat.id, dispatch, isActive, router, deleteSession]);

  const isFavorite = isFavoriteFromRedux ?? chat.isFavorite ?? false;
  const filteredProjects = useMemo(() => {
    const query = moveSearch.toLowerCase();
    return (projects ?? []).filter((p) => p.name.toLowerCase().includes(query));
  }, [projects, moveSearch]);

  // Rename mode — inline editing
  if (isRenaming) {
    return (
      <SidebarMenuItem>
        <div className="flex items-center h-9 rounded-[10px] ps-[9px] pe-[2px] gap-3">
          {isLoading ? (
            <Loader2Icon className="size-[18px] shrink-0 animate-spin text-sidebar-foreground/40" />
          ) : (
            <Icon className="size-[18px] shrink-0 text-sidebar-foreground/40" />
          )}
          <input
            ref={renameInputRef}
            className="flex-1 bg-transparent text-sm outline-none border-b border-primary min-w-0"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameSubmit}
          />
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          tooltip={chat.title}
          className="h-9 rounded-[10px] gap-3 ps-[9px] pe-[2px] [&>svg]:size-[18px]"
        >
          <Link href={`/chat/${chat.id}`}>
            {isLoading ? (
              <Loader2Icon className="animate-spin text-sidebar-foreground/40" />
            ) : (
              <Icon className="text-sidebar-foreground/40" />
            )}
            <span className="flex-1 min-w-0 truncate text-sm">{chat.title}</span>
            {isFavorite && (
              <StarIcon className="!size-3 fill-yellow-400 text-yellow-400 shrink-0" />
            )}
          </Link>
        </SidebarMenuButton>

        {/* Three-dots menu — shows on hover (Manus style) */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className="right-[2px] size-8 rounded-lg hover:bg-sidebar-accent/60 [&>svg]:size-[18px] data-[state=open]:opacity-100"
            >
              <EllipsisIcon className="text-sidebar-foreground/40" />
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={handleShare} className="gap-2">
              {linkCopied ? (
                <CheckIcon className="size-4" />
              ) : (
                <ShareIcon className="size-4" />
              )}
              {linkCopied ? "Copied!" : "Share"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRenameStart} className="gap-2">
              <PenLineIcon className="size-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleFavorite} className="gap-2">
              <StarIcon
                className={`size-4 ${isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
              />
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenInNewTab} className="gap-2">
              <ExternalLinkIcon className="size-4" />
              Open in new tab
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setMoveSearch("");
                setSelectedProjectId(chat.projectId ?? null);
                setShowMoveDialog(true);
              }}
              className="gap-2"
            >
              <FolderIcon className="size-4" />
              Move to project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2Icon className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{chat.title}&rdquo; and all its messages. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move to project dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Project</DialogTitle>
            <DialogDescription>
              Select a project to move &ldquo;{chat.title}&rdquo; to.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={moveSearch}
              onChange={(e) => setMoveSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="max-h-[280px]">
            {filteredProjects.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {moveSearch ? "No projects found" : "No projects yet"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                      selectedProjectId === project.id
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-md"
                      style={{
                        backgroundColor: project.color
                          ? `${project.color}20`
                          : undefined,
                      }}
                    >
                      {project.icon ? (
                        <span className="text-sm">{project.icon}</span>
                      ) : (
                        <FolderIcon
                          className="size-4"
                          style={{ color: project.color ?? undefined }}
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{project.name}</p>
                      {project.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {project.description}
                        </p>
                      )}
                    </div>
                    {selectedProjectId === project.id && (
                      <CheckIcon className="size-4 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleMoveToProject}
              disabled={!selectedProjectId || isMoving}
            >
              {isMoving ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
