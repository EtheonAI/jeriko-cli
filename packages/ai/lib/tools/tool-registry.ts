/**
 * @repo/ai - Tool Registry
 *
 * Comprehensive tool execution framework with validation,
 * error handling, approval workflows, and client-side execution support.
 */

import { z } from 'zod';
import { generateId } from '../streaming';

// ============================================================================
// Types
// ============================================================================

export type ToolExecutionMode = 'server' | 'client' | 'hybrid';

export interface ToolContext {
  /** Session ID */
  sessionId?: string;

  /** User ID */
  userId?: string;

  /** Message ID */
  messageId?: string;

  /** Tool call ID */
  toolCallId: string;

  /** Abort signal for cancellation */
  abortSignal?: AbortSignal;

  /** Progress callback */
  onProgress?: (progress: number, message?: string) => void;

  /** Stream writer for streaming results */
  streamWriter?: {
    writeData: <T>(type: string, data: T) => void;
  };
}

export interface ToolResult<T = unknown> {
  success: boolean;
  output?: T;
  error?: string;
  duration: number;
  cached?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition<
  TInput extends z.ZodTypeAny = z.ZodUnknown,
  TOutput = unknown,
> {
  /** Tool name (must be unique) */
  name: string;

  /** Human-readable description */
  description: string;

  /** Tool category for grouping */
  category?: string;

  /** Icon identifier */
  icon?: string;

  /** Input schema (Zod) */
  parameters: TInput;

  /** Output schema (optional, for validation) */
  outputSchema?: z.ZodType<TOutput>;

  /** Execution mode */
  mode?: ToolExecutionMode;

  /** Requires user approval before execution */
  requiresApproval?: boolean;

  /** Show warning to user */
  dangerous?: boolean;

  /** Execution timeout in ms */
  timeout?: number;

  /** Number of retries on failure */
  retries?: number;

  /** Can cache results */
  cacheable?: boolean;

  /** Cache TTL in ms */
  cacheTtl?: number;

  /** Rate limit (calls per minute) */
  rateLimit?: number;

  /** Execute the tool */
  execute: (
    input: z.infer<TInput>,
    context: ToolContext
  ) => Promise<TOutput>;

  /** Optional validation function */
  validate?: (input: z.infer<TInput>) => boolean | string;

  /** Optional pre-execution hook */
  beforeExecute?: (
    input: z.infer<TInput>,
    context: ToolContext
  ) => Promise<void>;

  /** Optional post-execution hook */
  afterExecute?: (
    input: z.infer<TInput>,
    output: TOutput,
    context: ToolContext
  ) => Promise<void>;
}

export interface ToolExecutionOptions {
  /** Skip approval check */
  skipApproval?: boolean;

  /** Override timeout */
  timeout?: number;

  /** Skip cache */
  skipCache?: boolean;

  /** Metadata to attach to result */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Tool Registry
// ============================================================================

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private cache = new Map<string, { result: unknown; expiresAt: number }>();
  private rateLimits = new Map<string, { count: number; resetAt: number }>();

  // ========================================
  // Registration
  // ========================================

  /**
   * Register a tool
   */
  register<TInput extends z.ZodTypeAny, TOutput>(
    tool: ToolDefinition<TInput, TOutput>
  ): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }

