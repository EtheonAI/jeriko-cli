import "server-only";

import { Composio } from "@composio/core";

import {
  type ConnectorAction,
  type ConnectorAdapter,
  type ConnectorAuthState,
  type ConnectorConnection,
  type ConnectorExecutionResult,
  type ConnectorSessionRef,
  type ConnectorToolkit,
  type ConnectorTriggerRef,
  connectorActionListResultSchema,
  connectorActionSchema,
  connectorAuthorizationRequestSchema,
  connectorAuthorizationResultSchema,
  connectorConnectionListResultSchema,
  connectorConnectionSchema,
  connectorCreateTriggerRequestSchema,
  connectorExecuteRequestSchema,
  connectorExecutionResultSchema,
  connectorGetActionRequestSchema,
  connectorListActionsRequestSchema,
  connectorListConnectionsRequestSchema,
  connectorListToolkitsRequestSchema,
  connectorListTriggersRequestSchema,
  connectorSessionCreateOptionsSchema,
  connectorSessionLocatorSchema,
  connectorSessionRefSchema,
  connectorToolkitListResultSchema,
  connectorToolkitSchema,
  connectorTriggerListResultSchema,
  connectorTriggerMutationRequestSchema,
  connectorTriggerRefSchema,
  connectorWaitForConnectionRequestSchema,
} from "./contracts.js";
import { normalizeComposioEvent } from "./events.js";
import {
  asRecord,
  errorMessage,
  getCursor,
  getItems,
  readBoolean,
  readNestedRecord,
  readString,
} from "./internal.js";
import { keys } from "./keys.js";

type ComposioConnectionRequestLike = {
  id?: string;
  redirectUrl?: string;
  redirect_url?: string;
  connectedAccountId?: string;
  connected_account_id?: string;
  waitForConnection?: (timeoutMs?: number) => Promise<unknown>;
};

type ComposioSessionLike = {
  sessionId?: string;
  session_id?: string;
  id?: string;
  mcp?: {
    url?: string;
    headers?: Record<string, string>;
  };
  authorize: (
    toolkit: string,
    options?: { alias?: string; callbackUrl?: string }
  ) => Promise<ComposioConnectionRequestLike>;
  execute?: (toolSlug: string, arguments_?: Record<string, unknown>) => Promise<unknown>;
  search?: (params: { query: string; toolkits?: string[] }) => Promise<unknown>;
  toolkits: (options?: {
    cursor?: string;
    isConnected?: boolean;
    limit?: number;
    search?: string;
    toolkits?: string[];
  }) => Promise<unknown>;
  tools: (modifiers?: unknown) => Promise<unknown>;
};

type ComposioLike = {
  create: (userId: string, options?: Record<string, unknown>) => Promise<ComposioSessionLike>;
  use: (sessionId: string) => Promise<ComposioSessionLike>;
  connectedAccounts: {
    get?: (id: string) => Promise<unknown>;
    link?: (
      userId: string,
      authConfigId: string,
      options?: { callbackUrl?: string }
    ) => Promise<ComposioConnectionRequestLike>;
    list?: (query?: Record<string, unknown>) => Promise<unknown>;
    waitForConnection?: (connectedAccountId: string, timeoutMs?: number) => Promise<unknown>;
  };
  tools: {
    execute?: (
      slug: string,
      body: Record<string, unknown>,
      modifiers?: unknown
    ) => Promise<unknown>;
    get?: (userId: string, query?: Record<string, unknown>) => Promise<unknown>;
    getRawComposioToolBySlug?: (slug: string, options?: unknown) => Promise<unknown>;
    getRawComposioTools?: (query: Record<string, unknown>, options?: unknown) => Promise<unknown>;
  };
  triggers: {
    create?: (
      userId: string,
      slug: string,
      body?: {
        connectedAccountId?: string;
        triggerConfig?: Record<string, unknown>;
      }
    ) => Promise<unknown>;
    delete?: (triggerId: string) => Promise<unknown>;
    disable?: (triggerId: string) => Promise<unknown>;
    enable?: (triggerId: string) => Promise<unknown>;
    listActive?: (query?: Record<string, unknown>) => Promise<unknown>;
  };
};

export type CreateComposioConnectorAdapterOptions = {
  apiKey?: string;
  baseURL?: string;
  client?: ComposioLike;
  fileUploadPathDenySegments?: string[];
  provider?: unknown;
  sensitiveFileUploadProtection?: boolean;
  toolkitVersions?: Record<string, string>;
};

