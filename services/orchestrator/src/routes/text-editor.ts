import type { FastifyInstance } from "fastify";

const SANDBOX_SERVICE_URL =
  process.env.SANDBOX_SERVICE_URL || "http://localhost:4012";

async function sandboxExec(
  sandboxId: string,
  command: string,
  userId: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/shell`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ command, timeout }),
      signal: AbortSignal.timeout(timeout + 5000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`Sandbox exec failed: ${resp.status} ${detail}`);
  }
  const data = (await resp.json()) as {
    data?: { stdout?: string; stderr?: string; exitCode?: number };
  };
  return {
    stdout: data.data?.stdout || "",
    stderr: data.data?.stderr || "",
    exitCode: data.data?.exitCode ?? 1,
  };
}

async function sandboxWriteFile(
  sandboxId: string,
  filePath: string,
  content: string,
  userId: string,
): Promise<void> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userId },
      body: JSON.stringify({ path: filePath, content }),
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File write failed: ${resp.status} ${detail}`);
  }
}

async function sandboxReadFile(
  sandboxId: string,
  filePath: string,
  userId: string,
): Promise<string> {
  const resp = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${sandboxId}/files?path=${encodeURIComponent(filePath)}`,
    {
      headers: { "x-user-id": userId },
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!resp.ok) {
    const detail = await resp.text();
    throw new Error(`File read failed: ${resp.status} ${detail}`);
  }
  const data = (await resp.json()) as { data?: { content?: string } };
  return data.data?.content || "";
}

type TextEditorCommand =
  | "view"
  | "create"
  | "str_replace"
  | "insert"
  | "undo_edit";

interface TextEditorBody {
  sandboxId: string;
  userId: string;
  command: TextEditorCommand;
  path: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  new_str_insert?: string;
  view_range?: [number, number];
}

export async function textEditorRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/text-editor", async (request, reply) => {
    const body = request.body as TextEditorBody;

    const { sandboxId, userId, command, path } = body;
    if (!sandboxId || !userId || !command || !path) {
      return reply
        .status(400)
        .send({ error: "sandboxId, userId, command, and path required" });
    }

    const validCommands: TextEditorCommand[] = [
      "view",
      "create",
      "str_replace",
      "insert",
      "undo_edit",
    ];
    if (!validCommands.includes(command)) {
      return reply.status(400).send({
        error: `Invalid command "${command}". Must be one of: ${validCommands.join(", ")}`,
      });
    }

    try {
      switch (command) {
        case "view": {
          const content = await sandboxReadFile(sandboxId, path, userId);
          if (body.view_range) {
            const lines = content.split("\n");
            const [start, end] = body.view_range;

            if (start < 1) {
              return reply
                .status(400)
                .send({ error: "view_range start must be >= 1" });
            }
            if (end < start) {
              return reply
                .status(400)
                .send({ error: "view_range end must be >= start" });
            }

            const slice = lines.slice(Math.max(0, start - 1), end);
            // Return numbered lines for clarity (1-indexed)
            const numbered = slice.map(
              (line, i) => `${start + i}\t${line}`,
            );
            return reply.send({
              content: slice.join("\n"),
              numberedContent: numbered.join("\n"),
              totalLines: lines.length,
              viewRange: [start, Math.min(end, lines.length)],
            });
          }
          return reply.send({
            content,
            totalLines: content.split("\n").length,
          });
        }

        case "create": {
          // Ensure parent directory exists
          const parentDir = path.substring(0, path.lastIndexOf("/"));
          if (parentDir) {
            await sandboxExec(
              sandboxId,
              `mkdir -p "${parentDir}"`,
              userId,
              5000,
            );
          }

          await sandboxWriteFile(
            sandboxId,
            path,
            body.file_text || "",
            userId,
          );
          return reply.send({
            success: true,
            path,
            size: (body.file_text || "").length,
          });
        }

        case "str_replace": {
          if (body.old_str === undefined || body.old_str === null) {
            return reply
              .status(400)
              .send({ error: "old_str is required for str_replace" });
          }

          const content = await sandboxReadFile(sandboxId, path, userId);

          // Save backup for undo
          await sandboxWriteFile(
            sandboxId,
            path + ".rubic-backup",
            content,
            userId,
          );

          if (!content.includes(body.old_str)) {
            return reply.status(400).send({
              error: "old_str not found in file",
              hint: "The exact string was not found. Check whitespace, line endings, and indentation.",
            });
          }

          // Count occurrences for reporting
          const occurrences = content.split(body.old_str).length - 1;

          // Only replace first occurrence (Manus behavior)
          const updated = content.replace(body.old_str, body.new_str || "");
          await sandboxWriteFile(sandboxId, path, updated, userId);

          return reply.send({
            success: true,
            replacements: 1,
            totalOccurrences: occurrences,
          });
        }

        case "insert": {
          if (body.insert_line === undefined || body.insert_line === null) {
            return reply
              .status(400)
              .send({ error: "insert_line is required for insert" });
          }

          const content = await sandboxReadFile(sandboxId, path, userId);

          // Save backup for undo
          await sandboxWriteFile(
            sandboxId,
            path + ".rubic-backup",
            content,
            userId,
          );

          const lines = content.split("\n");
          const insertAt = Math.max(
            0,
            Math.min(body.insert_line, lines.length),
          );

          // Insert the new text (may be multiline itself)
          const newLines = (body.new_str_insert || "").split("\n");
          lines.splice(insertAt, 0, ...newLines);

          await sandboxWriteFile(sandboxId, path, lines.join("\n"), userId);

          return reply.send({
            success: true,
            insertedAt: insertAt,
            linesInserted: newLines.length,
            totalLines: lines.length,
          });
        }

        case "undo_edit": {
          const backupPath = path + ".rubic-backup";

          let backup: string;
          try {
            backup = await sandboxReadFile(sandboxId, backupPath, userId);
          } catch {
            return reply.status(404).send({
              error: "No backup found for undo",
              hint: "undo_edit only works after a str_replace or insert operation.",
            });
          }

          // Restore from backup
          await sandboxWriteFile(sandboxId, path, backup, userId);

          // Remove the backup file
          await sandboxExec(
            sandboxId,
            `rm -f "${backupPath}"`,
            userId,
            5000,
          );

          return reply.send({ success: true, restoredFrom: backupPath });
        }

        default: {
          // This should never be reached due to the validCommands check above
          return reply
            .status(400)
            .send({ error: `Unhandled command: ${command}` });
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      request.log.error(
        { err, command, path },
        "Text editor operation failed",
      );
      return reply.status(500).send({ error: message, command, path });
    }
  });
}
