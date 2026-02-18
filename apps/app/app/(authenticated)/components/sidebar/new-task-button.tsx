"use client";

import {
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@repo/design-system/components/ui/sidebar";
import { SquarePenIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function NewTaskButton() {
  const { open } = useSidebar();
  const router = useRouter();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip="New task"
        className="h-9 rounded-[10px] gap-3 ps-[9px] pe-[2px] bg-sidebar-accent/60 hover:bg-sidebar-accent/40 [&>svg]:size-[18px]"
        onClick={() => router.push("/")}
      >
        <SquarePenIcon />
        {open && <span className="text-sm">New task</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
