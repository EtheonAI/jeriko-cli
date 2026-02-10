/**
 * E2B Adapter Interface
 *
 * Defines the contract for E2B sandbox operations.
 * Implementations can swap between E2B SDK and alternative sandbox providers.
 */

export interface SandboxConfig {
  apiKey: string;
  template?: string;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export interface FileOperation {
  path: string;
  content?: string;
  isDirectory?: boolean;
}

export interface BrowserAction {
  type: "navigate" | "click" | "scroll" | "screenshot" | "key_press";
  params: Record<string, unknown>;
}

export interface IE2BAdapter {
  /**
   * Create a new sandbox instance
   */
  create(config: SandboxConfig): Promise<string>;

  /**
   * Connect to an existing sandbox by ID
   */
  connect(sandboxId: string): Promise<void>;

  /**
   * Execute code in the sandbox
   */
  executeCode(
    sandboxId: string,
    code: string,
    language: "python" | "javascript"
  ): Promise<ExecutionResult>;

  /**
   * Execute shell command in the sandbox
   */
  executeShell(sandboxId: string, command: string): Promise<ExecutionResult>;

  /**
   * Perform browser action
   */
  executeBrowserAction(sandboxId: string, action: BrowserAction): Promise<unknown>;

  /**
   * Write file to sandbox
   */
  writeFile(sandboxId: string, operation: FileOperation): Promise<void>;

  /**
   * Read file from sandbox
   */
  readFile(sandboxId: string, path: string): Promise<string>;

  /**
   * List files in sandbox directory
   */
  listFiles(sandboxId: string, path: string): Promise<FileOperation[]>;

  /**
   * Destroy sandbox and cleanup resources
   */
  destroy(sandboxId: string): Promise<void>;

  /**
   * Check if sandbox is active
   */
  isActive(sandboxId: string): Promise<boolean>;

  /**
   * Get sandbox status
   */
  getStatus(sandboxId: string): Promise<"active" | "stopped" | "error">;
}
