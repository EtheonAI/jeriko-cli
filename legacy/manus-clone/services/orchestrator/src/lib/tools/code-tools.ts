/**
 * Code execution tool
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createCodeExecuteTool(ctx: ToolContext) {
  return tool({
    description: `Execute code in the sandbox environment. Supports Python and JavaScript/Node.js.

Use this for:
- Running scripts or code snippets
- Testing code before delivering to user
- Data processing and computation
- Installing packages (pip install, npm install)

The sandbox has Python 3.12, Node.js 22, and common packages pre-installed.
Output includes stdout, stderr, and exit code.`,
    inputSchema: z.object({
      language: z
        .enum(['python', 'javascript', 'typescript', 'bash'])
        .describe('Programming language to execute'),
      code: z.string().describe('Code to execute'),
      timeout: z
        .number()
        .optional()
        .default(60000)
        .describe('Execution timeout in milliseconds'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'code_execute', params);
    },
  });
}

export function createCodeTools(ctx: ToolContext) {
  return {
    code_execute: createCodeExecuteTool(ctx),
  } as const;
}
