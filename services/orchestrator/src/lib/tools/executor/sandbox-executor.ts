/**
 * Sandbox tool executor — routes tool calls to sandbox service via HTTP.
 *
 * Maps orchestrator tool names to sandbox service endpoints:
 *   - file_read       → GET  /sandboxes/:id/files?path=...
 *   - file_write      → POST /sandboxes/:id/files { path, content }
 *   - file_str_replace→ GET + replace + POST /sandboxes/:id/files
 *   - file_find_*     → POST /sandboxes/:id/shell (rg/fd commands)
 *   - shell_exec      → POST /sandboxes/:id/shell { command, timeout }
 *   - shell_view/wait → POST /sandboxes/:id/shell (ps/wait commands)
 *   - browser_*       → POST /sandboxes/:id/browser { action, params }
 *   - code_execute    → POST /sandboxes/:id/execute { code, language }
 *   - deploy_*        → POST /sandboxes/:id/shell (deploy commands)
 */

import type { ToolContext } from '../types.js';

const SANDBOX_SERVICE_URL = process.env.SANDBOX_SERVICE_URL || 'http://localhost:4012';

export async function executeSandboxTool(
  ctx: ToolContext,
  toolName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
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

    // Route to correct sandbox service endpoint based on tool type
    if (toolName === 'file_read') {
      result = await handleFileRead(ctx, params);
    } else if (toolName === 'file_write') {
      result = await handleFileWrite(ctx, params);
    } else if (toolName === 'file_str_replace') {
      result = await handleFileStrReplace(ctx, params);
    } else if (toolName === 'file_find_in_content') {
      result = await handleFileFindInContent(ctx, params);
    } else if (toolName === 'file_find_by_name') {
      result = await handleFileFindByName(ctx, params);
    } else if (toolName === 'shell_exec') {
      result = await handleShellExec(ctx, params);
    } else if (toolName === 'shell_view') {
      result = await handleShellView(ctx, params);
    } else if (toolName === 'shell_wait') {
      result = await handleShellWait(ctx, params);
    } else if (toolName === 'shell_write_to_process') {
      result = await handleShellWriteToProcess(ctx, params);
    } else if (toolName === 'shell_kill_process') {
      result = await handleShellKillProcess(ctx, params);
    } else if (toolName === 'code_execute') {
      result = await handleCodeExecute(ctx, params);
    } else if (toolName.startsWith('browser_')) {
      result = await handleBrowser(ctx, toolName, params);
    } else if (toolName === 'deploy_expose_port') {
      result = await handleDeployExposePort(ctx, params);
    } else if (toolName === 'deploy_apply_deployment') {
      result = await handleDeployApplyDeployment(ctx, params);
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

// ── Helper: POST to sandbox shell endpoint ──────────────────────────────────

async function shellExec(
  ctx: ToolContext,
  command: string,
  timeout = 60000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const response = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${ctx.sandboxId}/shell`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': ctx.userId },
      body: JSON.stringify({ command, timeout }),
      signal: AbortSignal.timeout(timeout + 10000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Sandbox shell error (${response.status}): ${text}`);
  }

  const data = (await response.json()) as { data?: { stdout?: string; stderr?: string; exitCode?: number } };
  return {
    stdout: data.data?.stdout || '',
    stderr: data.data?.stderr || '',
    exitCode: data.data?.exitCode ?? 1,
  };
}

// ── File tools ──────────────────────────────────────────────────────────────

async function handleFileRead(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const path = params.path as string;
  const offset = params.offset as number | undefined;
  const limit = params.limit as number | undefined;

  // Use shell to read with optional offset/limit (more flexible than E2B files.read)
  let command: string;
  if (offset !== undefined && limit !== undefined) {
    command = `sed -n '${offset + 1},${offset + limit}p' ${JSON.stringify(path)}`;
  } else if (offset !== undefined) {
    command = `tail -n +${offset + 1} ${JSON.stringify(path)}`;
  } else if (limit !== undefined) {
    command = `head -n ${limit} ${JSON.stringify(path)}`;
  } else {
    command = `cat ${JSON.stringify(path)}`;
  }

  const result = await shellExec(ctx, command, 15000);

  if (result.exitCode !== 0) {
    return { status: 'error', error: result.stderr || `Failed to read file: ${path}` };
  }

  return {
    status: 'success',
    content: result.stdout,
    path,
  };
}

