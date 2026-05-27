/**
 * Prometheus Metrics for Service Monitoring
 * Provides HTTP request metrics, custom business metrics, and health indicators
 */

import type { FastifyInstance } from "fastify";

// Metric types
export interface Counter {
  inc(labels?: Record<string, string>, value?: number): void;
}

export interface Gauge {
  set(labels: Record<string, string>, value: number): void;
  inc(labels?: Record<string, string>, value?: number): void;
  dec(labels?: Record<string, string>, value?: number): void;
}

export interface Histogram {
  observe(labels: Record<string, string>, value: number): void;
  startTimer(labels?: Record<string, string>): () => number;
}

export interface Summary {
  observe(labels: Record<string, string>, value: number): void;
}

/**
 * In-memory metrics store with bounded histogram aggregation.
 * Histograms track count+sum (not individual observations) to prevent unbounded memory growth.
 * For production with Prometheus scraping, use prom-client instead.
 */
class MetricsStore {
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  // Histograms store { count, sum } aggregates — NOT individual observations
  private histograms: Map<string, Map<string, { count: number; sum: number }>> = new Map();

  private getKey(labels: Record<string, string>): string {
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
  }

  incCounter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Map());
    }
    const key = this.getKey(labels);
    const current = this.counters.get(name)!.get(key) || 0;
    this.counters.get(name)!.set(key, current + value);
  }

  setGauge(name: string, labels: Record<string, string>, value: number): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Map());
    }
    const key = this.getKey(labels);
    this.gauges.get(name)!.set(key, value);
  }

  observeHistogram(name: string, labels: Record<string, string>, value: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Map());
    }
    const key = this.getKey(labels);
    const existing = this.histograms.get(name)!.get(key);
    if (existing) {
      existing.count++;
      existing.sum += value;
    } else {
      this.histograms.get(name)!.set(key, { count: 1, sum: value });
    }
  }

  toPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, values] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      for (const [labels, value] of values) {
        const labelStr = labels ? `{${labels}}` : "";
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Gauges
    for (const [name, values] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      for (const [labels, value] of values) {
        const labelStr = labels ? `{${labels}}` : "";
        lines.push(`${name}${labelStr} ${value}`);
      }
    }

    // Histograms (count + sum aggregates)
    for (const [name, values] of this.histograms) {
      lines.push(`# TYPE ${name} histogram`);
      for (const [labels, agg] of values) {
        const labelStr = labels ? `{${labels}}` : "";
        lines.push(`${name}_count${labelStr} ${agg.count}`);
        lines.push(`${name}_sum${labelStr} ${agg.sum}`);
      }
    }

    return lines.join("\n");
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
}

// Global metrics store
const metricsStore = new MetricsStore();

// Metric factory
export interface MetricsConfig {
  serviceName: string;
  defaultLabels?: Record<string, string>;
}

export class Metrics {
  private defaultLabels: Record<string, string>;

  constructor(config: MetricsConfig) {
    this.defaultLabels = {
      service: config.serviceName,
      ...config.defaultLabels,
    };
  }

  // HTTP request metrics
  httpRequestsTotal(method: string, path: string, status: number): void {
    metricsStore.incCounter("http_requests_total", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path),
      status: String(status),
    });
  }

  httpRequestDuration(method: string, path: string, durationMs: number): void {
    metricsStore.observeHistogram("http_request_duration_seconds", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path),
    }, durationMs / 1000);
  }

  httpRequestSize(method: string, path: string, bytes: number): void {
    metricsStore.observeHistogram("http_request_size_bytes", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path),
    }, bytes);
  }

  httpResponseSize(method: string, path: string, bytes: number): void {
    metricsStore.observeHistogram("http_response_size_bytes", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path),
    }, bytes);
  }

  // Custom business metrics
  counter(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    metricsStore.incCounter(name, { ...this.defaultLabels, ...labels }, value);
  }

  gauge(name: string, labels: Record<string, string>, value: number): void {
    metricsStore.setGauge(name, { ...this.defaultLabels, ...labels }, value);
  }

  histogram(name: string, labels: Record<string, string>, value: number): void {
    metricsStore.observeHistogram(name, { ...this.defaultLabels, ...labels }, value);
  }

  // Timer helper
  startTimer(): () => number {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1e6; // Convert to milliseconds
    };
  }

  // Normalize path for metrics (remove IDs)
  private normalizePath(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
      .replace(/\/[a-z0-9]{20,30}/gi, "/:id")
      .replace(/\/\d+/g, "/:id");
  }

  // Get metrics in Prometheus format
  static getMetrics(): string {
    return metricsStore.toPrometheus();
  }

  // Reset metrics (for testing)
  static reset(): void {
    metricsStore.reset();
  }
}

// Fastify plugin for automatic HTTP metrics
export function metricsPlugin(serviceName: string) {
  const metrics = new Metrics({ serviceName });

  return async function (fastify: FastifyInstance) {
    // Add metrics endpoint
    fastify.get("/metrics", async (_request, reply) => {
      reply.header("Content-Type", "text/plain; version=0.0.4");
      return Metrics.getMetrics();
    });

    // Track request metrics
    fastify.addHook("onRequest", async (request) => {
      (request as any).metricsTimer = metrics.startTimer();
    });

    fastify.addHook("onResponse", async (request, reply) => {
      const timer = (request as any).metricsTimer;
      if (timer) {
        const duration = timer();
        metrics.httpRequestsTotal(request.method, request.url, reply.statusCode);
        metrics.httpRequestDuration(request.method, request.url, duration);
      }
    });
  };
}

// Create metrics instance
export function createMetrics(serviceName: string): Metrics {
  return new Metrics({ serviceName });
}
