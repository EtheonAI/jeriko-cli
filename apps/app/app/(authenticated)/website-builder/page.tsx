import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import { WebsiteBuilderClient } from "./website-builder-client";

export const metadata: Metadata = {
  title: "Website Builder | Rubic",
  description: "Build and deploy websites with AI",
};

export default async function WebsiteBuilderPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return (
    <>
      <Header
        title="Website Builder"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <WebsiteBuilderClient />
      </div>
    </>
  );
}