async function handleFileWrite(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const path = params.path as string;
  const content = params.content as string;

  // Ensure parent directory exists
  const parentDir = path.substring(0, path.lastIndexOf('/'));
  if (parentDir) {
    await shellExec(ctx, `mkdir -p ${JSON.stringify(parentDir)}`, 10000);
  }

  // POST to sandbox files endpoint (matches sandbox service route)
  const response = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${ctx.sandboxId}/files`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': ctx.userId },
      body: JSON.stringify({ path, content }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    return { status: 'error', error: `Failed to write file (${response.status}): ${text}` };
  }

  return {
    status: 'success',
    path,
    bytesWritten: Buffer.byteLength(content, 'utf-8'),
  };
}

async function handleFileStrReplace(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const path = params.path as string;
  const oldString = params.old_string as string;
  const newString = params.new_string as string;

  // Read the file first
  const readResult = await shellExec(ctx, `cat ${JSON.stringify(path)}`, 15000);
  if (readResult.exitCode !== 0) {
    return { status: 'error', error: readResult.stderr || `Failed to read file: ${path}` };
  }

  const originalContent = readResult.stdout;

  // Check that old_string exists and is unique
  const occurrences = originalContent.split(oldString).length - 1;
  if (occurrences === 0) {
    return {
      status: 'error',
      error: `String not found in ${path}. The old_string must match exactly.`,
    };
  }
  if (occurrences > 1) {
    return {
      status: 'error',
      error: `Found ${occurrences} occurrences of old_string in ${path}. Include more surrounding context to make the match unique.`,
    };
  }

  // Apply replacement
  const newContent = originalContent.replace(oldString, newString);

  // Write back via sandbox files endpoint
  const response = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${ctx.sandboxId}/files`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': ctx.userId },
      body: JSON.stringify({ path, content: newContent }),
      signal: AbortSignal.timeout(30000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    return { status: 'error', error: `Failed to write replacement (${response.status}): ${text}` };
  }

  return {
    status: 'success',
    path,
    replacements: 1,
  };
}

async function handleFileFindInContent(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pattern = params.pattern as string;
  const searchPath = (params.path as string) || '/home/user';
  const include = params.include as string | undefined;

  // Use ripgrep (rg) which is installed in the sandbox template
  let command = `rg -n --no-heading --color=never`;
  if (include) {
    command += ` -g ${JSON.stringify(include)}`;
  }
  command += ` ${JSON.stringify(pattern)} ${JSON.stringify(searchPath)} 2>/dev/null | head -100`;

  const result = await shellExec(ctx, command, 30000);

  // rg returns exit code 1 when no matches (not an error)
  const matches = result.stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const colonIdx = line.indexOf(':');
      const secondColon = line.indexOf(':', colonIdx + 1);
      if (colonIdx > 0 && secondColon > colonIdx) {
        return {
          file: line.substring(0, colonIdx),
          line: parseInt(line.substring(colonIdx + 1, secondColon), 10),
          content: line.substring(secondColon + 1),
        };
      }
      return { file: '', line: 0, content: line };
    });

  return {
    status: 'success',
    matches,
    matchCount: matches.length,
  };
}

async function handleFileFindByName(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pattern = params.pattern as string;
  const searchPath = (params.path as string) || '/home/user';

  // Use fd (fd-find) which is installed in the sandbox template, fallback to find
  const command = `fd --no-ignore --type f ${JSON.stringify(pattern)} ${JSON.stringify(searchPath)} 2>/dev/null || find ${JSON.stringify(searchPath)} -name ${JSON.stringify(pattern)} -type f 2>/dev/null | head -200`;

  const result = await shellExec(ctx, command, 30000);

  const files = result.stdout.trim().split('\n').filter(Boolean);

  return {
    status: 'success',
    files,
    fileCount: files.length,
  };
}

// ── Shell tools ─────────────────────────────────────────────────────────────

