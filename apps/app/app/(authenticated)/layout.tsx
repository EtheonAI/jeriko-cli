import { SidebarProvider } from "@repo/design-system/components/ui/sidebar";
import { showBetaFeature } from "@repo/feature-flags";
import { secure } from "@repo/security";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import { env } from "@/env";
import { getSession } from "@/lib/dal";
import { NotificationsProvider } from "./components/notifications-provider";
import { GlobalSidebar } from "./components/sidebar/index";
import { SettingsProvider } from "./components/settings/settings-context";
import { SearchProvider } from "./components/search";
import { AuthenticatedProviders } from "./providers";
import { redirect } from "next/navigation";

// Lazy-load SettingsDialog — most users never open settings on a given page load.
// This removes ~150KB of settings tab JS from the critical path.
const SettingsDialog = dynamic(
  () => import("./components/settings/settings-dialog").then((m) => ({ default: m.SettingsDialog })),
);

type AppLayoutProperties = {
  readonly children: ReactNode;
};

const AppLayout = async ({ children }: AppLayoutProperties) => {
  if (env.ARCJET_KEY) {
    await secure(["CATEGORY:PREVIEW"]);
  }

  // Use cached DAL — deduplicates with page-level calls in the same request.
  // Proxy.ts handles the primary auth redirect; this is a safety net for
  // edge cases (e.g. valid cookie but expired session).
  const session = await getSession();
  const betaFeature = await showBetaFeature();

  if (!session?.user) {
    redirect("/login");
  }

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  const u = session.user as Record<string, unknown>;
  const serverUser = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name || null,
    image: session.user.image || null,
    emailVerified: (u.emailVerified as boolean) ?? false,
    createdAt: u.createdAt instanceof Date
      ? u.createdAt.toISOString()
      : typeof u.createdAt === "string" ? u.createdAt : new Date().toISOString(),
  };

  return (
    <AuthenticatedProviders serverUser={serverUser}>
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
