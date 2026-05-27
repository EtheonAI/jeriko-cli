import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
} from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { NavSection } from "./nav-section";
import { SidebarFooter } from "./sidebar-footer";

type AppSidebarProps = {
  readonly children: ReactNode;
  readonly userEmail: string;
};

export function AppSidebar({ children, userEmail }: AppSidebarProps) {
  return (
    <>
      <Sidebar collapsible="icon" variant="inset">
        <SidebarHeader className="p-2">
          <div className="flex h-[44px] items-center justify-between px-1 py-3 group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
                J
              </div>
              <span className="text-sm font-semibold group-data-[collapsible=icon]:hidden">
                Jeriko
              </span>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="flex flex-col gap-0">
          <SidebarGroup className="p-2 pb-0">
            <SidebarGroupContent className="mt-px">
              <NavSection />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter userEmail={userEmail} />
      </Sidebar>
      <SidebarInset>{children}</SidebarInset>
    </>
  );
}
