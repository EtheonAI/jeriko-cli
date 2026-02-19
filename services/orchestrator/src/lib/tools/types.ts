/**
 * Shared types and interfaces for tool execution
 */

export interface ToolContext {
  // Session
  sessionId: string;
  userId: string;
  userName?: string;
  projectId?: string;

  // Database
  db: DatabaseClient;

  // E2B Sandbox
  sandboxId: string;
  terminalServerUrl: string;
  e2bSandboxId: string;

  // WebSocket
  ws: WebSocketClient;

  // External Services
  searchProvider?: SearchProvider;
  imageProvider?: ImageProvider;
  storage: StorageClient;

  // Plan Limits (from billing service)
  planLimits?: {
    maxParallelSubtasks: number;
    planType: string;
  };
}

export interface DatabaseClient {
  insertMessage(params: InsertMessageParams): Promise<Message>;
  insertManusPage(params: InsertPageParams): Promise<ManusPage>;
  query: unknown; // Drizzle query builder
}

export interface InsertMessageParams {
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  contentType?: 'info' | 'ask' | 'result';
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  contentType?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface InsertPageParams {
  sessionId: string;
  userId: string;
  title: string;
  content: string;
  isPublic: boolean;
}

export interface ManusPage {
  id: string;
  userId: string;
  title: string;
  content: string;
  isPublic: boolean;
  createdAt: Date;
}

export interface WebSocketClient {
  emit(sessionId: string, event: unknown): Promise<void>;
}

export interface SearchProvider {
  search(params: SearchParams): Promise<SearchResult[]>;
}

export interface SearchParams {
  query: string;
  dateRange?: 'all' | 'past_hour' | 'past_day' | 'past_week' | 'past_month' | 'past_year';
  type?: 'info' | 'image' | 'news' | 'api' | 'data' | 'research' | 'tool';
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: Date;
}

export interface ImageProvider {
  generate(params: ImageGenParams): Promise<{ url: string }>;
}

export interface ImageGenParams {
  prompt: string;
  size: '1024x1024' | '1792x1024' | '1024x1792';
  n: number;
}

export interface StorageClient {
  uploadFromUrl(url: string, userId: string): Promise<string>;
  uploadFromSandbox(sandboxId: string, path: string, userId: string): Promise<string>;
}

export interface SandboxProcess {
  sendStdin(input: string): void;
  kill(): void;
}

// Tool execution result types
export interface ToolResult {
  status: 'success' | 'error';
  [key: string]: unknown;
}

export interface FileReadResult extends ToolResult {
  content?: string;
  error?: string;
}

export interface FileWriteResult extends ToolResult {
  path?: string;
  bytesWritten?: number;
  error?: string;
}

export interface ShellExecResult extends ToolResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export interface BrowserResult extends ToolResult {
  url?: string;
  title?: string;
  content?: string;
  screenshot?: string; // base64 or CDN URL
  elements?: unknown[];
  error?: string;
}
