import type { FastifyInstance } from "fastify";
import { createLogger } from "@repo/service-utils";

const logger = createLogger({ service: "email" });

interface EmailPayload {
  sandboxId?: string;
  userId: string;
  to: string | string[];
  subject: string;
  body: string;
  attachments?: Array<{ filename: string; path?: string; url?: string }>;
  draft?: boolean;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

interface DownloadPayload {
  sandboxId: string;
  userId: string;
  messageId: string;
  attachmentIds?: string[];
  destDir?: string;
}

const NOT_CONFIGURED_RESPONSE = {
  success: false,
  error:
    "Email integration not yet configured. Please connect your email account in Settings > Integrations.",
} as const;

export async function emailRoutes(fastify: FastifyInstance): Promise<void> {
  // ---------------------------------------------------------------------------
  // POST /api/email/gmail/send — Send email or save draft via Gmail
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: EmailPayload }>(
    "/api/email/gmail/send",
    async (request, reply) => {
      const { userId, to, subject, draft } = request.body;
      logger.info(
        {
          userId,
          to,
          subject,
          draft: draft ?? false,
          provider: "gmail",
        },
        draft ? "Gmail draft save attempted" : "Gmail send attempted",
      );

      // TODO: Integrate with Gmail OAuth via connector service
      // 1. Look up user's Gmail OAuth token from connectors table
      // 2. Use googleapis to send/draft email
      // 3. Handle attachments from sandbox if sandboxId provided

      return reply.status(501).send(NOT_CONFIGURED_RESPONSE);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/email/outlook/send — Send email or save draft via Outlook
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: EmailPayload }>(
    "/api/email/outlook/send",
    async (request, reply) => {
      const { userId, to, subject, draft } = request.body;
      logger.info(
        {
          userId,
          to,
          subject,
          draft: draft ?? false,
          provider: "outlook",
        },
        draft ? "Outlook draft save attempted" : "Outlook send attempted",
      );

      // TODO: Integrate with Outlook/Microsoft Graph API via connector service
      // 1. Look up user's Microsoft OAuth token from connectors table
      // 2. Use Microsoft Graph API to send/draft email
      // 3. Handle attachments from sandbox if sandboxId provided

      return reply.status(501).send(NOT_CONFIGURED_RESPONSE);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/email/outlook/download — Download Outlook mail attachments
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: DownloadPayload }>(
    "/api/email/outlook/download",
    async (request, reply) => {
      const { userId, messageId } = request.body;
      logger.info(
        { userId, messageId, provider: "outlook" },
        "Outlook attachment download attempted",
      );

      // TODO: Integrate with Microsoft Graph API
      // 1. Look up user's Microsoft OAuth token
      // 2. Fetch attachment bytes from Graph API
      // 3. Write to sandbox destDir (default /home/user/Downloads)

      return reply.status(501).send(NOT_CONFIGURED_RESPONSE);
    },
  );

  // ---------------------------------------------------------------------------
  // POST /api/email/gmail/download — Download Gmail attachments
  // ---------------------------------------------------------------------------
  fastify.post<{ Body: DownloadPayload }>(
    "/api/email/gmail/download",
    async (request, reply) => {
      const { userId, messageId } = request.body;
      logger.info(
        { userId, messageId, provider: "gmail" },
        "Gmail attachment download attempted",
      );

      // TODO: Integrate with Gmail API
      // 1. Look up user's Gmail OAuth token from connectors table
      // 2. Fetch attachment bytes from Gmail API
      // 3. Write to sandbox destDir (default /home/user/Downloads)

      return reply.status(501).send(NOT_CONFIGURED_RESPONSE);
    },
  );
}
