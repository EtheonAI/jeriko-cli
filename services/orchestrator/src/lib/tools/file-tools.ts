/**
 * File tools - Read, write, search, and manipulate files in the sandbox filesystem
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createFileReadTool(ctx: ToolContext) {
  return tool({
    description: `Read file contents from the sandbox filesystem.

Returns the text content of a file at the given path. For large files, use offset and limit to read specific line ranges instead of loading the entire file.

Use this to:
- Inspect source code, config files, logs, or data files
- Check the current state of a file before editing
- Read specific sections of large files with offset/limit

The path must be an absolute path within the sandbox (e.g., /home/user/project/src/index.ts).
`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path to the file to read (e.g., /home/user/project/README.md)'),
      offset: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe('Line number to start reading from (0-indexed). Omit to start from the beginning.'),
      limit: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('Maximum number of lines to read. Omit to read to the end of the file.'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_read', params);
    },
  });
}

export function createFileWriteTool(ctx: ToolContext) {
  return tool({
    description: `Write content to a file in the sandbox filesystem. Creates the file if it does not exist, and automatically creates any missing parent directories.

Use this to:
- Create new files (source code, config, data, etc.)
- Overwrite existing files with entirely new content
- Generate output files (reports, HTML pages, scripts)

IMPORTANT: This overwrites the entire file. For small targeted edits to existing files, prefer file_str_replace instead to avoid accidentally losing content.

The path must be an absolute path within the sandbox.
`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path for the file to write (e.g., /home/user/project/src/app.ts)'),
      content: z.string().describe('The full content to write to the file'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_write', params);
    },
  });
}

export function createFileStrReplaceTool(ctx: ToolContext) {
  return tool({
    description: `Replace an exact string occurrence in a file with new content. This is the preferred way to make targeted edits to existing files.

Use this to:
- Fix bugs by replacing specific code snippets
- Update configuration values
- Rename variables, functions, or imports
- Insert or remove lines by including surrounding context in old_string

The old_string must match EXACTLY (including whitespace and indentation). If the string is not found or matches multiple locations, the operation will fail. Include enough surrounding context to make the match unique.

Tips:
- Copy the exact text from a file_read result
- Include 2-3 lines of surrounding context if the target text is not unique
- For multi-line replacements, include the full block with correct indentation
`,
    inputSchema: z.object({
      path: z.string().describe('Absolute path to the file to edit'),
      old_string: z
        .string()
        .describe('The exact string to find and replace. Must match file content exactly, including whitespace.'),
      new_string: z
        .string()
        .describe('The replacement string. Use empty string to delete the old_string.'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_str_replace', params);
    },
  });
}

export function createFileFindInContentTool(ctx: ToolContext) {
  return tool({
    description: `Search for a regex pattern in file contents across the sandbox filesystem (similar to grep/ripgrep).

Returns matching lines with file paths and line numbers. Use this to:
- Find where a function, variable, or class is defined or used
- Search for TODO comments, error messages, or specific patterns
- Locate configuration values or imports across a project

The pattern uses standard regex syntax. The search is recursive within the specified directory.
`,
    inputSchema: z.object({
      pattern: z.string().describe('Regular expression pattern to search for (e.g., "function\\s+handleSubmit", "TODO:", "import.*from")'),
      path: z
        .string()
        .optional()
        .describe('Directory to search in. Defaults to the sandbox working directory if omitted.'),
      include: z
        .string()
        .optional()
        .describe('Glob pattern to filter which files to search (e.g., "*.ts", "*.{js,jsx}", "src/**/*.py")'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_find_in_content', params);
    },
  });
}

export function createFileFindByNameTool(ctx: ToolContext) {
  return tool({
    description: `Find files and directories by name pattern in the sandbox filesystem (similar to find/glob).

Returns a list of matching file paths. Use this to:
- Discover project structure and find specific files
- Locate config files (e.g., "tsconfig.json", "*.config.*")
- Find all files of a certain type (e.g., "*.test.ts", "*.css")
- Explore unfamiliar codebases before reading specific files

The pattern uses glob syntax (*, **, ?, []).
`,
    inputSchema: z.object({
      pattern: z.string().describe('Glob pattern to match file names (e.g., "*.ts", "**/*.test.js", "package.json", "src/**/*.{ts,tsx}")'),
      path: z
        .string()
        .optional()
        .describe('Directory to search in. Defaults to the sandbox working directory if omitted.'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'file_find_by_name', params);
    },
  });
}

/**
 * Create all file tools keyed by their tool name
 */
export function createFileTools(ctx: ToolContext) {
  return {
    file_read: createFileReadTool(ctx),
    file_write: createFileWriteTool(ctx),
    file_str_replace: createFileStrReplaceTool(ctx),
    file_find_in_content: createFileFindInContentTool(ctx),
    file_find_by_name: createFileFindByNameTool(ctx),
  };
}
