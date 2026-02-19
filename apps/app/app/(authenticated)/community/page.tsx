import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";
import { CommunityPageClient } from "./community-page-client";

export const metadata: Metadata = {
  title: "Community | Rubic",
  description: "Explore shared sessions and discover what others are building with Rubic.",
};

export default async function CommunityPage() {
  // Verify auth (redirects if not authenticated)
  await verifySession();

  return <CommunityPageClient />;
}
