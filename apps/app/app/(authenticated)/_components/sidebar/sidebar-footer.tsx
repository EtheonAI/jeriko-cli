import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import {
  SidebarFooter as SidebarFooterPrimitive,
  SidebarMenu,
  SidebarMenuItem,
} from "@repo/design-system/components/ui/sidebar";
import { SignOutButton } from "./sign-out-button";

type SidebarFooterProps = {
  readonly userEmail: string;
};

export function SidebarFooter({ userEmail }: SidebarFooterProps) {
  return (
    <SidebarFooterPrimitive className="border-t border-sidebar-border/40 p-2">
      <SidebarMenu className="gap-1">
        <SidebarMenuItem>
          <SignOutButton />
        </SidebarMenuItem>
        <SidebarMenuItem className="flex items-center justify-between">
          <div className="flex items-center gap-0.5">
            <ModeToggle />
            <span className="ml-2 hidden max-w-32 truncate text-xs text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
              {userEmail}
            </span>
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooterPrimitive>
  );
}
