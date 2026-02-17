import type { Metadata } from "next";
import { Suspense } from "react";
import { getSession } from "@/lib/dal";
import { Header } from "../components/header/index";
import { AutomationsPageClient } from "./automations-page-client";

export const metadata: Metadata = {
  title: "Automations | Rubic",
  description: "Create and manage automated tasks triggered by events or schedules",
};

export default async function ActionsPage() {
  const session = await getSession();

  return (
    <>
      <Header
        title="Automations"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <Suspense>
        <AutomationsPageClient />
      </Suspense>
    </>
  );
}
