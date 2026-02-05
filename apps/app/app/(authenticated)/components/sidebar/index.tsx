"use client";

import { useMemo } from "react";
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
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { MessageSquareIcon } from "lucide-react";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc/client";
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

type Session = {
  id: string;
  title: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

function groupSessionsByDate(sessions: Session[]) {
  const groups: { label: string; sessions: Session[] }[] = [];
  const buckets: Record<string, Session[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const lastWeek = new Date(today.getTime() - 7 * 86400000);

  const order = ["Today", "Yesterday", "Last 7 days", "Older"];

  for (const session of sessions) {
    const date = new Date(session.updatedAt);
    let label: string;
    if (date >= today) label = "Today";
    else if (date >= yesterday) label = "Yesterday";
    else if (date >= lastWeek) label = "Last 7 days";
    else label = "Older";

    if (!buckets[label]) buckets[label] = [];
    buckets[label].push(session);
  }

  for (const label of order) {
    if (buckets[label]?.length) {
      groups.push({ label, sessions: buckets[label] });
    }
  }

  return groups;
}

export function GlobalSidebar({ children, user }: GlobalSidebarProps) {
  const { data: sessions, isLoading } = trpc.sessions.list.useQuery();

  const grouped = useMemo(() => groupSessionsByDate(sessions ?? []), [sessions]);

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader className="p-2">
          {/* Logo */}
          <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              R
            </div>
            <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
              Rubic
            </span>
          </div>

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

          {/* Sessions */}
          <div className="group-data-[collapsible=icon]:hidden flex-1 min-h-0 flex flex-col overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col gap-1 px-4 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full rounded-lg" />
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-sidebar-foreground/40">
                <MessageSquareIcon className="h-8 w-8" />
                <p className="text-sm text-center">No conversations yet</p>
              </div>
            ) : (
              grouped.map((group) => (
                <SidebarGroup key={group.label} className="p-0">
                  <SidebarGroupLabel className="px-4 text-sidebar-foreground/60">
                    {group.label}
                  </SidebarGroupLabel>
                  <SidebarGroupContent className="px-2">
                    <SidebarMenu className="gap-0.5">
                      {group.sessions.map((session) => (
                        <ChatItem
                          key={session.id}
                          chat={{
                            id: session.id,
                            title: session.title || "Untitled",
                          }}
                        />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              ))
            )}
          </div>
        </SidebarContent>

        {user && <SidebarFooter user={user} />}
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
}
