# Rubic Testing Documentation

**Version:** 1.0.0  
**Status:** In Development  
**Last Updated:** 2026-02-04

---

## Table of Contents

1. [Overview](#overview)
2. [Testing Strategy](#testing-strategy)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Security Testing](#security-testing)
8. [Device Testing](#device-testing)
9. [CI/CD Integration](#cicd-integration)
10. [Test Data Management](#test-data-management)

---

## Overview

Rubic requires a comprehensive testing strategy covering a polyglot microservices architecture with real-time communication, AI agent orchestration, and device control.

### Testing Pyramid

```
         /\
        /  \
       / E2E\         (Cypress, Playwright)
      /________\
     /          \
    /Integration \    (Supertest, httpx)
   /______________\
  /                \
 /     Unit         \  (Jest, pytest, Go test)
/____________________\
```

### Coverage Goals

| Layer             | Target Coverage | Tools                            |
| ----------------- | --------------- | -------------------------------- |
| Unit Tests        | 80%+            | Jest, pytest, Go test            |
| Integration Tests | 70%+            | Supertest, httpx, Testcontainers |
| E2E Tests         | 50%+            | Cypress, Playwright              |
| Contract Tests    | 100%            | Pact                             |

---

## Testing Strategy

### Test Categories

| Category              | Purpose                              | Frequency    |
| --------------------- | ------------------------------------ | ------------ |
| **Unit Tests**        | Test individual functions/components | Every commit |
| **Integration Tests** | Test service interactions            | Every PR     |
| **E2E Tests**         | Test complete user flows             | Pre-release  |
| **Contract Tests**    | Verify API contracts                 | Every PR     |
| **Performance Tests** | Load and stress testing              | Weekly       |
| **Security Tests**    | Vulnerability scanning               | Weekly       |

### Test Environments

```
Development → Integration → Staging → Production
     ↓              ↓            ↓
   Local       Docker Compose   AWS
```

---

## Unit Testing

### Frontend (Jest + React Testing Library)

```typescript
// apps/app/components/prompt-input.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptInput } from './prompt-input';

describe('PromptInput', () => {
  it('renders correctly', () => {
    render(<PromptInput onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText('Ask anything...')).toBeInTheDocument();
  });

  it('calls onSubmit when form is submitted', () => {
    const onSubmit = jest.fn();
    render(<PromptInput onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith({ parts: [{ type: 'text', text: 'Hello' }] });
  });

  it('disables submit when loading', () => {
    render(<PromptInput onSubmit={jest.fn()} loading={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

### Backend Node.js (Jest)

```typescript
// services/gateway/src/routes/proxy.test.ts
import { FastifyInstance } from "fastify";
import { buildApp } from "../app";

describe("Proxy Routes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should proxy requests to downstream services", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/tasks/health",
    });

    expect(response.statusCode).toBe(200);
  });

  it("should return 404 for unknown services", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/v1/unknown/health",
    });

    expect(response.statusCode).toBe(404);
  });
});
```

### Python Services (pytest)

```python
# services/agent/src/routes/test_tools.py
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

class TestToolExecution:
    def test_list_tools(self):
        response = client.get("/v1/tools")
        assert response.status_code == 200
        assert "tools" in response.json()

    def test_execute_web_search(self):
        response = client.post("/v1/tools/execute", json={
            "tool_name": "web_search",
            "arguments": {"query": "test"}
        })
        assert response.status_code == 200

    def test_execute_unknown_tool(self):
        response = client.post("/v1/tools/execute", json={
            "tool_name": "unknown_tool",
            "arguments": {}
        })
        assert response.status_code == 404
```

### Go Services (Go test)

```go
// services/device/internal/handler/device_handler_test.go
package handler

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "github.com/go-chi/chi/v5"
    "github.com/stretchr/testify/assert"
)

func TestRegisterDevice(t *testing.T) {
    handler := NewDeviceHandler(nil, nil, nil)

    payload := map[string]interface{}{
        "name": "Test Device",
        "type": "pc",
    }
    body, _ := json.Marshal(payload)

    req := httptest.NewRequest("POST", "/v1/devices", bytes.NewReader(body))
    req.Header.Set("x-user-id", "user_123")
    req.Header.Set("Content-Type", "application/json")

    rr := httptest.NewRecorder()
    handler.RegisterDevice(rr, req)

    assert.Equal(t, http.StatusCreated, rr.Code)
}

