import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter } from "k6/metrics";

// ────────────────────────────────────────────────────────
// tRPC Sessions Load Test
//
// Tests the tRPC sessions.list query endpoint under increasing
// concurrent read load. Validates response format, measures
// query latency, and verifies consistent behavior at scale.
// ────────────────────────────────────────────────────────

const queryLatency = new Trend("trpc_latency", true);
const queryCount = new Counter("trpc_query_count");
const batchLatency = new Trend("trpc_batch_latency", true);

export const options = {
  stages: [
    { duration: "10s", target: 20 },    // Warm up
    { duration: "30s", target: 100 },   // Moderate load
    { duration: "30s", target: 200 },   // High load
    { duration: "10s", target: 0 },     // Ramp down
  ],
  thresholds: {
    trpc_latency: ["p(95)<1000", "p(99)<3000"],
    http_req_failed: ["rate<0.05"],
    trpc_batch_latency: ["p(95)<2000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const AUTH_COOKIE = __ENV.AUTH_COOKIE || "";

const defaultHeaders = {
  Cookie: AUTH_COOKIE,
  "Content-Type": "application/json",
};

export default function () {
  group("sessions.list", () => {
    const input = encodeURIComponent(JSON.stringify({ json: { limit: 20 } }));

    const start = Date.now();
    const listRes = http.get(
      `${BASE_URL}/api/trpc/sessions.list?input=${input}`,
      { headers: defaultHeaders, tags: { name: "sessions_list" } }
    );
    queryLatency.add(Date.now() - start);
    queryCount.add(1);

    check(listRes, {
      "sessions.list returns 200": (r) => r.status === 200,
      "response is JSON": (r) => {
        const ct = r.headers["Content-Type"] || "";
        return ct.includes("json");
      },
      "response has result": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.result !== undefined || body.error !== undefined;
        } catch (_e) {
          return false;
        }
      },
    });
  });

  group("sessions.list with pagination", () => {
    // Test paginated queries with different offsets
    const offset = __ITER * 20;
    const input = encodeURIComponent(
      JSON.stringify({ json: { limit: 20, cursor: offset > 0 ? `cursor-${offset}` : undefined } })
    );

    const start = Date.now();
    const paginatedRes = http.get(
      `${BASE_URL}/api/trpc/sessions.list?input=${input}`,
      { headers: defaultHeaders, tags: { name: "sessions_list_paginated" } }
    );
    queryLatency.add(Date.now() - start);
    queryCount.add(1);

    check(paginatedRes, {
      "paginated query returns 200": (r) => r.status === 200,
      "no server error": (r) => r.status < 500,
    });
  });

  group("batch query simulation", () => {
    // Simulate multiple tRPC queries that a page load would trigger
    const queries = [
      "sessions.list",
      "user.me",
      "notifications.list",
    ];

    const batchStart = Date.now();

    const responses = queries.map((procedure) => {
      const input = encodeURIComponent(
        JSON.stringify({ json: { limit: 10 } })
      );
      return http.get(
        `${BASE_URL}/api/trpc/${procedure}?input=${input}`,
        { headers: defaultHeaders, tags: { name: `batch_${procedure}` } }
      );
    });

    batchLatency.add(Date.now() - batchStart);

    for (let i = 0; i < responses.length; i++) {
      check(responses[i], {
        [`${queries[i]} returns successfully`]: (r) =>
          r.status === 200 || r.status === 401,
      });
    }
  });

  sleep(0.5);
}
