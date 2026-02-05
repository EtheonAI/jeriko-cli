import { db, agentMailboxes, eq } from "@repo/database";
import { log } from "@repo/observability/log";
import { NextResponse } from "next/server";

export const POST = async (request: Request): Promise<Response> => {
  try {
    const body = await request.json();
    const { eventType, data } = body as {
      eventType: string;
      data: Record<string, unknown>;
    };

    // TODO: Signature verification when AGENTMAIL_WEBHOOK_SECRET is set
    // const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    // if (secret) { verify signature from headers }

    switch (eventType) {
      case "message.received": {
        const inboxId = (data.inboxId as string) ?? (data.inbox_id as string);
        if (!inboxId) break;

        const [mailbox] = await db
          .select()
          .from(agentMailboxes)
          .where(eq(agentMailboxes.inboxId, inboxId))
          .limit(1);

        if (mailbox) {
          log.info(`AgentMail: message received for user ${mailbox.userId}`, {
            inboxId,
            messageId: data.messageId ?? data.message_id,
          });
        } else {
          log.warn(`AgentMail: message received for unknown inbox ${inboxId}`);
        }
        break;
      }

      case "message.sent": {
        const inboxId = (data.inboxId as string) ?? (data.inbox_id as string);
        log.info(`AgentMail: message sent from inbox ${inboxId}`, {
          messageId: data.messageId ?? data.message_id,
        });
        break;
      }

      case "message.bounced": {
        const inboxId = (data.inboxId as string) ?? (data.inbox_id as string);
        log.warn(`AgentMail: message bounced for inbox ${inboxId}`, {
          messageId: data.messageId ?? data.message_id,
          reason: data.reason,
        });
        break;
      }

      default:
        log.warn(`AgentMail: unhandled webhook event type: ${eventType}`);
    }

    return NextResponse.json({ received: true, ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    log.error(`AgentMail webhook error: ${message}`);
    return NextResponse.json({ message: "Webhook processing failed", ok: false }, { status: 500 });
  }
};
