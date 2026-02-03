import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Header } from "../../components/header/index";
import { ChatPageClient } from "./chat-page-client";

type ChatPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Chat ${id} | Rubic`,
    description: "Continue your conversation with Rubic",
  };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  if (!id) {
    notFound();
  }

  // TODO: In production, fetch initial messages from database
  // const messages = await fetchMessages(id);

  return (
    <>
      <Header
        title="Rubic"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatPageClient
          sessionId={id}
          initialMessages={[]}
          user={{
            name: session?.user?.name,
            email: session?.user?.email ?? "",
            image: session?.user?.image,
          }}
        />
      </div>
    </>
  );
}
