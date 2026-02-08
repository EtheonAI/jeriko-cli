/**
 * Code execution tools — code_execute (E2B code interpreter)
 */
import { z } from "zod";

export const codeTools = {
  code_execute: {
    description:
      "Execute code in a sandboxed environment. Use for running scripts, data analysis, or testing code snippets.",
    parameters: z.object({
      language: z
        .enum(["python", "javascript", "typescript", "bash"])
        .describe("Programming language to execute"),
      code: z.string().describe("Code to execute"),
    }),
  },
} as const;
