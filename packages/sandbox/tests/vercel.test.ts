import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createVercelSandboxAdapter } from "../src/vercel.js";

const mocks = vi.hoisted(() => {
  class MockCommandResult {
    exitCode = 0;

    async stdout() {
      return "stdout";
    }

    async stderr() {
      return "stderr";
    }
  }

  class MockSandbox {
    runtime: string;
    createdAt = new Date("2026-05-26T00:00:00.000Z");
    tags?: Record<string, string>;
    stopped = false;
    writtenFiles: { path: string; content: string | Uint8Array }[] = [];

    constructor(
      readonly name: string,
      params: {
        runtime?: string;
        tags?: Record<string, string>;
      } = {}
    ) {
      this.runtime = params.runtime ?? "node24";
      this.tags = params.tags;
    }

    async runCommand() {
      return new MockCommandResult();
    }

    async writeFiles(files: { path: string; content: string | Uint8Array }[]) {
      this.writtenFiles.push(...files);
    }

    async readFileToBuffer({ path }: { path: string }) {
      const file = this.writtenFiles.find((candidate) => candidate.path === path);

      if (!file) {
        return null;
      }

      return Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
    }

    domain(port: number) {
      return `https://${port}-${this.name}.vercel.run`;
    }

    async stop() {
      this.stopped = true;
    }
  }

  const instances = new Map<string, MockSandbox>();
  const create = vi.fn(
    async (params: { name?: string; runtime?: string; tags?: Record<string, string> } = {}) => {
      const sandbox = new MockSandbox(params.name ?? "generated", params);
      instances.set(sandbox.name, sandbox);
      return sandbox;
    }
  );
  const get = vi.fn(async ({ name }: { name: string }) => {
    const sandbox = instances.get(name);

    if (!sandbox) {
      throw new Error(`Missing sandbox ${name}`);
    }

    return sandbox;
  });

  return { create, get, instances };
});

vi.mock("@vercel/sandbox", () => ({
  Sandbox: {
    create: mocks.create,
    get: mocks.get,
  },
}));

describe("VercelSandboxAdapter", () => {
  const env = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.instances.clear();
    process.env = {
      ...env,
      VERCEL_TOKEN: "token",
      VERCEL_TEAM_ID: "team",
      VERCEL_PROJECT_ID: "project",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it("creates Vercel sandboxes with package-owned credentials and options", async () => {
    const adapter = createVercelSandboxAdapter();

    const session = await adapter.create({
      name: "run-123",
      runtime: "node24",
      ports: [3000],
      env: { NODE_ENV: "test" },
      networkPolicy: "deny-all",
      vcpus: 2,
      timeoutMs: 60_000,
      metadata: { run: "123" },
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token",
        teamId: "team",
        projectId: "project",
        name: "run-123",
        runtime: "node24",
        ports: [3000],
        env: { NODE_ENV: "test" },
        networkPolicy: "deny-all",
        timeout: 60_000,
        resources: { vcpus: 2 },
        tags: { run: "123" },
      })
    );
    expect(session).toMatchObject({
      id: "run-123",
      provider: "vercel",
      runtime: "node24",
      metadata: { run: "123" },
    });
  });

  it("runs commands and maps command output", async () => {
    const adapter = createVercelSandboxAdapter();
    const session = await adapter.create({ name: "command-session" });

    await expect(
      adapter.runCommand(session, {
        command: "node",
        args: ["--version"],
      })
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: "stdout",
      stderr: "stderr",
    });
  });

  it("writes files, reads files, exposes ports, and stops sessions", async () => {
    const adapter = createVercelSandboxAdapter();
    const session = await adapter.create({ name: "file-session", ports: [3000] });

    await adapter.writeFile(session, {
      path: "hello.txt",
      content: "hello",
    });

    await expect(adapter.readFile(session, "hello.txt")).resolves.toEqual({
      path: "hello.txt",
      content: "hello",
      encoding: "utf8",
    });
    await expect(adapter.getPortUrl(session, 3000)).resolves.toBe(
      "https://3000-file-session.vercel.run"
    );

    await adapter.stop(session);
    expect(mocks.instances.get("file-session")?.stopped).toBe(true);
  });
});
