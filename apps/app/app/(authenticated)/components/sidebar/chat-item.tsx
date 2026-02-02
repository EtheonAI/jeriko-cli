"use client";

import { useState } from "react";
import { SidebarMenuItem, SidebarMenuButton } from "@repo/design-system/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
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
  const Icon = getIconForChat(chat.title);

  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/chat/${chat.id}`);
  };

  const handleOpenInNewTab = () => {
    window.open(`/chat/${chat.id}`, "_blank");
  };

  return (
    <SidebarMenuItem className="group/item">
      <SidebarMenuButton
        asChild
        className="h-9 px-3 gap-3 rounded-[10px] pr-10"
      >
        <Link href={`/chat/${chat.id}`}>
          <Icon className="h-[18px] w-[18px] shrink-0 text-sidebar-foreground/60" />
          <span className="truncate text-[14px]">{chat.title}</span>
        </Link>
      </SidebarMenuButton>

      {/* Three-dots menu */}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="absolute right-1 top-1/2 -translate-y-1/2 size-7 flex items-center justify-center rounded-md opacity-0 group-hover/item:opacity-100 hover:bg-sidebar-accent/60 transition-opacity"
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
          <DropdownMenuItem className="gap-2">
            <PenLineIcon className="h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <StarIcon className="h-4 w-4" />
            Add to favorites
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleOpenInNewTab} className="gap-2">
            <ExternalLinkIcon className="h-4 w-4" />
            Open in new tab
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2">
            <ArchiveIcon className="h-4 w-4" />
            Archive
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="gap-2">
            <Trash2Icon className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}
