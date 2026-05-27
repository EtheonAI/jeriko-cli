import "server-only";

import {
  type ConnectorAdapter,
  type ConnectorExecutionMode,
  type ConnectorExecutionResult,
  type ConnectorProvider,
} from "@repo/connectors";
import { tool as aiTool, type Tool } from "ai";
import { z } from "zod";

import {
  type PlatformToolApprovalDecision,
  type PlatformToolApprovalPolicy,
  PlatformToolApprovalRequiredError,
  type PlatformToolPermission,
  type PlatformToolRisk,
} from "./contracts.js";

export type ConnectorPlatformToolManifest<TInputSchema extends z.ZodType = z.ZodType> = {
  id: string;
  description: string;
  inputSchema: TInputSchema;
  connector: {
    provider: ConnectorProvider;
    toolSlug: string;
    toolkitSlug?: string;
    mode?: ConnectorExecutionMode;
    connectedAccountId?: string;
  };
  permission: PlatformToolPermission;
  risk: PlatformToolRisk;
  approval: PlatformToolApprovalPolicy | DynamicApprovalPolicy<TInputSchema>;
  strict?: boolean;
};

export type ConnectorPlatformToolRuntime = {
  connector: ConnectorAdapter;
  userId: string;
  sessionId?: string;
  connectedAccountId?: string;
  workflowId?: string;
  runId?: string;
  metadata?: Record<string, unknown>;
  onBeforeExecute?: (event: ConnectorPlatformToolExecutionEvent) => Promise<void> | void;
  onAfterExecute?: (event: ConnectorPlatformToolExecutionEvent) => Promise<void> | void;
};

export type ConnectorPlatformToolExecutionEvent = {
  platformToolId: string;
  connectorToolSlug: string;
  permissionId: string;
  risk: PlatformToolRisk;
  userId: string;
  workflowId?: string;
  runId?: string;
};

export type ConnectorPlatformToolExecutionResult = {
  platformToolId: string;
  connectorToolSlug: string;
  permissionId: string;
  approvalRequired: boolean;
  success: boolean;
  output?: unknown;
  error?: string;
  connectorResult: ConnectorExecutionResult;
};

type DynamicApprovalPolicy<TInputSchema extends z.ZodType> = (
  input: z.infer<TInputSchema>
) => boolean | Promise<boolean>;

export async function requiresConnectorPlatformToolApproval<TInputSchema extends z.ZodType>(
  manifest: ConnectorPlatformToolManifest<TInputSchema>,
  input: z.infer<TInputSchema>
): Promise<boolean> {
  if (typeof manifest.approval === "function") {
    return manifest.approval(input);
  }

  if (manifest.approval === "always") {
    return true;
  }

  if (manifest.approval === "external_write") {
    return ["external_write", "destructive"].includes(manifest.risk);
  }

  return false;
}

export async function executeConnectorPlatformTool<TInputSchema extends z.ZodType>(
  manifest: ConnectorPlatformToolManifest<TInputSchema>,
  runtime: ConnectorPlatformToolRuntime,
  input: unknown,
  approval?: PlatformToolApprovalDecision
): Promise<ConnectorPlatformToolExecutionResult> {
  const parsedInput = manifest.inputSchema.parse(input);
  const approvalRequired = await requiresConnectorPlatformToolApproval(manifest, parsedInput);

  if (approvalRequired && approval?.approved !== true) {
    throw new PlatformToolApprovalRequiredError(manifest.id);
  }

  const event = toExecutionEvent(manifest, runtime);
  await runtime.onBeforeExecute?.(event);

  const connectorResult = await runtime.connector.execute({
    provider: manifest.connector.provider,
    mode: manifest.connector.mode ?? "session",
    userId: runtime.userId,
    sessionId: runtime.sessionId,
    connectedAccountId: runtime.connectedAccountId ?? manifest.connector.connectedAccountId,
    toolSlug: manifest.connector.toolSlug,
    arguments: toConnectorArguments(parsedInput),
    metadata: {
      ...runtime.metadata,
      platformToolId: manifest.id,
      permissionId: manifest.permission.id,
      risk: manifest.risk,
      workflowId: runtime.workflowId,
      runId: runtime.runId,
      approvalId: approval?.approvalId,
      approvalReason: approval?.reason,
    },
  });

  await runtime.onAfterExecute?.(event);

  return {
    platformToolId: manifest.id,
    connectorToolSlug: manifest.connector.toolSlug,
    permissionId: manifest.permission.id,
    approvalRequired,
    success: connectorResult.success,
    output: connectorResult.output,
    error: connectorResult.error,
    connectorResult,
  };
}

export function createConnectorAiSdkTool<TInputSchema extends z.ZodType>(
  manifest: ConnectorPlatformToolManifest<TInputSchema>,
  runtime: ConnectorPlatformToolRuntime
): Tool<z.output<TInputSchema>, ConnectorPlatformToolExecutionResult> {
  return aiTool<z.output<TInputSchema>, ConnectorPlatformToolExecutionResult>({
    description: manifest.description,
    inputSchema: manifest.inputSchema,
    strict: manifest.strict,
    needsApproval: (input) =>
      requiresConnectorPlatformToolApproval(manifest, manifest.inputSchema.parse(input)),
    execute: (input) =>
      executeConnectorPlatformTool(manifest, runtime, input, {
        approved: true,
        reason: "AI SDK approval gate satisfied before execution.",
      }),
  });
}

export function createConnectorAiSdkTools(
  manifests: readonly ConnectorPlatformToolManifest<z.ZodType>[],
  runtime: ConnectorPlatformToolRuntime
): Record<string, Tool<unknown, ConnectorPlatformToolExecutionResult>> {
  const entries: Array<[string, Tool<unknown, ConnectorPlatformToolExecutionResult>]> =
    manifests.map((manifest) => [
      manifest.id,
      createConnectorAiSdkTool(manifest, runtime) as Tool<
        unknown,
        ConnectorPlatformToolExecutionResult
      >,
    ]);

  return Object.fromEntries(entries);
}

function toExecutionEvent<TInputSchema extends z.ZodType>(
  manifest: ConnectorPlatformToolManifest<TInputSchema>,
  runtime: ConnectorPlatformToolRuntime
): ConnectorPlatformToolExecutionEvent {
  return {
    platformToolId: manifest.id,
    connectorToolSlug: manifest.connector.toolSlug,
    permissionId: manifest.permission.id,
    risk: manifest.risk,
    userId: runtime.userId,
    workflowId: runtime.workflowId,
    runId: runtime.runId,
  };
}

function toConnectorArguments(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { value: input };
  }

  return input as Record<string, unknown>;
}