func TestExecuteCommand(t *testing.T) {
    // Test with dangerous command
    handler := NewDeviceHandler(nil, nil, nil)

    payload := map[string]interface{}{
        "command": "rm -rf /",
        "type": "shell",
    }
    body, _ := json.Marshal(payload)

    req := httptest.NewRequest("POST", "/v1/devices/device_123/command", bytes.NewReader(body))
    req.Header.Set("x-user-id", "user_123")

    rr := httptest.NewRecorder()
    handler.ExecuteCommand(rr, req)

    assert.Equal(t, http.StatusForbidden, rr.Code)
}
```

---

## Integration Testing

### Testcontainers for Integration Tests

```typescript
// services/task/src/tests/integration/task.test.ts
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { RedisContainer } from "@testcontainers/redis";
import { FastifyInstance } from "fastify";
import { buildApp } from "../../app";

describe("Task Service Integration", () => {
  let app: FastifyInstance;
  let postgres: StartedTestContainer;
  let redis: StartedTestContainer;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer().start();
    redis = await new RedisContainer().start();

    app = await buildApp({
      databaseUrl: postgres.getConnectionUri(),
      redisUrl: redis.getConnectionUrl(),
    });
  });

  afterAll(async () => {
    await app.close();
    await postgres.stop();
    await redis.stop();
  });

  it("should create and retrieve a task", async () => {
    // Create task
    const createResponse = await app.inject({
      method: "POST",
      url: "/v1/tasks",
      payload: {
        prompt: "Test task",
        sessionId: "session_123",
      },
      headers: { "x-user-id": "user_123" },
    });

    expect(createResponse.statusCode).toBe(201);
    const { data: task } = JSON.parse(createResponse.payload);

    // Retrieve task
    const getResponse = await app.inject({
      method: "GET",
      url: `/v1/tasks/${task.id}`,
      headers: { "x-user-id": "user_123" },
    });

    expect(getResponse.statusCode).toBe(200);
  });
});
```

### Service-to-Service Integration

```python
# tests/integration/test_agent_device_integration.py
import pytest
import httpx

@pytest.mark.asyncio
async def test_agent_can_control_device():
    """Test that Agent service can execute commands on Device service"""

    async with httpx.AsyncClient() as client:
        # Register device
        device_resp = await client.post(
            "http://device:8080/v1/devices",
            json={"name": "Test PC", "type": "pc"},
            headers={"x-user-id": "user_123"}
        )
        device = device_resp.json()["data"]

        # Execute tool via Agent service
        tool_resp = await client.post(
            "http://agent:8000/v1/tools/execute",
            json={
                "tool_name": "terminal_command",
                "arguments": {
                    "command": "echo hello",
                    "device_id": device["id"]
                }
            },
            headers={"x-user-id": "user_123"}
        )

        assert tool_resp.status_code == 200
```

---

## End-to-End Testing

### Cypress Tests

```typescript
// cypress/e2e/chat.cy.ts
describe("Chat Flow", () => {
  beforeEach(() => {
    cy.login("test@example.com", "password");
  });

  it("should send a message and receive a response", () => {
    cy.visit("/app");

    // Type message
    cy.get('[data-testid="prompt-input"]').type("What is the weather in New York?");

    // Submit
    cy.get('[data-testid="send-button"]').click();

    // Wait for streaming response
    cy.get('[data-testid="message-list"]').should("contain", "weather");
  });

  it("should handle file uploads", () => {
    cy.visit("/app");

    cy.get('[data-testid="file-upload"]').attachFile("test-document.pdf");
    cy.get('[data-testid="attachment-preview"]').should("contain", "test-document.pdf");
  });
});
```

### Device Control E2E

```typescript
// cypress/e2e/devices.cy.ts
describe("Device Control", () => {
  beforeEach(() => {
    cy.login("test@example.com", "password");
  });

  it("should register a new device", () => {
    cy.visit("/app/settings/devices");

    cy.get('[data-testid="add-device"]').click();
    cy.get('[data-testid="device-name"]').type("My MacBook");
    cy.get('[data-testid="device-type"]').select("pc");
    cy.get('[data-testid="save-device"]').click();

    cy.get('[data-testid="device-list"]').should("contain", "My MacBook");
  });

  it("should execute command on connected device", () => {
    cy.visit("/app");

    // Select device
    cy.get('[data-testid="device-selector"]').click();
    cy.get('[data-testid="device-option-my-macbook"]').click();

    // Send command
    cy.get('[data-testid="prompt-input"]').type("Run: ls -la");
    cy.get('[data-testid="send-button"]').click();

    // Verify command executed
    cy.get('[data-testid="message-list"]').should("contain", "Command executed");
  });
});
```

---

## Performance Testing

### Load Testing with k6

```javascript
// tests/performance/load-test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: 100 }, // Ramp up
    { duration: "5m", target: 100 }, // Steady state
    { duration: "2m", target: 200 }, // Ramp up
    { duration: "5m", target: 200 }, // Steady state
    { duration: "2m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], // 95% of requests under 500ms
    http_req_failed: ["rate<0.1"], // Error rate under 0.1%
  },
};

