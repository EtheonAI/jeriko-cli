import { z } from "zod";

const metadataSchema = z.record(z.string(), z.unknown());
const stringListSchema = z.array(z.string().min(1));

export const connectorProviderSchema = z.enum(["composio", "direct", "mock"]);

export const connectorAuthStateSchema = z.enum([
  "connected",
  "needs_auth",
  "pending",
  "expired",
  "disabled",
  "failed",
  "unknown",
]);

export const connectorExecutionModeSchema = z.enum(["session", "direct"]);

export const connectorActionRiskSchema = z.enum([
  "read",
  "write",
  "external_write",
  "destructive",
  "unknown",
]);

export const connectorWorkbenchSizeSchema = z.enum(["standard", "medium", "large", "xlarge"]);

export const connectorToolkitScopeSchema = z.union([
  stringListSchema,
  z
    .object({
      enable: stringListSchema.optional(),
      disable: stringListSchema.optional(),
    })
    .refine((value) => !(value.enable && value.disable), {
      message: "Use either toolkit enable or disable scope, not both.",
    }),
]);

export const connectorWorkbenchConfigSchema = z.object({
  enable: z.boolean().optional(),
  sandboxSize: connectorWorkbenchSizeSchema.optional(),
});

export const connectorManageConnectionsSchema = z.union([
  z.boolean(),
  z.object({
    callbackUrl: z.string().url().optional(),
  }),
]);

export const connectorSessionCreateOptionsSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  userId: z.string().min(1),
  workflowId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  toolkits: connectorToolkitScopeSchema.optional(),
  tools: stringListSchema.optional(),
  authConfigs: z.record(z.string(), z.string().min(1)).optional(),
  connectedAccounts: z
    .record(z.string(), z.union([z.string().min(1), z.array(z.string().min(1))]))
    .optional(),
  manageConnections: connectorManageConnectionsSchema.optional(),
  workbench: connectorWorkbenchConfigSchema.optional(),
  preload: z
    .object({
      tools: z.union([z.literal("all"), stringListSchema]).optional(),
    })
    .optional(),
  metadata: metadataSchema.optional(),
});

const connectorSessionLocatorBaseSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  sessionId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  toolkits: connectorToolkitScopeSchema.optional(),
  authConfigs: z.record(z.string(), z.string().min(1)).optional(),
  connectedAccounts: z
    .record(z.string(), z.union([z.string().min(1), z.array(z.string().min(1))]))
    .optional(),
  manageConnections: connectorManageConnectionsSchema.optional(),
  workbench: connectorWorkbenchConfigSchema.optional(),
});

export const connectorSessionLocatorSchema = connectorSessionLocatorBaseSchema.refine(
  (value) => Boolean(value.sessionId || value.userId),
  {
    message: "Provide sessionId to reuse a session or userId to create one.",
  }
);

export const connectorSessionRefSchema = z.object({
  provider: connectorProviderSchema,
  sessionId: z.string().min(1),
  userId: z.string().min(1).optional(),
  workflowId: z.string().min(1).optional(),
  runId: z.string().min(1).optional(),
  mcp: z
    .object({
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
  metadata: metadataSchema.optional(),
});

export const connectorToolkitSchema = z.object({
  provider: connectorProviderSchema,
  slug: z.string().min(1),
  name: z.string().min(1),
  logoUrl: z.string().url().optional(),
  authState: connectorAuthStateSchema.default("unknown"),
  connectedAccountId: z.string().min(1).optional(),
  raw: z.unknown().optional(),
});

export const connectorListToolkitsRequestSchema = connectorSessionLocatorBaseSchema
  .extend({
    cursor: z.string().min(1).optional(),
    limit: z.number().int().positive().max(100).optional(),
    isConnected: z.boolean().optional(),
    search: z.string().min(1).optional(),
    toolkitSlugs: stringListSchema.optional(),
  })
  .refine((value) => Boolean(value.sessionId || value.userId), {
    message: "Provide sessionId to reuse a session or userId to create one.",
  });

export const connectorToolkitListResultSchema = z.object({
  items: z.array(connectorToolkitSchema),
  cursor: z.string().optional(),
});

export const connectorActionSchema = z.object({
  provider: connectorProviderSchema,
  slug: z.string().min(1),
  toolkitSlug: z.string().min(1).optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.unknown().optional(),
  outputSchema: z.unknown().optional(),
  risk: connectorActionRiskSchema.default("unknown"),
  raw: z.unknown().optional(),
});

export const connectorListActionsRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  userId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  query: z.string().min(1).optional(),
  toolkits: stringListSchema.optional(),
  tools: stringListSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const connectorActionListResultSchema = z.object({
  items: z.array(connectorActionSchema),
  cursor: z.string().optional(),
});

export const connectorGetActionRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  slug: z.string().min(1),
});

