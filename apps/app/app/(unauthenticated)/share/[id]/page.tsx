import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, agentSessions, messages as messagesTable, users, eq, asc } from "@repo/database";
import { SharedSessionView } from "./shared-session-view";

const MESSAGE_DISPLAY_LIMIT = 5;

type SharePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params;

  // Load session title for metadata
  const [session] = await db
    .select({ title: agentSessions.title })
    .from(agentSessions)
    .where(eq(agentSessions.id, id))
    .limit(1);

  return {
    title: session?.title ? `${session.title} | Rubic` : "Shared Session | Rubic",
    description: "View a shared conversation on Rubic",
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;

  if (!id) {
    notFound();
  }

  // Load session
  const [session] = await db
    .select({
      id: agentSessions.id,
      title: agentSessions.title,
      status: agentSessions.status,
      metadata: agentSessions.metadata,
      createdAt: agentSessions.createdAt,
      userId: agentSessions.userId,
    })
    .from(agentSessions)
    .where(eq(agentSessions.id, id))
    .limit(1);

  if (!session) {
    notFound();
  }

  // Check if session is shared
  const meta = (session.metadata as Record<string, unknown>) ?? {};
  if (!meta.isShared) {
    notFound();
  }

  // Load author info
  const [author] = await db
    .select({ id: users.id, name: users.name, image: users.image })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  // Load all messages (we limit display on the client side for guest gating)
  const allMessages = await db
    .select({
      id: messagesTable.id,
      role: messagesTable.role,
      content: messagesTable.content,
      parts: messagesTable.parts,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .where(eq(messagesTable.sessionId, id))
    .orderBy(asc(messagesTable.createdAt));

  // Filter out tool messages
  const filteredMessages = allMessages
    .filter((m) => m.role !== "tool")
    .map((m) => ({
      id: m.id,
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    }));

  // Increment view count (non-blocking)
  const viewCount = ((meta.viewCount as number) ?? 0) + 1;
  db.update(agentSessions)
    .set({ metadata: { ...meta, viewCount } })
    .where(eq(agentSessions.id, id))
    .then(() => {})
    .catch(() => {});

  return (
    <SharedSessionView
      session={{
        id: session.id,
        title: session.title ?? "Untitled",
        createdAt: session.createdAt.toISOString(),
        likeCount: (meta.likeCount as number) ?? 0,
        viewCount,
      }}
      author={{
        id: author?.id ?? session.userId,
        name: author?.name ?? "Unknown",
        image: author?.image ?? null,
      }}
      messages={filteredMessages}
      messageDisplayLimit={MESSAGE_DISPLAY_LIMIT}
    />
  );
}
