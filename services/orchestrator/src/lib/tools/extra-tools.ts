/**
 * Extra tools — text_editor, image utilities, email (Gmail/Outlook),
 * skills, idle, and make_manus_page.
 *
 * These tools were described in the system prompt but missing from the
 * tool registry. Each routes to the terminal server inside the sandbox
 * (port 8330) unless noted otherwise.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { getRsaHeaders } from '../rsa-auth.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function postJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<Record<string, unknown>> {
  const jsonBody = JSON.stringify(body);
  const rsaHeaders = getRsaHeaders(jsonBody);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...rsaHeaders,
    },
    body: jsonBody,
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Sandbox runtime error (${response.status}): ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

// ── text_editor ─────────────────────────────────────────────────────────────

/**
 * Unified text editing tool — view, create, str_replace, insert, undo_edit,
 * find_content, find_file, multi_edit.  Routes to POST /text_editor on the
 * terminal server.
 */
export function createTextEditorTool(ctx: ToolContext) {
  return tool({
    description: `Unified text editor for the sandbox filesystem. Supports multiple commands:

- **view**: Read a file (optionally a line range).
- **create**: Create a new file with content.
- **str_replace**: Replace an exact string in a file.
- **insert**: Insert text at a specific line number.
- **undo_edit**: Undo the last edit to a file.
- **find_content**: Search for a regex pattern across files in a directory.
- **find_file**: Find files matching a glob pattern.
- **multi_edit**: Apply multiple str_replace edits to a file in one call.

Use this when you need fine-grained file operations beyond simple read/write.`,
    inputSchema: z.object({
      command: z
        .enum([
          'view',
          'create',
          'str_replace',
          'insert',
          'undo_edit',
          'find_content',
          'find_file',
          'multi_edit',
        ])
        .describe('The editing command to execute'),
      path: z.string().describe('Absolute file or directory path'),
      file_text: z
        .string()
        .optional()
        .describe('File content for create command'),
      old_str: z
        .string()
        .optional()
        .describe('String to find for str_replace'),
      new_str: z
        .string()
        .optional()
        .describe('Replacement string for str_replace / insert text for insert'),
      insert_line: z
        .number()
        .int()
        .optional()
        .describe('Line number to insert at (0-based) for insert command'),
      view_range: z
        .array(z.number().int())
        .length(2)
        .optional()
        .describe('[start_line, end_line] for view command (-1 = EOF)'),
      regex: z
        .string()
        .optional()
        .describe('Regex pattern for find_content'),
      glob: z
        .string()
        .optional()
        .describe('Glob pattern for find_file'),
      edits: z
        .array(
          z.object({
            old_str: z.string().describe('String to find'),
            new_str: z.string().describe('Replacement string'),
          }),
        )
        .optional()
        .describe('Array of edits for multi_edit command'),
      sudo: z
        .boolean()
        .optional()
        .describe('Whether to use sudo privileges'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(`${baseUrl}/text_editor`, params as Record<string, unknown>, 60000);
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'text_editor call failed',
        };
      }
    },
  });
}

// ── image_rmbg ──────────────────────────────────────────────────────────────

export function createImageRmbgTool(ctx: ToolContext) {
  return tool({
    description: `Remove the background from an image file. The processed image is saved back to the sandbox filesystem.`,
    inputSchema: z.object({
      image_path: z.string().describe('Absolute path of the image file in the sandbox'),
      output_path: z
        .string()
        .optional()
        .describe('Optional output path. Defaults to <original>_nobg.png'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(`${baseUrl}/image/rmbg`, params as Record<string, unknown>, 60000);
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'image_rmbg call failed',
        };
      }
    },
  });
}

// ── image_search_upload ─────────────────────────────────────────────────────

export function createImageSearchUploadTool(ctx: ToolContext) {
  return tool({
    description: `Upload an image for reverse image search. Returns search results with visually similar images and source URLs.`,
    inputSchema: z.object({
      image_path: z.string().describe('Absolute path of the image file to search'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/search_image/upload`,
          params as Record<string, unknown>,
          60000,
        );
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'image_search_upload call failed',
        };
      }
    },
  });
}

// ── gmail_send ──────────────────────────────────────────────────────────────

export function createGmailSendTool(ctx: ToolContext) {
  return tool({
    description: `Send an email or save a draft via Gmail. Requires the user to have connected their Gmail account.`,
    inputSchema: z.object({
      to: z.string().describe('Recipient email address'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body (plain text or HTML)'),
      cc: z.string().optional().describe('CC recipients, comma-separated'),
      bcc: z.string().optional().describe('BCC recipients, comma-separated'),
      is_html: z.boolean().optional().default(false).describe('Whether the body is HTML'),
      save_as_draft: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, save as draft instead of sending'),
      attachments: z
        .array(z.string())
        .optional()
        .describe('List of absolute file paths to attach'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/gmail/send-or-save-draft`,
          { ...params, user_id: ctx.userId } as Record<string, unknown>,
          30000,
        );
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'gmail_send call failed',
        };
      }
    },
  });
}

