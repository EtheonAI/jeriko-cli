import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db, messages as messagesTable, eq, asc } from "@repo/database";
import type { Message } from "@/lib/store/slices/chat.slice";
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

  // Fetch initial messages from database
  let initialMessages: Message[] = [];
  try {
    const dbMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, id))
      .orderBy(asc(messagesTable.createdAt));

    initialMessages = dbMessages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as Message["role"],
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      metadata: (m.metadata ?? undefined) as Message["metadata"],
    }));
  } catch {
    // If DB query fails, render empty chat
  }

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
          initialMessages={initialMessages}
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
