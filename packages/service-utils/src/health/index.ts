/**
 * Health Check Utilities
 * Kubernetes-compatible readiness and liveness probes
 */

import type { FastifyInstance } from "fastify";

export type HealthStatus = "healthy" | "unhealthy" | "degraded";
export type CheckStatus = "pass" | "fail" | "warn";

export interface HealthCheckResult {
  name: string;
  status: CheckStatus;
  message?: string;
  duration?: number;
  timestamp: string;
}

export interface HealthResponse {
  status: HealthStatus;
  version: string;
  service: string;
  timestamp: string;
  uptime: number;
  checks: HealthCheckResult[];
}

export interface ReadinessResponse {
  ready: boolean;
  checks: HealthCheckResult[];
}

export interface LivenessResponse {
  alive: boolean;
  uptime: number;
}

export type HealthCheck = () => Promise<HealthCheckResult>;

/**
 * Health check manager
 */
export class HealthManager {
  private service: string;
  private version: string;
  private startTime: number;
  private checks: Map<string, HealthCheck> = new Map();
  private readinessChecks: Map<string, HealthCheck> = new Map();

  constructor(service: string, version: string = "1.0.0") {
    this.service = service;
    this.version = version;
    this.startTime = Date.now();
  }

  /**
   * Register a health check
   */
  registerCheck(name: string, check: HealthCheck, includeInReadiness: boolean = false): void {
    this.checks.set(name, check);
    if (includeInReadiness) {
      this.readinessChecks.set(name, check);
    }
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.readinessChecks.delete(name);
  }

  /**
   * Run all health checks
   */
  async checkHealth(): Promise<HealthResponse> {
    const results = await this.runChecks(this.checks);
    const status = this.determineStatus(results);

    return {
      status,
      version: this.version,
      service: this.service,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      checks: results,
    };
  }

  /**
   * Check readiness (can accept traffic)
   */
  async checkReadiness(): Promise<ReadinessResponse> {
    const results = await this.runChecks(this.readinessChecks);
    const ready = results.every((r) => r.status === "pass");

    return {
      ready,
      checks: results,
    };
  }

  /**
   * Check liveness (is the process alive)
   */
  checkLiveness(): LivenessResponse {
    return {
      alive: true,
      uptime: this.getUptime(),
    };
  }

  private async runChecks(checks: Map<string, HealthCheck>): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];

    for (const [name, check] of checks) {
      try {
        const start = Date.now();
        const result = await Promise.race([
          check(),
          new Promise<HealthCheckResult>((_, reject) =>
            setTimeout(() => reject(new Error("Health check timeout")), 5000)
          ),
        ]);
        result.duration = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }
    }

    return results;
  }

  private determineStatus(results: HealthCheckResult[]): HealthStatus {
    if (results.length === 0) return "healthy";

    const hasFailure = results.some((r) => r.status === "fail");
    const hasWarning = results.some((r) => r.status === "warn");

    if (hasFailure) return "unhealthy";
    if (hasWarning) return "degraded";
    return "healthy";
  }

  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }
}

/**
 * Common health check factories
 */
export const healthChecks = {
  /**
   * Database connectivity check
   */
  database(name: string, checkFn: () => Promise<boolean>): HealthCheck {
    return async () => {
      try {
        const healthy = await checkFn();
        return {
          name,
          status: healthy ? "pass" : "fail",
          message: healthy ? "Database connection OK" : "Database connection failed",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Database check failed",
          timestamp: new Date().toISOString(),
        };
      }
    };
  },

  /**
   * Redis connectivity check
   */
  redis(name: string, checkFn: () => Promise<boolean>): HealthCheck {
    return async () => {
      try {
        const healthy = await checkFn();
        return {
          name,
          status: healthy ? "pass" : "fail",
          message: healthy ? "Redis connection OK" : "Redis connection failed",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Redis check failed",
          timestamp: new Date().toISOString(),
        };
      }
    };
  },

  /**
   * External service check
   */
  externalService(name: string, url: string, timeoutMs: number = 3000): HealthCheck {
    return async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        return {
          name,
          status: response.ok ? "pass" : "warn",
          message: `HTTP ${response.status}`,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Service unreachable",
          timestamp: new Date().toISOString(),
        };
      }
    };
  },

  /**
   * Memory usage check
   */
  memory(thresholdPercent: number = 90): HealthCheck {
    return async () => {
      const used = process.memoryUsage();
      const heapUsedPercent = (used.heapUsed / used.heapTotal) * 100;

      return {
        name: "memory",
        status: heapUsedPercent < thresholdPercent ? "pass" : "warn",
        message: `Heap: ${Math.round(heapUsedPercent)}% used (${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB)`,
        timestamp: new Date().toISOString(),
      };
    };
  },

  /**
   * Disk space check (basic - checks if write is possible)
   */
  diskWrite(path: string = "/tmp"): HealthCheck {
    return async () => {
      try {
        const fs = await import("fs/promises");
        const testFile = `${path}/.health-check-${Date.now()}`;
        await fs.writeFile(testFile, "test");
        await fs.unlink(testFile);

        return {
          name: "disk",
          status: "pass",
          message: "Disk write OK",
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        return {
          name: "disk",
          status: "fail",
          message: error instanceof Error ? error.message : "Disk write failed",
          timestamp: new Date().toISOString(),
        };
      }
    };
  },
};

/**
 * Fastify plugin for health endpoints
 */
export function healthPlugin(manager: HealthManager) {
  return async function (fastify: FastifyInstance) {
    // Full health check
    fastify.get("/health", async (request, reply) => {
      const health = await manager.checkHealth();
      const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
      return reply.status(statusCode).send(health);
    });

    // Kubernetes readiness probe
    fastify.get("/health/ready", async (request, reply) => {
      const readiness = await manager.checkReadiness();
      return reply.status(readiness.ready ? 200 : 503).send(readiness);
    });

    // Kubernetes liveness probe
    fastify.get("/health/live", async (request, reply) => {
      const liveness = manager.checkLiveness();
      return reply.status(200).send(liveness);
    });
  };
}

/**
 * Create health manager instance
 */
export function createHealthManager(service: string, version?: string): HealthManager {
  return new HealthManager(service, version);
}
