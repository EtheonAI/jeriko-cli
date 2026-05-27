/**
 * E2B Adapter Factory
 *
 * Creates the appropriate adapter implementation based on feature flags.
 * Allows runtime switching between different sandbox providers.
 */

import type { IE2BAdapter, SandboxConfig } from "./e2b-adapter.interface.js";
import { E2BSdkAdapter } from "./e2b-sdk-adapter.js";

export interface AdapterFactoryConfig {
  enableE2BAdapter?: boolean;
  sandboxConfig: SandboxConfig;
}

export class E2BAdapterFactory {
  /**
   * Create adapter instance based on feature flags
   */
  static create(config: AdapterFactoryConfig): IE2BAdapter {
    // Feature flag check - default to E2B SDK for now
    if (config.enableE2BAdapter !== false) {
      return new E2BSdkAdapter();
    }

    // Fallback to default implementation
    return new E2BSdkAdapter();
  }

  /**
   * Create adapter with explicit implementation
   */
  static createExplicit(adapterType: "e2b-sdk"): IE2BAdapter {
    switch (adapterType) {
      case "e2b-sdk":
        return new E2BSdkAdapter();
      default:
        throw new Error(`Unknown adapter type: ${adapterType}`);
    }
  }
}