    this.tools.set(tool.name, tool as unknown as ToolDefinition);
    return this;
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: ToolDefinition[]): this {
    for (const tool of tools) {
      this.register(tool);
    }
    return this;
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Check if a tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tools
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools by category
   */
  getByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.category === category
    );
  }

  /**
   * Get tool definitions for AI (OpenAI/Anthropic format)
   */
  getToolDefinitions(): Record<string, { description: string; parameters: unknown }> {
    const result: Record<string, { description: string; parameters: unknown }> = {};

    for (const tool of this.tools.values()) {
      result[tool.name] = {
        description: tool.description,
        parameters: zodToJsonSchema(tool.parameters),
      };
    }

    return result;
  }

  // ========================================
  // Execution
  // ========================================

  /**
   * Execute a tool
   */
  async execute<T = unknown>(
    name: string,
    input: unknown,
    context: Partial<ToolContext> = {},
    options: ToolExecutionOptions = {}
  ): Promise<ToolResult<T>> {
    const startTime = Date.now();

    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${name}" not found`,
        duration: Date.now() - startTime,
      };
    }

    const fullContext: ToolContext = {
      toolCallId: context.toolCallId ?? generateId('tool'),
      ...context,
    };

    try {
      // Check rate limit
      if (tool.rateLimit) {
        const rateLimitResult = this.checkRateLimit(name, tool.rateLimit);
        if (!rateLimitResult.allowed) {
          return {
            success: false,
            error: `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter}ms`,
            duration: Date.now() - startTime,
          };
        }
      }

      // Validate input
      const parseResult = tool.parameters.safeParse(input);
      if (!parseResult.success) {
        return {
          success: false,
          error: `Invalid input: ${parseResult.error.message}`,
          duration: Date.now() - startTime,
        };
      }

      const validatedInput = parseResult.data;

      // Custom validation
      if (tool.validate) {
        const validationResult = tool.validate(validatedInput);
        if (validationResult !== true) {
          return {
            success: false,
            error: typeof validationResult === 'string'
              ? validationResult
              : 'Validation failed',
            duration: Date.now() - startTime,
          };
        }
      }

      // Check cache
      if (tool.cacheable && !options.skipCache) {
        const cacheKey = this.getCacheKey(name, validatedInput);
        const cached = this.getFromCache(cacheKey);
        if (cached !== undefined) {
          return {
            success: true,
            output: cached as T,
            duration: Date.now() - startTime,
            cached: true,
          };
        }
      }

      // Check approval (if required and not skipped)
      if (tool.requiresApproval && !options.skipApproval) {
        return {
          success: false,
          error: 'APPROVAL_REQUIRED',
          duration: Date.now() - startTime,
          metadata: {
            requiresApproval: true,
            toolName: name,
            input: validatedInput,
          },
        };
      }

      // Pre-execution hook
      if (tool.beforeExecute) {
        await tool.beforeExecute(validatedInput, fullContext);
      }

      // Execute with timeout
      const timeout = options.timeout ?? tool.timeout ?? 30000;
      const output = await this.executeWithTimeout(
        () => tool.execute(validatedInput, fullContext),
        timeout,
        fullContext.abortSignal
      );

      // Validate output
      if (tool.outputSchema) {
        const outputResult = tool.outputSchema.safeParse(output);
        if (!outputResult.success) {
          return {
            success: false,
            error: `Invalid output: ${outputResult.error.message}`,
            duration: Date.now() - startTime,
          };
        }
      }

      // Post-execution hook
      if (tool.afterExecute) {
        await tool.afterExecute(validatedInput, output, fullContext);
      }

      // Cache result
      if (tool.cacheable && !options.skipCache) {
        const cacheKey = this.getCacheKey(name, validatedInput);
        this.setCache(cacheKey, output, tool.cacheTtl ?? 60000);
      }

      return {
        success: true,
        output: output as T,
        duration: Date.now() - startTime,
        metadata: options.metadata,
      };
    } catch (error) {
      // Handle retries
      if (tool.retries && tool.retries > 0) {
        return this.executeWithRetry(
          name,
          input,
          fullContext,
          { ...options, timeout: options.timeout ?? tool.timeout },
          tool.retries
        );
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Execute with retries
   */
  private async executeWithRetry<T>(
    name: string,
    input: unknown,
    context: ToolContext,
    options: ToolExecutionOptions,
    retriesLeft: number
  ): Promise<ToolResult<T>> {
    const result = await this.execute<T>(name, input, context, options);

    if (!result.success && retriesLeft > 0) {
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, 3 - retriesLeft), 10000);
      await sleep(delay);

      return this.executeWithRetry(name, input, context, options, retriesLeft - 1);
    }

    return result;
  }

  /**
   * Execute with timeout
   */
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    abortSignal?: AbortSignal
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeout}ms`));
      }, timeout);

      // Handle abort signal
      if (abortSignal) {
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Tool execution aborted'));
        }, { once: true });
      }

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  // ========================================
  // Caching
  // ========================================

  private getCacheKey(name: string, input: unknown): string {
    return `${name}:${JSON.stringify(input)}`;
  }

  private getFromCache(key: string): unknown | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.result;
  }

  private setCache(key: string, result: unknown, ttl: number): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttl,
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ========================================
  // Rate Limiting
  // ========================================

  private checkRateLimit(
    name: string,
    limit: number
  ): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(name);

    if (!entry || now > entry.resetAt) {
      // Reset or initialize
      this.rateLimits.set(name, {
        count: 1,
        resetAt: now + 60000, // 1 minute window
      });
      return { allowed: true };
    }

    if (entry.count >= limit) {
      return {
        allowed: false,
        retryAfter: entry.resetAt - now,
      };
    }

    entry.count++;
    return { allowed: true };
  }
}

// ============================================================================
// Tool Builder
// ============================================================================

export class ToolBuilder<TInput extends z.ZodTypeAny = z.ZodUnknown> {
  private definition: Partial<ToolDefinition<TInput>>;

  constructor(name: string) {
    this.definition = { name };
  }

  description(description: string): this {
    this.definition.description = description;
    return this;
  }

  category(category: string): this {
    this.definition.category = category;
    return this;
  }

  icon(icon: string): this {
    this.definition.icon = icon;
    return this;
  }

  parameters<T extends z.ZodTypeAny>(schema: T): ToolBuilder<T> {
    (this.definition as any).parameters = schema;
    return this as unknown as ToolBuilder<T>;
  }

  outputSchema<T>(schema: z.ZodType<T>): this {
    this.definition.outputSchema = schema as any;
    return this;
  }

  mode(mode: ToolExecutionMode): this {
    this.definition.mode = mode;
    return this;
  }

  requiresApproval(required = true): this {
    this.definition.requiresApproval = required;
    return this;
  }

  dangerous(isDangerous = true): this {
    this.definition.dangerous = isDangerous;
    return this;
  }

  timeout(ms: number): this {
    this.definition.timeout = ms;
    return this;
  }

  retries(count: number): this {
    this.definition.retries = count;
    return this;
  }

  cacheable(ttl?: number): this {
    this.definition.cacheable = true;
    if (ttl) {
      this.definition.cacheTtl = ttl;
    }
    return this;
  }

  rateLimit(callsPerMinute: number): this {
    this.definition.rateLimit = callsPerMinute;
    return this;
  }

  execute(
    fn: (input: z.infer<TInput>, context: ToolContext) => Promise<unknown>
  ): this {
    this.definition.execute = fn as any;
    return this;
  }

  validate(fn: (input: z.infer<TInput>) => boolean | string): this {
    this.definition.validate = fn as any;
    return this;
  }

  beforeExecute(
    fn: (input: z.infer<TInput>, context: ToolContext) => Promise<void>
  ): this {
    this.definition.beforeExecute = fn as any;
    return this;
  }

  afterExecute(
    fn: (input: z.infer<TInput>, output: unknown, context: ToolContext) => Promise<void>
  ): this {
    this.definition.afterExecute = fn as any;
    return this;
  }

  build(): ToolDefinition<TInput> {
    if (!this.definition.name) {
      throw new Error('Tool name is required');
    }
    if (!this.definition.description) {
      throw new Error('Tool description is required');
    }
    if (!this.definition.parameters) {
      throw new Error('Tool parameters schema is required');
    }
    if (!this.definition.execute) {
      throw new Error('Tool execute function is required');
    }

    return this.definition as ToolDefinition<TInput>;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

export function tool(name: string): ToolBuilder {
  return new ToolBuilder(name);
}

export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Convert Zod schema to JSON Schema
 */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  // Basic conversion - in production, use a library like zod-to-json-schema
  try {
    // Use zod's internal describe method if available
    const description = (schema as any)._def?.description;

    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value as z.ZodTypeAny);

        // Check if required
        if (!((value as any) instanceof z.ZodOptional)) {
          required.push(key);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
        description,
      };
    }

    if (schema instanceof z.ZodString) {
      return { type: 'string', description };
    }

    if (schema instanceof z.ZodNumber) {
      return { type: 'number', description };
    }

    if (schema instanceof z.ZodBoolean) {
      return { type: 'boolean', description };
    }

    if (schema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: zodToJsonSchema((schema as any)._def.type),
        description,
      };
    }

    if (schema instanceof z.ZodEnum) {
      return {
        type: 'string',
        enum: (schema as any)._def.values,
        description,
      };
    }

    if (schema instanceof z.ZodOptional) {
      return zodToJsonSchema((schema as any)._def.innerType);
    }

    if (schema instanceof z.ZodDefault) {
      const innerSchema = zodToJsonSchema((schema as any)._def.innerType);
      return {
        ...innerSchema,
        default: (schema as any)._def.defaultValue(),
      };
    }

    // Fallback
    return { type: 'string', description };
  } catch {
    return { type: 'string' };
  }
}

// ============================================================================
// Default Registry Instance
// ============================================================================

let defaultRegistry: ToolRegistry | null = null;

export function getDefaultToolRegistry(): ToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolRegistry();
  }
  return defaultRegistry;
}

export function setDefaultToolRegistry(registry: ToolRegistry): void {
  defaultRegistry = registry;
}
