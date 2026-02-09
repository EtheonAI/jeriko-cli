# Load Tests

Powered by [k6](https://k6.io/). Install k6 to run locally.

## Prerequisites

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D68
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker
docker run --rm -i grafana/k6 run - <load-tests/chat-api.js
```

## Scripts

| Script | Target | Description |
|--------|--------|-------------|
| `gateway-ws.js` | Gateway WebSocket | Connection load test: ramp to 500 concurrent WS connections |
| `chat-api.js` | Chat API (POST /api/chat) | SSE streaming throughput test: ramp to 100 concurrent users |
| `trpc-sessions.js` | tRPC (sessions.list) | Query throughput test: ramp to 200 concurrent reads |
| `service-device.js` | Device Service | Heartbeat endpoint load: ramp to 100 concurrent devices |

## Usage

```bash
# Run a single script with defaults
k6 run load-tests/gateway-ws.js

# Run with custom virtual users and duration
k6 run --vus 100 --duration 30s load-tests/chat-api.js

# Run with environment variables
k6 run -e BASE_URL=http://staging.rubic.dev -e AUTH_TOKEN=xxx load-tests/chat-api.js

# Run with custom device service URL
k6 run -e DEVICE_URL=http://localhost:4014 load-tests/service-device.js

# Run with JSON output for CI
k6 run --out json=results.json load-tests/trpc-sessions.js

# Run with thresholds only (exit code reflects pass/fail)
k6 run --quiet load-tests/gateway-ws.js
```

## Environment Variables

| Variable | Default | Used By |
|----------|---------|---------|
| `BASE_URL` | `ws://localhost:4001` (WS) or `http://localhost:3000` (HTTP) | gateway-ws, chat-api, trpc-sessions |
| `AUTH_TOKEN` | `test-token` | chat-api |
| `AUTH_COOKIE` | (empty) | trpc-sessions |
| `DEVICE_URL` | `http://localhost:4014` | service-device |

## Thresholds

Each script defines its own pass/fail thresholds:

- **gateway-ws**: p95 WS latency < 500ms, > 100 connections established
- **chat-api**: p95 chat latency < 5s, error rate < 10%
- **trpc-sessions**: p95 query latency < 1s, p99 < 3s, failure rate < 5%
- **service-device**: p95 heartbeat latency < 200ms, p99 < 500ms, failure rate < 1%
