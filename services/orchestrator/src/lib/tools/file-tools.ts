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
      file: z.string().describe('Absolute path of the file to read'),
      start_line: z.number().int().optional().describe('Starting line to read from, 0-based'),
      end_line: z.number().int().optional().describe('Ending line number (exclusive)'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_read', params);
    },
  });
}

export function createFileWriteTool(ctx: ToolContext) {
  return tool({
    description: `Overwrite or append content to a file. Use for creating new files, appending content, or modifying existing files.`,
    inputSchema: z.object({
      file: z.string().describe('Absolute path of the file to write to'),
      content: z.string().describe('Text content to write'),
      append: z.boolean().optional().describe('Whether to use append mode'),
      leading_newline: z.boolean().optional().describe('Whether to add a leading newline'),
      trailing_newline: z.boolean().optional().describe('Whether to add a trailing newline'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_write', params);
    },
  });
}

export function createFileStrReplaceTool(ctx: ToolContext) {
  return tool({
    description: `Replace specified string in a file. Use for updating specific content in files or fixing errors in code.`,
    inputSchema: z.object({
      file: z.string().describe('Absolute path of the file to perform replacement on'),
      old_str: z.string().describe('Original string to be replaced'),
      new_str: z.string().describe('New string to replace with'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_str_replace', params);
    },
  });
}

export function createFileFindInContentTool(ctx: ToolContext) {
  return tool({
    description: `Search for matching text within file content. Use for finding specific content or patterns in files.`,
    inputSchema: z.object({
      file: z.string().describe('Absolute path of the file to search within'),
      regex: z.string().describe('Regular expression pattern to match'),
      sudo: z.boolean().optional().describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_find_in_content', params);
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

export function createFileTools(ctx: ToolContext) {
  return {
    file_read: createFileReadTool(ctx),
    file_write: createFileWriteTool(ctx),
    file_str_replace: createFileStrReplaceTool(ctx),
    file_find_in_content: createFileFindInContentTool(ctx),
    file_find_by_name: createFileFindByNameTool(ctx),
  };
}
