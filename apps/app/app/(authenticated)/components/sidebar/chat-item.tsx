"use client";

import { useState, useRef, useEffect } from "react";
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
  ArchiveIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

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
};

type ChatItemProps = {
  chat: Chat;
};

export function ChatItem({ chat }: ChatItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const isActive = pathname === `/chat/${chat.id}`;

  const Icon = getIconForChat(chat.title);
  const utils = trpc.useUtils();

  const updateSession = trpc.sessions.update.useMutation({
    onSuccess: () => utils.sessions.list.invalidate(),
  });

  const deleteSession = trpc.sessions.delete.useMutation({
    onSuccess: () => utils.sessions.list.invalidate(),
  });

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/chat/${chat.id}`);
  };

  const handleOpenInNewTab = () => {
    window.open(`/chat/${chat.id}`, "_blank");
  };

  const handleRenameStart = () => {
    setRenameValue(chat.title);
    setIsRenaming(true);
  };

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== chat.title) {
      updateSession.mutate({ id: chat.id, title: trimmed });
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRenameSubmit();
    } else if (e.key === "Escape") {
      setIsRenaming(false);
    }
  };

  const handleArchive = () => {
    updateSession.mutate({ id: chat.id, status: "completed" });
  };

  const handleDelete = () => {
    deleteSession.mutate({ id: chat.id });
    setShowDeleteDialog(false);
  };

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
            <Icon className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            <span className="truncate">{chat.title}</span>
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
          <DropdownMenuContent align="end" className="w-[180px]">
            <DropdownMenuItem onClick={handleShare} className="gap-2">
              <ShareIcon className="h-4 w-4" />
              Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRenameStart} className="gap-2">
              <PenLineIcon className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenInNewTab} className="gap-2">
              <ExternalLinkIcon className="h-4 w-4" />
              Open in new tab
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive} className="gap-2">
              <ArchiveIcon className="h-4 w-4" />
              Archive
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
    </>
  );
}
