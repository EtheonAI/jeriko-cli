/**
 * Sandbox tool executor — routes tool calls to the terminal server inside the E2B sandbox.
 *
 * The terminal server runs on port 8330 inside the sandbox and provides:
 *   - Terminal (PTY sessions): /terminal/{id}/write, /terminal/{id}/view, /terminal/{id}/kill
 *   - Text editor (files):    /text_editor (unified endpoint)
 *   - Browser control:        /browser/action (unified endpoint)
 *   - Deploy:                 /deploy/zip-and-upload, expose-port via E2B SDK
 *   - File I/O:               /file (raw read/write)
 */

import type { ToolContext } from '../types.js';
import { getRsaHeaders } from '../../rsa-auth.js';

/**
 * Execute a tool by routing to the correct terminal server endpoint.
 */
export async function executeSandboxTool(
  ctx: ToolContext,
  toolName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const baseUrl = ctx.terminalServerUrl;
  if (!baseUrl || baseUrl === 'no-sandbox') {
    return { status: 'error', error: 'No sandbox available. Terminal server is not reachable.' };
  }

  try {
    // Emit tool start event
    await ctx.ws.emit(ctx.sessionId, {
      type: 'tool_call',
      toolName,
      status: 'running',
      params,
      timestamp: new Date().toISOString(),
    });

    let result: Record<string, unknown>;

    // Route to correct terminal server endpoint
    if (toolName === 'file_read') {
      result = await handleFileRead(baseUrl, params);
    } else if (toolName === 'file_write') {
      result = await handleFileWrite(baseUrl, params);
    } else if (toolName === 'file_str_replace') {
      result = await handleFileStrReplace(baseUrl, params);
    } else if (toolName === 'file_find_in_content') {
      result = await handleFileFindInContent(baseUrl, params);
    } else if (toolName === 'file_find_by_name') {
      result = await handleFileFindByName(baseUrl, params);
    } else if (toolName === 'shell_exec') {
      result = await handleShellExec(baseUrl, params);
    } else if (toolName === 'shell_view') {
      result = await handleShellView(baseUrl, params);
    } else if (toolName === 'shell_wait') {
      result = await handleShellWait(baseUrl, params);
    } else if (toolName === 'shell_write_to_process') {
      result = await handleShellWriteToProcess(baseUrl, params);
    } else if (toolName === 'shell_kill_process') {
      result = await handleShellKillProcess(baseUrl, params);
    } else if (toolName === 'code_execute') {
      result = await handleCodeExecute(baseUrl, params);
    } else if (toolName.startsWith('browser_')) {
      result = await handleBrowser(baseUrl, toolName, params);
    } else if (toolName === 'deploy_expose_port') {
      result = await handleDeployExposePort(ctx, params);
    } else if (toolName === 'deploy_apply_deployment') {
      result = await handleDeployApplyDeployment(baseUrl, ctx, params);
    } else {
      result = { status: 'error', error: `Unknown tool: ${toolName}` };
    }

    // Emit tool result event
    await ctx.ws.emit(ctx.sessionId, {
      type: 'tool_result',
      toolName,
      status: result.status === 'error' ? 'failed' : 'completed',
      result,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await ctx.ws.emit(ctx.sessionId, {
      type: 'tool_result',
      toolName,
      status: 'failed',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });

    return { status: 'error', error: errorMessage };
  }
}

// ── Helper: POST JSON to terminal server ────────────────────────────────────

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

async function getJson(url: string, timeoutMs = 15000): Promise<Record<string, unknown>> {
  // GET requests have empty body — sign empty string
  const rsaHeaders = getRsaHeaders('');

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

// ── File tools (via /text_editor) ───────────────────────────────────────────

async function handleFileRead(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  const startLine = params.start_line as number | undefined;
  const endLine = params.end_line as number | undefined;
  const sudo = params.sudo as boolean | undefined;

  const body: Record<string, unknown> = { command: 'view', path: file };
  if (startLine !== undefined || endLine !== undefined) {
    body.view_range = [startLine ?? 0, endLine ?? -1];
  }
  if (sudo) body.sudo = true;

  const result = await postJson(`${baseUrl}/text_editor`, body);
  return { status: 'success', content: result.content ?? result.output ?? '', file };
}

async function handleFileWrite(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  let content = params.content as string;
  const append = params.append as boolean | undefined;
  const leadingNewline = params.leading_newline as boolean | undefined;
  const trailingNewline = params.trailing_newline as boolean | undefined;
  const sudo = params.sudo as boolean | undefined;

  if (leadingNewline) content = '\n' + content;
  if (trailingNewline) content = content + '\n';

  const command = append ? 'write' : 'create';
  const body: Record<string, unknown> = { command, path: file, file_text: content };
  if (append) body.insert_line = -1; // append at end
  if (sudo) body.sudo = true;

  const result = await postJson(`${baseUrl}/text_editor`, body);
  return { status: 'success', file, bytesWritten: Buffer.byteLength(content, 'utf-8'), ...result };
}

async function handleFileStrReplace(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  const oldStr = params.old_str as string;
  const newStr = params.new_str as string;
  const sudo = params.sudo as boolean | undefined;

  const body: Record<string, unknown> = {
    command: 'str_replace',
    path: file,
    old_str: oldStr,
    new_str: newStr,
  };
  if (sudo) body.sudo = true;

  const result = await postJson(`${baseUrl}/text_editor`, body);
  return { status: 'success', file, replacements: 1, ...result };
}

async function handleFileFindInContent(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const file = params.file as string;
  const regex = params.regex as string;
  const sudo = params.sudo as boolean | undefined;

  const body: Record<string, unknown> = { command: 'grep', path: file, regex };
  if (sudo) body.sudo = true;

  const result = await postJson(`${baseUrl}/text_editor`, body);
  return { status: 'success', matches: result.matches ?? result.output ?? '', ...result };
}

async function handleFileFindByName(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const path = params.path as string;
  const glob = params.glob as string;

  const result = await postJson(`${baseUrl}/text_editor`, {
    command: 'find_file',
    path,
    glob,
  });
  return { status: 'success', files: result.files ?? result.output ?? '', ...result };
}

// ── Shell tools (via /terminal/{id}/*) ──────────────────────────────────────

async function handleShellExec(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = params.id as string;
  const execDir = params.exec_dir as string;
  const command = params.command as string;

  // Write command to terminal. If exec_dir is specified, cd first.
  const fullCommand = execDir ? `cd ${JSON.stringify(execDir)} && ${command}` : command;

  await postJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/write`, {
    text: fullCommand,
    enter: true,
  }, 120000);

  // Brief pause to let output accumulate
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Read the terminal output
  const viewResult = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);

  return {
    status: 'success',
    output: viewResult.output ?? viewResult.content ?? '',
    ...viewResult,
  };
}

async function handleShellView(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = params.id as string;

  const result = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);

  return {
    status: 'success',
    output: result.output ?? result.content ?? '',
    ...result,
  };
}

async function handleShellWait(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = params.id as string;
  const seconds = (params.seconds as number) ?? 30;

  // Poll terminal view until output stabilizes or timeout
  const startTime = Date.now();
  const timeoutMs = seconds * 1000;
  let lastOutput = '';
  let stableCount = 0;

  while (Date.now() - startTime < timeoutMs) {
    const result = await getJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/view`);
    const currentOutput = (result.output ?? result.content ?? '') as string;

    if (currentOutput === lastOutput) {
      stableCount++;
      if (stableCount >= 3) {
        // Output has stabilized — process likely finished
        return { status: 'success', completed: true, output: currentOutput, ...result };
      }
    } else {
      stableCount = 0;
      lastOutput = currentOutput;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // Timeout — return what we have
  return {
    status: 'success',
    completed: false,
    output: lastOutput,
  };
}

async function handleShellWriteToProcess(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = params.id as string;
  const input = params.input as string;
  const pressEnter = params.press_enter as boolean;

  const result = await postJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/write`, {
    text: input,
    enter: pressEnter,
  });

  return { status: 'success', ...result };
}

async function handleShellKillProcess(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = params.id as string;

  const result = await postJson(`${baseUrl}/terminal/${encodeURIComponent(id)}/kill`, {});

  return { status: 'success', ...result };
}

// ── Code execution (via shell) ──────────────────────────────────────────────

async function handleCodeExecute(
  baseUrl: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const code = params.code as string;
  const language = (params.language as string) || 'python';

  // Execute code via a terminal session
  let command: string;
  if (language === 'python') {
    command = `python3 -c ${JSON.stringify(code)}`;
  } else if (language === 'javascript' || language === 'typescript') {
    command = `node -e ${JSON.stringify(code)}`;
  } else if (language === 'bash') {
    command = `bash -c ${JSON.stringify(code)}`;
  } else {
    return { status: 'error', error: `Unsupported language: ${language}` };
  }

  // Use a dedicated code execution terminal
  await postJson(`${baseUrl}/terminal/code_exec/write`, {
    text: command,
    enter: true,
  }, 120000);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const viewResult = await getJson(`${baseUrl}/terminal/code_exec/view`);

  return {
    status: 'success',
    output: viewResult.output ?? viewResult.content ?? '',
    ...viewResult,
  };
}

// ── Browser tools (via /browser/action) ─────────────────────────────────────

async function handleBrowser(
  baseUrl: string,
  toolName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Map tool name to browser action name
  const actionMap: Record<string, string> = {
    browser_view: 'browser_view',
    browser_navigate: 'browser_navigate',
    browser_restart: 'browser_restart',
    browser_click: 'browser_click',
    browser_input: 'browser_input',
    browser_move_mouse: 'browser_move_mouse',
    browser_press_key: 'browser_press_key',
    browser_select_option: 'browser_select_option',
    browser_scroll_up: 'browser_scroll_up',
    browser_scroll_down: 'browser_scroll_down',
    browser_console_exec: 'browser_console_exec',
    browser_console_view: 'browser_console_view',
    browser_screenshot: 'browser_screenshot',
  };

  const action = actionMap[toolName] || toolName;

  const result = await postJson(`${baseUrl}/browser/action`, {
    action,
    ...params,
  }, 45000);

  return { status: 'success', ...result };
}

// ── Deploy tools ────────────────────────────────────────────────────────────

async function handleDeployExposePort(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const port = params.port as number;
  const e2bId = ctx.e2bSandboxId;

  if (!e2bId) {
    return { status: 'error', error: 'No E2B sandbox ID available' };
  }

  const domain = process.env.SANDBOX_DOMAIN || 'e2b.dev';
  const publicUrl = `https://${port}-${e2bId}.${domain}`;

  return { status: 'success', url: publicUrl, port };
}

async function handleDeployApplyDeployment(
  baseUrl: string,
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const type = params.type as string;
  const localDir = params.local_dir as string;

  // Call the terminal server's deploy endpoint
  const result = await postJson(`${baseUrl}/deploy/zip-and-upload`, {
    type,
    local_dir: localDir,
    user_id: ctx.userId,
    session_id: ctx.sessionId,
  }, 120000);

  return { status: 'success', type, local_dir: localDir, ...result };
}

// ── Upload attachments ──────────────────────────────────────────────────────

export async function uploadAttachments(
  ctx: ToolContext,
  attachments: string[],
): Promise<Array<{ path: string; url: string }>> {
  if (!attachments || attachments.length === 0) return [];

  const baseUrl = ctx.terminalServerUrl;
  const uploaded: Array<{ path: string; url: string }> = [];

  for (const filePath of attachments) {
    try {
      if (baseUrl && baseUrl !== 'no-sandbox') {
        // Use terminal server's file upload endpoint
        const result = await postJson(`${baseUrl}/file/upload_to_s3`, {
          file_path: filePath,
          user_id: ctx.userId,
        });
        if (result.url) {
          uploaded.push({ path: filePath, url: result.url as string });
          continue;
        }
      }
      // Fallback to storage client
      const url = await ctx.storage.uploadFromSandbox(ctx.e2bSandboxId || ctx.sandboxId, filePath, ctx.userId);
      uploaded.push({ path: filePath, url });
    } catch (error) {
      console.error(`Failed to upload attachment ${filePath}:`, error);
    }
  }

  return uploaded;
}
