/**
 * Message tools - Communication with the user
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { uploadAttachments } from './executor/sandbox-executor.js';

export function createMessageNotifyUserTool(ctx: ToolContext) {
  return tool({
    description: `Send an informational or result message to the user without blocking execution.

Use this for:
- Progress updates during task execution
- Final results delivery
- Status notifications

Do NOT use for:
- Questions requiring user response (use message_ask_user)
`,
    inputSchema: z.object({
      text: z.string().describe('Message content in markdown format'),
      attachments: z
        .array(z.string())
        .optional()
        .describe('Array of absolute file paths to attach from sandbox'),
    }),
    execute: async (params) => {
      const { text, attachments = [] } = params;

      // Upload attachments to S3 if present
      const uploadedAttachments = await uploadAttachments(ctx, attachments);

      // Persist to database
      await ctx.db.insertMessage({
        sessionId: ctx.sessionId,
        role: 'assistant',
        content: text,
        contentType: 'info',
        metadata: { attachments: uploadedAttachments },
      });

      // Broadcast via WebSocket
      await ctx.ws.emit(ctx.sessionId, {
        type: 'message',
        role: 'assistant',
        content: text,
        messageType: 'info',
        attachments: uploadedAttachments,
        timestamp: Date.now(),
      });

      return {
        status: 'sent',
        message: 'Message delivered to user',
      };
    },
  });
}

export function createMessageAskUserTool(ctx: ToolContext) {
  return tool({
    description: `Ask the user a question and wait for their response. This BLOCKS execution.

Use this only when:
- You need user input to proceed
- Multiple valid approaches exist and user preference matters
- Critical decision requires user approval

Avoid overusing - prefer making reasonable decisions autonomously.
`,
    inputSchema: z.object({
      text: z.string().describe('Question text in markdown format'),
      attachments: z.array(z.string()).optional().describe('Array of absolute file paths to attach'),
      suggested_action: z
        .string()
        .optional()
        .describe('Your recommended answer/action for user consideration'),
    }),
    execute: async (params) => {
      const { text, attachments = [], suggested_action } = params;

      const uploadedAttachments = await uploadAttachments(ctx, attachments);

      await ctx.db.insertMessage({
        sessionId: ctx.sessionId,
        role: 'assistant',
        content: text,
        contentType: 'ask',
        metadata: {
          attachments: uploadedAttachments,
          suggestedAction: suggested_action,
        },
      });

      await ctx.ws.emit(ctx.sessionId, {
        type: 'message',
        role: 'assistant',
        content: text,
        messageType: 'ask',
        attachments: uploadedAttachments,
        suggestedAction: suggested_action,
        timestamp: Date.now(),
      });

      // Signal to orchestrator loop to pause
      return {
        status: 'waiting_for_user',
        message: 'Question sent. Awaiting user response.',
      };
    },
  });
}