export function createComposioClient(
  options: Omit<CreateComposioConnectorAdapterOptions, "client"> = {}
): ComposioLike {
  const env = keys();
  const apiKey = options.apiKey ?? env.COMPOSIO_API_KEY;

  if (!apiKey) {
    throw new Error("COMPOSIO_API_KEY is required to create a Composio client.");
  }

  const config = stripUndefined({
    apiKey,
    baseURL: options.baseURL,
    fileUploadPathDenySegments: options.fileUploadPathDenySegments,
    provider: options.provider,
    sensitiveFileUploadProtection: options.sensitiveFileUploadProtection,
    toolkitVersions: options.toolkitVersions,
  });

  return new Composio(
    config as ConstructorParameters<typeof Composio>[0]
  ) as unknown as ComposioLike;
}

export function createComposioConnectorAdapter(
  options: CreateComposioConnectorAdapterOptions = {}
): ConnectorAdapter {
  const client = options.client ?? createComposioClient(options);

  return {
    async createSession(input) {
      const parsed = connectorSessionCreateOptionsSchema.parse({
        provider: "composio",
        ...input,
      });
      const session = await client.create(parsed.userId, toComposioSessionOptions(parsed));

      return toSessionRef(session, parsed);
    },

    async useSession(input) {
      const parsed = connectorSessionLocatorSchema.parse({
        provider: "composio",
        ...input,
      });
      const session = await resolveSession(client, parsed);

      return toSessionRef(session, parsed);
    },

    async listToolkits(input) {
      const parsed = connectorListToolkitsRequestSchema.parse({
        provider: "composio",
        ...input,
      });
      const session = await resolveSession(client, parsed);
      const result = await session.toolkits(
        stripUndefined({
          cursor: parsed.cursor,
          isConnected: parsed.isConnected,
          limit: parsed.limit,
          search: parsed.search,
          toolkits: parsed.toolkitSlugs,
        })
      );

      return connectorToolkitListResultSchema.parse({
        items: getItems(result).map(toToolkit),
        cursor: getCursor(result),
      });
    },

    async listActions(input) {
      const parsed = connectorListActionsRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (parsed.sessionId && parsed.query) {
        const session = await client.use(parsed.sessionId);
        const result = await session.search?.({
          query: parsed.query,
          toolkits: parsed.toolkits,
        });

        return connectorActionListResultSchema.parse({
          items: getItems(result).map(toAction),
          cursor: getCursor(result),
        });
      }

      if (client.tools.getRawComposioTools) {
        const result = await client.tools.getRawComposioTools(
          stripUndefined({
            cursor: parsed.cursor,
            limit: parsed.limit,
            search: parsed.query,
            toolkits: parsed.toolkits,
            tools: parsed.tools,
          })
        );

        return connectorActionListResultSchema.parse({
          items: getItems(result).map(toAction),
          cursor: getCursor(result),
        });
      }

      if (!parsed.userId || !client.tools.get) {
        throw new Error(
          "Composio action listing requires getRawComposioTools or a userId fallback."
        );
      }

      const result = await client.tools.get(
        parsed.userId,
        stripUndefined({
          limit: parsed.limit,
          toolkits: parsed.toolkits,
          tools: parsed.tools,
        })
      );

      return connectorActionListResultSchema.parse({
        items: getItems(result).map(toAction),
        cursor: getCursor(result),
      });
    },

    async getAction(input) {
      const parsed = connectorGetActionRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (!client.tools.getRawComposioToolBySlug) {
        throw new Error("Composio raw tool schema lookup is unavailable.");
      }

      return toAction(await client.tools.getRawComposioToolBySlug(parsed.slug));
    },

    async authorize(input) {
      const parsed = connectorAuthorizationRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (parsed.authConfigId) {
        if (!client.connectedAccounts.link) {
          throw new Error("Composio connected account link is unavailable.");
        }

        const result = await client.connectedAccounts.link(
          parsed.userId,
          parsed.authConfigId,
          stripUndefined({
            callbackUrl: parsed.callbackUrl,
          })
        );

        return toAuthorizationResult(result, parsed);
      }

      if (!parsed.toolkitSlug) {
        throw new Error("Composio authorize requires toolkitSlug or authConfigId.");
      }

      const session = parsed.sessionId
        ? await client.use(parsed.sessionId)
        : await client.create(parsed.userId);
      const result = await session.authorize(
        parsed.toolkitSlug,
        stripUndefined({
          alias: parsed.alias,
          callbackUrl: parsed.callbackUrl,
        })
      );

      return toAuthorizationResult(result, parsed);
    },

    async listConnections(input) {
      const parsed = connectorListConnectionsRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (!client.connectedAccounts.list) {
        throw new Error("Composio connected account listing is unavailable.");
      }

      const result = await client.connectedAccounts.list(
        stripUndefined({
          authConfigIds: parsed.authConfigIds,
          cursor: parsed.cursor,
          limit: parsed.limit,
          statuses: parsed.statuses,
          toolkitSlugs: parsed.toolkitSlugs,
          userIds: parsed.userIds,
        })
      );

      return connectorConnectionListResultSchema.parse({
        items: getItems(result).map(toConnection),
        cursor: getCursor(result),
      });
    },

    async waitForConnection(input) {
      const parsed = connectorWaitForConnectionRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (client.connectedAccounts.waitForConnection) {
        return toConnection(
          await client.connectedAccounts.waitForConnection(
            parsed.connectedAccountId,
            parsed.timeoutMs
          )
        );
      }

      if (!client.connectedAccounts.get) {
        throw new Error("Composio connected account wait/get is unavailable.");
      }

      return toConnection(await client.connectedAccounts.get(parsed.connectedAccountId));
    },

    async execute(input) {
      const parsed = connectorExecuteRequestSchema.parse({
        provider: "composio",
        ...input,
      });
      const startedAt = new Date();

      try {
        const raw =
          parsed.mode === "session"
            ? await executeInSession(client, parsed)
            : await executeDirect(client, parsed);

        return toExecutionResult(raw, parsed, startedAt, new Date());
      } catch (error) {
        return connectorExecutionResultSchema.parse({
          provider: "composio",
          mode: parsed.mode,
          toolSlug: parsed.toolSlug,
          success: false,
          error: errorMessage(error),
          startedAt,
          endedAt: new Date(),
        });
      }
    },

    async createTrigger(input) {
      const parsed = connectorCreateTriggerRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (!client.triggers.create) {
        throw new Error("Composio trigger creation is unavailable.");
      }

      const result = await client.triggers.create(
        parsed.userId,
        parsed.triggerSlug,
        stripUndefined({
          connectedAccountId: parsed.connectedAccountId,
          triggerConfig: parsed.config,
        })
      );

      return toTrigger(result, {
        triggerSlug: parsed.triggerSlug,
        userId: parsed.userId,
        connectedAccountId: parsed.connectedAccountId,
      });
    },

    async listTriggers(input) {
      const parsed = connectorListTriggersRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (!client.triggers.listActive) {
        throw new Error("Composio trigger listing is unavailable.");
      }

      const result = await client.triggers.listActive(
        stripUndefined({
          authConfigIds: parsed.authConfigIds,
          connectedAccountIds: parsed.connectedAccountIds,
          cursor: parsed.cursor,
          limit: parsed.limit,
          showDisabled: parsed.showDisabled,
          triggerIds: parsed.triggerIds,
          triggerNames: parsed.triggerSlugs,
        })
      );

      return connectorTriggerListResultSchema.parse({
        items: getItems(result).map((item) => toTrigger(item)),
        cursor: getCursor(result),
      });
    },

    async enableTrigger(input) {
      const parsed = connectorTriggerMutationRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (!client.triggers.enable) {
        throw new Error("Composio trigger enable is unavailable.");
      }

      return toTrigger(await client.triggers.enable(parsed.triggerId), {
        triggerId: parsed.triggerId,
        status: "enabled",
      });
    },

    async disableTrigger(input) {
      const parsed = connectorTriggerMutationRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (!client.triggers.disable) {
        throw new Error("Composio trigger disable is unavailable.");
      }

      return toTrigger(await client.triggers.disable(parsed.triggerId), {
        triggerId: parsed.triggerId,
        status: "disabled",
      });
    },

    async deleteTrigger(input) {
      const parsed = connectorTriggerMutationRequestSchema.parse({
        provider: "composio",
        ...input,
      });

      if (!client.triggers.delete) {
        throw new Error("Composio trigger delete is unavailable.");
      }

      await client.triggers.delete(parsed.triggerId);
    },

    normalizeEvent(input) {
      return normalizeComposioEvent(input);
    },
  };
}

