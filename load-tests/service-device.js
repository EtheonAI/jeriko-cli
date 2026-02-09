import http from "k6/http";
import { check, sleep, group } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// ────────────────────────────────────────────────────────
// Device Service Load Test
//
// Tests the device heartbeat endpoint under load, simulating
// many IoT devices reporting status concurrently. Also tests
// device listing and status queries under concurrent access.
// ────────────────────────────────────────────────────────

const heartbeatLatency = new Trend("heartbeat_latency", true);
const heartbeatCount = new Counter("heartbeat_count");
const listLatency = new Trend("device_list_latency", true);
const heartbeatErrors = new Rate("heartbeat_errors");

export const options = {
  stages: [
    { duration: "5s", target: 10 },     // Warm up: 10 devices
    { duration: "20s", target: 50 },    // Moderate: 50 devices
    { duration: "20s", target: 100 },   // High: 100 concurrent devices
    { duration: "5s", target: 0 },      // Ramp down
  ],
  thresholds: {
    heartbeat_latency: ["p(95)<200", "p(99)<500"],
    http_req_failed: ["rate<0.01"],
    heartbeat_errors: ["rate<0.05"],
    device_list_latency: ["p(95)<500"],
  },
};

const DEVICE_URL = __ENV.DEVICE_URL || "http://localhost:4014";

// Device types to simulate realistic fleet
const DEVICE_TYPES = [
  "smart-light",
  "thermostat",
  "door-lock",
  "camera",
  "motion-sensor",
  "smart-plug",
  "humidity-sensor",
  "smart-speaker",
];

export default function () {
  const deviceId = `load-device-${__VU}`;
  const deviceType = DEVICE_TYPES[__VU % DEVICE_TYPES.length];

  group("heartbeat", () => {
    const payload = JSON.stringify({
      deviceId,
      status: "online",
      deviceType,
      metrics: {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        temperature: 20 + Math.random() * 15,
        uptime: __ITER * 30,
        battery: deviceType.includes("sensor")
          ? Math.max(0, 100 - __ITER * 0.1)
          : undefined,
      },
      firmware: "1.2.3",
      lastSeen: new Date().toISOString(),
    });

    const start = Date.now();
    const res = http.post(
      `${DEVICE_URL}/api/devices/${deviceId}/heartbeat`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "x-user-id": "load-test-user",
        },
        tags: { name: "device_heartbeat" },
      }
    );
    const elapsed = Date.now() - start;
    heartbeatLatency.add(elapsed);
    heartbeatCount.add(1);

    const success = check(res, {
      "heartbeat accepted": (r) =>
        r.status === 200 || r.status === 204 || r.status === 201,
      "heartbeat responds quickly": () => elapsed < 500,
    });

    if (!success) {
      heartbeatErrors.add(1);
    } else {
      heartbeatErrors.add(0);
    }
  });

  // Every 5th iteration, also query the device list
  if (__ITER % 5 === 0) {
    group("device list", () => {
      const start = Date.now();
      const listRes = http.get(`${DEVICE_URL}/api/devices`, {
        headers: {
          "x-user-id": "load-test-user",
        },
        tags: { name: "device_list" },
      });
      listLatency.add(Date.now() - start);

      check(listRes, {
        "list returns 200": (r) => r.status === 200,
        "list response is JSON": (r) => {
          const ct = r.headers["Content-Type"] || "";
          return ct.includes("json");
        },
      });
    });
  }

  // Every 10th iteration, query a specific device
  if (__ITER % 10 === 0) {
    group("device status", () => {
      const res = http.get(`${DEVICE_URL}/api/devices/${deviceId}`, {
        headers: {
          "x-user-id": "load-test-user",
        },
        tags: { name: "device_status" },
      });

      check(res, {
        "device status returns 200 or 404": (r) =>
          r.status === 200 || r.status === 404,
      });
    });
  }

  sleep(1);
}
