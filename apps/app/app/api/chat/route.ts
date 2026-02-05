import { streamText, generateText, convertToModelMessages as aiConvertToModelMessages } from "ai";
import { sanitizeMessages } from "@repo/ai";
import { log } from "@repo/observability/log";
import { resolveModel } from "@repo/ai/lib/models";
import type { UIMessage } from "@repo/ai/lib/types/ui-message";
import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db, messages as messagesTable, agentSessions, eq } from "@repo/database";
import { createId } from "@paralleldrive/cuid2";

export const maxDuration = 60;

export const POST = async (req: Request) => {
  try {
    // Authenticate
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.user.id;
    const body = await req.json();
    log.info("Chat request received.");

    const {
      messages,
      chatId,
      metadata,
      model: bodyModel,
    } = body as {
      messages: UIMessage[];
      chatId?: string;
      metadata?: { sessionId?: string; model?: string };
      model?: string;
    };

    const sessionId = chatId ?? metadata?.sessionId;
    const model = bodyModel ?? metadata?.model;

    // Validate messages
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Messages array is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure session exists in DB (upsert)
    if (sessionId) {
      try {
        const [existing] = await db
          .select({ id: agentSessions.id })
          .from(agentSessions)
          .where(eq(agentSessions.id, sessionId))
          .limit(1);

        if (!existing) {
          await db.insert(agentSessions).values({
            id: sessionId,
            userId,
            status: "active",
          });
        }
      } catch (err) {
        log.error("Failed to upsert session:", err as Error);
      }
    }

    // Persist the latest user message
    if (sessionId) {
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        const textContent =
          lastUserMsg.parts
            ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("") ?? "";

        if (textContent) {
          try {
            // Check if already persisted (by message ID)
            const [existingMsg] = await db
              .select({ id: messagesTable.id })
              .from(messagesTable)
              .where(eq(messagesTable.id, lastUserMsg.id))
              .limit(1);

            if (!existingMsg) {
              await db.insert(messagesTable).values({
                id: lastUserMsg.id,
                sessionId,
                role: "user",
                content: textContent,
              });
            }
          } catch (err) {
            log.error("Failed to persist user message:", err as Error);
          }
        }
      }
    }

    // Sanitize and convert messages
    const sanitized = sanitizeMessages(messages);
    const modelMessages = await aiConvertToModelMessages(
      sanitized as Parameters<typeof aiConvertToModelMessages>[0]
    );

    log.info("Generating response...", {
      messageCount: modelMessages.length,
      model: model ?? "gpt-4o-mini",
    });

    const result = streamText({
      model: resolveModel(model),
      system: "You are Rubic, a helpful AI assistant. Be concise, helpful, and friendly.",
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        // Persist assistant message
        if (sessionId && text) {
          try {
            await db.insert(messagesTable).values({
              id: createId(),
              sessionId,
              role: "assistant",
              content: text,
              metadata: {
                model: model ?? "gpt-4o-mini",
                tokens: usage
                  ? { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0 }
                  : undefined,
              },
            });
          } catch (err) {
            log.error("Failed to persist assistant message:", err as Error);
          }
        }

        // Auto-generate title if session has none
        if (sessionId) {
          try {
            const [sess] = await db
              .select({ title: agentSessions.title })
              .from(agentSessions)
              .where(eq(agentSessions.id, sessionId))
              .limit(1);

            if (sess && !sess.title) {
              const firstUserMsg = messages.find((m) => m.role === "user");
              const userText =
                firstUserMsg?.parts
                  ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("") ?? "";

              if (userText) {
                const titleResult = await generateText({
                  model: resolveModel("gpt-4o-mini"),
                  prompt: `Generate a short 4-6 word title for this conversation. No quotes, no punctuation at the end. User's message: "${userText.slice(0, 200)}"`,
                });

                const title = titleResult.text.trim();
                if (title) {
                  await db
                    .update(agentSessions)
                    .set({ title })
                    .where(eq(agentSessions.id, sessionId));
                }
              }
            }
          } catch (err) {
            log.error("Failed to auto-generate title:", err as Error);
          }
        }
      },
    });

    log.info("Streaming response...");

    return result.toTextStreamResponse();
  } catch (error) {
    log.error("Chat error:", error as Error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
