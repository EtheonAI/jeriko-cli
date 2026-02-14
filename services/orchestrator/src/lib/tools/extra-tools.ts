/**
 * Extra tools — text_editor, image utilities, email (Gmail/Outlook),
 * skills, idle, and make_manus_page.
 *
 * These tools were described in the system prompt but missing from the
 * tool registry. Each routes to the terminal server inside the sandbox
 * (port 8330) unless noted otherwise.
 */

import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "./types.js";
import { getRsaHeaders } from "../rsa-auth.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

async function postJson(
  url: string,
  body: Record<string, unknown>,
  timeoutMs = 30000
): Promise<Record<string, unknown>> {
  const jsonBody = JSON.stringify(body);
  const rsaHeaders = getRsaHeaders(jsonBody);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
          "view",
          "create",
          "str_replace",
          "insert",
          "undo_edit",
          "find",
          "find_file",
          "multi_edit",
        ])
        .describe("The editing command to execute"),
      path: z.string().describe("Absolute file or directory path"),
      file_text: z.string().optional().describe("File content for create command"),
      old_str: z.string().optional().describe("String to find for str_replace"),
      new_str: z
        .string()
        .optional()
        .describe("Replacement string for str_replace / insert text for insert"),
      insert_line: z
        .number()
        .int()
        .optional()
        .describe("Line number to insert at (0-based) for insert command"),
      view_range: z
        .array(z.number().int())
        .length(2)
        .optional()
        .describe("[start_line, end_line] for view command (-1 = EOF)"),
      regex: z.string().optional().describe("Regex pattern for find_content"),
      glob: z.string().optional().describe("Glob pattern for find_file"),
      edits: z
        .array(
          z.object({
            old_str: z.string().describe("String to find"),
            new_str: z.string().describe("Replacement string"),
          })
        )
        .optional()
        .describe("Array of edits for multi_edit command"),
      sudo: z.boolean().optional().describe("Whether to use sudo privileges"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return {
          status: "error" as const,
          error: "No sandbox available. Terminal server is not reachable.",
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/text_editor`,
          params as Record<string, unknown>,
          60000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "text_editor call failed",
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
      input: z.string().describe("Absolute path of the image file in the sandbox"),
      output: z
        .string()
        .optional()
        .describe("Optional output path. Defaults to <original>_nobg.png"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return {
          status: "error" as const,
          error: "No sandbox available. Terminal server is not reachable.",
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/image/rmbg`,
          params as Record<string, unknown>,
          60000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "image_rmbg call failed",
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
      file_path: z.string().describe("Absolute path of the image file to search"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return {
          status: "error" as const,
          error: "No sandbox available. Terminal server is not reachable.",
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/search_image/upload`,
          params as Record<string, unknown>,
          60000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "image_search_upload call failed",
        };
      }
    },
  });
}

// ── gmail_send ──────────────────────────────────────────────────────────────

export function createGmailSendTool(ctx: ToolContext) {
  return tool({
    description: `Send an email or save a draft via Gmail. Requires the user to have connected their Gmail account in Settings > Applications.`,
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body (plain text or HTML)"),
      cc: z.string().optional().describe("CC recipients, comma-separated"),
      bcc: z.string().optional().describe("BCC recipients, comma-separated"),
      is_html: z.boolean().optional().default(false).describe("Whether the body is HTML"),
      save_as_draft: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, save as draft instead of sending"),
    }),
    execute: async (params) => {
      // Route through connector service (Composio) — NOT sandbox 501 stubs
      const connectorUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";
      const toolName = params.save_as_draft ? "GMAIL_CREATE_EMAIL_DRAFT" : "GMAIL_SEND_EMAIL";

      try {
        const response = await fetch(`${connectorUrl}/tools/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": ctx.userId,
          },
          body: JSON.stringify({
            toolName,
            arguments: {
              recipient_email: params.to,
              subject: params.subject,
              body: params.body,
              cc: params.cc,
              bcc: params.bcc,
              is_html: params.is_html,
            },
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          if (response.status === 403) {
            return {
              status: "error" as const,
              error:
                "Gmail not connected. Ask the user to connect their Gmail account in Settings > Applications.",
            };
          }
          return {
            status: "error" as const,
            error: `Connector error (${response.status}): ${text}`,
          };
        }

        const result = (await response.json()) as Record<string, unknown>;
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "gmail_send failed",
        };
      }
    },
  });
}

// ── outlook_send ────────────────────────────────────────────────────────────

