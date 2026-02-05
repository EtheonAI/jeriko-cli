import { logger } from "./helpers.js";

export interface HAState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HAConfig {
  location_name: string;
  version: string;
  components: string[];
}

export interface HAArea {
  area_id: string;
  name: string;
}

export class HomeAssistantClient {
  private url: string;
  private accessToken: string;

  constructor(url: string, accessToken: string) {
    // Strip trailing slash
    this.url = url.replace(/\/+$/, "");
    this.accessToken = accessToken;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.url}/api${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      logger.error({ status: response.status, path, body: text }, "HA API error");
      throw new Error(`Home Assistant API error: ${response.status} ${text}`);
    }

    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<{ ok: boolean; version?: string }> {
    try {
      const config = await this.getConfig();
      return { ok: true, version: config.version };
    } catch {
      return { ok: false };
    }
  }

  async getStates(): Promise<HAState[]> {
    return this.request<HAState[]>("/states");
  }

  async getConfig(): Promise<HAConfig> {
    return this.request<HAConfig>("/config");
  }

  async getAreas(): Promise<HAArea[]> {
    // HA uses a websocket-based registry for areas, but we can use the template API
    // Fallback: areas come from entity attributes via device registry
    try {
      return this.request<HAArea[]>("/template", {
        method: "POST",
        body: JSON.stringify({
          template: "{{ areas() | list | tojson }}",
        }),
      })
        .then(() => [])
        .catch(() => []);
    } catch {
      return [];
    }
  }

  async getEntityState(entityId: string): Promise<HAState> {
    return this.request<HAState>(`/states/${entityId}`);
  }

  async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<HAState[]> {
    return this.request<HAState[]>(`/services/${domain}/${service}`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  }
}
