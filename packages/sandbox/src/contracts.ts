import { z } from "zod";

export const sandboxProviderSchema = z.enum(["vercel", "local", "mock"]);

export const sandboxRuntimeSchema = z.enum(["node24", "node22", "python3.13"]);

export const sandboxNetworkPolicySchema = z.union([
  z.literal("allow-all"),
  z.literal("deny-all"),
  z.object({
    allow: z.array(z.string().min(1)).default([]),
    subnets: z
      .object({
        allow: z.array(z.string().min(1)).optional(),
        deny: z.array(z.string().min(1)).optional(),
      })
      .optional(),
  }),
]);

export const sandboxCommandSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export const sandboxCommandResultSchema = z.object({
  exitCode: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  durationMs: z.number().int().nonnegative(),
});

export const sandboxFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  encoding: z.enum(["utf8", "base64"]).default("utf8"),
});

export const sandboxCreateOptionsSchema = z.object({
  provider: sandboxProviderSchema.default("vercel"),
  name: z.string().min(1).optional(),
  runtime: sandboxRuntimeSchema.default("node24"),
  ports: z.array(z.number().int().positive()).max(4).default([]),
  env: z.record(z.string(), z.string()).optional(),
  networkPolicy: sandboxNetworkPolicySchema.optional(),
  vcpus: z.union([z.literal(1), z.literal(2), z.literal(4), z.literal(8)]).optional(),
  timeoutMs: z.number().int().positive().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export type SandboxProvider = z.infer<typeof sandboxProviderSchema>;
export type SandboxRuntime = z.infer<typeof sandboxRuntimeSchema>;
export type SandboxNetworkPolicy = z.infer<typeof sandboxNetworkPolicySchema>;
export type SandboxCommand = z.input<typeof sandboxCommandSchema>;
export type ParsedSandboxCommand = z.infer<typeof sandboxCommandSchema>;
export type SandboxCommandResult = z.infer<typeof sandboxCommandResultSchema>;
export type SandboxFile = z.input<typeof sandboxFileSchema>;
export type ParsedSandboxFile = z.infer<typeof sandboxFileSchema>;
export type SandboxCreateOptions = z.input<typeof sandboxCreateOptionsSchema>;
export type ParsedSandboxCreateOptions = z.infer<typeof sandboxCreateOptionsSchema>;

export type SandboxSession = {
  id: string;
  provider: SandboxProvider;
  runtime: SandboxRuntime;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, string>;
};

export type SandboxAdapter = {
  create(options?: SandboxCreateOptions): Promise<SandboxSession>;
  get(id: string): Promise<SandboxSession>;
  runCommand(session: SandboxSession, command: SandboxCommand): Promise<SandboxCommandResult>;
  writeFile(session: SandboxSession, file: SandboxFile): Promise<void>;
  readFile(
    session: SandboxSession,
    path: string,
    options?: { encoding?: ParsedSandboxFile["encoding"] }
  ): Promise<ParsedSandboxFile>;
  getPortUrl(session: SandboxSession, port: number): Promise<string>;
  stop(session: SandboxSession): Promise<void>;
};