async function resolveSession(
  client: ComposioLike,
  locator: {
    sessionId?: string;
    userId?: string;
    toolkits?: unknown;
    authConfigs?: Record<string, string>;
    connectedAccounts?: Record<string, string | string[]>;
    manageConnections?: unknown;
    workbench?: unknown;
  }
) {
  if (locator.sessionId) {
    return client.use(locator.sessionId);
  }

  if (!locator.userId) {
    throw new Error("Composio session resolution requires userId or sessionId.");
  }

  return client.create(locator.userId, toComposioSessionOptions(locator));
}

function toComposioSessionOptions(input: {
  authConfigs?: Record<string, string>;
  connectedAccounts?: Record<string, string | string[]>;
  manageConnections?: unknown;
  preload?: unknown;
  toolkits?: unknown;
  tools?: string[];
  workbench?: unknown;
}) {
  return stripUndefined({
    authConfigs: input.authConfigs,
    connectedAccounts: input.connectedAccounts,
    manageConnections: input.manageConnections,
    preload: input.preload,
    toolkits: input.toolkits,
    tools: input.tools,
    workbench: input.workbench,
  });
}

function toSessionRef(
  session: ComposioSessionLike,
  input: {
    userId?: string;
    workflowId?: string;
    runId?: string;
    metadata?: Record<string, unknown>;
  }
): ConnectorSessionRef {
  const sessionId = session.sessionId ?? session.session_id ?? session.id;
  const headers = normalizeHeaders(session.mcp?.headers);

  if (!sessionId) {
    throw new Error("Composio session did not include a sessionId.");
  }

  return connectorSessionRefSchema.parse({
    provider: "composio",
    sessionId,
    userId: input.userId,
    workflowId: input.workflowId,
    runId: input.runId,
    mcp: session.mcp?.url
      ? {
          url: session.mcp.url,
          headers,
        }
      : undefined,
    metadata: input.metadata,
  });
}

