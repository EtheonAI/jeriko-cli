import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import { AppWindowIcon, PlusIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";

export const metadata: Metadata = {
  title: "Applications | Rubic",
  description: "Manage your connected applications",
};

export default async function ApplicationsPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return (
    <>
      <Header
        title="Applications"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Applications</h1>
            <p className="text-muted-foreground">
              Connect and manage your external applications
            </p>
          </div>
          <Button className="gap-2">
            <PlusIcon className="h-4 w-4" />
            Connect app
          </Button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <AppWindowIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No applications connected</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
            Connect your favorite applications to extend Rubic&apos;s capabilities.
            Integrate with tools like Slack, Google Drive, GitHub, and more.
          </p>
          <Button className="mt-6 gap-2">
            <PlusIcon className="h-4 w-4" />
            Browse applications
          </Button>
        </div>
      </div>
    </>
  );
}
