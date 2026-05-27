import { Sandbox, type NetworkPolicy } from "@vercel/sandbox";

import {
  type SandboxAdapter,
  type SandboxCommand,
  type SandboxCommandResult,
  type SandboxCreateOptions,
  type SandboxFile,
  type SandboxNetworkPolicy,
  type SandboxRuntime,
  type SandboxSession,
  sandboxCommandSchema,
  sandboxCreateOptionsSchema,
  sandboxFileSchema,
  sandboxRuntimeSchema,
} from "./contracts.js";
import { keys } from "./keys.js";

type VercelCredentials = {
  token: string;
  teamId: string;
  projectId: string;
};

export type VercelSandboxAdapterOptions = {
  defaultRuntime?: SandboxRuntime;
  defaultTimeoutMs?: number;
  defaultPorts?: number[];
  defaultEnv?: Record<string, string>;
  defaultNetworkPolicy?: SandboxNetworkPolicy;
  defaultVcpus?: 1 | 2 | 4 | 8;
  defaultMetadata?: Record<string, string>;
};

export class VercelSandboxAdapter implements SandboxAdapter {
  private readonly sandboxes = new Map<string, Sandbox>();

  constructor(private readonly options: VercelSandboxAdapterOptions = {}) {}

  async create(input?: SandboxCreateOptions): Promise<SandboxSession> {
    const parsed = sandboxCreateOptionsSchema.parse({
      runtime: this.options.defaultRuntime,
      ports: this.options.defaultPorts,
      env: this.options.defaultEnv,
      networkPolicy: this.options.defaultNetworkPolicy,
      vcpus: this.options.defaultVcpus,
      timeoutMs: this.options.defaultTimeoutMs,
      metadata: this.options.defaultMetadata,
      ...input,
      provider: "vercel",
    });
    const sandbox = await Sandbox.create({
      ...getVercelCredentials(),
      name: parsed.name,
      runtime: parsed.runtime,
      ports: parsed.ports,
      env: parsed.env,
      timeout: parsed.timeoutMs,
      networkPolicy: toVercelNetworkPolicy(parsed.networkPolicy),
      resources: parsed.vcpus ? { vcpus: parsed.vcpus } : undefined,
      tags: parsed.metadata,
    });

    this.sandboxes.set(sandbox.name, sandbox);

    return toSession(sandbox, parsed.runtime, parsed.metadata);
  }

  async get(id: string): Promise<SandboxSession> {
    const sandbox = await this.getSandbox(id);
    const runtime = readRuntime(sandbox.runtime, this.options.defaultRuntime);

    return toSession(sandbox, runtime, sandbox.tags);
  }

  async runCommand(session: SandboxSession, input: SandboxCommand): Promise<SandboxCommandResult> {
    const command = sandboxCommandSchema.parse(input);
    const sandbox = await this.getSandbox(session.id);
    const startedAt = Date.now();
    const result = await runWithTimeout(command.timeoutMs, (signal) =>
      sandbox.runCommand({
        cmd: command.command,
        args: command.args,
        cwd: command.cwd,
        env: command.env,
        signal,
      })
    );
    const [stdout, stderr] = await Promise.all([result.stdout(), result.stderr()]);

    return {
      exitCode: result.exitCode,
      stdout,
      stderr,
      durationMs: Date.now() - startedAt,
    };
  }

  async writeFile(session: SandboxSession, input: SandboxFile) {
    const file = sandboxFileSchema.parse(input);
    const sandbox = await this.getSandbox(session.id);
    const content = file.encoding === "base64" ? Buffer.from(file.content, "base64") : file.content;

    await sandbox.writeFiles([{ path: file.path, content }]);
  }

  async readFile(
    session: SandboxSession,
    path: string,
    options?: { encoding?: "utf8" | "base64" }
  ) {
    const encoding = options?.encoding ?? "utf8";
    const sandbox = await this.getSandbox(session.id);
    const buffer = await sandbox.readFileToBuffer({ path });

    if (!buffer) {
      throw new Error(`Sandbox file not found: ${path}`);
    }

    return {
      path,
      content: buffer.toString(encoding),
      encoding,
    };
  }

  async getPortUrl(session: SandboxSession, port: number): Promise<string> {
    const sandbox = await this.getSandbox(session.id);
    return sandbox.domain(port);
  }

  async stop(session: SandboxSession): Promise<void> {
    const sandbox = await this.getSandbox(session.id);
    await sandbox.stop();
    this.sandboxes.delete(session.id);
  }

  private async getSandbox(id: string) {
    const cached = this.sandboxes.get(id);

    if (cached) {
      return cached;
    }

    const sandbox = await Sandbox.get({
      ...getVercelCredentials(),
      name: id,
    });

    this.sandboxes.set(id, sandbox);

    return sandbox;
  }
}

export function createVercelSandboxAdapter(options?: VercelSandboxAdapterOptions): SandboxAdapter {
  return new VercelSandboxAdapter(options);
}

function getVercelCredentials(): VercelCredentials | Record<string, never> {
  const env = keys();
  const token = env.VERCEL_OIDC_TOKEN ?? env.VERCEL_TOKEN;

  if (token && env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID) {
    return {
      token,
      teamId: env.VERCEL_TEAM_ID,
      projectId: env.VERCEL_PROJECT_ID,
    };
  }

  return {};
}

function toSession(
  sandbox: Sandbox,
  fallbackRuntime: SandboxRuntime,
  metadata?: Record<string, string>
): SandboxSession {
  return {
    id: sandbox.name,
    provider: "vercel",
    runtime: readRuntime(sandbox.runtime, fallbackRuntime),
    createdAt: sandbox.createdAt,
    metadata,
  };
}

function readRuntime(
  runtime: string | undefined,
  fallback: SandboxRuntime = "node24"
): SandboxRuntime {
  const parsed = sandboxRuntimeSchema.safeParse(runtime);
  return parsed.success ? parsed.data : fallback;
}

function toVercelNetworkPolicy(
  policy: SandboxNetworkPolicy | undefined
): NetworkPolicy | undefined {
  if (!policy || typeof policy === "string") {
    return policy;
  }

  return {
    allow: policy.allow,
    subnets: policy.subnets,
  };
}

async function runWithTimeout<T>(
  timeoutMs: number | undefined,
  run: (signal?: AbortSignal) => Promise<T>
): Promise<T> {
  if (!timeoutMs) {
    return run();
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}