function toAuthorizationResult(
  input: ComposioConnectionRequestLike,
  request: {
    userId: string;
    toolkitSlug?: string;
    authConfigId?: string;
  }
) {
  const record = asRecord(input);
  const redirectUrl = readString(record, ["redirectUrl", "redirect_url"]);

  if (!redirectUrl) {
    throw new Error("Composio authorization did not return a redirectUrl.");
  }

  return connectorAuthorizationResultSchema.parse({
    provider: "composio",
    id: readString(record, ["id"]),
    userId: request.userId,
    toolkitSlug: request.toolkitSlug,
    authConfigId: request.authConfigId,
    redirectUrl,
    connectedAccountId: readString(record, ["connectedAccountId", "connected_account_id", "id"]),
    raw: input,
  });
}

function toToolkit(input: unknown): ConnectorToolkit {
  const record = asRecord(input);
  const connection = readNestedRecord(record, ["connection"]);
  const connectedAccount = readNestedRecord(connection, ["connectedAccount", "connected_account"]);
  const slug =
    readString(record, ["slug", "toolkitSlug", "toolkit_slug"]) ??
    readString(connectedAccount, ["toolkitSlug", "toolkit_slug"]) ??
    "unknown";

  return connectorToolkitSchema.parse({
    provider: "composio",
    slug,
    name: readString(record, ["name"]) ?? slug,
    logoUrl: readString(record, ["logo", "logoUrl", "logo_url"]),
    authState: toAuthState(connection, connectedAccount),
    connectedAccountId:
      readString(connection, ["connectedAccountId", "connected_account_id"]) ??
      readString(connectedAccount, ["id", "nanoid", "nanoId"]),
    raw: input,
  });
}

function toAction(input: unknown): ConnectorAction {
  const record = asRecord(input);
  const toolkit = readNestedRecord(record, ["toolkit"]);
  const slug = readString(record, ["slug", "name"]) ?? "unknown";
  const toolkitSlug =
    readString(record, ["toolkitSlug", "toolkit_slug"]) ?? readString(toolkit, ["slug", "name"]);

  return connectorActionSchema.parse({
    provider: "composio",
    slug,
    toolkitSlug,
    name: readString(record, ["displayName", "display_name", "name"]) ?? slug,
    description: readString(record, ["description"]),
    inputSchema:
      record.inputParameters ??
      record.input_parameters ??
      record.inputSchema ??
      record.input_schema,
    outputSchema:
      record.outputParameters ??
      record.output_parameters ??
      record.outputSchema ??
      record.output_schema,
    raw: input,
  });
}