export const connectorAuthorizationRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  userId: z.string().min(1),
  toolkitSlug: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  authConfigId: z.string().min(1).optional(),
  callbackUrl: z.string().url().optional(),
  alias: z.string().min(1).optional(),
});

export const connectorAuthorizationResultSchema = z.object({
  provider: connectorProviderSchema,
  id: z.string().min(1).optional(),
  userId: z.string().min(1),
  toolkitSlug: z.string().min(1).optional(),
  authConfigId: z.string().min(1).optional(),
  redirectUrl: z.string().url(),
  connectedAccountId: z.string().min(1).optional(),
  raw: z.unknown().optional(),
});

export const connectorConnectionSchema = z.object({
  provider: connectorProviderSchema,
  id: z.string().min(1),
  userId: z.string().min(1).optional(),
  toolkitSlug: z.string().min(1).optional(),
  authConfigId: z.string().min(1).optional(),
  status: connectorAuthStateSchema.default("unknown"),
  isActive: z.boolean().default(false),
  raw: z.unknown().optional(),
});

export const connectorListConnectionsRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  userIds: stringListSchema.optional(),
  statuses: stringListSchema.optional(),
  toolkitSlugs: stringListSchema.optional(),
  authConfigIds: stringListSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const connectorConnectionListResultSchema = z.object({
  items: z.array(connectorConnectionSchema),
  cursor: z.string().optional(),
});

export const connectorWaitForConnectionRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  connectedAccountId: z.string().min(1),
  timeoutMs: z.number().int().positive().optional(),
});

export const connectorExecuteRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  mode: connectorExecutionModeSchema.default("session"),
  userId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
  toolSlug: z.string().min(1),
  arguments: metadataSchema.default({}),
  connectedAccountId: z.string().min(1).optional(),
  version: z.string().min(1).optional(),
  dangerouslySkipVersionCheck: z.boolean().optional(),
  metadata: metadataSchema.optional(),
});

export const connectorExecutionResultSchema = z.object({
  provider: connectorProviderSchema,
  mode: connectorExecutionModeSchema,
  toolSlug: z.string().min(1),
  success: z.boolean(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  logId: z.string().min(1).optional(),
  startedAt: z.date(),
  endedAt: z.date(),
  raw: z.unknown().optional(),
  metadata: metadataSchema.optional(),
});

export const connectorTriggerStatusSchema = z.enum(["enabled", "disabled", "unknown"]);

export const connectorCreateTriggerRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  userId: z.string().min(1),
  triggerSlug: z.string().min(1),
  connectedAccountId: z.string().min(1).optional(),
  config: metadataSchema.optional(),
  metadata: metadataSchema.optional(),
});

export const connectorTriggerRefSchema = z.object({
  provider: connectorProviderSchema,
  id: z.string().min(1),
  triggerSlug: z.string().min(1),
  userId: z.string().min(1).optional(),
  connectedAccountId: z.string().min(1).optional(),
  status: connectorTriggerStatusSchema.default("unknown"),
  raw: z.unknown().optional(),
  metadata: metadataSchema.optional(),
});

export const connectorListTriggersRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  connectedAccountIds: stringListSchema.optional(),
  triggerIds: stringListSchema.optional(),
  triggerSlugs: stringListSchema.optional(),
  authConfigIds: stringListSchema.optional(),
  showDisabled: z.boolean().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const connectorTriggerListResultSchema = z.object({
  items: z.array(connectorTriggerRefSchema),
  cursor: z.string().optional(),
});

export const connectorTriggerMutationRequestSchema = z.object({
  provider: connectorProviderSchema.default("composio"),
  triggerId: z.string().min(1),
});

export const connectorEventSchema = z.object({
  provider: connectorProviderSchema,
  id: z.string().min(1).optional(),
  type: z.string().min(1),
  occurredAt: z.date().optional(),
  toolkitSlug: z.string().min(1).optional(),
  triggerSlug: z.string().min(1).optional(),
  connectedAccountId: z.string().min(1).optional(),
  payload: z.unknown(),
  metadata: metadataSchema.optional(),
});

