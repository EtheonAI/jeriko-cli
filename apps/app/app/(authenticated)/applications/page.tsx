import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import { ApplicationsPageClient } from "./applications-page-client";

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
        <ApplicationsPageClient />
      </div>
    </>
  );
}
