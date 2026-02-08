import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const errorRate = new Rate("errors");
const apiLatency = new Trend("api_latency");

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const GATEWAY_URL = __ENV.GATEWAY_URL || "http://localhost:4000";

/**
 * Load test — simulate realistic user traffic.
 * Run: k6 run k6/load.js
 * Run against staging: k6 run -e BASE_URL=https://staging.rubic.dev k6/load.js
 */
export const options = {
  stages: [
    { duration: "1m", target: 20 }, // Ramp up to 20 users
    { duration: "3m", target: 50 }, // Hold at 50 users
    { duration: "1m", target: 100 }, // Spike to 100 users
    { duration: "2m", target: 50 }, // Back to 50
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    errors: ["rate<0.05"], // <5% error rate
    api_latency: ["p(95)<1000"], // 95th percentile under 1s
    http_req_duration: ["p(99)<3000"], // 99th percentile under 3s
    http_req_failed: ["rate<0.05"],
  },
};

export default function () {
  // Simulate a user session: health → page load → API calls
  const healthRes = http.get(`${BASE_URL}/api/health`);
  apiLatency.add(healthRes.timings.duration);
  check(healthRes, {
    "health 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  // Simulate tRPC session list (most frequent API call)
  const sessionsRes = http.get(
    `${BASE_URL}/api/trpc/sessions.list?input=%7B%7D`,
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: "better-auth.session_token=load-test-token",
      },
    }
  );
  apiLatency.add(sessionsRes.timings.duration);
  check(sessionsRes, {
    "sessions responds": (r) => r.status < 500,
  }) || errorRate.add(1);

  // Gateway proxy health
  const gwRes = http.get(`${GATEWAY_URL}/health`);
  check(gwRes, {
    "gateway 200": (r) => r.status === 200,
  }) || errorRate.add(1);

  sleep(Math.random() * 3 + 1); // 1-4s think time
}
