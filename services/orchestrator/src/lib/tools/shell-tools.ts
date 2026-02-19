/**
 * Shell tools — Execute commands and manage processes in persistent terminal sessions.
 *
 * Terminal sessions are PTY-based (not one-shot) and persist across tool calls.
 * Each session is identified by a string ID (e.g. "default", "terminal_1").
 * The terminal server runs inside the E2B sandbox on port 8330.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createShellExecTool(ctx: ToolContext) {
  return tool({
    description: `Execute commands in a specified shell session. Use for running code, installing packages, or managing files.

The command runs in a persistent PTY session identified by the 'id' parameter. Sessions persist across calls — environment variables, working directory, and shell state are maintained.

Use this to:
- Run build commands (npm install, npm run build, cargo build)
- Execute scripts (python script.py, node index.js, bash setup.sh)
- Install dependencies (apt-get install, pip install, npm install)
- Run tests (pytest, jest, go test)

IMPORTANT:
- Use exec_dir to set the working directory (must be absolute path).
- For long-running processes (servers, watchers), the command will run in background.
- Use shell_view to check output, shell_wait to wait for completion.
- Combine related commands with && to reduce round trips.
`,
    inputSchema: z.object({
      session: z.string().describe('Unique identifier of the target shell session (e.g. "default", "terminal_1")'),
      exec_dir: z.string().describe('Working directory for command execution (must use absolute path)'),
      command: z.string().describe('Shell command to execute'),
      timeout: z.number().int().optional().describe('Timeout in seconds for command execution (default: 30)'),
    }),
    execute: async (params) => {
      // Map session→id for sandbox executor compatibility
      return executeSandboxTool(ctx, 'shell_exec', { ...params, id: params.session });
    },
  });
}

export function createShellViewTool(ctx: ToolContext) {
  return tool({
    description: `View the content of a specified shell session. Use for checking command execution results or monitoring output.

Returns the current terminal buffer content including recent command output.
`,
    inputSchema: z.object({
      session: z.string().describe('Unique identifier of the target shell session'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_view', { ...params, id: params.session });
    },
  });
}

export function createShellWaitTool(ctx: ToolContext) {
  return tool({
    description: `Wait for the running process in a specified shell session to return. Use after running commands that require longer runtime.

If the process does not complete within the wait duration, the call returns with whatever output is available so far.
`,
    inputSchema: z.object({
      session: z.string().describe('Unique identifier of the target shell session'),
      timeout: z
        .number()
        .int()
        .optional()
        .describe('Wait timeout in seconds'),
    }),
    execute: async (params) => {
      // Map session→id, timeout→seconds for sandbox executor compatibility
      return executeSandboxTool(ctx, 'shell_wait', { ...params, id: params.session, seconds: params.timeout });
    },
  });
}

export function createShellWriteToProcessTool(ctx: ToolContext) {
  return tool({
    description: `Write input to a running process in a specified shell session. Use for responding to interactive command prompts.
`,
    inputSchema: z.object({
      session: z.string().describe('Unique identifier of the target shell session'),
      input: z.string().describe('Input content to write to the process'),
      press_enter: z.boolean().describe('Whether to press Enter key after input'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_write_to_process', { ...params, id: params.session });
    },
  });
}

export function createShellKillProcessTool(ctx: ToolContext) {
  return tool({
    description: `Terminate a running process in a specified shell session. Use for stopping long-running processes or handling frozen commands.
`,
    inputSchema: z.object({
      session: z.string().describe('Unique identifier of the target shell session'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_kill_process', { ...params, id: params.session });
    },
  });
}

export function createShellTools(ctx: ToolContext) {
  return {
    shell_exec: createShellExecTool(ctx),
    shell_view: createShellViewTool(ctx),
    shell_wait: createShellWaitTool(ctx),
    shell_write_to_process: createShellWriteToProcessTool(ctx),
    shell_kill_process: createShellKillProcessTool(ctx),
  };
}
