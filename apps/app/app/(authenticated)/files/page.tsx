import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import { FilesPageClient } from "./files-page-client";

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
        <FilesPageClient />
      </div>
    </>
  );
}
