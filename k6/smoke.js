import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const healthLatency = new Trend("health_latency");

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const GATEWAY_URL = __ENV.GATEWAY_URL || "http://localhost:4000";

/**
 * Smoke test — verify all critical endpoints respond.
 * Run: k6 run k6/smoke.js
 */
export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    errors: ["rate<0.01"], // <1% error rate
    health_latency: ["p(95)<500"], // 95th percentile under 500ms
    http_req_duration: ["p(95)<2000"], // All requests under 2s
  },
};

export default function () {
  // Health check — app
  const healthRes = http.get(`${BASE_URL}/api/health`);
  healthLatency.add(healthRes.timings.duration);
  check(healthRes, {
    "health status 200": (r) => r.status === 200,
    "health body ok": (r) => JSON.parse(r.body).status === "ok",
  }) || errorRate.add(1);

  // Gateway health
  const gwRes = http.get(`${GATEWAY_URL}/health`);
  check(gwRes, {
    "gateway status 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  // Login page loads
  const loginRes = http.get(`${BASE_URL}/login`);
  check(loginRes, {
    "login page loads": (r) => r.status === 200,
    "login has content": (r) => r.body.length > 100,
  }) || errorRate.add(1);

  sleep(1);
}
