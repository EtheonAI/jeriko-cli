import {
  type ConnectorAction,
  type ConnectorAdapter,
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
  connectorEventSchema,
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

export type MockConnectorExecuteHandler = (input: {
  request: ReturnType<typeof connectorExecuteRequestSchema.parse>;
  session?: ConnectorSessionRef;
  action?: ConnectorAction;
  connections: ConnectorConnection[];
}) => Promise<
  | Partial<
      Pick<ConnectorExecutionResult, "success" | "output" | "error" | "logId" | "raw" | "metadata">
    >
  | unknown
>;

export type MockConnectorAdapterOptions = {
  actions?: ConnectorAction[];
  connections?: ConnectorConnection[];
  executeHandler?: MockConnectorExecuteHandler;
  idFactory?: (kind: "connection" | "session" | "trigger") => string;
  now?: () => Date;
  toolkits?: ConnectorToolkit[];
  triggers?: ConnectorTriggerRef[];
};

export function createMockConnectorAdapter(
  options: MockConnectorAdapterOptions = {}
): ConnectorAdapter {
  const now = options.now ?? (() => new Date());
  const idFactory =
    options.idFactory ?? ((kind) => `mock-${kind}-${Math.random().toString(36).slice(2, 10)}`);

  const sessions = new Map<string, ConnectorSessionRef>();
  const actions = new Map(
    (options.actions ?? []).map((action) => {
      const parsed = connectorActionSchema.parse({
        ...action,
        provider: "mock",
      });
      return [parsed.slug, parsed] as const;
    })
  );
  const connections = new Map(
    (options.connections ?? []).map((connection) => {
      const parsed = connectorConnectionSchema.parse({
        ...connection,
        provider: "mock",
      });
      return [parsed.id, parsed] as const;
    })
  );
  const triggers = new Map(
    (options.triggers ?? []).map((trigger) => {
      const parsed = connectorTriggerRefSchema.parse({
        ...trigger,
        provider: "mock",
      });
      return [parsed.id, parsed] as const;
    })
  );
  const toolkits = seedToolkits(options.toolkits ?? [], [...actions.values()]);

  const resolveSession = async (input: { sessionId?: string; userId?: string }) => {
    if (input.sessionId) {
      const session = sessions.get(input.sessionId);

      if (!session) {
        throw new Error(`Unknown connector session: ${input.sessionId}`);
      }

      return session;
    }

    if (!input.userId) {
      throw new Error("Mock connector requires sessionId or userId.");
    }

    return connectorSessionRefSchema.parse({
      provider: "mock",
      sessionId: idFactory("session"),
      userId: input.userId,
    });
  };

  return {
    async createSession(input) {
      const parsed = connectorSessionCreateOptionsSchema.parse({
        provider: "mock",
        ...input,
      });
      const session = connectorSessionRefSchema.parse({
        provider: "mock",
        sessionId: idFactory("session"),
        userId: parsed.userId,
        workflowId: parsed.workflowId,
        runId: parsed.runId,
        metadata: parsed.metadata,
      });

      sessions.set(session.sessionId, session);

      return session;
    },

    async useSession(input) {
      const parsed = connectorSessionLocatorSchema.parse({
        provider: "mock",
        ...input,
      });
      const session = await resolveSession(parsed);
      sessions.set(session.sessionId, session);

      return session;
    },

    async listToolkits(input) {
      const parsed = connectorListToolkitsRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      await resolveSession(parsed);

      const filtered = [...toolkits.values()].filter((toolkit) => {
        if (parsed.isConnected && toolkit.authState !== "connected") {
          return false;
        }

        if (parsed.toolkitSlugs && !parsed.toolkitSlugs.includes(toolkit.slug)) {
          return false;
        }

        if (
          parsed.search &&
          !`${toolkit.slug} ${toolkit.name}`.toLowerCase().includes(parsed.search.toLowerCase())
        ) {
          return false;
        }

        return true;
      });

      return connectorToolkitListResultSchema.parse({
        items: filtered.slice(0, parsed.limit ?? filtered.length),
      });
    },

    async listActions(input) {
      const parsed = connectorListActionsRequestSchema.parse({
        provider: "mock",
        ...input,
      });

      const filtered = [...actions.values()].filter((action) => {
        if (parsed.tools && !parsed.tools.includes(action.slug)) {
          return false;
        }

        if (
          parsed.toolkits &&
          (!action.toolkitSlug || !parsed.toolkits.includes(action.toolkitSlug))
        ) {
          return false;
        }

        if (
          parsed.query &&
          !`${action.slug} ${action.name} ${action.description ?? ""}`
            .toLowerCase()
            .includes(parsed.query.toLowerCase())
        ) {
          return false;
        }

        return true;
      });

      return connectorActionListResultSchema.parse({
        items: filtered.slice(0, parsed.limit ?? filtered.length),
      });
    },

    async getAction(input) {
      const parsed = connectorGetActionRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      const action = actions.get(parsed.slug);

      if (!action) {
        throw new Error(`Unknown connector action: ${parsed.slug}`);
      }

      return action;
    },

    async authorize(input) {
      const parsed = connectorAuthorizationRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      const connectionId = idFactory("connection");
      const connection = connectorConnectionSchema.parse({
        provider: "mock",
        id: connectionId,
        userId: parsed.userId,
        toolkitSlug: parsed.toolkitSlug,
        authConfigId: parsed.authConfigId,
        status: "pending",
        isActive: false,
      });

      connections.set(connection.id, connection);

      return connectorAuthorizationResultSchema.parse({
        provider: "mock",
        id: connectionId,
        userId: parsed.userId,
        toolkitSlug: parsed.toolkitSlug,
        authConfigId: parsed.authConfigId,
        redirectUrl: `https://connect.local/${connectionId}`,
        connectedAccountId: connectionId,
      });
    },

    async listConnections(input) {
      const parsed = connectorListConnectionsRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      const filtered = [...connections.values()].filter((connection) => {
        if (parsed.userIds && !connection.userId) {
          return false;
        }

        if (parsed.userIds && connection.userId && !parsed.userIds.includes(connection.userId)) {
          return false;
        }

        if (
          parsed.toolkitSlugs &&
          (!connection.toolkitSlug || !parsed.toolkitSlugs.includes(connection.toolkitSlug))
        ) {
          return false;
        }

        if (
          parsed.authConfigIds &&
          (!connection.authConfigId || !parsed.authConfigIds.includes(connection.authConfigId))
        ) {
          return false;
        }

        if (parsed.statuses && !parsed.statuses.includes(connection.status)) {
          return false;
        }

        return true;
      });

      return connectorConnectionListResultSchema.parse({
        items: filtered.slice(0, parsed.limit ?? filtered.length),
      });
    },

    async waitForConnection(input) {
      const parsed = connectorWaitForConnectionRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      const connection = connections.get(parsed.connectedAccountId);

      if (!connection) {
        throw new Error(`Unknown connector connection: ${parsed.connectedAccountId}`);
      }

      const connected = connectorConnectionSchema.parse({
        ...connection,
        status: "connected",
        isActive: true,
      });

      connections.set(connected.id, connected);

      return connected;
    },

    async execute(input) {
      const parsed = connectorExecuteRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      const startedAt = now();
      const session = await resolveSession(parsed);
      const action = actions.get(parsed.toolSlug);
      const handled = await options.executeHandler?.({
        request: parsed,
        session,
        action,
        connections: [...connections.values()],
      });
      const endedAt = now();

      if (handled && typeof handled === "object" && !Array.isArray(handled)) {
        return connectorExecutionResultSchema.parse({
          provider: "mock",
          mode: parsed.mode,
          toolSlug: parsed.toolSlug,
          success: true,
          startedAt,
          endedAt,
          ...(handled as Partial<ConnectorExecutionResult>),
        });
      }

      return connectorExecutionResultSchema.parse({
        provider: "mock",
        mode: parsed.mode,
        toolSlug: parsed.toolSlug,
        success: true,
        output: handled ?? {
          toolSlug: parsed.toolSlug,
          arguments: parsed.arguments,
        },
        startedAt,
        endedAt,
      });
    },

    async createTrigger(input) {
      const parsed = connectorCreateTriggerRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      const trigger = connectorTriggerRefSchema.parse({
        provider: "mock",
        id: idFactory("trigger"),
        triggerSlug: parsed.triggerSlug,
        userId: parsed.userId,
        connectedAccountId: parsed.connectedAccountId,
        status: "enabled",
        metadata: parsed.metadata,
      });

      triggers.set(trigger.id, trigger);

      return trigger;
    },

    async listTriggers(input) {
      const parsed = connectorListTriggersRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      const filtered = [...triggers.values()].filter((trigger) => {
        if (parsed.triggerIds && !parsed.triggerIds.includes(trigger.id)) {
          return false;
        }

        if (parsed.triggerSlugs && !parsed.triggerSlugs.includes(trigger.triggerSlug)) {
          return false;
        }

        if (
          parsed.connectedAccountIds &&
          (!trigger.connectedAccountId ||
            !parsed.connectedAccountIds.includes(trigger.connectedAccountId))
        ) {
          return false;
        }

        if (!parsed.showDisabled && trigger.status === "disabled") {
          return false;
        }

        return true;
      });

      return connectorTriggerListResultSchema.parse({
        items: filtered.slice(0, parsed.limit ?? filtered.length),
      });
    },

    async enableTrigger(input) {
      const parsed = connectorTriggerMutationRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      return updateTrigger(triggers, parsed.triggerId, "enabled");
    },

    async disableTrigger(input) {
      const parsed = connectorTriggerMutationRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      return updateTrigger(triggers, parsed.triggerId, "disabled");
    },

    async deleteTrigger(input) {
      const parsed = connectorTriggerMutationRequestSchema.parse({
        provider: "mock",
        ...input,
      });
      triggers.delete(parsed.triggerId);
    },

    normalizeEvent(input) {
      const event = normalizeComposioEvent(input);

      return connectorEventSchema.parse({
        ...event,
        provider: "mock",
      });
    },
  };
}

function seedToolkits(
  seeded: ConnectorToolkit[],
  actions: ConnectorAction[]
): Map<string, ConnectorToolkit> {
  const toolkits = new Map(
    seeded.map((toolkit) => {
      const parsed = connectorToolkitSchema.parse({
        ...toolkit,
        provider: "mock",
      });
      return [parsed.slug, parsed] as const;
    })
  );

  for (const action of actions) {
    if (action.toolkitSlug && !toolkits.has(action.toolkitSlug)) {
      toolkits.set(
        action.toolkitSlug,
        connectorToolkitSchema.parse({
          provider: "mock",
          slug: action.toolkitSlug,
          name: action.toolkitSlug,
          authState: "unknown",
        })
      );
    }
  }

  return toolkits;
}

function updateTrigger(
  triggers: Map<string, ConnectorTriggerRef>,
  triggerId: string,
  status: "enabled" | "disabled"
) {
  const trigger = triggers.get(triggerId);

  if (!trigger) {
    throw new Error(`Unknown connector trigger: ${triggerId}`);
  }

  const updated = connectorTriggerRefSchema.parse({
    ...trigger,
    status,
  });

  triggers.set(triggerId, updated);

  return updated;
}