async function handleShellExec(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const command = params.command as string;
  const timeout = (params.timeout as number) || 60000;

  const result = await shellExec(ctx, command, timeout);

  return {
    status: result.exitCode === 0 ? 'success' : 'error',
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

async function handleShellView(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pid = params.pid as number;

  // Check if process is running and get its recent output
  const result = await shellExec(
    ctx,
    `ps -p ${pid} -o pid,comm,state --no-headers 2>/dev/null && echo "---RUNNING---" || echo "---STOPPED---"`,
    10000,
  );

  const isRunning = result.stdout.includes('---RUNNING---');

  return {
    status: 'success',
    pid,
    running: isRunning,
    output: result.stdout.replace(/---(?:RUNNING|STOPPED)---/, '').trim(),
  };
}

async function handleShellWait(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pid = params.pid as number;
  const timeout = (params.timeout as number) || 30000;

  // Wait for process to finish
  const result = await shellExec(
    ctx,
    `timeout ${Math.ceil(timeout / 1000)} tail --pid=${pid} -f /dev/null 2>/dev/null; ps -p ${pid} -o pid --no-headers 2>/dev/null && echo "still_running" || echo "completed"`,
    timeout + 5000,
  );

  const completed = result.stdout.includes('completed');

  return {
    status: 'success',
    pid,
    completed,
    output: result.stdout,
  };
}

async function handleShellWriteToProcess(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pid = params.pid as number;
  const input = params.input as string;

  // Write to process stdin via /proc filesystem
  const escapedInput = input.replace(/'/g, "'\\''");
  const result = await shellExec(
    ctx,
    `echo '${escapedInput}' > /proc/${pid}/fd/0 2>/dev/null`,
    10000,
  );

  return {
    status: result.exitCode === 0 ? 'success' : 'error',
    pid,
    error: result.exitCode !== 0 ? (result.stderr || 'Failed to write to process') : undefined,
  };
}

async function handleShellKillProcess(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const pid = params.pid as number;
  const signal = (params.signal as number) || 15;

  const result = await shellExec(ctx, `kill -${signal} ${pid} 2>/dev/null`, 10000);

  return {
    status: result.exitCode === 0 ? 'success' : 'error',
    pid,
    signal,
    error: result.exitCode !== 0 ? (result.stderr || `Failed to kill process ${pid}`) : undefined,
  };
}

// ── Code execution ──────────────────────────────────────────────────────────

async function handleCodeExecute(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const code = params.code as string;
  const language = (params.language as string) || 'python';

  const response = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${ctx.sandboxId}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': ctx.userId },
      body: JSON.stringify({ code, language, timeout: 60000 }),
      signal: AbortSignal.timeout(70000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    return { status: 'error', error: `Code execution failed (${response.status}): ${text}` };
  }

  const data = (await response.json()) as {
    data?: { stdout?: string; stderr?: string; exitCode?: number; error?: unknown };
  };

  return {
    status: data.data?.exitCode === 0 ? 'success' : 'error',
    stdout: data.data?.stdout || '',
    stderr: data.data?.stderr || '',
    exitCode: data.data?.exitCode ?? 1,
    error: data.data?.error || undefined,
  };
}

// ── Browser tools ───────────────────────────────────────────────────────────

async function handleBrowser(
  ctx: ToolContext,
  toolName: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Use the action from params (set by browser-tools.ts) which matches
  // the Playwright controller routes. Fallback to deriving from tool name.
  const action = (params.action as string) || toolName.replace('browser_', '');

  // Strip 'action' from params before sending — sandbox service
  // destructures { action, params } separately from request body
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { action: _action, ...cleanParams } = params;

  const response = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${ctx.sandboxId}/browser`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-user-id': ctx.userId },
      body: JSON.stringify({ action, params: cleanParams }),
      signal: AbortSignal.timeout(45000),
    },
  );

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    return { status: 'error', error: `Browser action failed (${response.status}): ${text}` };
  }

  const data = (await response.json()) as { data?: Record<string, unknown> };

  return {
    status: 'success',
    ...(data.data || {}),
  };
}

// ── Deploy tools ────────────────────────────────────────────────────────────

async function handleDeployExposePort(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const port = params.port as number;

  // Get E2B sandbox ID from the sandbox service
  const response = await fetch(
    `${SANDBOX_SERVICE_URL}/sandboxes/${ctx.sandboxId}`,
    {
      headers: { 'x-user-id': ctx.userId },
      signal: AbortSignal.timeout(5000),
    },
  );

  if (!response.ok) {
    return { status: 'error', error: 'Could not look up sandbox for port exposure' };
  }

  const data = (await response.json()) as { data?: { e2bSandboxId?: string } };
  const e2bId = data.data?.e2bSandboxId;

  if (!e2bId) {
    return { status: 'error', error: 'No E2B sandbox ID available' };
  }

  const domain = process.env.SANDBOX_DOMAIN || 'e2b.dev';
  const publicUrl = `https://${port}-${e2bId}.${domain}`;

  return {
    status: 'success',
    url: publicUrl,
    port,
  };
}

async function handleDeployApplyDeployment(
  ctx: ToolContext,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const name = params.name as string;
  const port = params.port as number;
  const startCommand = params.start_command as string;
  const buildCommand = params.build_command as string | undefined;
  const env = params.env as Record<string, string> | undefined;

  const projectPath = '/home/user/my-app';

  // Build step (optional)
  if (buildCommand) {
    const buildResult = await shellExec(ctx, `cd ${projectPath} && ${buildCommand}`, 120000);
    if (buildResult.exitCode !== 0) {
      return {
        status: 'error',
        error: `Build failed: ${buildResult.stderr.slice(-500)}`,
      };
    }
  }

  // Write env if provided
  if (env && Object.keys(env).length > 0) {
    const envLines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');
    await shellExec(ctx, `printf '%s\\n' ${JSON.stringify(envLines)} >> ${projectPath}/.env`, 5000);
  }

  // Start the application in background
  const startResult = await shellExec(
    ctx,
    `cd ${projectPath} && nohup ${startCommand} > /tmp/${name}.log 2>&1 & echo $!`,
    15000,
  );

  const pid = parseInt(startResult.stdout.trim(), 10);

  // Wait briefly for the server to start
  await shellExec(ctx, `sleep 2`, 5000);

  // Expose the port
  const exposeResult = await handleDeployExposePort(ctx, { port });

  return {
    status: 'success',
    name,
    pid: isNaN(pid) ? undefined : pid,
    port,
    url: (exposeResult as Record<string, unknown>).url,
  };
}

// ── Upload attachments ──────────────────────────────────────────────────────

export async function uploadAttachments(
  ctx: ToolContext,
  attachments: string[],
): Promise<Array<{ path: string; url: string }>> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  const uploaded: Array<{ path: string; url: string }> = [];

  for (const path of attachments) {
    try {
      const url = await ctx.storage.uploadFromSandbox(ctx.sandboxId, path, ctx.userId);
      uploaded.push({ path, url });
    } catch (error) {
      console.error(`Failed to upload attachment ${path}:`, error);
    }
  }

  return uploaded;
}
