/**
 * Connector Adapter Factory
 *
 * Creates the appropriate adapter implementation based on feature flags.
 * Allows runtime switching between different connector providers.
 */

import type { IConnectorAdapter, ConnectorConfig } from "./connector-adapter.interface.js";
import { ComposioAdapter } from "./composio-adapter.js";

export interface AdapterFactoryConfig {
  enableComposioAdapter?: boolean;
  connectorConfig: ConnectorConfig;
}

export class ConnectorAdapterFactory {
  /**
   * Create adapter instance based on feature flags
   */
  static create(config: AdapterFactoryConfig): IConnectorAdapter {
    // Feature flag check - default to Composio for now
    if (config.enableComposioAdapter !== false) {
      return new ComposioAdapter(config.connectorConfig);
    }

    // Fallback to default implementation
    return new ComposioAdapter(config.connectorConfig);
  }

  /**
   * Create adapter with explicit implementation
   */
  static createExplicit(adapterType: "composio", config: ConnectorConfig): IConnectorAdapter {
    switch (adapterType) {
      case "composio":
        return new ComposioAdapter(config);
      default:
        throw new Error(`Unknown adapter type: ${adapterType}`);
    }
  }
}
