import { describe, expect, it } from "vitest";

import { createMockSandboxAdapter } from "../src/mock.js";

describe("createMockSandboxAdapter", () => {
  it("creates sessions and stores files by session", async () => {
    const adapter = createMockSandboxAdapter({
      idFactory: () => "mock-session",
      now: () => new Date("2026-05-26T00:00:00.000Z"),
    });
    const session = await adapter.create({
      runtime: "node24",
      metadata: { owner: "test" },
    });

    await adapter.writeFile(session, {
      path: "hello.txt",
      content: "hello",
    });

    await expect(adapter.get(session.id)).resolves.toEqual(session);
    await expect(adapter.readFile(session, "hello.txt")).resolves.toEqual({
      path: "hello.txt",
      content: "hello",
      encoding: "utf8",
    });
  });

  it("uses command handlers for deterministic command results", async () => {
    const adapter = createMockSandboxAdapter({
      commandHandler: async ({ command }) =>
        command.command === "echo"
          ? { stdout: `${command.args.join(" ")}\n` }
          : { exitCode: 127, stderr: "not found" },
    });
    const session = await adapter.create();

    await expect(
      adapter.runCommand(session, { command: "echo", args: ["ok"] })
    ).resolves.toMatchObject({
      exitCode: 0,
      stdout: "ok\n",
      stderr: "",
    });

    await expect(adapter.runCommand(session, { command: "missing" })).resolves.toMatchObject({
      exitCode: 127,
      stderr: "not found",
    });
  });

  it("removes sessions on stop", async () => {
    const adapter = createMockSandboxAdapter({
      idFactory: () => "stopped-session",
    });
    const session = await adapter.create();

    await adapter.stop(session);

    await expect(adapter.get(session.id)).rejects.toThrow("Unknown sandbox session");
  });
});
