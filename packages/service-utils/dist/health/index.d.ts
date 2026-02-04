import { FastifyInstance } from 'fastify';

/**
 * Health Check Utilities
 * Kubernetes-compatible readiness and liveness probes
 */

type HealthStatus = "healthy" | "unhealthy" | "degraded";
type CheckStatus = "pass" | "fail" | "warn";
interface HealthCheckResult {
    name: string;
    status: CheckStatus;
    message?: string;
    duration?: number;
    timestamp: string;
}
interface HealthResponse {
    status: HealthStatus;
    version: string;
    service: string;
    timestamp: string;
    uptime: number;
    checks: HealthCheckResult[];
}
interface ReadinessResponse {
    ready: boolean;
    checks: HealthCheckResult[];
}
interface LivenessResponse {
    alive: boolean;
    uptime: number;
}
type HealthCheck = () => Promise<HealthCheckResult>;
/**
 * Health check manager
 */
declare class HealthManager {
    private service;
    private version;
    private startTime;
    private checks;
    private readinessChecks;
    constructor(service: string, version?: string);
    /**
     * Register a health check
     */
    registerCheck(name: string, check: HealthCheck, includeInReadiness?: boolean): void;
    /**
     * Unregister a health check
     */
    unregisterCheck(name: string): void;
    /**
     * Run all health checks
     */
    checkHealth(): Promise<HealthResponse>;
    /**
     * Check readiness (can accept traffic)
     */
    checkReadiness(): Promise<ReadinessResponse>;
    /**
     * Check liveness (is the process alive)
     */
    checkLiveness(): LivenessResponse;
    private runChecks;
    private determineStatus;
    private getUptime;
}
/**
 * Common health check factories
 */
declare const healthChecks: {
    /**
     * Database connectivity check
     */
    database(name: string, checkFn: () => Promise<boolean>): HealthCheck;
    /**
     * Redis connectivity check
     */
    redis(name: string, checkFn: () => Promise<boolean>): HealthCheck;
    /**
     * External service check
     */
    externalService(name: string, url: string, timeoutMs?: number): HealthCheck;
    /**
     * Memory usage check
     */
    memory(thresholdPercent?: number): HealthCheck;
    /**
     * Disk space check (basic - checks if write is possible)
     */
    diskWrite(path?: string): HealthCheck;
};
/**
 * Fastify plugin for health endpoints
 */
declare function healthPlugin(manager: HealthManager): (fastify: FastifyInstance) => Promise<void>;
/**
 * Create health manager instance
 */
declare function createHealthManager(service: string, version?: string): HealthManager;

export { type CheckStatus, type HealthCheck, type HealthCheckResult, HealthManager, type HealthResponse, type HealthStatus, type LivenessResponse, type ReadinessResponse, createHealthManager, healthChecks, healthPlugin };
