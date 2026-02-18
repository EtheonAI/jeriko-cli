import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, messages as messagesTable, eq, desc } from "@repo/database";
import { getSession } from "@/lib/dal";
import type { Message } from "@/lib/store/slices/chat.slice";
import { ChatClient } from "./components/chat-client";

/** Max messages to load on initial page render. Older messages load on demand. */
const INITIAL_MESSAGE_LIMIT = 50;

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
  const session = await getSession();

  if (!id) {
    notFound();
  }

  // Fetch initial messages from database — limited to most recent N
  let initialMessages: Message[] = [];
  let hasMoreMessages = false;
  try {
    // Fetch limit+1 in DESC order, then reverse, to get the most recent messages
    const dbMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.sessionId, id))
      .orderBy(desc(messagesTable.createdAt))
      .limit(INITIAL_MESSAGE_LIMIT + 1);

    hasMoreMessages = dbMessages.length > INITIAL_MESSAGE_LIMIT;
    if (hasMoreMessages) dbMessages.pop();

    // Reverse to chronological order
    dbMessages.reverse();

    // Filter and deduplicate:
    // 1. Skip role="tool" messages — tool data is already inside assistant parts
    // 2. When duplicate assistant messages exist, keep only the one WITH parts
    //    (route.ts saves with parts, agent service saves without — deduplicate)
    const filtered: typeof dbMessages = [];
    const assistantsByContent = new Map<string, typeof dbMessages[number]>();
    const userTexts = new Set<string>();

    for (const m of dbMessages) {
      // Skip tool role messages — they're legacy from agent service direct saves
      if (m.role === "tool") continue;

      // Deduplicate user messages with identical content
      if (m.role === "user") {
        const key = m.content?.trim() ?? "";
        if (userTexts.has(key)) continue;
        userTexts.add(key);
        filtered.push(m);
        continue;
      }

      // Deduplicate assistant messages — prefer the one with parts
      if (m.role === "assistant") {
        const key = m.content?.slice(0, 100) ?? m.id;
        const existing = assistantsByContent.get(key);
        if (existing) {
          // Keep whichever has parts (or the newer one)
          if (m.parts && !existing.parts) {
            // Replace existing with this one (has parts)
            const idx = filtered.indexOf(existing);
            if (idx >= 0) filtered[idx] = m;
            assistantsByContent.set(key, m);
          }
          // Otherwise keep existing
          continue;
        }
        assistantsByContent.set(key, m);
        filtered.push(m);
        continue;
      }

      filtered.push(m);
    }

    initialMessages = filtered.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role as Message["role"],
      content: m.content,
      parts: (m.parts ?? undefined) as Message["parts"],
      createdAt: m.createdAt.toISOString(),
      metadata: (m.metadata ?? undefined) as Message["metadata"],
    }));
  } catch {
    // If DB query fails, render empty chat
  }

  // loading.tsx in this directory already creates an implicit <Suspense> boundary
  // around this page — no need for an inner <Suspense> wrapping ChatClient,
  // which is a sync client component that receives pre-fetched data.
  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <ChatClient
        sessionId={id}
        initialMessages={initialMessages}
        hasMoreMessages={hasMoreMessages}
        user={{
          name: session?.user?.name,
          email: session?.user?.email ?? "",
          image: session?.user?.image,
        }}
      />
    </div>
  );
}
