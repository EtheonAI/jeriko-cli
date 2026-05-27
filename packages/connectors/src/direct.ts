import type { ConnectorAdapter } from "./contracts.js";

export class DirectConnectorUnsupportedOperationError extends Error {
  constructor(operation: keyof ConnectorAdapter) {
    super(`Direct connector operation is not implemented: ${operation}`);
    this.name = "DirectConnectorUnsupportedOperationError";
  }
}

export type DirectConnectorAdapterHandlers = Partial<ConnectorAdapter> &
  Pick<ConnectorAdapter, "execute" | "normalizeEvent">;

export function createDirectConnectorAdapter(
  handlers: DirectConnectorAdapterHandlers
): ConnectorAdapter {
  return {
    createSession: handlers.createSession ?? unsupported("createSession"),
    useSession: handlers.useSession ?? unsupported("useSession"),
    listToolkits: handlers.listToolkits ?? unsupported("listToolkits"),
    listActions: handlers.listActions ?? unsupported("listActions"),
    getAction: handlers.getAction ?? unsupported("getAction"),
    authorize: handlers.authorize ?? unsupported("authorize"),
    listConnections: handlers.listConnections ?? unsupported("listConnections"),
    waitForConnection: handlers.waitForConnection ?? unsupported("waitForConnection"),
    execute: handlers.execute,
    createTrigger: handlers.createTrigger ?? unsupported("createTrigger"),
    listTriggers: handlers.listTriggers ?? unsupported("listTriggers"),
    enableTrigger: handlers.enableTrigger ?? unsupported("enableTrigger"),
    disableTrigger: handlers.disableTrigger ?? unsupported("disableTrigger"),
    deleteTrigger: handlers.deleteTrigger ?? unsupported("deleteTrigger"),
    normalizeEvent: handlers.normalizeEvent,
  };
}

function unsupported<T extends keyof ConnectorAdapter>(operation: T): ConnectorAdapter[T] {
  return (() => {
    throw new DirectConnectorUnsupportedOperationError(operation);
  }) as ConnectorAdapter[T];
}
