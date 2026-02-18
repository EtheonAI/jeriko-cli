"use client";

import { useCallback, useRef, useState } from "react";
import { getTrpcClient } from "@/lib/trpc/vanilla";

/**
 * useWebhooksData — Webhooks are settings-only (no Redux slice needed).
 * Local state is sufficient since webhooks are only viewed in the integrations tab.
 */

interface Webhook {
  id: string;
  url: string;
  description?: string;
  events: string[];
  isActive: boolean;
  secret?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: string;
  status: "success" | "failed" | "pending";
  statusCode?: number;
  requestBody?: string;
  responseBody?: string;
  attemptCount: number;
  createdAt: string;
}

export function useWebhooksData() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchWebhooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTrpcClient().webhooks.list.query();
      setWebhooks((Array.isArray(data) ? data : (data as any)?.items ?? []) as Webhook[]);
      hasFetchedRef.current = true;
    } catch (err: any) {
      setError(err?.message || "Failed to load webhooks");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEventTypes = useCallback(async () => {
    try {
      const types = await getTrpcClient().webhooks.getEventTypes.query();
      if (Array.isArray(types)) setEventTypes(types as string[]);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchDeliveries = useCallback(async (webhookId: string) => {
    try {
      const data = await getTrpcClient().webhooks.getDeliveries.query({ webhookId });
      setDeliveries((Array.isArray(data) ? data : (data as any)?.items ?? []) as WebhookDelivery[]);
    } catch {
      // Non-critical
    }
  }, []);

  const createWebhook = useCallback(
    async (params: { url: string; events: string[]; description?: string }) => {
      const result = await getTrpcClient().webhooks.create.mutate(params as any);
      await fetchWebhooks();
      return result;
    },
    [fetchWebhooks]
  );

  const deleteWebhook = useCallback(
    async (id: string) => {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      try {
        await getTrpcClient().webhooks.delete.mutate({ id });
      } catch {
        await fetchWebhooks();
      }
    },
    [fetchWebhooks]
  );

  const testWebhook = useCallback(async (id: string) => {
    return getTrpcClient().webhooks.test.mutate({ id });
  }, []);

  const retryDelivery = useCallback(async (deliveryId: string) => {
    return getTrpcClient().webhooks.retryDelivery.mutate({ deliveryId });
  }, []);

  const regenerateSecret = useCallback(
    async (id: string) => {
      const result = await getTrpcClient().webhooks.regenerateSecret.mutate({ id });
      await fetchWebhooks();
      return result;
    },
    [fetchWebhooks]
  );

  return {
    webhooks,
    deliveries,
    eventTypes,
    isLoading,
    error,
    fetchWebhooks,
    fetchEventTypes,
    fetchDeliveries,
    createWebhook,
    deleteWebhook,
    testWebhook,
    retryDelivery,
    regenerateSecret,
  };
}