export function createOutlookSendTool(ctx: ToolContext) {
  return tool({
    description: `Send an email or save a draft via Outlook. Requires the user to have connected their Outlook account in Settings > Applications.`,
    inputSchema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body (plain text or HTML)"),
      cc: z.string().optional().describe("CC recipients, comma-separated"),
      bcc: z.string().optional().describe("BCC recipients, comma-separated"),
      is_html: z.boolean().optional().default(false).describe("Whether the body is HTML"),
      save_as_draft: z
        .boolean()
        .optional()
        .default(false)
        .describe("If true, save as draft instead of sending"),
    }),
    execute: async (params) => {
      // Route through connector service (Composio) — NOT sandbox 501 stubs
      const connectorUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";
      const toolName = params.save_as_draft ? "OUTLOOK_CREATE_DRAFT" : "OUTLOOK_SEND_EMAIL";

      try {
        const response = await fetch(`${connectorUrl}/tools/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": ctx.userId,
          },
          body: JSON.stringify({
            toolName,
            arguments: {
              recipient_email: params.to,
              subject: params.subject,
              body: params.body,
              cc: params.cc,
              bcc: params.bcc,
              is_html: params.is_html,
            },
          }),
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          if (response.status === 403) {
            return {
              status: "error" as const,
              error:
                "Outlook not connected. Ask the user to connect their Outlook account in Settings > Applications.",
            };
          }
          return {
            status: "error" as const,
            error: `Connector error (${response.status}): ${text}`,
          };
        }

        const result = (await response.json()) as Record<string, unknown>;
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "outlook_send failed",
        };
      }
    },
  });
}

// ── gmail_download ──────────────────────────────────────────────────────────

export function createGmailDownloadTool(ctx: ToolContext) {
  return tool({
    description: `Download attachments from a Gmail message. Requires the user to have connected their Gmail account in Settings > Applications. Files are saved to the sandbox filesystem.`,
    inputSchema: z.object({
      message_id: z.string().describe("Gmail message ID to download attachments from"),
      output_dir: z
        .string()
        .optional()
        .default("/home/ubuntu/Downloads")
        .describe("Directory to save attachments"),
    }),
    execute: async (params) => {
      // Route through connector service (Composio) to get attachment data
      const connectorUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

      try {
        // Step 1: Get attachment metadata from Gmail via Composio
        const response = await fetch(`${connectorUrl}/tools/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": ctx.userId,
          },
          body: JSON.stringify({
            toolName: "GMAIL_GET_ATTACHMENT",
            arguments: {
              message_id: params.message_id,
            },
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          if (response.status === 403) {
            return {
              status: "error" as const,
              error:
                "Gmail not connected. Ask the user to connect their Gmail account in Settings > Applications.",
            };
          }
          return {
            status: "error" as const,
            error: `Connector error (${response.status}): ${text}`,
          };
        }

        const result = (await response.json()) as Record<string, unknown>;

        // Step 2: If we got attachment data, write files to sandbox
        const baseUrl = ctx.terminalServerUrl;
        if (baseUrl && baseUrl !== "no-sandbox" && result.result) {
          const attachments = Array.isArray(result.result)
            ? result.result
            : [result.result as Record<string, unknown>];
          const savedFiles: string[] = [];

          for (const att of attachments) {
            const attObj = att as Record<string, unknown>;
            const filename = (attObj.filename as string) || `attachment_${Date.now()}`;
            const data = (attObj.data as string) || (attObj.content as string) || "";
            const outputPath = `${params.output_dir}/${filename}`;

            if (data) {
              await postJson(
                `${baseUrl}/file/write`,
                {
                  path: outputPath,
                  content: data,
                  encoding: (attObj.encoding as string) || "base64",
                },
                30000
              );
              savedFiles.push(outputPath);
            }
          }

          return { status: "success" as const, files: savedFiles, count: savedFiles.length };
        }

        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "gmail_download failed",
        };
      }
    },
  });
}

// ── outlook_download ────────────────────────────────────────────────────────

