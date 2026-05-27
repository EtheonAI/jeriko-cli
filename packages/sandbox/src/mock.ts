import {
  type ParsedSandboxCommand,
  type ParsedSandboxFile,
  type SandboxAdapter,
  type SandboxCommandResult,
  type SandboxCreateOptions,
  type SandboxSession,
  sandboxCommandResultSchema,
  sandboxCommandSchema,
  sandboxCreateOptionsSchema,
  sandboxFileSchema,
} from "./contracts.js";

export type MockSandboxCommandHandler = (input: {
  session: SandboxSession;
  command: ParsedSandboxCommand;
  files: Map<string, ParsedSandboxFile>;
}) => Promise<Partial<SandboxCommandResult> | string | undefined>;

export type MockSandboxAdapterOptions = {
  commandHandler?: MockSandboxCommandHandler;
  idFactory?: () => string;
  now?: () => Date;
};

export function createMockSandboxAdapter(options: MockSandboxAdapterOptions = {}): SandboxAdapter {
  const now = options.now ?? (() => new Date());
  const idFactory = options.idFactory ?? (() => `mock-${Math.random().toString(36).slice(2, 10)}`);
  const sessions = new Map<string, SandboxSession>();
  const filesBySession = new Map<string, Map<string, ParsedSandboxFile>>();

  const getFiles = (session: SandboxSession) => {
    const files = filesBySession.get(session.id);

    if (!files) {
      throw new Error(`Unknown sandbox session: ${session.id}`);
    }

    return files;
  };

  return {
    async create(input?: SandboxCreateOptions) {
      const parsed = sandboxCreateOptionsSchema.parse({
        provider: "mock",
        ...input,
      });
      const session: SandboxSession = {
        id: parsed.name ?? idFactory(),
        provider: "mock",
        runtime: parsed.runtime,
        createdAt: now(),
        metadata: parsed.metadata,
      };

      sessions.set(session.id, session);
      filesBySession.set(session.id, new Map());

      return session;
    },

    async get(id: string) {
      const session = sessions.get(id);

      if (!session) {
        throw new Error(`Unknown sandbox session: ${id}`);
      }

      return session;
    },

    async runCommand(session, input) {
      const command = sandboxCommandSchema.parse(input);
      const startedAt = Date.now();
      const files = getFiles(session);
      const handled = await options.commandHandler?.({
        session,
        command,
        files,
      });

      if (typeof handled === "string") {
        return sandboxCommandResultSchema.parse({
          exitCode: 0,
          stdout: handled,
          stderr: "",
          durationMs: Date.now() - startedAt,
        });
      }

      return sandboxCommandResultSchema.parse({
        exitCode: handled?.exitCode ?? 0,
        stdout: handled?.stdout ?? "",
        stderr: handled?.stderr ?? "",
        durationMs: handled?.durationMs ?? Date.now() - startedAt,
      });
    },

    async writeFile(session, input) {
      const file = sandboxFileSchema.parse(input);
      getFiles(session).set(file.path, file);
    },

    async readFile(session, path, options) {
      const file = getFiles(session).get(path);

      if (!file) {
        throw new Error(`Sandbox file not found: ${path}`);
      }

      if (!options?.encoding || options.encoding === file.encoding) {
        return file;
      }

      if (options.encoding === "base64") {
        return {
          ...file,
          content: Buffer.from(file.content, file.encoding).toString("base64"),
          encoding: "base64",
        };
      }

      return {
        ...file,
        content: Buffer.from(file.content, "base64").toString("utf8"),
        encoding: "utf8",
      };
    },

    async getPortUrl(session, port) {
      await this.get(session.id);
      return `https://sandbox.local/${session.id}/ports/${port}`;
    },

    async stop(session) {
      sessions.delete(session.id);
      filesBySession.delete(session.id);
    },
  };
}
