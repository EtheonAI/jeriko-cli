/**
 * File tools — Read, write, search, and manipulate files in the sandbox filesystem.
 *
 * All file operations route through the terminal server's /text_editor endpoint
 * or /file endpoint on port 8330 inside the E2B sandbox.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createFileReadTool(ctx: ToolContext) {
  return tool({
    description: `Read file content. Use for checking file contents, analyzing logs, or reading configuration files.`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to read'),
      start_line: z.number().int().optional().describe('Starting line to read from, 0-based'),
      end_line: z.number().int().optional().describe('Ending line number (exclusive)'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      // Map path→file for sandbox executor compatibility
      return executeSandboxTool(ctx, 'file_read', { ...params, file: params.path });
    },
  });
}

export function createFileWriteTool(ctx: ToolContext) {
  return tool({
    description: `Overwrite or append content to a file. Use for creating new files, appending content, or modifying existing files.`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to write to'),
      content: z.string().describe('Text content to write'),
      append: z.boolean().optional().describe('Whether to use append mode'),
      leading_newline: z.boolean().optional().describe('Whether to add a leading newline'),
      trailing_newline: z.boolean().optional().describe('Whether to add a trailing newline'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      // Map path→file for sandbox executor compatibility
      return executeSandboxTool(ctx, 'file_write', { ...params, file: params.path });
    },
  });
}

export function createFileStrReplaceTool(ctx: ToolContext) {
  return tool({
    description: `Replace specified string(s) in a file. Supports single replacement (old_str/new_str) or multiple atomic edits (edits array). Use edits[] for batch replacements in one call.`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to perform replacement on'),
      old_str: z.string().optional().describe('Original string to be replaced (single-edit mode)'),
      new_str: z.string().optional().describe('New string to replace with (single-edit mode)'),
      edits: z
        .array(
          z.object({
            find: z.string().describe('String to find'),
            replace: z.string().describe('Replacement string'),
            all: z.boolean().optional().describe('Replace all occurrences (default: first only)'),
          })
        )
        .optional()
        .describe('Array of find/replace edits. Applied atomically. Use for multiple replacements in one call.'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      // Normalize: convert single old_str/new_str to edits[] format
      const edits = params.edits ?? (
        params.old_str !== undefined && params.new_str !== undefined
          ? [{ find: params.old_str, replace: params.new_str }]
          : []
      );

      if (edits.length === 0) {
        return { status: 'error', error: 'Provide either old_str/new_str or edits array' };
      }

      // Single edit: use existing str_replace endpoint directly
      if (edits.length === 1) {
        return executeSandboxTool(ctx, 'file_str_replace', {
          file: params.path,
          old_str: edits[0]!.find,
          new_str: edits[0]!.replace,
          sudo: params.sudo,
        });
      }

      // Multiple edits: apply atomically via sequential str_replace calls
      // Read file first, apply all edits in memory, then write back
      const readResult = await executeSandboxTool(ctx, 'file_read', { file: params.path });
      if (readResult.status === 'error') return readResult;

      let content = (readResult.content as string) ?? '';
      let totalReplacements = 0;

      for (const edit of edits) {
        if (edit.all) {
          const parts = content.split(edit.find);
          totalReplacements += parts.length - 1;
          content = parts.join(edit.replace);
        } else {
          const idx = content.indexOf(edit.find);
          if (idx !== -1) {
            content = content.slice(0, idx) + edit.replace + content.slice(idx + edit.find.length);
            totalReplacements++;
          }
        }
      }

      // Write modified content atomically
      const writeResult = await executeSandboxTool(ctx, 'file_write', {
        file: params.path,
        content,
        sudo: params.sudo,
      });
      if (writeResult.status === 'error') return writeResult;

      return { status: 'success', file: params.path, replacements: totalReplacements, edits: edits.length };
    },
  });
}

export function createFileFindInContentTool(ctx: ToolContext) {
  return tool({
    description: `Search for matching text within file content. Use for finding specific content or patterns in files.`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to search within'),
      regex: z.string().describe('Regular expression pattern to match'),
      leading: z.number().int().optional().describe('Number of lines to include before each match'),
      trailing: z.number().int().optional().describe('Number of lines to include after each match'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      // Map path→file for sandbox executor compatibility
      return executeSandboxTool(ctx, 'file_find_in_content', { ...params, file: params.path });
    },
  });
}

export function createFileFindByNameTool(ctx: ToolContext) {
  return tool({
    description: `Find files by name pattern in specified directory. Use for locating files with specific naming patterns.`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path of directory to search'),
      glob: z.string().describe('Filename pattern using glob syntax wildcards'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_find_by_name', params);
    },
  });
}

export function createFileViewTool(ctx: ToolContext) {
  return tool({
    description: `View the contents of a binary file (image, PDF, etc.) visually. Returns a base64-encoded representation that can be analyzed. Use for inspecting generated charts, screenshots, PDFs, or any visual file.`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path of the file to view'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_view', { ...params, file: params.path });
    },
  });
}

export function createFileTools(ctx: ToolContext) {
  return {
    file_read: createFileReadTool(ctx),
    file_write: createFileWriteTool(ctx),
    file_str_replace: createFileStrReplaceTool(ctx),
    file_find_in_content: createFileFindInContentTool(ctx),
    file_find_by_name: createFileFindByNameTool(ctx),
    file_view: createFileViewTool(ctx),
  };
}
