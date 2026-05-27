/**
 * Code execution tool schema kept for sandbox runtime handoff.
 */
import { z } from "zod";

export const codeTools = {
  code_execute: {
    description:
      "Execute code in a sandboxed environment. Use for running scripts, data analysis, or testing code snippets.",
    inputSchema: z.object({
      language: z
        .enum(["python", "javascript", "typescript", "bash"])
        .describe("Programming language to execute"),
      code: z.string().describe("Code to execute"),
    }),
  },
} as const;
