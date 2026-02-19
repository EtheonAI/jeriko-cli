/**
 * Sandbox tool executor — routes tool calls to the sandbox runtime inside the E2B sandbox.
 *
 * The sandbox runtime runs on port 8330 inside the sandbox and provides:
 *   - Terminal (PTY sessions): /terminal/create, /terminal/{id}/write, /terminal/{id}/view, /terminal/{id}/kill
 *   - Text editor (files):    /text_editor (unified endpoint)
 *   - Browser control:        /browser/action (unified endpoint)
 *   - Deploy:                 /deploy/zip-and-upload, expose-port via E2B SDK
 *   - File I/O:               /file/{command}
 */

import type { ToolContext } from "../types.js";
import { getRsaHeaders } from "../../rsa-auth.js";

// Track which terminal IDs have been created this session
const createdTerminals = new Set<string>();

/**
 * Execute a tool by routing to the correct sandbox runtime endpoint.
 */
export async function executeSandboxTool(
  ctx: ToolContext,
  toolName: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = ctx.terminalServerUrl;
  if (!baseUrl || baseUrl === "no-sandbox") {
    return { status: "error", error: "No sandbox available. Sandbox runtime is not reachable." };
  }

  try {
    // Emit tool start event
    await ctx.ws.emit(ctx.sessionId, {
      type: "tool_call",
      toolName,
      status: "running",
      params,
      timestamp: new Date().toISOString(),
    });

    let result: Record<string, unknown>;

    // Route to correct sandbox runtime endpoint
    if (toolName === "file_read") {
      result = await handleFileRead(baseUrl, params);
    } else if (toolName === "file_write") {
      result = await handleFileWrite(baseUrl, params);
    } else if (toolName === "file_str_replace") {
      result = await handleFileStrReplace(baseUrl, params);
    } else if (toolName === "file_find_in_content") {
      result = await handleFileFindInContent(baseUrl, params);
    } else if (toolName === "file_find_by_name") {
      result = await handleFileFindByName(baseUrl, params);
    } else if (toolName === "file_view") {
      result = await handleFileView(baseUrl, params);
    } else if (toolName === "shell_exec") {
      result = await handleShellExec(baseUrl, params);
    } else if (toolName === "shell_view") {
      result = await handleShellView(baseUrl, params);
    } else if (toolName === "shell_wait") {
      result = await handleShellWait(baseUrl, params);
    } else if (toolName === "shell_write_to_process") {
      result = await handleShellWriteToProcess(baseUrl, params);
    } else if (toolName === "shell_kill_process") {
      result = await handleShellKillProcess(baseUrl, params);
    } else if (toolName === "code_execute") {
      result = await handleCodeExecute(baseUrl, params);
    } else if (toolName.startsWith("browser_")) {
      result = await handleBrowser(baseUrl, toolName, params, ctx.userId);
    } else if (toolName === "deploy_expose_port") {
      result = await handleDeployExposePort(ctx, params);
    } else if (toolName === "deploy_apply_deployment") {
      result = await handleDeployApplyDeployment(baseUrl, ctx, params);
    } else {
      result = { status: "error", error: `Unknown tool: ${toolName}` };
    }

    // Emit tool result event
    await ctx.ws.emit(ctx.sessionId, {
      type: "tool_result",
      toolName,
      status: result.status === "error" ? "failed" : "completed",
      result,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await ctx.ws.emit(ctx.sessionId, {
      type: "tool_result",
      toolName,
      status: "failed",
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return { status: "error", error: errorMessage };
  }
}

// ── Helper: POST JSON to sandbox runtime ─────────────────────────────────────

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

async function getJson(url: string, timeoutMs = 15000): Promise<Record<string, unknown>> {
  const rsaHeaders = getRsaHeaders("");

  const response = await fetch(url, {
    headers: { ...rsaHeaders },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Sandbox runtime error (${response.status}): ${text}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

// ── Ensure terminal exists ───────────────────────────────────────────────────

async function ensureTerminal(baseUrl: string, id: string): Promise<void> {
  const key = `${baseUrl}:${id}`;
  if (createdTerminals.has(key)) return;

  try {
    await postJson(`${baseUrl}/terminal/create`, { id }, 10000);
  } catch {
    // Terminal may already exist — not fatal
  }
  createdTerminals.add(key);
}

// ── File tools (via /text_editor) ────────────────────────────────────────────

async function handleFileRead(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  const startLine = params.start_line as number | undefined;
  const endLine = params.end_line as number | undefined;
  const sudo = params.sudo as boolean | undefined;

  const body: Record<string, unknown> = { command: "view", path: file };
  if (startLine !== undefined || endLine !== undefined) {
    body.view_range = [startLine ?? 0, endLine ?? -1];
  }
  if (sudo) body.sudo = true;

  const result = await postJson(`${baseUrl}/text_editor`, body);
  return { status: "success", content: result.content ?? result.output ?? "", file };
}

async function handleFileWrite(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  let content = params.content as string;
  const append = params.append as boolean | undefined;
  const leadingNewline = params.leading_newline as boolean | undefined;
  const trailingNewline = params.trailing_newline as boolean | undefined;
  const sudo = params.sudo as boolean | undefined;

  if (append) {
    // Append: use /file/write with append=true
    // Let the /file/write endpoint handle leading/trailing newlines natively
    const body: Record<string, unknown> = {
      path: file,
      content,
      append: true,
      leading_newline: !!leadingNewline,
      trailing_newline: trailingNewline !== false,
    };
    const result = await postJson(`${baseUrl}/file/write`, body);
    return {
      status: "success",
      file,
      bytesWritten: Buffer.byteLength(content, "utf-8"),
      ...result,
    };
  } else {
    // Create/overwrite: prepend/append newlines here, then use text_editor 'create'
    if (leadingNewline) content = "\n" + content;
    if (trailingNewline) content = content + "\n";
    const body: Record<string, unknown> = { command: "create", path: file, file_text: content };
    if (sudo) body.sudo = true;
    const result = await postJson(`${baseUrl}/text_editor`, body);
    return {
      status: "success",
      file,
      bytesWritten: Buffer.byteLength(content, "utf-8"),
      ...result,
    };
  }
}

async function handleFileStrReplace(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  const oldStr = params.old_str as string;
  const newStr = params.new_str as string;
  const sudo = params.sudo as boolean | undefined;

  const body: Record<string, unknown> = {
    command: "str_replace",
    path: file,
    old_str: oldStr,
    new_str: newStr,
  };
  if (sudo) body.sudo = true;

  const result = await postJson(`${baseUrl}/text_editor`, body);
  return { status: "success", file, replacements: 1, ...result };
}

async function handleFileFindInContent(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  const regex = params.regex as string;
  const sudo = params.sudo as boolean | undefined;

  // Sandbox text_editor uses "find" command (not "grep")
  const body: Record<string, unknown> = { command: "find", path: file, regex };
  if (sudo) body.sudo = true;

  const result = await postJson(`${baseUrl}/text_editor`, body);
  return { status: "success", matches: result.matches ?? result.output ?? "", ...result };
}

async function handleFileFindByName(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const path = params.path as string;
  const glob = params.glob as string;

  const result = await postJson(`${baseUrl}/text_editor`, {
    command: "find_file",
    path,
    glob,
  });
  return { status: "success", files: result.files ?? result.output ?? "", ...result };
}

async function handleFileView(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  const sudo = params.sudo as boolean | undefined;

  // Read the file as base64 via /file/read endpoint
  const body: Record<string, unknown> = { path: file, encoding: "base64" };
  if (sudo) body.sudo = true;

  try {
    const result = await postJson(`${baseUrl}/file/read`, body, 30000);
    const content = result.content as string;
    if (!content) {
      return { status: "error", error: "File is empty or could not be read" };
    }

    // Detect mime type from extension
    const ext = file.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap: Record<string, string> = {
      png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif",
      webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", ico: "image/x-icon",
      pdf: "application/pdf", tiff: "image/tiff", tif: "image/tiff",
    };
    const mimeType = mimeMap[ext] || "application/octet-stream";

    return {
      status: "success",
      file,
      mimeType,
      base64: content,
      sizeBytes: Math.ceil((content.length * 3) / 4),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { status: "error", error: `Failed to view file: ${msg}` };
  }
}

// ── Shell tools (via /terminal/{id}/*) ───────────────────────────────────────

async function handleShellExec(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const id = (params.id as string) || "default";
  const execDir = params.exec_dir as string;
  const command = params.command as string;

  // Ensure terminal exists
  await ensureTerminal(baseUrl, id);

  // Snapshot current output length BEFORE writing the command
  // so we can return only the new output (delta)
  const preView = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);
  const preOutput = ((preView.output ?? preView.content ?? "") as string);
  const preLen = preOutput.length;

  // Build command — if exec_dir specified, cd first
  const fullCommand = execDir ? `cd ${JSON.stringify(execDir)} && ${command}` : command;

  // Write command to terminal
  await postJson(
    `${baseUrl}/terminal/${encodeURIComponent(id)}/write`,
    { text: fullCommand + "\n" },
    120000
  );

  // Manus parity: exec_command() waits max 5 seconds for completion.
  // If done → returns status="completed" with output.
  // If still running → returns status="running" with partial output.
  // Agent then calls shell_view() to poll — each poll = new tool event = frontend update.
  await new Promise((resolve) => setTimeout(resolve, 500));
  let lastOutput = "";
  let stableCount = 0;
  const pollStart = Date.now();
  while (Date.now() - pollStart < 5000) {
    const result = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);
    const currentOutput = (result.output ?? result.content ?? "") as string;
    if (currentOutput === lastOutput) {
      stableCount++;
      if (stableCount >= 2) break; // Output stabilized = command done
    } else {
      stableCount = 0;
      lastOutput = currentOutput;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Read final output and return only the NEW portion (after the pre-snapshot)
  const viewResult = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);
  const fullOutput = (viewResult.output ?? viewResult.content ?? "") as string;
  const newOutput = fullOutput.length > preLen ? fullOutput.slice(preLen) : fullOutput.slice(-2000);

  if (stableCount >= 2) {
    // Command completed within 5s — return full output (Manus: status="completed")
    const outputLines = newOutput.split("\n");
    const trimmedOutput = outputLines.length > 100
      ? outputLines.slice(-100).join("\n")
      : newOutput;
    return { status: "completed", output: trimmedOutput };
  }

  // Command still running — return immediately with partial output (Manus parity)
  // Agent will call shell_view() to poll → each poll is a new tool event → progressive terminal updates
  const partialLines = newOutput.split("\n");
  const trimmedPartial = partialLines.length > 50
    ? partialLines.slice(-50).join("\n")
    : newOutput;
  return {
    status: "running",
    output: trimmedPartial || "(command still running — use shell_view to check output)",
    session_id: id,
  };
}

async function handleShellView(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const id = (params.id as string) || "default";

  const result = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);
  const fullOutput = (result.output ?? result.content ?? "") as string;
  const outputLines = fullOutput.split("\n");
  const trimmedOutput = outputLines.length > 100
    ? outputLines.slice(-100).join("\n")
    : fullOutput;

  return {
    status: "success",
    output: trimmedOutput,
    output_truncated: outputLines.length > 100,
  };
}

async function handleShellWait(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const id = (params.id as string) || "default";
  const seconds = (params.seconds as number) ?? 30;

  // Poll terminal view until output stabilizes or timeout
  const startTime = Date.now();
  const timeoutMs = seconds * 1000;
  let lastOutput = "";
  let stableCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    const result = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);
    const currentOutput = (result.output ?? result.content ?? "") as string;

    if (currentOutput === lastOutput) {
      stableCount++;
      if (stableCount >= 3) {
        const lines = currentOutput.split("\n");
        const trimmed = lines.length > 100 ? lines.slice(-100).join("\n") : currentOutput;
        return { status: "success", completed: true, output: trimmed, output_truncated: lines.length > 100 };
      }
    } else {
      stableCount = 0;
      lastOutput = currentOutput;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const lines = lastOutput.split("\n");
  const trimmed = lines.length > 100 ? lines.slice(-100).join("\n") : lastOutput;
  return {
    status: "success",
    completed: false,
    output: trimmed,
    output_truncated: lines.length > 100,
  };
}

async function handleShellWriteToProcess(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const id = (params.id as string) || "default";
  const input = params.input as string;
  const pressEnter = (params.press_enter as boolean) ?? false;

  await postJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/write`, {
    text: input,
    enter: pressEnter,
  });

  // Wait briefly then return current terminal output so the agent can see the effect
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const viewResult = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);
  const fullOutput = (viewResult.output ?? viewResult.content ?? "") as string;
  const outputLines = fullOutput.split("\n");
  const trimmedOutput = outputLines.length > 80
    ? outputLines.slice(-80).join("\n")
    : fullOutput;

  return { status: "success", output: trimmedOutput };
}

async function handleShellKillProcess(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const id = (params.id as string) || "default";

  const result = await postJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/kill`, {});

  return { status: "success", ...result };
}

// ── Code execution (via shell) ───────────────────────────────────────────────

async function handleCodeExecute(
  baseUrl: string,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const code = params.code as string;
  const language = (params.language as string) || "python";

  let command: string;
  if (language === "python") {
    command = `python3 -c ${JSON.stringify(code)}`;
  } else if (language === "javascript" || language === "typescript") {
    command = `node -e ${JSON.stringify(code)}`;
  } else if (language === "bash") {
    command = `bash -c ${JSON.stringify(code)}`;
  } else {
    return { status: "error", error: `Unsupported language: ${language}` };
  }

  // Ensure the code_exec terminal exists
  await ensureTerminal(baseUrl, "code_exec");

  // Write command with newline so it executes
  await postJson(
    `${baseUrl}/terminal/code_exec/write`,
    {
      text: command + "\n",
    },
    120000
  );

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const viewResult = await getJson(`${baseUrl}/terminal/code_exec/view`);

  return {
    status: "success",
    output: viewResult.output ?? viewResult.content ?? "",
    ...viewResult,
  };
}

// ── Browser tools (via /browser/action) ──────────────────────────────────────

/**
 * Upload a base64-encoded screenshot to S3 and return a presigned URL.
 * Manus flow: sandbox → base64 → S3 upload → presigned URL → frontend.
 */
async function uploadScreenshotToS3(
  base64Data: string,
  userId: string
): Promise<string> {
  const { uploadFile, getPresignedUrl } = await import("@repo/storage");
  const buffer = Buffer.from(base64Data, "base64");
  const key = `screenshots/${userId}/${Date.now()}_${Math.random().toString(36).slice(2)}.webp`;
  await uploadFile(key, buffer, "image/webp");
  return getPresignedUrl(key, 86400, true);
}

// Actions that return annotated screenshots (bounding boxes drawn by sandbox browser.py).
// Manus sends CLEAN screenshots to frontend — annotations are text-only (data-manus-id).
// We take a second clean screenshot after these actions for the frontend.
const ANNOTATED_SCREENSHOT_ACTIONS = new Set([
  "view", "navigate", "click", "input", "scroll_up", "scroll_down",
  "move_mouse", "press_key", "select_option", "restart",
  "fill_form", "find_keyword", "upload_file",
]);

async function handleBrowser(
  baseUrl: string,
  toolName: string,
  params: Record<string, unknown>,
  userId: string
): Promise<Record<string, unknown>> {
  // Strip 'browser_' prefix — sandbox expects bare action names
  const action = toolName.replace(/^browser_/, "");

  // Transform parameters to match sandbox expected format
  const transformedParams = { ...params };

  // Convert {coordinate_x, coordinate_y} → {coordinate: [x, y]}
  if ("coordinate_x" in transformedParams && "coordinate_y" in transformedParams) {
    transformedParams.coordinate = [transformedParams.coordinate_x, transformedParams.coordinate_y];
    delete transformedParams.coordinate_x;
    delete transformedParams.coordinate_y;
  }

  // console_exec: {javascript} → {script}
  if (action === "console_exec" && "javascript" in transformedParams) {
    transformedParams.script = transformedParams.javascript;
    delete transformedParams.javascript;
  }

  // select_option: pass index + option/value through to sandbox
  // (sandbox browser.py handles index-based select natively)
  if (action === "select_option" && "option" in transformedParams) {
    transformedParams.value = transformedParams.option;
    delete transformedParams.option;
  }

  // scroll_up: {to_top} → {amount}
  if (action === "scroll_up" && "to_top" in transformedParams) {
    if (transformedParams.to_top) {
      transformedParams.amount = 99999;
    }
    delete transformedParams.to_top;
  }

  // scroll_down: {to_bottom} → {amount}
  if (action === "scroll_down" && "to_bottom" in transformedParams) {
    if (transformedParams.to_bottom) {
      transformedParams.amount = 99999;
    }
    delete transformedParams.to_bottom;
  }

  const result = await postJson(
    `${baseUrl}/browser/action`,
    {
      action,
      ...transformedParams,
    },
    45000
  );

  // ── Manus parity: send CLEAN screenshot to frontend ──
  // The sandbox annotates screenshots with numbered bounding boxes (Pillow).
  // Manus never sends annotated images to users — only adds data-manus-id to DOM.
  // Primary: use clean_screenshot from sandbox (returned alongside annotated).
  // Fallback: take a separate clean screenshot via "screenshot" action.
  if (
    ANNOTATED_SCREENSHOT_ACTIONS.has(action) &&
    typeof result.screenshot === "string" &&
    result.screenshot.length > 200
  ) {
    // Primary: sandbox returns clean_screenshot alongside annotated
    if (typeof result.clean_screenshot === "string" && result.clean_screenshot.length > 200) {
      result.screenshot = result.clean_screenshot;
    } else {
      // Fallback: take a separate clean screenshot
      try {
        const cleanResult = await postJson(
          `${baseUrl}/browser/action`,
          { action: "screenshot" },
          15000
        );
        if (
          typeof cleanResult.screenshot === "string" &&
          cleanResult.screenshot.length > 200
        ) {
          result.screenshot = cleanResult.screenshot;
        }
      } catch {
        // Keep annotated as fallback — still usable
      }
    }
  }
  // Remove clean_screenshot from result — only screenshot goes to frontend
  delete result.clean_screenshot;

  // Upload screenshot base64 to S3 and replace with presigned URL
  if (typeof result.screenshot === "string" && result.screenshot.length > 200) {
    try {
      const screenshotUrl = await uploadScreenshotToS3(result.screenshot, userId);
      result.screenshot = screenshotUrl;
    } catch (error) {
      console.error("Failed to upload screenshot to S3:", error);
    }
  }

  return { status: "success", ...result };
}

// ── Deploy tools ─────────────────────────────────────────────────────────────

async function handleDeployExposePort(
  ctx: ToolContext,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const port = params.port as number;
  const e2bId = ctx.e2bSandboxId;

  if (!e2bId) {
    return { status: "error", error: "No E2B sandbox ID available" };
  }

  const domain = process.env.SANDBOX_DOMAIN || "e2b.dev";
  const publicUrl = `https://${port}-${e2bId}.${domain}`;

  return { status: "success", url: publicUrl, port };
}

async function handleDeployApplyDeployment(
  baseUrl: string,
  ctx: ToolContext,
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const type = params.type as string;
  const localDir = params.local_dir as string;

  const result = await postJson(
    `${baseUrl}/deploy/zip-and-upload`,
    {
      type,
      local_dir: localDir,
      user_id: ctx.userId,
      session_id: ctx.sessionId,
    },
    120000
  );

  return { status: "success", type, local_dir: localDir, ...result };
}

// ── Upload attachments ───────────────────────────────────────────────────────

/** MIME type lookup from file extension — matches Manus CDN content-type detection */
const EXT_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".ts": "text/typescript",
  ".json": "application/json",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function guessMimeType(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return EXT_MIME[ext] || "application/octet-stream";
}

export interface UploadedAttachment {
  path: string;
  url: string;
  name: string;
  mediaType: string;
}

export async function uploadAttachments(
  ctx: ToolContext,
  attachments: string[]
): Promise<UploadedAttachment[]> {
  if (!attachments || attachments.length === 0) return [];

  const baseUrl = ctx.terminalServerUrl;
  const uploaded: UploadedAttachment[] = [];

  for (const filePath of attachments) {
    try {
      const name = filePath.split("/").pop() || "file";
      const mediaType = guessMimeType(filePath);
      let url: string | undefined;

      // Primary path: sandbox runtime → rubic-upload-file → S3
      if (baseUrl && baseUrl !== "no-sandbox") {
        try {
          const result = await postJson(`${baseUrl}/file/upload`, {
            file_path: filePath,
            user_id: ctx.userId,
          });
          if (result.url) {
            url = result.url as string;
          }
        } catch (primaryErr) {
          console.error(`[uploadAttachments] Primary upload failed for ${filePath}, trying fallback:`, primaryErr);
        }
      }

      // Fallback: read file from sandbox → upload to S3 from orchestrator
      if (!url) {
        try {
          url = await ctx.storage.uploadFromSandbox(
            ctx.e2bSandboxId || ctx.sandboxId,
            filePath,
            ctx.userId
          );
        } catch (fallbackErr) {
          console.error(`[uploadAttachments] Fallback upload failed for ${filePath}:`, fallbackErr);
        }
      }

      if (url) {
        uploaded.push({ path: filePath, url, name, mediaType });
      } else {
        console.error(`[uploadAttachments] All upload paths failed for ${filePath}`);
      }
    } catch (error) {
      console.error(`[uploadAttachments] Unexpected error for ${filePath}:`, error);
    }
  }

  return uploaded;
}
