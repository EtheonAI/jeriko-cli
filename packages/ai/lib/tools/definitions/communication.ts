/**
 * Communication tools — message_notify_user, message_ask_user
 */
import { z } from "zod";

const attachmentsSchema = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .describe("List of attachments to show to user, can be file paths or URLs");

export const communicationTools = {
  message_notify_user: {
    description:
      "Send a message to user without requiring a response. Use for acknowledging receipt of messages, providing progress updates, reporting task completion, or explaining changes in approach.",
    parameters: z.object({
      text: z.string().describe("Message text to display to user"),
      attachments: attachmentsSchema,
    }),
  },
  message_ask_user: {
    description:
      "Ask user a question and wait for response. Use for requesting clarification, asking for confirmation, or gathering additional information.",
    parameters: z.object({
      text: z.string().describe("Question text to present to user"),
      attachments: attachmentsSchema,
      suggest_user_takeover: z
        .enum(["none", "browser"])
        .optional()
        .describe("Suggested operation for user takeover"),
    }),
  },
} as const;
