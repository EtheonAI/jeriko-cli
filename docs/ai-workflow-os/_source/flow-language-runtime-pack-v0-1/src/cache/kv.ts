export interface KV {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, options?: { ttlSeconds?: number }): Promise<number>;
}

/**
 * In-memory KV for tests/local dev.
 * Production should use Redis/Upstash/Vercel KV-compatible store.
 */
export class MemoryKV implements KV {
  private store = new Map<string, { value: unknown; expiresAt?: number }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt && hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value as T;
  }

  async set<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: options?.ttlSeconds ? Date.now() + options.ttlSeconds * 1000 : undefined,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async incr(key: string, options?: { ttlSeconds?: number }): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    await this.set(key, next, options);
    return next;
  }
}

export const kv = new MemoryKV();

export const KVKeys = {
  compiledFlow: (workflowVersionId: string) => `compiled:${workflowVersionId}`,
  toolManifest: (toolName: string) => `tool:${toolName}`,
  workerRegistry: (orgId: string) => `workers:${orgId}`,
  eventDedupe: (source: string, id: string) => `event-dedupe:${source}:${id}`,
  rate: (orgId: string, source: string, minute: string) => `rate:${orgId}:${source}:${minute}`,
};
