/**
 * Deployment tools — deploy_expose_port, deploy_apply_deployment
 */
import { z } from "zod";

export const deploymentTools = {
  deploy_expose_port: {
    description:
      "Expose specified local port for temporary public access. Use when providing temporary public access for services.",
    parameters: z.object({
      port: z.number().int().describe("Local port number to expose"),
    }),
  },
  deploy_apply_deployment: {
    description:
      "Deploy website or application to public production environment. Use when deploying or updating static websites or applications.",
    parameters: z.object({
      type: z.enum(["static", "nextjs"]).describe("Type of website or application to deploy"),
      local_dir: z.string().describe("Absolute path of local directory to deploy"),
    }),
  },
} as const;
