// ============================================================
// Message Persistence
// ============================================================

import { log } from "@repo/observability/log";
import { db, agentSessions, messages as messagesTable, eq } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

export async function saveMessageToDB(
  sessionId: string,
  role: "user" | "assistant" | "system" | "tool",
  content: string,
  metadata?: Record<string, unknown>,
  parts?: Record<string, unknown>[] | null,
) {
  try {
    await db.insert(messagesTable).values({
      id: createId(),
      sessionId,
      role,
      content,
      parts: parts ?? null,
      metadata: metadata ?? null,
    });
  } catch (err) {
    log.error(`Failed to save ${role} message:`, err as Error);
  }
}

export async function autoSetSessionTitle(sessionId: string, userPrompt: string) {
  try {
    // Only set title if it's not already set
    const [session] = await db
      .select({ title: agentSessions.title })
      .from(agentSessions)
      .where(eq(agentSessions.id, sessionId))
      .limit(1);

    if (session && !session.title) {
      let title = userPrompt.slice(0, 60).trim();
      if (userPrompt.length > 60) title += "...";
      await db
        .update(agentSessions)
        .set({ title, updatedAt: new Date() })
        .where(eq(agentSessions.id, sessionId));
    }
  } catch {
    // Non-critical
  }
}
