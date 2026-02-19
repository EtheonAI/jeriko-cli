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

  // Prefetch files + connector definitions on server — client picks them up instantly.
  try {
    await Promise.all([
      serverTrpc.files.listBySession.prefetch(),
      serverTrpc.connectors.listByCategory.prefetch({ categories: ["storage", "communication"] }),
    ]);
  } catch {
    // SSR prefetch failed — client-side RTK Query will retry
  }

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
