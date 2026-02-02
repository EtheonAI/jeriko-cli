"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useSidebar } from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { PlusIcon } from "lucide-react";
import Link from "next/link";

export function NewTaskButton() {
  const { open } = useSidebar();

  return (
    <Button
      asChild
      className={cn(
        "h-9 w-full justify-start gap-3 rounded-[10px]",
        "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
        !open && "w-9 justify-center px-0"
      )}
    >
      <Link href="/">
        <PlusIcon className="h-4 w-4 shrink-0" />
        {open && <span>New task</span>}
      </Link>
    </Button>
  );
}