function toConnection(input: unknown): ConnectorConnection {
  const record = asRecord(input);
  const toolkit = readNestedRecord(record, ["toolkit"]);
  const id = readString(record, ["id", "nanoid", "nanoId"]);
  const status = readString(record, ["status"]);

  if (!id) {
    throw new Error("Composio connected account did not include an id.");
  }

  return connectorConnectionSchema.parse({
    provider: "composio",
    id,
    userId: readString(record, ["userId", "user_id"]),
    toolkitSlug:
      readString(record, ["toolkitSlug", "toolkit_slug"]) ?? readString(toolkit, ["slug", "name"]),
    authConfigId: readString(record, ["authConfigId", "auth_config_id"]),
    status: toAuthState(record),
    isActive:
      readBoolean(record, ["isActive", "is_active", "active"]) ??
      status?.toUpperCase() === "ACTIVE",
    raw: input,
  });
}

async function executeInSession(
  client: ComposioLike,
  request: ReturnType<typeof connectorExecuteRequestSchema.parse>
) {
  const session = request.sessionId
    ? await client.use(request.sessionId)
    : await client.create(request.userId);

  if (!session.execute) {
    throw new Error("Composio session execution is unavailable.");
  }

  return session.execute(request.toolSlug, request.arguments);
}

async function executeDirect(
  client: ComposioLike,
  request: ReturnType<typeof connectorExecuteRequestSchema.parse>
) {
  if (!client.tools.execute) {
    throw new Error("Composio direct execution is unavailable.");
  }

  return client.tools.execute(
    request.toolSlug,
    stripUndefined({
      arguments: request.arguments,
      connectedAccountId: request.connectedAccountId,
      dangerouslySkipVersionCheck: request.dangerouslySkipVersionCheck,
      userId: request.userId,
      version: request.version,
    })
  );
}

function toExecutionResult(
  input: unknown,
  request: ReturnType<typeof connectorExecuteRequestSchema.parse>,
  startedAt: Date,
  endedAt: Date
): ConnectorExecutionResult {
  const record = asRecord(input);
  const error = readString(record, ["error"]);

  return connectorExecutionResultSchema.parse({
    provider: "composio",
    mode: request.mode,
    toolSlug: request.toolSlug,
    success: !error,
    output: record.data ?? record.output ?? input,
    error,
    logId: readString(record, ["logId", "log_id"]),
    startedAt,
    endedAt,
    raw: input,
    metadata: request.metadata,
  });
}

function toTrigger(
  input: unknown,
  fallback: {
    connectedAccountId?: string;
    status?: "enabled" | "disabled";
    triggerId?: string;
    triggerSlug?: string;
    userId?: string;
  } = {}
): ConnectorTriggerRef {
  const record = asRecord(input);
  const id = readString(record, ["id", "triggerId", "trigger_id"]) ?? fallback.triggerId;
  const disabledAt = readString(record, ["disabledAt", "disabled_at"]);

  if (!id) {
    throw new Error("Composio trigger did not include a trigger id.");
  }

  return connectorTriggerRefSchema.parse({
    provider: "composio",
    id,
    triggerSlug:
      readString(record, ["triggerSlug", "trigger_slug", "triggerName"]) ??
      fallback.triggerSlug ??
      id,
    userId: readString(record, ["userId", "user_id"]) ?? fallback.userId,
    connectedAccountId:
      readString(record, ["connectedAccountId", "connected_account_id"]) ??
      fallback.connectedAccountId,
    status: fallback.status ?? (disabledAt ? "disabled" : "enabled"),
    raw: input,
  });
}

function toAuthState(...records: Array<Record<string, unknown>>): ConnectorAuthState {
  for (const record of records) {
    const active = readBoolean(record, ["isActive", "is_active", "active"]);

    if (active) {
      return "connected";
    }

    const disabled = readBoolean(record, ["isDisabled", "is_disabled", "disabled"]);

    if (disabled) {
      return "disabled";
    }

    const status = readString(record, ["status", "state"])?.toLowerCase();

    if (!status) {
      continue;
    }

    if (["active", "connected"].includes(status)) {
      return "connected";
    }

    if (["inactive", "disabled"].includes(status)) {
      return "disabled";
    }

    if (["expired"].includes(status)) {
      return "expired";
    }

    if (["failed", "error"].includes(status)) {
      return "failed";
    }

    if (["initiated", "pending", "processing"].includes(status)) {
      return "pending";
    }
  }

  return "unknown";
}

function normalizeHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => {
      const [, value] = entry;
      return typeof value === "string";
    })
  );
}

function stripUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as {
    [K in keyof T as undefined extends T[K] ? K : K]: Exclude<T[K], undefined>;
  };
}
