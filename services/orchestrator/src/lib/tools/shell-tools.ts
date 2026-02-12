/**
 * Shell tools - Execute commands and manage processes in the sandbox environment
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createShellExecTool(ctx: ToolContext) {
  return tool({
    description: `Execute a shell command in the sandbox environment. Returns stdout, stderr, and the exit code.

Use this to:
- Run build commands (npm install, npm run build, cargo build)
- Execute scripts (python script.py, node index.js, bash setup.sh)
- Inspect system state (ls, cat, which, env, ps)
- Install dependencies (apt-get install, pip install, npm install)
- Run tests (pytest, jest, go test)

The command runs in a bash shell with the sandbox user's environment. Commands that produce continuous output (servers, watchers) will be killed after the timeout. For long-running processes, consider using a shorter initial command or adjusting the timeout.

IMPORTANT:
- Commands are non-interactive. Do not use commands that require TTY input (e.g., vim, less, sudo with password prompt).
- For long-running background processes, append & to the command and use shell_view/shell_wait to monitor.
- Combine related commands with && to reduce round trips.
`,
    inputSchema: z.object({
      command: z.string().describe('The shell command to execute (e.g., "npm install && npm run build", "python3 main.py")'),
      timeout: z
        .number()
        .int()
        .min(1000)
        .max(300000)
        .optional()
        .describe('Maximum execution time in milliseconds. Defaults to 60000 (60 seconds). Max 300000 (5 minutes).'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_exec', {
        command: params.command,
        timeout: params.timeout ?? 60000,
      });
    },
  });
}

export function createShellViewTool(ctx: ToolContext) {
  return tool({
    description: `View the latest output of a running or recently completed process.

Use this to:
- Check the output of a background process started with shell_exec
- Monitor a running development server or build process
- Read stdout/stderr of a process that is still running

The pid must be from a process started in the current sandbox session.
`,
    inputSchema: z.object({
      pid: z.number().int().describe('Process ID of the running process to view output from'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_view', params);
    },
  });
}

export function createShellWaitTool(ctx: ToolContext) {
  return tool({
    description: `Wait for a running process to complete and return its final output.

Use this to:
- Wait for a background build or test run to finish
- Collect the final exit code and output of a long-running command
- Block until a process completes before proceeding with dependent tasks

If the process does not complete within the timeout, the call returns with whatever output is available so far. The process itself continues running.
`,
    inputSchema: z.object({
      pid: z.number().int().describe('Process ID of the process to wait for'),
      timeout: z
        .number()
        .int()
        .min(1000)
        .max(300000)
        .optional()
        .describe('Maximum time to wait in milliseconds. Defaults to 30000 (30 seconds). Max 300000 (5 minutes).'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_wait', {
        pid: params.pid,
        timeout: params.timeout ?? 30000,
      });
    },
  });
}

export function createShellWriteToProcessTool(ctx: ToolContext) {
  return tool({
    description: `Write input to a running process's stdin. Use this to interact with processes that read from standard input.

Use this to:
- Provide input to an interactive CLI program
- Send data to a process reading from stdin (e.g., a REPL)
- Answer prompts from scripts or installers
- Pipe data into a running process

The input is sent as-is. Include a newline character (\\n) at the end if the process expects line-terminated input.
`,
    inputSchema: z.object({
      pid: z.number().int().describe('Process ID of the running process to write to'),
      input: z.string().describe('Text to write to the process stdin. Include \\n for newline-terminated input.'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_write_to_process', params);
    },
  });
}

export function createShellKillProcessTool(ctx: ToolContext) {
  return tool({
    description: `Kill a running process in the sandbox. Sends a signal to terminate the process.

Use this to:
- Stop a running development server
- Kill a hung or runaway process
- Clean up background processes before starting new ones
- Force-terminate a process that did not respond to SIGTERM

Default signal is 15 (SIGTERM) for graceful shutdown. Use signal 9 (SIGKILL) to force-kill a process that does not respond to SIGTERM.
`,
    inputSchema: z.object({
      pid: z.number().int().describe('Process ID of the process to kill'),
      signal: z
        .number()
        .int()
        .min(1)
        .max(31)
        .optional()
        .describe('Signal number to send. Defaults to 15 (SIGTERM). Use 9 (SIGKILL) for force kill.'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'shell_kill_process', {
        pid: params.pid,
        signal: params.signal ?? 15,
      });
    },
  });
}

/**
 * Create all shell tools keyed by their tool name
 */
export function createShellTools(ctx: ToolContext) {
  return {
    shell_exec: createShellExecTool(ctx),
    shell_view: createShellViewTool(ctx),
    shell_wait: createShellWaitTool(ctx),
    shell_write_to_process: createShellWriteToProcessTool(ctx),
    shell_kill_process: createShellKillProcessTool(ctx),
  };
}
