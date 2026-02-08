"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@repo/design-system/components/ui/sidebar";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Button } from "@repo/design-system/components/ui/button";
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
  MoreHorizontalIcon,
  PenLineIcon,
  StarIcon,
  FolderIcon,
  FileTextIcon,
  Trash2Icon,
  InfoIcon,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  updateSession as updateSessionInStore,
  removeSession,
  toggleSessionFavorite,
} from "@/lib/store/slices/sessions.slice";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { CollaboratePopover } from "./collaborate-popover";
import { SharePopover } from "./share-popover";
import { MoveToProjectDialog } from "./move-to-project-dialog";
import { TaskDetailsSheet } from "./task-details-sheet";
import type { AgentSession } from "@/lib/store/slices/sessions.slice";
import type { UIMessage } from "@repo/ai/lib/types";

interface ChatHeaderProps {
  sessionId: string;
  user: {
    name?: string | null;
    email: string;
    image?: string | null;
  };
  messages: UIMessage[];
  onToggleFileManagement: () => void;
  isFileManagementOpen: boolean;
}

export function ChatHeader({
  sessionId,
  user,
  messages,
  onToggleFileManagement,
  isFileManagementOpen,
}: ChatHeaderProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const session = useAppSelector((state) =>
    state.sessions.sessions.find((s: AgentSession) => s.id === sessionId)
  );

  // Local state
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session?.title ?? "");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: (updated) => {
      if (updated) {
        dispatch(updateSessionInStore({ id: updated.id, updates: updated as any }));
      }
    },
    onError: () => utils.sessions.list.invalidate(),
  });

  const deleteSession = trpc.sessions.delete.useMutation({
    onSuccess: () => {
      dispatch(removeSession(sessionId));
      router.push("/");
    },
    onError: () => {
      toast.error("Failed to delete conversation");
      utils.sessions.list.invalidate();
    },
  });

  // Auto-focus rename input
  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  // Handlers
  const handleRenameStart = useCallback(() => {
    setRenameValue(session?.title ?? "");
    setIsRenaming(true);
  }, [session?.title]);

  const handleRenameSubmit = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session?.title) {
      dispatch(updateSessionInStore({ id: sessionId, updates: { title: trimmed } }));
      updateSession.mutate({ id: sessionId, title: trimmed });
    }
    setIsRenaming(false);
  }, [renameValue, session?.title, sessionId, dispatch, updateSession]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleRenameSubmit();
      else if (e.key === "Escape") setIsRenaming(false);
    },
    [handleRenameSubmit]
  );

  const handleToggleFavorite = useCallback(() => {
    dispatch(toggleSessionFavorite(sessionId));
    const isFav = !session?.isFavorite;
    updateSession.mutate({
      id: sessionId,
      metadata: { isFavorite: isFav },
    });
    toast.success(isFav ? "Added to favorites" : "Removed from favorites");
  }, [sessionId, session?.isFavorite, dispatch, updateSession]);

  const handleDelete = useCallback(() => {
    dispatch(removeSession(sessionId));
    deleteSession.mutate({ id: sessionId });
    setShowDeleteDialog(false);
  }, [sessionId, dispatch, deleteSession]);

  const handleShareChange = useCallback(
    (isPublic: boolean) => {
      const shareId = isPublic ? sessionId : null;
      dispatch(
        updateSessionInStore({
          id: sessionId,
          updates: { isShared: isPublic, shareId },
        })
      );
      updateSession.mutate({
        id: sessionId,
        metadata: { isShared: isPublic, shareId },
      });
    },
    [sessionId, dispatch, updateSession]
  );

  const handleMoved = useCallback(
    (projectId: string, projectName: string) => {
      dispatch(
        updateSessionInStore({
          id: sessionId,
          updates: { projectId },
        })
      );
    },
    [sessionId, dispatch]
  );

  const isFavorite = session?.isFavorite ?? false;
  const displayTitle = session?.title ?? "New Chat";

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        {/* Left side: sidebar trigger + title */}
        <div className="flex items-center gap-2 min-w-0">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-2 h-4" orientation="vertical" />

          {isRenaming ? (
            <input
              ref={renameInputRef}
              className="bg-transparent text-sm font-medium outline-none border-b border-primary max-w-[300px]"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={handleRenameSubmit}
            />
          ) : (
            <span className="text-sm font-medium truncate max-w-[300px]">
              {displayTitle}
            </span>
          )}

          {isFavorite && (
            <StarIcon className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400 shrink-0" />
          )}
        </div>

        {/* Right side: action buttons */}
        <div className="flex items-center gap-2">
          {/* Collaborate */}
          <CollaboratePopover
            sessionId={sessionId}
            currentUser={user}
            collaborators={
              (session?.sharedWith ?? []).map((email: string, i: number) => ({
                id: `collab-${i}`,
                name: email.split("@")[0] ?? email,
                email,
                role: "editor" as const,
              }))
            }
            onInvite={(email) => {
              const current = session?.sharedWith ?? [];
              if (current.includes(email)) {
                toast.error("Already invited");
                return;
              }
              const updated = [...current, email];
              dispatch(
                updateSessionInStore({
                  id: sessionId,
                  updates: { sharedWith: updated },
                })
              );
              updateSession.mutate({
                id: sessionId,
                metadata: { sharedWith: updated },
              });
            }}
          />

          {/* Share */}
          <SharePopover
            sessionId={sessionId}
            isShared={session?.isShared ?? false}
            shareId={session?.shareId}
            onShareChange={handleShareChange}
          />

          {/* File Management */}
          <Button
            variant={isFileManagementOpen ? "secondary" : "outline"}
            size="sm"
            className="gap-2"
            onClick={onToggleFileManagement}
          >
            <FileTextIcon className="h-4 w-4" />
            Files
          </Button>

          {/* More actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
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
              <DropdownMenuItem
                onClick={() => setShowMoveDialog(true)}
                className="gap-2"
              >
                <FolderIcon className="h-4 w-4" />
                Move to project
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowTaskDetails(true)}
                className="gap-2"
              >
                <InfoIcon className="h-4 w-4" />
                Task details
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
        </div>
      </header>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{displayTitle}&rdquo; and all its
              messages. This action cannot be undone.
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
      <MoveToProjectDialog
        open={showMoveDialog}
        onOpenChange={setShowMoveDialog}
        sessionId={sessionId}
        currentProjectId={session?.projectId}
        onMoved={handleMoved}
      />

      {/* Task details sheet */}
      <TaskDetailsSheet
        open={showTaskDetails}
        onOpenChange={setShowTaskDetails}
        session={session ?? null}
        messageCount={messages.length}
      />
    </>
  );
}
