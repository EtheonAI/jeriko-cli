/**
 * Message tools — Communication with the user.
 *
 * Manus parity: message_notify_user accepts optional `type` param:
 *   - info: progress update (default)
 *   - result: task complete — signals loop termination
 *
 * message_ask_user: question that waits for user response.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { uploadAttachments } from './executor/sandbox-executor.js';

export function createMessageNotifyUserTool(ctx: ToolContext) {
  return tool({
    description: `Send a message to user without requiring a response. Use for progress updates (type=info) or signaling task completion with final deliverables (type=result). When type=result, attach all created files.`,
    inputSchema: z.object({
      text: z.string().describe('Message text to display to user'),
      type: z
        .enum(['info', 'result'])
        .default('info')
        .describe("Message type: info=progress update (default), result=task complete (delivers final output)"),
      attachments: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('List of attachments to show to user, can be file paths or URLs'),
    }),
    execute: async (params) => {
      const { text } = params;
      const messageType = params.type || 'info';
      const rawAttachments = params.attachments;
      const attachmentList = rawAttachments
        ? Array.isArray(rawAttachments) ? rawAttachments : [rawAttachments]
        : [];

      const uploadedAttachments = await uploadAttachments(ctx, attachmentList);

      await ctx.db.insertMessage({
        sessionId: ctx.sessionId,
        role: 'assistant',
        content: text,
        contentType: messageType,
        metadata: {
          attachments: uploadedAttachments,
          ...(messageType === 'result' && { isTaskComplete: true }),
        },
      });

      await ctx.ws.emit(ctx.sessionId, {
        type: 'message',
        role: 'assistant',
        content: text,
        messageType,
        attachments: uploadedAttachments,
        timestamp: Date.now(),
      });

      // Include attachment data in tool output so it flows to the frontend
      // via the SSE stream (tool-output-available event).
      // Manus delivers files via WebSocket; we deliver via tool output.
      return {
        status: messageType === 'result' ? 'complete' : 'sent',
        message: messageType === 'result'
          ? 'Task complete. Results delivered to user.'
          : 'Message delivered to user',
        ...(messageType === 'result' && { isTaskComplete: true }),
        ...(uploadedAttachments.length > 0 && {
          attachments: uploadedAttachments.map((a) => ({
            name: a.name,
            url: a.url,
            mediaType: a.mediaType,
          })),
        }),
      };
    },
  });
}

export function createMessageAskUserTool(ctx: ToolContext) {
  return tool({
    description: `Ask user a question and wait for response. Use for requesting clarification, asking for confirmation, or gathering additional information.`,
    inputSchema: z.object({
      text: z.string().describe('Question text to present to user'),
      attachments: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('List of question-related files or reference materials'),
      suggest_user_takeover: z
        .enum(['none', 'browser'])
        .optional()
        .describe('Suggested operation for user takeover'),
    }),
    execute: async (params) => {
      const { text, suggest_user_takeover } = params;
      const rawAttachments = params.attachments;
      const attachmentList = rawAttachments
        ? Array.isArray(rawAttachments) ? rawAttachments : [rawAttachments]
        : [];

      const uploadedAttachments = await uploadAttachments(ctx, attachmentList);

      await ctx.db.insertMessage({
        sessionId: ctx.sessionId,
        role: 'assistant',
        content: text,
        contentType: 'ask',
        metadata: {
          attachments: uploadedAttachments,
          suggestUserTakeover: suggest_user_takeover,
        },
      });

      await ctx.ws.emit(ctx.sessionId, {
        type: 'message',
        role: 'assistant',
        content: text,
        messageType: 'ask',
        attachments: uploadedAttachments,
        suggestUserTakeover: suggest_user_takeover,
        timestamp: Date.now(),
      });

      return {
        status: 'waiting_for_user',
        message: 'Question sent. Awaiting user response.',
        ...(uploadedAttachments.length > 0 && {
          attachments: uploadedAttachments.map((a) => ({
            name: a.name,
            url: a.url,
            mediaType: a.mediaType,
          })),
        }),
      };
    },
  });
}
