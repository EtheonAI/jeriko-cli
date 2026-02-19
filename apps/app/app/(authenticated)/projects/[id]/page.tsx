import type { Metadata } from "next";
import { verifySession } from "@/lib/dal";
import { serverTrpc, HydrateClient } from "@/lib/trpc/server";
import { Header } from "../../components/header/index";
import { ProjectDetailClient } from "./project-detail-client";

export const metadata: Metadata = {
  title: "Project | Rubic",
  description: "Manage your project tasks and sessions",
};

type PageProps = {
  params: Promise<{ id: string }>;
};

const ProjectPage = async ({ params }: PageProps) => {
  const { id } = await params;
  const session = await verifySession();

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  // Prefetch project data in parallel
  try {
    await Promise.all([
      serverTrpc.projects.get.prefetch({ id }),
      serverTrpc.projects.listSessions.prefetch({ projectId: id }),
    ]);
  } catch {
    // SSR prefetch failed — client-side RTK Query will retry
  }

  return (
    <HydrateClient>
      <Header title="Project" version="1.0" user={user} />
      <ProjectDetailClient projectId={id} />
    </HydrateClient>
  );
};

export default ProjectPage;
