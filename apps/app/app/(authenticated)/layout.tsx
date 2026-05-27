import { showBetaFeature } from "@repo/feature-flags";
import { secure } from "@repo/security";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { env } from "@/env";
import { getSession } from "@/lib/dal";
import { AppShell } from "./_components/app-shell/app-shell";

type AppLayoutProperties = {
  readonly children: ReactNode;
};

export const dynamic = "force-dynamic";

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

  return (
    <AppShell
      betaFeature={betaFeature}
      userEmail={session.user.email ?? ""}
      userId={session.user.id ?? ""}
    >
      {children}
    </AppShell>
  );
};

export default AppLayout;
