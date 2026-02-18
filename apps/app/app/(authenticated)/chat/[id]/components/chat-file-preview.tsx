// ============================================================================
// Utility functions for extracting file content from chat message parts.
// Used by chat-client.tsx to construct LibraryFile objects for the modal.
// ============================================================================

/**
 * Extract file info from a tool message part by toolCallId.
 * Scans all messages for a matching tool-* part and extracts the file path
 * and content (for file_write: from input, for file_read: from output).
 */
export function extractFileFromMessages(
  messages: Array<{ parts: unknown[] }>,
  toolCallId: string,
): { path: string; content?: string; toolName?: string } | null {
  for (const msg of messages) {
    for (const part of msg.parts) {
      const p = part as Record<string, unknown>;
      if (typeof p.type !== "string" || !p.type.startsWith("tool-")) continue;
      if (p.toolCallId !== toolCallId) continue;

      const input = p.input as Record<string, unknown> | undefined;
      const output = p.output as Record<string, unknown> | undefined;
      const toolName = (p.toolName ?? p.type?.slice(5)) as string;

      const path = (input?.file ?? input?.path ?? output?.file) as
        | string
        | undefined;
      if (!path) continue;

      let content: string | undefined;
      if (toolName === "file_write" || toolName === "file_str_replace") {
        content = input?.content as string | undefined;
      }
      if (!content && output?.content) {
        content = output.content as string;
      }

      return { path, content, toolName };
    }
  }
  return null;
}

/**
 * Find a file in a DB file list by sandbox path.
 * Used for URL deep links where we have previewSandboxPath but not fileId.
 */
export function findFileByPath(
  dbFiles: Array<{ id: string; path: string; metadata?: unknown }> | undefined,
  sandboxPath: string,
): { fileId: string; toolCallId?: string } | null {
  if (!dbFiles) return null;
  const decoded = decodeURIComponent(sandboxPath);
  for (const f of dbFiles) {
    if (f.path === decoded || f.path === sandboxPath) {
      const meta = f.metadata as { toolCallId?: string } | null;
      return { fileId: f.id, toolCallId: meta?.toolCallId };
    }
  }
  return null;
}
