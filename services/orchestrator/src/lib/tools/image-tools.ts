/**
 * Image generation tool
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';

export function createGenerateImageTool(ctx: ToolContext) {
  return tool({
    description: `Generate an image using AI based on a text description.

Use this to:
- Create illustrations, diagrams, or artwork
- Generate placeholder images for web projects
- Create visual content the user requests

The generated image is saved to the sandbox filesystem and uploaded to storage.
Returns the image URL and local file path.`,
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .max(4000)
        .describe('Detailed description of the image to generate'),
      size: z
        .enum(['1024x1024', '1792x1024', '1024x1792'])
        .optional()
        .default('1024x1024')
        .describe('Image dimensions'),
      n: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .default(1)
        .describe('Number of images to generate'),
    }),
    execute: async (params) => {
      if (!ctx.imageProvider) {
        return { status: 'error' as const, error: 'Image generation is not configured' };
      }

      try {
        const result = await ctx.imageProvider.generate({
          prompt: params.prompt,
          size: params.size ?? '1024x1024',
          n: params.n ?? 1,
        });

        // Upload to S3 for persistence
        let cdnUrl: string | undefined;
        try {
          cdnUrl = await ctx.storage.uploadFromUrl(result.url, ctx.userId);
        } catch {
          // Fall through with original URL
        }

        return {
          status: 'success' as const,
          url: cdnUrl || result.url,
          originalUrl: result.url,
        };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'Image generation failed',
        };
      }
    },
  });
}

export function createImageTools(ctx: ToolContext) {
  return {
    generate_image: createGenerateImageTool(ctx),
  } as const;
}