export type ConnectorProvider = z.infer<typeof connectorProviderSchema>;
export type ConnectorAuthState = z.infer<typeof connectorAuthStateSchema>;
export type ConnectorExecutionMode = z.infer<typeof connectorExecutionModeSchema>;
export type ConnectorActionRisk = z.infer<typeof connectorActionRiskSchema>;
export type ConnectorToolkitScope = z.infer<typeof connectorToolkitScopeSchema>;
export type ConnectorSessionCreateOptions = z.input<typeof connectorSessionCreateOptionsSchema>;
export type ParsedConnectorSessionCreateOptions = z.infer<
  typeof connectorSessionCreateOptionsSchema
>;
export type ConnectorSessionLocator = z.input<typeof connectorSessionLocatorSchema>;
export type ParsedConnectorSessionLocator = z.infer<typeof connectorSessionLocatorSchema>;
export type ConnectorSessionRef = z.infer<typeof connectorSessionRefSchema>;
export type ConnectorToolkit = z.infer<typeof connectorToolkitSchema>;
export type ConnectorListToolkitsRequest = z.input<typeof connectorListToolkitsRequestSchema>;
export type ConnectorToolkitListResult = z.infer<typeof connectorToolkitListResultSchema>;
export type ConnectorAction = z.infer<typeof connectorActionSchema>;
export type ConnectorListActionsRequest = z.input<typeof connectorListActionsRequestSchema>;
export type ConnectorActionListResult = z.infer<typeof connectorActionListResultSchema>;
export type ConnectorGetActionRequest = z.input<typeof connectorGetActionRequestSchema>;
export type ConnectorAuthorizationRequest = z.input<typeof connectorAuthorizationRequestSchema>;
export type ConnectorAuthorizationResult = z.infer<typeof connectorAuthorizationResultSchema>;
export type ConnectorConnection = z.infer<typeof connectorConnectionSchema>;
export type ConnectorListConnectionsRequest = z.input<typeof connectorListConnectionsRequestSchema>;
export type ConnectorConnectionListResult = z.infer<typeof connectorConnectionListResultSchema>;
export type ConnectorWaitForConnectionRequest = z.input<
  typeof connectorWaitForConnectionRequestSchema
>;
export type ConnectorExecuteRequest = z.input<typeof connectorExecuteRequestSchema>;
export type ParsedConnectorExecuteRequest = z.infer<typeof connectorExecuteRequestSchema>;
export type ConnectorExecutionResult = z.infer<typeof connectorExecutionResultSchema>;
export type ConnectorCreateTriggerRequest = z.input<typeof connectorCreateTriggerRequestSchema>;
export type ConnectorTriggerRef = z.infer<typeof connectorTriggerRefSchema>;
export type ConnectorListTriggersRequest = z.input<typeof connectorListTriggersRequestSchema>;
export type ConnectorTriggerListResult = z.infer<typeof connectorTriggerListResultSchema>;
export type ConnectorTriggerMutationRequest = z.input<typeof connectorTriggerMutationRequestSchema>;
export type ConnectorEvent = z.infer<typeof connectorEventSchema>;

export type ConnectorAdapter = {
  createSession(input: ConnectorSessionCreateOptions): Promise<ConnectorSessionRef>;
  useSession(input: ConnectorSessionLocator): Promise<ConnectorSessionRef>;
  listToolkits(input: ConnectorListToolkitsRequest): Promise<ConnectorToolkitListResult>;
  listActions(input: ConnectorListActionsRequest): Promise<ConnectorActionListResult>;
  getAction(input: ConnectorGetActionRequest): Promise<ConnectorAction>;
  authorize(input: ConnectorAuthorizationRequest): Promise<ConnectorAuthorizationResult>;
  listConnections(input: ConnectorListConnectionsRequest): Promise<ConnectorConnectionListResult>;
  waitForConnection(input: ConnectorWaitForConnectionRequest): Promise<ConnectorConnection>;
  execute(input: ConnectorExecuteRequest): Promise<ConnectorExecutionResult>;
  createTrigger(input: ConnectorCreateTriggerRequest): Promise<ConnectorTriggerRef>;
  listTriggers(input: ConnectorListTriggersRequest): Promise<ConnectorTriggerListResult>;
  enableTrigger(input: ConnectorTriggerMutationRequest): Promise<ConnectorTriggerRef>;
  disableTrigger(input: ConnectorTriggerMutationRequest): Promise<ConnectorTriggerRef>;
  deleteTrigger(input: ConnectorTriggerMutationRequest): Promise<void>;
  normalizeEvent(input: unknown): ConnectorEvent;
};
