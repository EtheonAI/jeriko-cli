"use client";

import { SearchIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { useSearch } from "@/lib/hooks/use-search";
import { cn } from "@repo/design-system/lib/utils";

interface SearchButtonProps {
  className?: string;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
  showShortcut?: boolean;
}

export function SearchButton({
  className,
  variant = "outline",
  size = "default",
  showShortcut = true,
}: SearchButtonProps) {
  const { open } = useSearch();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={open}
      className={cn(
        "relative justify-start text-muted-foreground",
        size !== "icon" && "w-full",
        className
      )}
    >
      <SearchIcon className="mr-2 h-4 w-4" />
      {size !== "icon" && (
        <>
          <span className="flex-1 text-left">Search...</span>
          {showShortcut && (
            <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          )}
        </>
      )}
    </Button>
  );
}
