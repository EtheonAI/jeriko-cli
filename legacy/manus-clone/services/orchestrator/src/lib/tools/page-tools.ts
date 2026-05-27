/**
 * Page creation and idle tools
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createMakeJerikoPageTool(ctx: ToolContext) {
  return tool({
    description: `Make a Jeriko Page from a local MDX file. This creates a shareable page from markdown content.`,
    inputSchema: z.object({
      mdx_file_path: z.string().describe('Absolute path of the source MDX file'),
    }),
    execute: async (params) => {
      // Read the MDX file content via terminal server
      const readResult = await executeSandboxTool(ctx, 'file_read', {
        file: params.mdx_file_path,
      });

      if (readResult.status === 'error') {
        return { status: 'error' as const, error: `Failed to read MDX file: ${readResult.error}` };
      }

      const content = readResult.content as string;

      // Extract title from first # heading
      const titleMatch = content.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1]!.trim() : 'Untitled Page';

      // Create the page in the database
      const page = await ctx.db.insertManusPage({
        sessionId: ctx.sessionId,
        userId: ctx.userId,
        title,
        content,
        isPublic: true,
      });

      return {
        status: 'success' as const,
        pageId: page.id,
        title,
        url: `/pages/${page.id}`,
      };
    },
  });
}

export function createIdleTool(_ctx: ToolContext) {
  return tool({
    description: `A special tool to indicate you have completed all tasks and are about to enter idle state. Call this when all requested work is done.`,
    inputSchema: z.object({}),
    execute: async () => {
      return {
        status: 'success' as const,
        message: 'Agent entering idle state. All tasks completed.',
      };
    },
  });
}

export function createPageTools(ctx: ToolContext) {
  return {
    make_manus_page: createMakeJerikoPageTool(ctx),
    idle: createIdleTool(ctx),
  } as const;
}