export function createOutlookDownloadTool(ctx: ToolContext) {
  return tool({
    description: `Download attachments from an Outlook email message. Requires the user to have connected their Outlook account in Settings > Applications. Files are saved to the sandbox filesystem.`,
    inputSchema: z.object({
      message_id: z.string().describe("Outlook message ID to download attachments from"),
      output_dir: z
        .string()
        .optional()
        .default("/home/ubuntu/Downloads")
        .describe("Directory to save attachments"),
    }),
    execute: async (params) => {
      // Route through connector service (Composio) to get attachment data
      const connectorUrl = process.env.CONNECTOR_SERVICE_URL || "http://localhost:4009";

      try {
        // Step 1: Get attachment data from Outlook via Composio
        const response = await fetch(`${connectorUrl}/tools/execute`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": ctx.userId,
          },
          body: JSON.stringify({
            toolName: "OUTLOOK_GET_ATTACHMENT",
            arguments: {
              message_id: params.message_id,
            },
          }),
          signal: AbortSignal.timeout(60000),
        });

        if (!response.ok) {
          const text = await response.text().catch(() => "");
          if (response.status === 403) {
            return {
              status: "error" as const,
              error:
                "Outlook not connected. Ask the user to connect their Outlook account in Settings > Applications.",
            };
          }
          return {
            status: "error" as const,
            error: `Connector error (${response.status}): ${text}`,
          };
        }

        const result = (await response.json()) as Record<string, unknown>;

        // Step 2: If we got attachment data, write files to sandbox
        const baseUrl = ctx.terminalServerUrl;
        if (baseUrl && baseUrl !== "no-sandbox" && result.result) {
          const attachments = Array.isArray(result.result)
            ? result.result
            : [result.result as Record<string, unknown>];
          const savedFiles: string[] = [];

          for (const att of attachments) {
            const attObj = att as Record<string, unknown>;
            const filename = (attObj.filename as string) || `attachment_${Date.now()}`;
            const data = (attObj.data as string) || (attObj.content as string) || "";
            const outputPath = `${params.output_dir}/${filename}`;

            if (data) {
              await postJson(
                `${baseUrl}/file/write`,
                {
                  path: outputPath,
                  content: data,
                  encoding: (attObj.encoding as string) || "base64",
                },
                30000
              );
              savedFiles.push(outputPath);
            }
          }

          return { status: "success" as const, files: savedFiles, count: savedFiles.length };
        }

        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "outlook_download failed",
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
        .describe("Specific skill IDs to sync. If omitted, all user skills are synced."),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return {
          status: "error" as const,
          error: "No sandbox available. Terminal server is not reachable.",
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/skills/sync-skills`,
          { ...params, user_id: ctx.userId, session_id: ctx.sessionId } as Record<string, unknown>,
          60000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "skills_sync call failed",
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
      skill_path: z.string().describe("Absolute path of the skill directory to package"),
      skill_name: z.string().describe("Display name of the skill"),
      description: z.string().optional().describe("Brief description of what the skill does"),
      version: z.string().optional().default("1.0.0").describe("Semantic version"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return {
          status: "error" as const,
          error: "No sandbox available. Terminal server is not reachable.",
        };
      }

      try {
        const result = await postJson(
          `${baseUrl}/skills/package-skill`,
          { ...params, user_id: ctx.userId, session_id: ctx.sessionId } as Record<string, unknown>,
          60000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "skills_package call failed",
        };
      }
    },
  });
}

// ── Slide tools ───────────────────────────────────────────────────────────

export function createSlideInitTool(ctx: ToolContext) {
  return tool({
    description:
      "Initialize a new slide presentation project. Creates the project directory " +
      "with HTML player, styles, and empty slides.json. Starts a local dev server.",
    inputSchema: z.object({
      app_name: z.string().describe("Name of the presentation project (used as directory name)"),
      title: z.string().optional().describe("Title of the first slide"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return { status: "error" as const, error: "No sandbox available." };
      }
      try {
        const result = await postJson(
          `${baseUrl}/slide/init-project`,
          {
            app_name: params.app_name,
            title: params.title || "Untitled Presentation",
            user_id: ctx.userId,
            session_id: ctx.sessionId,
          },
          60000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "slide init failed",
        };
      }
    },
  });
}

export function createSlideModifyTool(ctx: ToolContext) {
  return tool({
    description:
      "Modify an existing slide in the presentation. Can update title, content (HTML), " +
      "background color/image, or reorder slides.",
    inputSchema: z.object({
      slide_id: z.string().describe("ID of the slide to modify"),
      title: z.string().optional().describe("New title for the slide"),
      content: z.string().optional().describe("HTML content for the slide body"),
      background: z.string().optional().describe("Background color or image URL"),
      order: z.number().optional().describe("New position in the slide deck (0-based)"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return { status: "error" as const, error: "No sandbox available." };
      }
      try {
        const result = await postJson(
          `${baseUrl}/slide/modify`,
          params as Record<string, unknown>,
          30000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "slide modify failed",
        };
      }
    },
  });
}

export function createSlideAddNotesTool(ctx: ToolContext) {
  return tool({
    description: "Add or update speaker notes for a specific slide.",
    inputSchema: z.object({
      slide_id: z.string().describe("ID of the slide"),
      notes: z.string().describe("Speaker notes content (markdown)"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return { status: "error" as const, error: "No sandbox available." };
      }
      try {
        const result = await postJson(
          `${baseUrl}/slide/notes`,
          params as Record<string, unknown>,
          15000
        );
        return { status: "success" as const, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "slide notes failed",
        };
      }
    },
  });
}

export function createSlidePresentTool(ctx: ToolContext) {
  return tool({
    description:
      "Enter presentation mode for the slide deck. Returns a URL to view the " +
      "presentation in the browser.",
    inputSchema: z.object({
      app_name: z.string().describe("Name of the presentation project"),
    }),
    execute: async (params) => {
      const baseUrl = ctx.terminalServerUrl;
      if (!baseUrl || baseUrl === "no-sandbox") {
        return { status: "error" as const, error: "No sandbox available." };
      }
      try {
        const result = await postJson(
          `${baseUrl}/slide/present`,
          params as Record<string, unknown>,
          15000
        );
        // Also compute the public URL via E2B port proxy
        const e2bId = ctx.e2bSandboxId;
        const domain = process.env.SANDBOX_DOMAIN || "e2b.dev";
        const presentUrl = e2bId ? `https://3000-${e2bId}.${domain}/?mode=present` : "";
        return { status: "success" as const, presentUrl, ...result };
      } catch (error) {
        return {
          status: "error" as const,
          error: error instanceof Error ? error.message : "slide present failed",
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

    // Slides
    slide_init: createSlideInitTool(ctx),
    slide_modify: createSlideModifyTool(ctx),
    slide_add_notes: createSlideAddNotesTool(ctx),
    slide_present: createSlidePresentTool(ctx),
  } as const;
}
