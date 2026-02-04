import { auth } from "@repo/auth";
import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { showBetaFeature } from "@repo/feature-flags";
import { secure } from "@repo/security";
import type { ReactNode } from "react";
import { env } from "@/env";
import { NotificationsProvider } from "./components/notifications-provider";
import { GlobalSidebar } from "./components/sidebar/index";
import { SettingsProvider } from "./components/settings/settings-context";
import { SettingsDialog } from "./components/settings/settings-dialog";
import { SearchProvider } from "./components/search";
import { AuthenticatedProviders } from "./providers";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

type AppLayoutProperties = {
  readonly children: ReactNode;
};

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }

  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  const betaFeature = await showBetaFeature();

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  return (
    <AuthenticatedProviders>
      <NotificationsProvider userId={session.user.id ?? ""}>
        <SettingsProvider>
          <SearchProvider>
            <SidebarProvider>
              <GlobalSidebar user={user}>
                {betaFeature && (
                  <div className="m-4 rounded-full bg-blue-500 p-1.5 text-center text-sm text-white">
                    Beta feature now available
                  </div>
                )}
                {children}
              </GlobalSidebar>
            </SidebarProvider>
            <SettingsDialog user={user} isPro={false} />
          </SearchProvider>
        </SettingsProvider>
      </NotificationsProvider>
    </AuthenticatedProviders>
  );
};

export default AppLayout;
