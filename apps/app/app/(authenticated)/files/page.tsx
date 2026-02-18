import type { Metadata } from "next";
import { getSession } from "@/lib/dal";
import { serverTrpc, HydrateClient } from "@/lib/trpc/server";
import { Header } from "../components/header/index";
import { FilesPageClient } from "./files-page-client";

export const metadata: Metadata = {
  title: "Library | Rubic",
  description: "View all your outputted and created files",
};

export default async function FilesPage() {
  const session = await getSession();

  // Prefetch files data on server — client picks it up instantly.
  // MUST await for data to be included in the dehydrated HTML payload.
  await serverTrpc.files.listBySession.prefetch();

  return (
    <HydrateClient>
      <Header
        title="Library"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col">
        <FilesPageClient />
      </div>
    </HydrateClient>
  );
}
