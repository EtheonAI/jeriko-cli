import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../components/header/index";
import { KnowledgePageClient } from "./knowledge-page-client";

export const metadata: Metadata = {
  title: "Knowledge | Rubic",
  description: "Manage your knowledge base for AI-powered context",
};

export default async function KnowledgePage() {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  return (
    <>
      <Header
        title="Knowledge"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <KnowledgePageClient />
    </>
  );
}
