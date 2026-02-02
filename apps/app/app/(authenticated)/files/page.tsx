import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import { FolderIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";

export const metadata: Metadata = {
  title: "Files | Rubic",
  description: "View all your outputted and created files",
};

export default async function FilesPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return (
    <>
      <Header
        title="Files"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Files</h1>
          <p className="text-muted-foreground">
            All your outputted and created files in one place
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed p-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FolderIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No files yet</h3>
          <p className="mt-2 text-center text-sm text-muted-foreground max-w-sm">
            Files created by your tasks will appear here. Start a new task to
            generate files.
          </p>
          <Button className="mt-6" asChild>
            <a href="/">Create new task</a>
          </Button>
        </div>
      </div>
    </>
  );
}
