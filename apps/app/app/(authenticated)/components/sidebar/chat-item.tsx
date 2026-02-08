"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SidebarMenuItem, SidebarMenuButton } from "@repo/design-system/components/ui/sidebar";
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
  MoreHorizontalIcon,
  PenLineIcon,
  ShareIcon,
  StarIcon,
  ExternalLinkIcon,
  FolderIcon,
  Trash2Icon,
  Loader2Icon,
  CheckIcon,
  CopyIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  removeSession,
  updateSession as updateSessionAction,
  toggleSessionFavorite,
} from "@/lib/store/slices/sessions.slice";
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
  return chatIconMap.default;
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

export function ChatItem({ chat }: ChatItemProps) {
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
  const isActive = pathname === `/chat/${chat.id}`;
  const { isStreaming, currentStreamingSessionId } = useAppSelector((state) => state.chat);
  const session = useAppSelector((state) =>
    state.sessions.sessions.find((s: { id: string }) => s.id === chat.id)
  );
  const isLoading = isStreaming && currentStreamingSessionId === chat.id;
  const dispatch = useAppDispatch();

  const Icon = getIconForChat(chat.title);
  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: (updated) => {
      dispatch(updateSessionAction({ id: updated.id, updates: updated as any }));
    },
    onError: () => utils.sessions.list.invalidate(),
  });

  const deleteSession = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      dispatch(removeSession(chat.id));
    },
    onError: () => utils.sessions.list.invalidate(),
  });

  const { data: projects } = trpc.projects.list.useQuery(
    { status: "active", limit: 50 },
    { enabled: showMoveDialog }
  );

  const addSessionToProject = trpc.projects.addSession.useMutation({
    onSuccess: () => {
      const project = projects?.find((p) => p.id === selectedProjectId);
      toast.success(`Moved to ${project?.name ?? "project"}`);
      dispatch(
        updateSessionAction({
          id: chat.id,
          updates: { projectId: selectedProjectId },
        })
      );
      setShowMoveDialog(false);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to move to project");
    },
  });

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
      updateSession.mutate({ id: chat.id, title: trimmed });
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
    const isFav = !(session?.isFavorite ?? false);
    updateSession.mutate({
      id: chat.id,
      metadata: { isFavorite: isFav },
    });
    toast.success(isFav ? "Added to favorites" : "Removed from favorites");
  }, [chat.id, session?.isFavorite, dispatch, updateSession]);

  const handleMoveToProject = useCallback(() => {
    if (!selectedProjectId) return;
    addSessionToProject.mutate({
      projectId: selectedProjectId,
      sessionId: chat.id,
    });
  }, [selectedProjectId, chat.id, addSessionToProject]);

  const handleDelete = useCallback(() => {
    dispatch(removeSession(chat.id));
    deleteSession.mutate({ id: chat.id });
    setShowDeleteDialog(false);
  }, [chat.id, dispatch, deleteSession]);

  const isFavorite = session?.isFavorite ?? chat.isFavorite ?? false;
  const filteredProjects = (projects ?? []).filter((p) =>
    p.name.toLowerCase().includes(moveSearch.toLowerCase())
  );

  if (isRenaming) {
    return (
      <SidebarMenuItem>
        <div className="flex items-center h-9 px-2 gap-3 rounded-lg">
          <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
          <input
            ref={renameInputRef}
            className="flex-1 bg-transparent text-sm outline-none border-b border-primary"
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
      <SidebarMenuItem className="group/item">
        <SidebarMenuButton asChild isActive={isActive} className="h-9 px-2 pr-9 gap-3 rounded-lg">
          <Link href={`/chat/${chat.id}`}>
            {isLoading ? (
              <Loader2Icon className="h-4 w-4 shrink-0 animate-spin text-sidebar-foreground/50" />
            ) : (
              <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            )}
            <span className="truncate">{chat.title}</span>
            {isFavorite && (
              <StarIcon className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0 ml-auto" />
            )}
          </Link>
        </SidebarMenuButton>

        {/* Three-dots menu */}
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-md opacity-0 group-hover/item:opacity-100 data-[state=open]:opacity-100 hover:bg-sidebar-accent/60 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon className="h-4 w-4 text-sidebar-foreground/60" />
              <span className="sr-only">More options</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={handleShare} className="gap-2">
              {linkCopied ? (
                <CheckIcon className="h-4 w-4" />
              ) : (
                <ShareIcon className="h-4 w-4" />
              )}
              {linkCopied ? "Copied!" : "Share"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRenameStart} className="gap-2">
              <PenLineIcon className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleFavorite} className="gap-2">
              <StarIcon
                className={`h-4 w-4 ${isFavorite ? "fill-yellow-400 text-yellow-400" : ""}`}
              />
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenInNewTab} className="gap-2">
              <ExternalLinkIcon className="h-4 w-4" />
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
              <FolderIcon className="h-4 w-4" />
              Move to project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="gap-2"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2Icon className="h-4 w-4" />
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
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                          className="h-4 w-4"
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
                      <CheckIcon className="h-4 w-4 text-primary shrink-0" />
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
              disabled={!selectedProjectId || addSessionToProject.isPending}
            >
              {addSessionToProject.isPending ? "Moving..." : "Move"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
