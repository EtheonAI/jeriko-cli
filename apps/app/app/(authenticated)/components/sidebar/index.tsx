"use client";

import { useMemo, useState } from "react";
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
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/design-system/components/ui/collapsible";
import { Skeleton } from "@repo/design-system/components/ui/skeleton";
import { ChevronUpIcon, MessageSquareIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useAppSelector } from "@/lib/store/hooks";
import { NavSection } from "./nav-section";
import { NewTaskButton } from "./new-task-button";
import { SearchButton } from "./search-button";
import { SidebarFooter } from "./sidebar-footer";
import { ChatItem } from "./chat-item";
import { ProjectsSection } from "./projects-section";
import { TaskFilter, type TaskFilterType } from "./task-filter";

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
  status?: string | null;
  projectId?: string | null;
  isShared?: boolean;
  isFavorite?: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

/** Apply the Manus-style filter to session list */
function filterSessions(sessions: Session[], filter: TaskFilterType): Session[] {
  switch (filter) {
    case "non-project":
      return sessions.filter((s) => !s.projectId && !(s.metadata as any)?.projectId);
    case "favorites":
      return sessions.filter(
        (s) => s.isFavorite || (s.metadata as any)?.isFavorite
      );
    case "scheduled":
      return sessions.filter(
        (s) =>
          s.status === "paused" ||
          (s.metadata as any)?.isScheduled ||
          (s.metadata as any)?.scheduledAt
      );
    case "shared":
      return sessions.filter(
        (s) => s.isShared || (s.metadata as any)?.isShared
      );
    case "all":
    default:
      return sessions;
  }
}

/** Get filter label for the section header */
function getFilterLabel(filter: TaskFilterType): string {
  switch (filter) {
    case "non-project":
      return "Non-project tasks";
    case "favorites":
      return "Favorites";
    case "scheduled":
      return "Scheduled";
    case "shared":
      return "Shared";
    case "all":
    default:
      return "All tasks";
  }
}

export function GlobalSidebar({ children, user }: GlobalSidebarProps) {
  const { open } = useSidebar();
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const isLoading = useAppSelector((state) => state.sessions.isLoading);
  const [filter, setFilter] = useState<TaskFilterType>("all");
  const [tasksOpen, setTasksOpen] = useState(true);

  const filteredSessions = useMemo(
    () => filterSessions(sessions ?? [], filter),
    [sessions, filter]
  );

  return (
    <>
      <Sidebar variant="inset" collapsible="icon">
        {/* Header — Logo only (Manus style) */}
        <SidebarHeader className="p-2">
          <div className="flex items-center justify-between h-[44px] py-3 px-1 group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                R
              </div>
              <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
                Rubic
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="flex flex-col gap-0">
          {/* Top navigation — Manus: New task, Search, Library, Automations */}
          <SidebarGroup className="p-2 pb-0">
            <SidebarMenu className="gap-px">
              <NewTaskButton />
              <SearchButton />
            </SidebarMenu>
            <SidebarGroupContent className="mt-px">
              <NavSection />
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarSeparator className="mx-2 opacity-0" />

          {/* Scrollable area: Projects + All tasks */}
          <div className="group-data-[collapsible=icon]:hidden flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
            {/* Projects section (collapsible) */}
            <div className="px-2">
              <ProjectsSection />
            </div>

            {/* All tasks section (collapsible, with filter) */}
            <Collapsible open={tasksOpen} onOpenChange={setTasksOpen} className="group/tasks flex-1 min-h-0 px-2">
              <SidebarGroup className="p-0 pt-[11px] flex flex-col flex-1 min-h-0">
                <SidebarGroupLabel
                  asChild
                  className="h-9 px-[10px] text-[13px] font-medium text-sidebar-foreground/50 tracking-tight cursor-pointer hover:bg-sidebar-accent/50 rounded-[10px] transition-colors"
                >
                  <div className="flex items-center w-full">
                    <CollapsibleTrigger className="flex items-center flex-1 min-w-0 gap-0.5">
                      <span className="flex-1 min-w-0 truncate text-left text-[13px] font-medium">
                        {getFilterLabel(filter)}
                      </span>
                      <ChevronUpIcon
                        className={`size-3.5 text-sidebar-foreground/40 transition-all shrink-0 opacity-0 group-hover/tasks:opacity-100 ${
                          !tasksOpen ? "rotate-180" : ""
                        }`}
                      />
                    </CollapsibleTrigger>
                    <TaskFilter value={filter} onChange={setFilter} />
                  </div>
                </SidebarGroupLabel>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-px pb-5">
                      {isLoading ? (
                        <>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <SidebarMenuItem key={i}>
                              <Skeleton className="h-9 w-full rounded-[10px]" />
                            </SidebarMenuItem>
                          ))}
                        </>
                      ) : filteredSessions.length === 0 ? (
                        <li className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-sidebar-foreground/30">
                          <MessageSquareIcon className="size-6" />
                          <p className="text-xs text-center">
                            {filter === "all"
                              ? "No conversations yet"
                              : `No ${getFilterLabel(filter).toLowerCase()}`}
                          </p>
                        </li>
                      ) : (
                        filteredSessions.map((session) => (
                          <ChatItem
                            key={session.id}
                            chat={{
                              id: session.id,
                              title: session.title || "Untitled",
                              isFavorite:
                                !!(session as any).isFavorite ||
                                !!(session.metadata as any)?.isFavorite,
                              projectId:
                                (session as any).projectId ??
                                (session.metadata as any)?.projectId ??
                                null,
                            }}
                          />
                        ))
                      )}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </div>
        </SidebarContent>

        {user && <SidebarFooter user={user} />}
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
}
