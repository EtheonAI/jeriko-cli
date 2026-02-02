"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import {
  SidebarFooter as SidebarFooterPrimitive,
  SidebarMenu,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import {
  Settings2Icon,
  BookOpenIcon,
} from "lucide-react";
import { useSettings } from "../settings/settings-context";

type UserInfo = {
  name: string | null;
  email: string;
  image: string | null;
};

type SidebarFooterProps = {
  user: UserInfo;
};

export function SidebarFooter({ user }: SidebarFooterProps) {
  const { openSettings } = useSettings();

  return (
    <SidebarFooterPrimitive className="border-t border-sidebar-border/40 p-3">
      <SidebarMenu>
        <SidebarMenuItem className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  onClick={() => openSettings("settings")}
                >
                  <Settings2Icon className="h-[18px] w-[18px]" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Settings</TooltipContent>
            </Tooltip>

            <ModeToggle />
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                asChild
              >
                <a href="/help" target="_blank" rel="noreferrer">
                  <BookOpenIcon className="h-[18px] w-[18px]" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Documentation</TooltipContent>
          </Tooltip>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterPrimitive>
  );
}
