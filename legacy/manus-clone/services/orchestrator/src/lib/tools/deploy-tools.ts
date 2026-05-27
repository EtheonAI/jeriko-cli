/**
 * Deployment tools
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createDeployExposePortTool(ctx: ToolContext) {
  return tool({
    description: `Expose specified local port for temporary public access. Use when providing temporary public access for services.`,
    inputSchema: z.object({
      port: z.number().int().describe('Local port number to expose'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'deploy_expose_port', params);
    },
  });
}

export function createDeployApplyDeploymentTool(ctx: ToolContext) {
  return tool({
    description: `Deploy website or application to public production environment. Use when deploying or updating static websites or applications.`,
    inputSchema: z.object({
      type: z.enum(['static', 'nextjs']).describe('Type of website or application to deploy.'),
      local_dir: z.string().describe('Absolute path of local directory to deploy.'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'deploy_apply_deployment', params);
    },
  });
}

export function createDeployTools(ctx: ToolContext) {
  return {
    deploy_expose_port: createDeployExposePortTool(ctx),
    deploy_apply_deployment: createDeployApplyDeploymentTool(ctx),
  } as const;
}
