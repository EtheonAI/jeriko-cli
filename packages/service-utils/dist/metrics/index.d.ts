import { FastifyInstance } from 'fastify';

/**
 * Prometheus Metrics for Service Monitoring
 * Provides HTTP request metrics, custom business metrics, and health indicators
 */

interface Counter {
    inc(labels?: Record<string, string>, value?: number): void;
}
interface Gauge {
    set(labels: Record<string, string>, value: number): void;
    inc(labels?: Record<string, string>, value?: number): void;
    dec(labels?: Record<string, string>, value?: number): void;
}
interface Histogram {
    observe(labels: Record<string, string>, value: number): void;
    startTimer(labels?: Record<string, string>): () => number;
}
interface Summary {
    observe(labels: Record<string, string>, value: number): void;
}
interface MetricsConfig {
    serviceName: string;
    defaultLabels?: Record<string, string>;
}
declare class Metrics {
    private serviceName;
    private defaultLabels;
    constructor(config: MetricsConfig);
    httpRequestsTotal(method: string, path: string, status: number): void;
    httpRequestDuration(method: string, path: string, durationMs: number): void;
    httpRequestSize(method: string, path: string, bytes: number): void;
    httpResponseSize(method: string, path: string, bytes: number): void;
    counter(name: string, labels?: Record<string, string>, value?: number): void;
    gauge(name: string, labels: Record<string, string>, value: number): void;
    histogram(name: string, labels: Record<string, string>, value: number): void;
    startTimer(): () => number;
    private normalizePath;
    static getMetrics(): string;
    static reset(): void;
}
declare function metricsPlugin(serviceName: string): (fastify: FastifyInstance) => Promise<void>;
declare function createMetrics(serviceName: string): Metrics;

export { type Counter, type Gauge, type Histogram, Metrics, type MetricsConfig, type Summary, createMetrics, metricsPlugin };
