// src/metrics/index.ts
var MetricsStore = class {
  counters = /* @__PURE__ */ new Map();
  gauges = /* @__PURE__ */ new Map();
  histograms = /* @__PURE__ */ new Map();
  getKey(labels) {
    return Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${v}"`).join(",");
  }
  incCounter(name, labels = {}, value = 1) {
    if (!this.counters.has(name)) {
      this.counters.set(name, /* @__PURE__ */ new Map());
    }
    const key = this.getKey(labels);
    const current = this.counters.get(name).get(key) || 0;
    this.counters.get(name).set(key, current + value);
  }
  setGauge(name, labels, value) {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, /* @__PURE__ */ new Map());
    }
    const key = this.getKey(labels);
    this.gauges.get(name).set(key, value);
  }
  observeHistogram(name, labels, value) {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, /* @__PURE__ */ new Map());
    }
    const key = this.getKey(labels);
    if (!this.histograms.get(name).has(key)) {
      this.histograms.get(name).set(key, []);
    }
    this.histograms.get(name).get(key).push(value);
  }
  toPrometheus() {
    const lines = [];
    for (const [name, values] of this.counters) {
      lines.push(`# TYPE ${name} counter`);
      for (const [labels, value] of values) {
        const labelStr = labels ? `{${labels}}` : "";
        lines.push(`${name}${labelStr} ${value}`);
      }
    }
    for (const [name, values] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`);
      for (const [labels, value] of values) {
        const labelStr = labels ? `{${labels}}` : "";
        lines.push(`${name}${labelStr} ${value}`);
      }
    }
    for (const [name, values] of this.histograms) {
      lines.push(`# TYPE ${name} histogram`);
      for (const [labels, observations] of values) {
        const labelStr = labels ? `{${labels}}` : "";
        const count = observations.length;
        const sum = observations.reduce((a, b) => a + b, 0);
        lines.push(`${name}_count${labelStr} ${count}`);
        lines.push(`${name}_sum${labelStr} ${sum}`);
      }
    }
    return lines.join("\n");
  }
  reset() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
};
var metricsStore = new MetricsStore();
var Metrics = class {
  serviceName;
  defaultLabels;
  constructor(config) {
    this.serviceName = config.serviceName;
    this.defaultLabels = {
      service: config.serviceName,
      ...config.defaultLabels
    };
  }
  // HTTP request metrics
  httpRequestsTotal(method, path, status) {
    metricsStore.incCounter("http_requests_total", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path),
      status: String(status)
    });
  }
  httpRequestDuration(method, path, durationMs) {
    metricsStore.observeHistogram("http_request_duration_seconds", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path)
    }, durationMs / 1e3);
  }
  httpRequestSize(method, path, bytes) {
    metricsStore.observeHistogram("http_request_size_bytes", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path)
    }, bytes);
  }
  httpResponseSize(method, path, bytes) {
    metricsStore.observeHistogram("http_response_size_bytes", {
      ...this.defaultLabels,
      method,
      path: this.normalizePath(path)
    }, bytes);
  }
  // Custom business metrics
  counter(name, labels = {}, value = 1) {
    metricsStore.incCounter(name, { ...this.defaultLabels, ...labels }, value);
  }
  gauge(name, labels, value) {
    metricsStore.setGauge(name, { ...this.defaultLabels, ...labels }, value);
  }
  histogram(name, labels, value) {
    metricsStore.observeHistogram(name, { ...this.defaultLabels, ...labels }, value);
  }
  // Timer helper
  startTimer() {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      return Number(end - start) / 1e6;
    };
  }
  // Normalize path for metrics (remove IDs)
  normalizePath(path) {
    return path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id").replace(/\/[a-z0-9]{20,30}/gi, "/:id").replace(/\/\d+/g, "/:id");
  }
  // Get metrics in Prometheus format
  static getMetrics() {
    return metricsStore.toPrometheus();
  }
  // Reset metrics (for testing)
  static reset() {
    metricsStore.reset();
  }
};
function metricsPlugin(serviceName) {
  const metrics = new Metrics({ serviceName });
  return async function(fastify) {
    fastify.get("/metrics", async (request, reply) => {
      reply.header("Content-Type", "text/plain; version=0.0.4");
      return Metrics.getMetrics();
    });
    fastify.addHook("onRequest", async (request) => {
      request.metricsTimer = metrics.startTimer();
    });
    fastify.addHook("onResponse", async (request, reply) => {
      const timer = request.metricsTimer;
      if (timer) {
        const duration = timer();
        metrics.httpRequestsTotal(request.method, request.url, reply.statusCode);
        metrics.httpRequestDuration(request.method, request.url, duration);
      }
    });
  };
}
function createMetrics(serviceName) {
  return new Metrics({ serviceName });
}
export {
  Metrics,
  createMetrics,
  metricsPlugin
};
//# sourceMappingURL=index.js.map