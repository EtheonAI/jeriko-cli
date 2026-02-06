"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { useSidebar } from "@repo/design-system/components/ui/sidebar";
import { cn } from "@repo/design-system/lib/utils";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function NewTaskButton() {
  const { open } = useSidebar();
  const router = useRouter();

  return (
    <Button
      className={cn(
        "h-9 w-full justify-start gap-3 rounded-lg",
        "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90",
        !open && "w-9 justify-center px-0"
      )}
      onClick={() => router.push("/")}
    >
      <PlusIcon className="h-4 w-4 shrink-0" />
      {open && <span>New task</span>}
    </Button>
  );
}
