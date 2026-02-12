/**
 * Deployment tools
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from './types.js';
import { executeSandboxTool } from './executor/sandbox-executor.js';

export function createDeployExposePortTool(ctx: ToolContext) {
  return tool({
    description: `Expose a port from the sandbox to make a service publicly accessible.

Use this to:
- Preview a running web application
- Share a development server URL with the user
- Make an API endpoint accessible for testing

Returns a public URL that the user can visit.
The port must have an active service listening on it inside the sandbox.`,
    inputSchema: z.object({
      port: z.number().int().min(1).max(65535).describe('Port number to expose'),
      protocol: z
        .enum(['http', 'https'])
        .optional()
        .default('http')
        .describe('Protocol for the exposed service'),
    }),
    execute: async (params) => {
      return executeSandboxTool(ctx, 'deploy_expose_port', params);
    },
  });
}

export function createDeployApplyDeploymentTool(ctx: ToolContext) {
  return tool({
    description: `Deploy the current sandbox state as a persistent application.

Use this to:
- Deploy a web application for the user
- Create a persistent hosted version of the project
- Finalize and publish work

This creates a deployment from the current sandbox filesystem.
Always test the application first using deploy_expose_port before final deployment.`,
    inputSchema: z.object({
      name: z.string().describe('Deployment name (used in URL slug)'),
      port: z.number().int().min(1).max(65535).describe('Application port'),
      start_command: z.string().describe('Command to start the application'),
      build_command: z.string().optional().describe('Build command to run before deployment'),
      env: z.record(z.string(), z.string()).optional().describe('Environment variables'),
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
