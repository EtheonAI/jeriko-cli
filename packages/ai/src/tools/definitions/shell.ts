/**
 * Shell tools — shell_exec, shell_view, shell_wait, shell_write_to_process, shell_kill_process
 */
import { z } from "zod";
import { shellIdSchema } from "./schemas.js";

export const shellTools = {
  shell_exec: {
    description:
      "Execute commands in a specified shell session. Use for running code, installing packages, or managing files.",
    inputSchema: z.object({
      id: shellIdSchema,
      exec_dir: z
        .string()
        .describe("Working directory for command execution (must use absolute path)"),
      command: z.string().describe("Shell command to execute"),
    }),
  },
  shell_view: {
    description:
      "View the content of a specified shell session. Use for checking command execution results or monitoring output.",
    inputSchema: z.object({
      id: shellIdSchema,
    }),
  },
  shell_wait: {
    description:
      "Wait for the running process in a specified shell session to return. Use after running commands that require longer runtime.",
    inputSchema: z.object({
      id: shellIdSchema,
      seconds: z.number().int().optional().describe("Wait duration in seconds"),
    }),
  },
  shell_write_to_process: {
    description:
      "Write input to a running process in a specified shell session. Use for responding to interactive command prompts.",
    inputSchema: z.object({
      id: shellIdSchema,
      input: z.string().describe("Input content to write to the process"),
      press_enter: z.boolean().describe("Whether to press Enter key after input"),
    }),
  },
  shell_kill_process: {
    description:
      "Terminate a running process in a specified shell session. Use for stopping long-running processes or handling frozen commands.",
    inputSchema: z.object({
      id: shellIdSchema,
    }),
  },
} as const;
