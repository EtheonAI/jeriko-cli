import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ────────────────────────────────────────────────────────
// Chat API Load Test
//
// Tests the POST /api/chat endpoint under increasing load.
// Validates SSE streaming response, measures time-to-first-byte,
// and tracks error rates under concurrent request pressure.
// ────────────────────────────────────────────────────────

const chatLatency = new Trend("chat_latency", true);
const chatTTFB = new Trend("chat_ttfb", true);
const chatErrors = new Rate("chat_errors");
const chatRequests = new Counter("chat_requests");

export const options = {
  stages: [
    { duration: "10s", target: 10 },    // Warm up
    { duration: "30s", target: 50 },    // Moderate load
    { duration: "30s", target: 100 },   // High load
    { duration: "10s", target: 0 },     // Ramp down
  ],
  thresholds: {
    chat_latency: ["p(95)<5000"],
    chat_ttfb: ["p(95)<3000"],
    chat_errors: ["rate<0.1"],
    http_req_failed: ["rate<0.15"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = __ENV.AUTH_TOKEN || "test-token";

// Variety of prompts to simulate realistic usage patterns
const PROMPTS = [
  "Hello, how are you?",
  "Write a Python function to sort a list",
  "Explain the difference between TCP and UDP",
  "Create a React component for a todo list",
  "What is the capital of France?",
  "Help me debug this error: TypeError: Cannot read property of undefined",
  "Write a SQL query to find duplicate records",
  "How do I set up a CI/CD pipeline?",
  "Explain Docker containers in simple terms",
  "Write a bash script to find large files",
];

export default function () {
  const prompt = PROMPTS[__ITER % PROMPTS.length];
  chatRequests.add(1);

  const payload = JSON.stringify({
    messages: [{ role: "user", content: prompt }],
    sessionId: `load-test-${__VU}-${__ITER}`,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AUTH_TOKEN}`,
    },
    timeout: "30s",
    tags: { name: "chat_post" },
  };

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/chat`, payload, params);
  const totalLatency = Date.now() - start;
  chatLatency.add(totalLatency);

  // Time to first byte (TTFB) from k6 timing
  if (res.timings && res.timings.waiting) {
    chatTTFB.add(res.timings.waiting);
  }

  const success = check(res, {
    "status is 200": (r) => r.status === 200,
    "has SSE content-type or JSON": (r) => {
      const ct = r.headers["Content-Type"] || "";
      return (
        ct.includes("text/event-stream") ||
        ct.includes("application/json") ||
        ct.includes("text/plain")
      );
    },
    "response body is non-empty": (r) => r.body && r.body.length > 0,
    "no 5xx error": (r) => r.status < 500,
  });

  if (!success) {
    chatErrors.add(1);
    if (res.status >= 400) {
      console.warn(
        `Chat API error (VU ${__VU}): status=${res.status} body=${String(res.body).slice(0, 200)}`
      );
    }
  } else {
    chatErrors.add(0);
  }

  // Realistic user think time between requests
  sleep(Math.random() * 2 + 1);
}