export default function () {
  const res = http.post(
    "http://localhost:3000/v1/tasks",
    {
      prompt: "Test task",
      sessionId: `session_${__VU}`,
    },
    {
      headers: { "x-user-id": `user_${__VU}` },
    }
  );

  check(res, {
    "status is 201": (r) => r.status === 201,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

### WebSocket Performance

```javascript
// tests/performance/websocket-test.js
import ws from "k6/ws";
import { check } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 1000 }, // 1000 concurrent WebSocket connections
  ],
};

export default function () {
  const url = "ws://localhost:3000/v1/stream";

  const res = ws.connect(url, null, function (socket) {
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          type: "subscribe",
          channels: ["user:test_user"],
        })
      );
    });

    socket.on("message", (data) => {
      check(data, {
        "received message": (d) => d.length > 0,
      });
    });

    socket.setTimeout(() => {
      socket.close();
    }, 30000);
  });

  check(res, { "connected successfully": (r) => r && r.status === 101 });
}
```

---

## Security Testing

### OWASP ZAP Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: "0 0 * * 0" # Weekly

jobs:
  zap-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Start services
        run: docker-compose up -d

      - name: ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: "http://localhost:3000"
          rules_file_name: ".zap/rules.tsv"
```

### Dependency Scanning

```yaml
# Snyk scanning
- name: Run Snyk
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --severity-threshold=high
```

### Secret Scanning

```yaml
# GitLeaks
- name: GitLeaks
  uses: gitleaks/gitleaks-action@v2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Device Testing

### MQTT Device Simulation

```python
# tests/devices/mqtt_simulator.py
import paho.mqtt.client as mqtt
import json
import time

class MQTTDeviceSimulator:
    def __init__(self, device_id, user_id):
        self.device_id = device_id
        self.user_id = user_id
        self.client = mqtt.Client()

    def connect(self, broker_url):
        self.client.connect(broker_url)
        self.client.loop_start()

        # Subscribe to commands
        topic = f"rubic/{self.user_id}/{self.device_id}/command"
        self.client.subscribe(topic)
        self.client.on_message = self._handle_command

    def _handle_command(self, client, userdata, message):
        payload = json.loads(message.payload)
        print(f"Received command: {payload}")

        # Send acknowledgment
        ack_topic = f"rubic/{self.user_id}/{self.device_id}/command/ack"
        self.client.publish(ack_topic, json.dumps({
            "message_id": payload["message_id"],
            "status": "executed"
        }))

    def send_telemetry(self, data):
        topic = f"rubic/{self.user_id}/{self.device_id}/telemetry"
        self.client.publish(topic, json.dumps(data))

# Usage in tests
@pytest.fixture
def mqtt_device():
    device = MQTTDeviceSimulator("device_123", "user_123")
    device.connect("localhost:1883")
    yield device
    device.client.loop_stop()

def test_mqtt_command_execution(mqtt_device):
    # Send command via API
    response = requests.post(
        "http://localhost:8080/v1/devices/device_123/command",
        json={"command": "test", "type": "action"}
    )

    # Wait for device to process
    time.sleep(1)

    # Verify device received command
    assert mqtt_device.last_command is not None
```

### PC Agent Testing

```typescript
// tests/devices/pc-agent.test.ts
import { spawn } from "child_process";
import WebSocket from "ws";

describe("PC Agent Integration", () => {
  let agent: ChildProcess;
  let ws: WebSocket;

  beforeAll(async () => {
    // Start agent
    agent = spawn("node", ["pc-agent.js"], {
      env: { ...process.env, RUBIC_TOKEN: "test_token" },
    });

    // Connect WebSocket
    ws = new WebSocket("ws://localhost:3005/v1/devices/test_pc/stream");
    await new Promise((resolve) => ws.once("open", resolve));
  });

  afterAll(() => {
    agent.kill();
    ws.close();
  });

  it("should execute shell command", (done) => {
    ws.send(
      JSON.stringify({
        type: "command",
        data: { command: "echo hello", type: "shell" },
      })
    );

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "output") {
        expect(message.data.stdout).toContain("hello");
        done();
      }
    });
  });

  it("should respect safety rules", (done) => {
    ws.send(
      JSON.stringify({
        type: "command",
        data: { command: "rm -rf /", type: "shell" },
      })
    );

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());
      if (message.type === "error") {
        expect(message.data.code).toBe("DANGEROUS_COMMAND");
        done();
      }
    });
  });
});
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  unit-tests:
    strategy:
      matrix:
        service: [gateway, task, file, billing]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - run: pnpm install
      - run: pnpm --filter=@rubic/${{ matrix.service }} test
      - run: pnpm --filter=@rubic/${{ matrix.service }} test:coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./services/${{ matrix.service }}/coverage/lcov.info

  python-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - working-directory: services/agent
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov
          pytest --cov=src --cov-report=xml

      - uses: codecov/codecov-action@v3
        with:
          files: ./services/agent/coverage.xml

  go-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: "1.22"

      - working-directory: services/device
        run: |
          go test -race -coverprofile=coverage.out ./...
          go tool cover -html=coverage.out -o coverage.html

  integration-tests:
    runs-on: ubuntu-latest
    needs: [unit-tests, python-tests, go-tests]
    steps:
      - uses: actions/checkout@v4

      - name: Start services
        run: docker-compose -f docker-compose.test.yml up -d

      - name: Run integration tests
        run: pnpm test:integration

      - name: Cleanup
        run: docker-compose -f docker-compose.test.yml down

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4

      - name: Cypress run
        uses: cypress-io/github-action@v6
        with:
          start: pnpm dev
          wait-on: "http://localhost:3000"
```

---

## Test Data Management

### Database Fixtures

```typescript
// tests/fixtures/database.ts
import { db } from "@repo/database";

export const createTestUser = async (overrides = {}) => {
  return db
    .insert(users)
    .values({
      id: `user_${randomUUID()}`,
      email: `test_${Date.now()}@example.com`,
      name: "Test User",
      ...overrides,
    })
    .returning();
};

export const createTestDevice = async (userId: string, overrides = {}) => {
  return db
    .insert(devices)
    .values({
      id: `device_${randomUUID()}`,
      userId,
      name: "Test Device",
      type: "pc",
      status: "online",
      ...overrides,
    })
    .returning();
};

export const cleanupTestData = async () => {
  await db.delete(taskMessages);
  await db.delete(tasks);
  await db.delete(devices);
  await db.delete(users);
};
```

### Mock Services

```typescript
// tests/mocks/composio.ts
export const mockComposio = () => {
  return {
    getTools: jest.fn().mockReturnValue([{ name: "GMAIL_SEND_EMAIL", description: "Send email" }]),
    executeAction: jest.fn().mockResolvedValue({
      success: true,
      data: { messageId: "msg_123" },
    }),
  };
};
```

---

## Test Commands

```bash
# Run all tests
pnpm test

# Run specific service tests
pnpm --filter=@rubic/gateway test

# Run with coverage
pnpm test:coverage

# Run integration tests
pnpm test:integration

# Run E2E tests
pnpm test:e2e

# Run performance tests
k6 run tests/performance/load-test.js

# Run security scan
zap-baseline.py -t http://localhost:3000
```

---

## Related Documentation

- [Frontend Architecture](../frontend/README.md)
- [Backend Architecture](../backend/README.md)
- [API Documentation](./api.md)
