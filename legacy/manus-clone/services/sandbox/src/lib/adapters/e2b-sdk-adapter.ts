/**
 * E2B SDK Adapter Implementation
 *
 * Concrete implementation using the E2B SDK.
 * This adapter wraps the E2B Code Interpreter SDK.
 */

import { Sandbox as E2BSandbox } from "@e2b/code-interpreter";
import type {
  IE2BAdapter,
  SandboxConfig,
  ExecutionResult,
  FileOperation,
  BrowserAction,
} from "./e2b-adapter.interface.js";

export class E2BSdkAdapter implements IE2BAdapter {
  private sandboxInstances = new Map<string, E2BSandbox>();

  async create(config: SandboxConfig): Promise<string> {
    // Stub implementation - will be wired to actual E2B SDK
    const sandbox = await E2BSandbox.create({
      apiKey: config.apiKey,
      template: config.template,
      timeoutMs: config.timeout,
      metadata: config.metadata as Record<string, string> | undefined,
    });

    const sandboxId = sandbox.sandboxId;
    this.sandboxInstances.set(sandboxId, sandbox);
    return sandboxId;
  }

  async connect(sandboxId: string): Promise<void> {
    // Stub implementation - reconnect to existing sandbox
    if (!this.sandboxInstances.has(sandboxId)) {
      const sandbox = await E2BSandbox.reconnect(sandboxId);
      this.sandboxInstances.set(sandboxId, sandbox);
    }
  }

  async executeCode(
    sandboxId: string,
    code: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _language: "python" | "javascript"
  ): Promise<ExecutionResult> {
    const sandbox = this.sandboxInstances.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    // Stub implementation - will be wired to actual execution
    const result = await sandbox.runCode(code);

    return {
      stdout: result.text || "",
      stderr: result.error?.message || "",
      exitCode: result.error ? 1 : 0,
      error: result.error?.message,
    };
  }

  async executeShell(sandboxId: string, command: string): Promise<ExecutionResult> {
    const sandbox = this.sandboxInstances.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    // Stub implementation - shell execution
    const process = await sandbox.process.start({
      cmd: command,
    });

    await process.wait();

    return {
      stdout: "",
      stderr: "",
      exitCode: process.exitCode || 0,
    };
  }

  async executeBrowserAction(sandboxId: string, action: BrowserAction): Promise<unknown> {
    const sandbox = this.sandboxInstances.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    // Stub implementation - browser actions
    // Will be implemented with actual browser controller API
    return { success: true, action: action.type };
  }

  async writeFile(sandboxId: string, operation: FileOperation): Promise<void> {
    const sandbox = this.sandboxInstances.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    // Stub implementation - file write
    if (operation.content !== undefined) {
      await sandbox.files.write(operation.path, operation.content);
    }
  }

  async readFile(sandboxId: string, path: string): Promise<string> {
    const sandbox = this.sandboxInstances.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    // Stub implementation - file read
    const content = await sandbox.files.read(path);
    return content || "";
  }

  async listFiles(sandboxId: string, path: string): Promise<FileOperation[]> {
    const sandbox = this.sandboxInstances.get(sandboxId);
    if (!sandbox) {
      throw new Error(`Sandbox ${sandboxId} not found`);
    }

    // Stub implementation - list files
    const files = await sandbox.files.list(path);
    return files.map((f) => ({
      path: f.name,
      isDirectory: f.type === "dir",
    }));
  }

  async destroy(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxInstances.get(sandboxId);
    if (sandbox) {
      await sandbox.close();
      this.sandboxInstances.delete(sandboxId);
    }
  }

  async isActive(sandboxId: string): Promise<boolean> {
    return this.sandboxInstances.has(sandboxId);
  }

  async getStatus(sandboxId: string): Promise<"active" | "stopped" | "error"> {
    const isActive = await this.isActive(sandboxId);
    return isActive ? "active" : "stopped";
  }
}
