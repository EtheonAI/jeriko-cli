import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import type { ReactNode } from "react";
import { NotificationsProvider } from "../notifications-provider";
import { AppSidebar } from "../sidebar/app-sidebar";
import { AppHeader } from "./app-header";

type AppShellProps = {
  readonly betaFeature: boolean;
  readonly children: ReactNode;
  readonly userEmail: string;
  readonly userId: string;
};

export function AppShell({ betaFeature, children, userEmail, userId }: AppShellProps) {
  return (
    <NotificationsProvider userId={userId}>
      <SidebarProvider>
        <AppSidebar userEmail={userEmail}>
          <AppHeader betaFeature={betaFeature} />
          {children}
        </AppSidebar>
      </SidebarProvider>
    </NotificationsProvider>
  );
}
