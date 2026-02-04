"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useSidebar } from "@repo/design-system/components/ui/sidebar";
import { Kbd } from "@repo/design-system/components/ui/kbd";
import { cn } from "@repo/design-system/lib/utils";
import { SearchIcon } from "lucide-react";
import { useSearch } from "@/lib/hooks/use-search";

export function SearchButton() {
  const { open } = useSidebar();
  const { open: openSearch } = useSearch();

  return (
    <Button
      variant="outline"
      className={cn(
        "h-9 w-full justify-start gap-3 rounded-lg",
        "border-sidebar-border bg-transparent",
        "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40",
        !open && "w-9 justify-center px-0"
      )}
      onClick={openSearch}
    >
      <SearchIcon className="h-4 w-4 shrink-0" />
      {open && (
        <>
          <span className="flex-1 text-left">Search</span>
          <Kbd className="text-[10px] bg-sidebar-accent/40 text-sidebar-foreground/60 border-sidebar-border">
            <span>&#8984;</span>K
          </Kbd>
        </>
      )}
    </Button>
  );
}
