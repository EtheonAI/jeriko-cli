"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator,
} from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { NavSection } from "./nav-section";
import { NewTaskButton } from "./new-task-button";
import { SearchButton } from "./search-button";
import { SidebarFooter } from "./sidebar-footer";
import { ChatItem } from "./chat-item";

type UserInfo = {
  name: string | null;
  email: string;
  image: string | null;
};

type GlobalSidebarProps = {
  readonly children: ReactNode;
  readonly user?: UserInfo;
};

// Simple chat data - in production this would come from an API
const recentChats = [
  { id: "1", title: "Meeting recording pending start" },
  { id: "2", title: "Daily Weather Forecast Email Automation" },
  { id: "3", title: "Building Multi-Platform Amazon Scraper" },
  { id: "4", title: "React Dashboard Component Design" },
  { id: "5", title: "API Integration for Payment Gateway" },
  { id: "6", title: "Marketing Campaign Analysis Report" },
  { id: "7", title: "Database Schema Migration Plan" },
  { id: "8", title: "User Authentication Flow Review" },
];

export function GlobalSidebar({ children, user }: GlobalSidebarProps) {
  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-2">
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <NewTaskButton />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SearchButton />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="flex flex-col gap-0">
          <NavSection />

          <SidebarSeparator className="mx-2" />

          {/* Recent Chats Section */}
          <SidebarGroup className="group-data-[collapsible=icon]:hidden flex-1 min-h-0 flex flex-col p-0">
            <SidebarGroupLabel className="px-4 text-sidebar-foreground/60">
              Recent
            </SidebarGroupLabel>
            <SidebarGroupContent className="flex-1 overflow-y-auto px-2">
              <SidebarMenu className="gap-0.5">
                {recentChats.map((chat) => (
                  <ChatItem key={chat.id} chat={chat} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {user && <SidebarFooter user={user} />}
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
}