// ── outlook_send ────────────────────────────────────────────────────────────

export function createOutlookSendTool(ctx: ToolContext) {
  return tool({
    description: `Send an email or save a draft via Outlook. Requires the user to have connected their Outlook account.`,
    inputSchema: z.object({
      to: z.string().describe('Recipient email address'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body (plain text or HTML)'),
      cc: z.string().optional().describe('CC recipients, comma-separated'),
      bcc: z.string().optional().describe('BCC recipients, comma-separated'),
      is_html: z.boolean().optional().default(false).describe('Whether the body is HTML'),
      save_as_draft: z
        .boolean()
        .optional()
        .default(false)
        .describe('If true, save as draft instead of sending'),
      attachments: z
        .array(z.string())
        .optional()
        .describe('List of absolute file paths to attach'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/outlook/send-or-save-draft`,
          { ...params, user_id: ctx.userId } as Record<string, unknown>,
          30000,
        );
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'outlook_send call failed',
        };
      }
    },
  });
}

// ── gmail_download ──────────────────────────────────────────────────────────

export function createGmailDownloadTool(ctx: ToolContext) {
  return tool({
    description: `Download attachments from a Gmail message. Requires the user to have connected their Gmail account. Files are saved to the sandbox filesystem.`,
    inputSchema: z.object({
      message_id: z.string().describe('Gmail message ID to download attachments from'),
      output_dir: z
        .string()
        .optional()
        .default('/home/ubuntu/Downloads')
        .describe('Directory to save attachments'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/request-download-gmail-attachments`,
          { ...params, user_id: ctx.userId } as Record<string, unknown>,
          60000,
        );
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'gmail_download call failed',
        };
      }
    },
  });
}

// ── outlook_download ────────────────────────────────────────────────────────

export function createOutlookDownloadTool(ctx: ToolContext) {
  return tool({
    description: `Download attachments from an Outlook email message. Requires the user to have connected their Outlook account. Files are saved to the sandbox filesystem.`,
    inputSchema: z.object({
      message_id: z.string().describe('Outlook message ID to download attachments from'),
      output_dir: z
        .string()
        .optional()
        .default('/home/ubuntu/Downloads')
        .describe('Directory to save attachments'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/outlook/download-mail-attachments`,
          { ...params, user_id: ctx.userId } as Record<string, unknown>,
          60000,
        );
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'outlook_download call failed',
        };
      }
    },
  });
}

// ── skills_sync ─────────────────────────────────────────────────────────────

export function createSkillsSyncTool(ctx: ToolContext) {
  return tool({
    description: `Sync skills to the sandbox. Downloads and installs skill packages so they are available for execution.`,
    inputSchema: z.object({
      skill_ids: z
        .array(z.string())
        .optional()
        .describe('Specific skill IDs to sync. If omitted, all user skills are synced.'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/skills/sync-skills`,
          { ...params, user_id: ctx.userId, session_id: ctx.sessionId } as Record<string, unknown>,
          60000,
        );
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'skills_sync call failed',
        };
      }
    },
  });
}

// ── skills_package ──────────────────────────────────────────────────────────

export function createSkillsPackageTool(ctx: ToolContext) {
  return tool({
    description: `Package a skill for distribution. Takes a skill directory and creates a distributable archive that can be shared or installed by other users.`,
    inputSchema: z.object({
      skill_dir: z.string().describe('Absolute path of the skill directory to package'),
      name: z.string().describe('Display name of the skill'),
      description: z.string().optional().describe('Brief description of what the skill does'),
      version: z.string().optional().default('1.0.0').describe('Semantic version'),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === 'no-sandbox') {
        return {
          status: 'error' as const,
          error: 'No sandbox available. Terminal server is not reachable.',
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/skills/package-skill`,
          { ...params, user_id: ctx.userId, session_id: ctx.sessionId } as Record<string, unknown>,
          60000,
        );
        return { status: 'success' as const, ...result };
      } catch (error) {
        return {
          status: 'error' as const,
          error: error instanceof Error ? error.message : 'skills_package call failed',
        };
      }
    },
  });
}

// ── Aggregate export ────────────────────────────────────────────────────────

export function createExtraTools(ctx: ToolContext) {
  return {
    // Unified text editor
    text_editor: createTextEditorTool(ctx),

    // Image utilities
    image_rmbg: createImageRmbgTool(ctx),
    image_search_upload: createImageSearchUploadTool(ctx),

    // Gmail
    gmail_send: createGmailSendTool(ctx),
    gmail_download: createGmailDownloadTool(ctx),

    // Outlook
    outlook_send: createOutlookSendTool(ctx),
    outlook_download: createOutlookDownloadTool(ctx),

    // Skills
    skills_sync: createSkillsSyncTool(ctx),
    skills_package: createSkillsPackageTool(ctx),
  } as const;
}
