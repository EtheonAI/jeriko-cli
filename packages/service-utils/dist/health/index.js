// src/health/index.ts
var HealthManager = class {
  service;
  version;
  startTime;
  checks = /* @__PURE__ */ new Map();
  readinessChecks = /* @__PURE__ */ new Map();
  constructor(service, version = "1.0.0") {
    this.service = service;
    this.version = version;
    this.startTime = Date.now();
  }
  /**
   * Register a health check
   */
  registerCheck(name, check, includeInReadiness = false) {
    this.checks.set(name, check);
    if (includeInReadiness) {
      this.readinessChecks.set(name, check);
    }
  }
  /**
   * Unregister a health check
   */
  unregisterCheck(name) {
    this.checks.delete(name);
    this.readinessChecks.delete(name);
  }
  /**
   * Run all health checks
   */
  async checkHealth() {
    const results = await this.runChecks(this.checks);
    const status = this.determineStatus(results);
    return {
      status,
      version: this.version,
      service: this.service,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      uptime: this.getUptime(),
      checks: results
    };
  }
  /**
   * Check readiness (can accept traffic)
   */
  async checkReadiness() {
    const results = await this.runChecks(this.readinessChecks);
    const ready = results.every((r) => r.status === "pass");
    return {
      ready,
      checks: results
    };
  }
  /**
   * Check liveness (is the process alive)
   */
  checkLiveness() {
    return {
      alive: true,
      uptime: this.getUptime()
    };
  }
  async runChecks(checks) {
    const results = [];
    for (const [name, check] of checks) {
      try {
        const start = Date.now();
        const result = await Promise.race([
          check(),
          new Promise(
            (_, reject) => setTimeout(() => reject(new Error("Health check timeout")), 5e3)
          )
        ]);
        result.duration = Date.now() - start;
        results.push(result);
      } catch (error) {
        results.push({
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
    return results;
  }
  determineStatus(results) {
    if (results.length === 0) return "healthy";
    const hasFailure = results.some((r) => r.status === "fail");
    const hasWarning = results.some((r) => r.status === "warn");
    if (hasFailure) return "unhealthy";
    if (hasWarning) return "degraded";
    return "healthy";
  }
  getUptime() {
    return Math.floor((Date.now() - this.startTime) / 1e3);
  }
};
var healthChecks = {
  /**
   * Database connectivity check
   */
  database(name, checkFn) {
    return async () => {
      try {
        const healthy = await checkFn();
        return {
          name,
          status: healthy ? "pass" : "fail",
          message: healthy ? "Database connection OK" : "Database connection failed",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (error) {
        return {
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Database check failed",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    };
  },
  /**
   * Redis connectivity check
   */
  redis(name, checkFn) {
    return async () => {
      try {
        const healthy = await checkFn();
        return {
          name,
          status: healthy ? "pass" : "fail",
          message: healthy ? "Redis connection OK" : "Redis connection failed",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (error) {
        return {
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Redis check failed",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    };
  },
  /**
   * External service check
   */
  externalService(name, url, timeoutMs = 3e3) {
    return async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const response = await fetch(url, {
          method: "GET",
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return {
          name,
          status: response.ok ? "pass" : "warn",
          message: `HTTP ${response.status}`,
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (error) {
        return {
          name,
          status: "fail",
          message: error instanceof Error ? error.message : "Service unreachable",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    };
  },
  /**
   * Memory usage check
   */
  memory(thresholdPercent = 90) {
    return async () => {
      const used = process.memoryUsage();
      const heapUsedPercent = used.heapUsed / used.heapTotal * 100;
      return {
        name: "memory",
        status: heapUsedPercent < thresholdPercent ? "pass" : "warn",
        message: `Heap: ${Math.round(heapUsedPercent)}% used (${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB)`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    };
  },
  /**
   * Disk space check (basic - checks if write is possible)
   */
  diskWrite(path = "/tmp") {
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
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      } catch (error) {
        return {
          name: "disk",
          status: "fail",
          message: error instanceof Error ? error.message : "Disk write failed",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        };
      }
    };
  }
};
function healthPlugin(manager) {
  return async function(fastify) {
    fastify.get("/health", async (request, reply) => {
      const health = await manager.checkHealth();
      const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;
      return reply.status(statusCode).send(health);
    });
    fastify.get("/health/ready", async (request, reply) => {
      const readiness = await manager.checkReadiness();
      return reply.status(readiness.ready ? 200 : 503).send(readiness);
    });
    fastify.get("/health/live", async (request, reply) => {
      const liveness = manager.checkLiveness();
      return reply.status(200).send(liveness);
    });
  };
}
function createHealthManager(service, version) {
  return new HealthManager(service, version);
}
export {
  HealthManager,
  createHealthManager,
  healthChecks,
  healthPlugin
};
//# sourceMappingURL=index.js.map