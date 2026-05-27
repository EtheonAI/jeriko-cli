/**
 * Typed Event Bus — Redis-backed pub/sub with structured events.
 *
 * Provides type-safe publish/subscribe for inter-service communication.
 * Events are automatically serialized/deserialized with metadata (timestamp, source, correlationId).
 *
 * Usage:
 * ```ts
 * const bus = createEventBus("my-service");
 *
 * // Publish
 * await bus.publish("file.uploaded", { fileId: "123", userId: "456" });
 *
 * // Subscribe
 * bus.subscribe("file.uploaded", async (event) => {
 *   console.log(event.data.fileId); // typed!
 * });
 * ```
 */

import { publish as redisPublish, subscribe as redisSubscribe } from "../redis/index.js";
import { createLogger } from "../logger/index.js";

const logger = createLogger({ service: "event-bus" });

/** Event envelope wrapping every published event */
export interface ServiceEvent<T = unknown> {
  /** Unique event ID */
  id: string;
  /** Event type (e.g., "file.uploaded", "project.created") */
  type: string;
  /** Service that published the event */
  source: string;
  /** ISO timestamp */
  timestamp: string;
  /** Correlation ID for distributed tracing */
  correlationId?: string;
  /** Event payload */
  data: T;
}

/** Event handler function */
export type EventHandler<T = unknown> = (event: ServiceEvent<T>) => Promise<void> | void;

/** Known event types for type safety */
export interface EventMap {
  // File events
  "file.uploaded": { fileId: string; userId: string; name: string; size: number };
  "file.deleted": { fileId: string; userId: string };
  "file.versioned": { fileId: string; userId: string; version: number };

  // Project events
  "project.created": { projectId: string; userId: string; name: string };
  "project.updated": { projectId: string; userId: string; changes: Record<string, unknown> };
  "project.deleted": { projectId: string; userId: string };

  // Session events
  "session.created": { sessionId: string; userId: string };
  "session.completed": { sessionId: string; userId: string };

  // Task events
  "task.created": { taskId: string; userId: string; prompt: string };
  "task.completed": { taskId: string; userId: string; status: string };
  "task.failed": { taskId: string; userId: string; error: string };

  // Device events
  "device.connected": { deviceId: string; userId: string };
  "device.disconnected": { deviceId: string; userId: string };
  "device.command": { deviceId: string; userId: string; command: string };

  // Connector events
  "connector.connected": { connectorId: string; userId: string; provider: string };
  "connector.disconnected": { connectorId: string; userId: string; provider: string };
  "connector.synced": { connectorId: string; userId: string; itemCount: number };

  // Billing events
  "billing.subscribed": { userId: string; planId: string };
  "billing.cancelled": { userId: string; planId: string };
  "billing.credits.purchased": { userId: string; amount: number };
  "billing.credits.used": { userId: string; amount: number; type: string };

  // Notification events
  "notification.sent": { notificationId: string; userId: string; channel: string };

  // Generic fallback
  [key: string]: Record<string, unknown>;
}

const EVENT_CHANNEL_PREFIX = "jeriko:events:";

export interface EventBus {
  /** Publish a typed event */
  publish<K extends keyof EventMap>(
    type: K,
    data: EventMap[K],
    correlationId?: string,
  ): Promise<void>;

  /** Subscribe to a typed event */
  subscribe<K extends keyof EventMap>(
    type: K,
    handler: EventHandler<EventMap[K]>,
  ): () => void;

  /** Subscribe to all events matching a pattern prefix */
  subscribeAll(
    handler: EventHandler,
  ): () => void;
}

/**
 * Create an event bus instance for a service.
 * Uses Redis pub/sub for cross-service communication.
 */
export function createEventBus(serviceName: string): EventBus {
  const allHandlers = new Set<EventHandler>();

  return {
    async publish<K extends keyof EventMap>(
      type: K,
      data: EventMap[K],
      correlationId?: string,
    ): Promise<void> {
      const event: ServiceEvent<EventMap[K]> = {
        id: crypto.randomUUID(),
        type: type as string,
        source: serviceName,
        timestamp: new Date().toISOString(),
        correlationId,
        data,
      };

      try {
        await redisPublish(`${EVENT_CHANNEL_PREFIX}${type as string}`, event);
        logger.debug({ eventType: type, eventId: event.id }, "Event published");
      } catch (err) {
        logger.error({ eventType: type, eventId: event.id, error: err }, "Failed to publish event");
      }
    },

    subscribe<K extends keyof EventMap>(
      type: K,
      handler: EventHandler<EventMap[K]>,
    ): () => void {
      const channel = `${EVENT_CHANNEL_PREFIX}${type as string}`;

      const wrappedHandler = (message: unknown) => {
        const event = message as ServiceEvent<EventMap[K]>;
        try {
          handler(event);
        } catch (err) {
          logger.error(
            { eventType: type, eventId: event?.id, error: err },
            "Event handler error",
          );
        }

        // Also notify "all" handlers
        for (const allHandler of allHandlers) {
          try {
            allHandler(event as ServiceEvent);
          } catch {
            // Don't break other handlers
          }
        }
      };

      return redisSubscribe(channel, wrappedHandler);
    },

    subscribeAll(handler: EventHandler): () => void {
      allHandlers.add(handler);
      return () => { allHandlers.delete(handler); };
    },
  };
}
