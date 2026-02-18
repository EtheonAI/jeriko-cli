"use client";

import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { SearchIcon, CommandIcon } from "lucide-react";
import { useSearch } from "@/lib/hooks/use-search";

export function SearchButton() {
  const { open } = useSidebar();
  const { open: openSearch } = useSearch();

  return (
    <SidebarMenuItem className="group/search">
      <SidebarMenuButton
        tooltip="Search"
        className="h-9 rounded-[10px] gap-3 ps-[9px] pe-[2px] [&>svg]:size-[18px]"
        onClick={openSearch}
      >
        <SearchIcon />
        {open && (
          <>
            <span className="flex-1 text-sm">Search</span>
            <span className="shrink-0 text-sidebar-foreground/40 text-sm hidden group-hover/search:inline-flex items-center gap-0.5 pe-2">
              <CommandIcon className="!size-3.5" />K
            </span>
          </>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
