import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Trend } from "k6/metrics";

// ────────────────────────────────────────────────────────
// Gateway WebSocket Load Test
//
// Tests concurrent WebSocket connections to the gateway service.
// Ramps from 0 to 500 concurrent connections to validate
// connection handling, message throughput, and graceful teardown.
// ────────────────────────────────────────────────────────

const wsConnections = new Counter("ws_connections");
const wsMessages = new Counter("ws_messages_received");
const wsLatency = new Trend("ws_latency", true);
const wsConnectTime = new Trend("ws_connect_time", true);

export const options = {
  stages: [
    { duration: "10s", target: 50 },   // Warm up: ramp to 50
    { duration: "30s", target: 200 },   // Ramp up: scale to 200
    { duration: "10s", target: 500 },   // Peak: push to 500
    { duration: "10s", target: 0 },     // Ramp down: graceful teardown
  ],
  thresholds: {
    ws_latency: ["p(95)<500"],
    ws_connections: ["count>100"],
    ws_connect_time: ["p(95)<2000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "ws://localhost:4001";

export default function () {
  const url = `${BASE_URL}/ws`;
  const connectStart = Date.now();

  const res = ws.connect(url, {}, function (socket) {
    const connectTime = Date.now() - connectStart;
    wsConnectTime.add(connectTime);
    wsConnections.add(1);

    socket.on("open", () => {
      // Send a ping to verify bidirectional communication
      const pingStart = Date.now();
      socket.send(JSON.stringify({ type: "ping", ts: pingStart }));
    });

    socket.on("message", (data) => {
      wsMessages.add(1);
      try {
        const msg = JSON.parse(data);
        check(msg, {
          "received valid message": (m) => m.type !== undefined,
        });

        // Measure round-trip latency if server echoes timestamp
        if (msg.ts) {
          wsLatency.add(Date.now() - msg.ts);
        } else {
          wsLatency.add(Date.now() - connectStart);
        }
      } catch (_e) {
        // Non-JSON message — still count it
        wsLatency.add(Date.now() - connectStart);
      }
    });

    socket.on("error", (e) => {
      console.error(`WebSocket error (VU ${__VU}): ${e.error()}`);
    });

    // Keep connection alive for 5 seconds, sending periodic pings
    let pingCount = 0;
    const pingInterval = setInterval(() => {
      pingCount++;
      if (pingCount <= 4) {
        socket.send(
          JSON.stringify({
            type: "ping",
            ts: Date.now(),
            vu: __VU,
            iter: __ITER,
            seq: pingCount,
          })
        );
      }
    }, 1000);

    socket.setTimeout(() => {
      clearInterval(pingInterval);
      socket.close();
    }, 5000);
  });

  check(res, {
    "ws connected": (r) => r && r.status === 101,
  });

  sleep(1);
}
