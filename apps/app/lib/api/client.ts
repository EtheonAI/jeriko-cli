/**
 * API Client for communicating with backend services via the gateway
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";

export interface ApiResponse<T> {
  data: T | null;
  meta: {
    requestId: string;
    timestamp: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
}

class ApiClient {
  private baseUrl: string;
  private defaultTimeout: number = 30000;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { timeout = this.defaultTimeout, ...fetchOptions } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...fetchOptions.headers,
        },
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        return {
          data: null,
          meta: data.meta || { requestId: "", timestamp: new Date().toISOString() },
          error: data.error || { code: "REQUEST_FAILED", message: response.statusText },
        };
      }

      return {
        data: data.data ?? data,
        meta: data.meta || { requestId: "", timestamp: new Date().toISOString() },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return {
          data: null,
          meta: { requestId: "", timestamp: new Date().toISOString() },
          error: { code: "TIMEOUT", message: "Request timed out" },
        };
      }

      return {
        data: null,
        meta: { requestId: "", timestamp: new Date().toISOString() },
        error: {
          code: "NETWORK_ERROR",
          message: error instanceof Error ? error.message : "Network error",
        },
      };
    }
  }

  // Health check
  async health() {
    return this.request<{ status: string }>("/health");
  }

  // Projects
  async listProjects(userId: string) {
    return this.request<{ projects: unknown[] }>(`/v1/projects?userId=${userId}`);
  }

  async createProject(data: { name: string; description?: string; userId: string }) {
    return this.request<{ id: string; name: string }>("/v1/projects", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getProject(projectId: string) {
    return this.request<unknown>(`/v1/projects/${projectId}`);
  }

  // Agent Sessions
  async createSession(data: { userId: string; projectId?: string }) {
    return this.request<{ sessionId: string }>("/v1/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async sendMessage(sessionId: string, data: { content: string; attachments?: unknown[] }) {
    return this.request<{ messageId: string }>(`/v1/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getSessionMessages(sessionId: string, cursor?: string) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    return this.request<{ messages: unknown[]; cursor: string | null }>(
      `/v1/sessions/${sessionId}/messages?${params}`
    );
  }

  // Files
  async uploadFile(file: File, projectId?: string) {
    const formData = new FormData();
    formData.append("file", file);
    if (projectId) formData.append("projectId", projectId);

    return this.request<{ id: string; url: string }>("/v1/files/upload", {
      method: "POST",
      body: formData,
      headers: {}, // Let browser set Content-Type for FormData
    });
  }

  async getFile(fileId: string) {
    return this.request<{ id: string; url: string; name: string }>(`/v1/files/${fileId}`);
  }

  // Knowledge
  async queryKnowledge(data: { query: string; groupIds?: string[]; userId: string }) {
    return this.request<{ results: unknown[] }>("/v1/knowledge/query", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Search
  async search(data: { query: string; types?: string[]; userId: string }) {
    return this.request<{ results: unknown[]; total: number }>("/v1/search", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Billing
  async getCredits(userId: string) {
    return this.request<{ balance: number; used: number }>(`/v1/billing/users/${userId}/credits`);
  }

  // Notifications
  async getNotifications(userId: string, cursor?: string) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    return this.request<{ notifications: unknown[]; cursor: string | null }>(
      `/v1/notifications/users/${userId}?${params}`
    );
  }
}

export const apiClient = new ApiClient(API_URL);
export default apiClient;
