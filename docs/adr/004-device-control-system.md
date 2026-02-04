# ADR-004: Device Control System Architecture

**Status:** Proposed
**Date:** 2026-02-04
**Decision Makers:** Engineering Team
**Technical Story:** Designing a device control system for PC, MQTT, WiFi, and Bluetooth devices

---

## Context and Problem Statement

Rubic needs to extend AI agent capabilities to control physical devices:
- **PC Control:** Execute terminal commands, browser automation, file operations
- **MQTT Devices:** IoT sensors, smart home devices, industrial equipment
- **WiFi Devices:** Network-connected appliances, cameras, displays
- **Bluetooth Devices:** Wearables, proximity sensors, BLE beacons

Inspiration comes from OpenClaw architecture, but extended for enterprise use cases.

---

## Decision Drivers

1. **Security:** Device control is sensitive; requires robust safety measures
2. **Latency:** Real-time control requires low-latency communication
3. **Scalability:** Support thousands of concurrent device connections
4. **Reliability:** Commands must be delivered and acknowledged
5. **Flexibility:** Support diverse device protocols
6. **User Trust:** Human-in-the-loop for sensitive operations

---

## Architecture Design

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RUBIC DEVICE CONTROL                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Device Service (Go)                              │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐  │ │
│  │  │                   Protocol Adapters                              │  │ │
│  │  │                                                                  │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │  │ │
│  │  │  │    PC    │  │   MQTT   │  │   WiFi   │  │Bluetooth │        │  │ │
│  │  │  │ Adapter  │  │ Adapter  │  │ Adapter  │  │ Adapter  │        │  │ │
│  │  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │  │ │
│  │  │       │             │             │             │               │  │ │
│  │  └───────┼─────────────┼─────────────┼─────────────┼───────────────┘  │ │
│  │          │             │             │             │                   │ │
│  │  ┌───────┴─────────────┴─────────────┴─────────────┴───────────────┐  │ │
│  │  │              Unified Device Protocol Layer                       │  │ │
│  │  └──────────────────────────────┬──────────────────────────────────┘  │ │
│  │                                 │                                      │ │
│  │  ┌──────────────────────────────┴──────────────────────────────────┐  │ │
│  │  │                    Safety & Validation Layer                     │  │ │
│  │  │  • Command Whitelist  • Resource Limits  • Rate Limits          │  │ │
│  │  │  • Approval Workflow  • Audit Logging   • Timeout Enforcement   │  │ │
│  │  └─────────────────────────────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└───────────────────┬───────────────────┬───────────────────┬──────────────────┘
                    │                   │                   │
         ┌──────────┴──────────┐  ┌─────┴─────┐  ┌─────────┴─────────┐
         │   WebSocket/gRPC    │  │   MQTT    │  │   Direct Socket   │
         │  (PC Agent <-> Svc) │  │  Broker   │  │  (WiFi/BLE)       │
         └──────────┬──────────┘  └─────┬─────┘  └─────────┬─────────┘
                    │                   │                   │
         ┌──────────┴──────────┐  ┌─────┴─────────┐  ┌─────┴─────────┐
         │   Rubic PC Agent    │  │  IoT Devices  │  │ Smart Devices │
         │   (Installed App)   │  │ (ESP32, etc.) │  │ (WiFi/BLE)    │
         └─────────────────────┘  └───────────────┘  └───────────────┘
```

---

## Device Types

### 1. PC Control (Primary)

**Installation:**
```bash
# macOS/Linux
curl -fsSL https://agent.rubic.ai/install.sh | bash

# Windows (PowerShell)
iwr -useb https://agent.rubic.ai/install.ps1 | iex

# npm (cross-platform)
npm install -g @rubic/agent
rubic-agent start
```

**Agent Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Rubic PC Agent                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 WebSocket Client                       │  │
│  │  Connects to: wss://devices.rubic.ai/agent/{token}    │  │
│  └────────────────────────┬─────────────────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴─────────────────────────────┐  │
│  │                  Command Router                       │  │
│  └───┬──────────┬──────────┬──────────┬────────────────┘  │
│      │          │          │          │                     │
│  ┌───┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐              │
│  │ Shell  │ │Browser │ │  File  │ │ System │              │
│  │Executor│ │Control │ │  Ops   │ │  Info  │              │
│  └────────┘ └────────┘ └────────┘ └────────┘              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Safety Sandbox (OS-level)                │  │
│  │  • Process isolation  • File system restrictions      │  │
│  │  • Network allowlist  • Resource limits               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Capabilities:**
- Shell command execution (bash, zsh, PowerShell)
- Python/Node.js script execution
- Browser automation via Playwright
- File read/write/search
- Screenshot capture
- System information retrieval
- Application launching

### 2. MQTT Devices

**Protocol:** MQTT 5.0 over TLS (AWS IoT Core)

**Topic Structure:**
```
rubic/{user_id}/{device_id}/telemetry    # Device → Cloud (sensor data)
rubic/{user_id}/{device_id}/command      # Cloud → Device (control)
rubic/{user_id}/{device_id}/command/ack  # Device → Cloud (acknowledgment)
rubic/{user_id}/{device_id}/status       # Bidirectional (online/offline)
rubic/{user_id}/{device_id}/config       # Cloud → Device (configuration)
```

**Message Format:**
```json
{
  "message_id": "cmd_xxxxx",
  "timestamp": "2026-02-04T12:00:00Z",
  "type": "command",
  "payload": {
    "action": "set_temperature",
    "parameters": {
      "value": 22,
      "unit": "celsius"
    }
  },
  "correlation_id": "task_xxxxx",
  "qos": 1,
  "ttl": 30000
}
```

**QoS Levels:**
- **QoS 0:** Telemetry data (fire-and-forget)
- **QoS 1:** Commands (at-least-once delivery)
- **QoS 2:** Critical commands (exactly-once)

### 3. WiFi/Bluetooth Devices

**Discovery Protocol:**
```
1. Device broadcasts mDNS/DNS-SD service
2. Service queries local network for _rubic._tcp services
3. Device responds with capabilities manifest
4. Service establishes secure connection
```

**Connection Types:**
- **HTTP REST:** Simple request/response devices
- **WebSocket:** Real-time bidirectional
- **TCP Socket:** Low-level control
- **BLE GATT:** Bluetooth Low Energy characteristics

---

## API Design

### REST API Endpoints

```yaml
# Device Registration
POST /v1/devices:
  description: Register a new device
  request:
    body:
      name: string (required)
      type: enum [pc, mqtt, wifi, bluetooth] (required)
      description: string
      config: DeviceConfig
  response:
    device_id: string
    access_token: string (for PC agent)
    certificate: string (for MQTT)
    status: string

# List Devices
GET /v1/devices:
  query:
    type: enum[]
    status: enum [online, offline]
    limit: integer
    after: string
  response:
    data: Device[]
    has_more: boolean

# Get Device Details
GET /v1/devices/{device_id}:
  response:
    id: string
    name: string
    type: string
    status: string
    capabilities: string[]
    last_seen_at: timestamp
    metadata: object

# Execute Command
POST /v1/devices/{device_id}/command:
  request:
    body:
      command: string (required)
      type: enum [shell, script, action, query] (required)
      parameters: object
      timeout: integer (default: 30000)
      requires_approval: boolean (default: false)
  response:
    execution_id: string
    status: enum [queued, executing, completed, failed]

# Get Command Status
GET /v1/devices/{device_id}/commands/{execution_id}:
  response:
    id: string
    status: string
    output: string
    error: string
    started_at: timestamp
    completed_at: timestamp

# Real-Time Stream
WS /v1/devices/{device_id}/stream:
  description: WebSocket for real-time device communication
  messages:
    # Client → Server
    - type: command
      data: { command: string, type: string, parameters: object }
    - type: subscribe
      data: { events: string[] }

    # Server → Client
    - type: output
      data: { stdout: string, stderr: string }
    - type: status
      data: { status: string, metrics: object }
    - type: event
      data: { event_type: string, payload: object }

# Unregister Device
DELETE /v1/devices/{device_id}:
  response:
    success: boolean
```

### gRPC Service Definition

```protobuf
// proto/device.proto
syntax = "proto3";
package rubic.device.v1;

service DeviceService {
  // Device Management
  rpc RegisterDevice(RegisterDeviceRequest) returns (RegisterDeviceResponse);
  rpc GetDevice(GetDeviceRequest) returns (Device);
  rpc ListDevices(ListDevicesRequest) returns (ListDevicesResponse);
  rpc UpdateDevice(UpdateDeviceRequest) returns (Device);
  rpc DeleteDevice(DeleteDeviceRequest) returns (DeleteDeviceResponse);

  // Command Execution
  rpc ExecuteCommand(ExecuteCommandRequest) returns (ExecuteCommandResponse);
  rpc GetCommandStatus(GetCommandStatusRequest) returns (CommandStatus);
  rpc CancelCommand(CancelCommandRequest) returns (CancelCommandResponse);

  // Streaming
  rpc StreamDevice(stream DeviceMessage) returns (stream DeviceMessage);
}

message Device {
  string id = 1;
  string user_id = 2;
  string name = 3;
  DeviceType type = 4;
  DeviceStatus status = 5;
  repeated string capabilities = 6;
  google.protobuf.Timestamp last_seen_at = 7;
  map<string, string> metadata = 8;
}

enum DeviceType {
  DEVICE_TYPE_UNSPECIFIED = 0;
  DEVICE_TYPE_PC = 1;
  DEVICE_TYPE_MQTT = 2;
  DEVICE_TYPE_WIFI = 3;
  DEVICE_TYPE_BLUETOOTH = 4;
}

enum DeviceStatus {
  DEVICE_STATUS_UNSPECIFIED = 0;
  DEVICE_STATUS_ONLINE = 1;
  DEVICE_STATUS_OFFLINE = 2;
  DEVICE_STATUS_CONNECTING = 3;
  DEVICE_STATUS_ERROR = 4;
}

message ExecuteCommandRequest {
  string device_id = 1;
  string command = 2;
  CommandType type = 3;
  map<string, string> parameters = 4;
  int32 timeout_ms = 5;
  bool requires_approval = 6;
}

enum CommandType {
  COMMAND_TYPE_UNSPECIFIED = 0;
  COMMAND_TYPE_SHELL = 1;
  COMMAND_TYPE_SCRIPT = 2;
  COMMAND_TYPE_ACTION = 3;
  COMMAND_TYPE_QUERY = 4;
}
```

---

## Safety & Security Architecture

### Command Safety Rules

```go
// internal/safety/rules.go
type SafetyRules struct {
    // Whitelist of allowed commands (regex patterns)
    AllowedCommands []string

    // Blacklist of forbidden commands
    ForbiddenCommands []string

    // Paths that cannot be accessed
    ForbiddenPaths []string

    // Commands requiring human approval
    ApprovalRequired []string

    // Resource limits
    MaxExecutionTime time.Duration
    MaxOutputSize    int64
    MaxMemoryUsage   int64

    // Rate limits
    MaxCommandsPerMinute int
    MaxConcurrentCommands int
}

var DefaultPCRules = SafetyRules{
    AllowedCommands: []string{
        `^ls\s`,           // List files
        `^cat\s`,          // Read files
        `^echo\s`,         // Output text
        `^pwd$`,           // Current directory
        `^whoami$`,        // Current user
        `^date$`,          // Current date
        `^python3?\s`,     // Python scripts
        `^node\s`,         // Node.js scripts
        // ... more safe commands
    },

    ForbiddenCommands: []string{
        `^rm\s+-rf\s+/`,   // No recursive delete from root
        `^sudo\s`,         // No sudo
        `^su\s`,           // No su
        `>\s*/etc/`,       // No writing to /etc
        `\|\s*bash`,       // No piping to bash
        `curl.*\|\s*sh`,   // No curl | sh
    },

    ForbiddenPaths: []string{
        "/etc/passwd",
        "/etc/shadow",
        "~/.ssh",
        "~/.aws",
        "~/.config/gcloud",
        ".env",
    },

    ApprovalRequired: []string{
        `^rm\s`,           // Any delete requires approval
        `^mv\s`,           // Any move requires approval
        `^chmod\s`,        // Permission changes
        `^chown\s`,        // Ownership changes
        `pip\s+install`,   // Package installation
        `npm\s+install`,   // Package installation
    },

    MaxExecutionTime:      30 * time.Second,
    MaxOutputSize:         10 * 1024 * 1024, // 10MB
    MaxMemoryUsage:        512 * 1024 * 1024, // 512MB
    MaxCommandsPerMinute:  60,
    MaxConcurrentCommands: 5,
}
```

### Human-in-the-Loop Approval

```
┌─────────────────────────────────────────────────────────────────┐
│                    APPROVAL WORKFLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Agent requests sensitive command                             │
│     └─→ "rm -rf ./old_project"                                  │
│                                                                  │
│  2. Device Service checks SafetyRules                           │
│     └─→ Command matches ApprovalRequired pattern                │
│                                                                  │
│  3. Create pending approval request                              │
│     └─→ Store in database, notify user                          │
│                                                                  │
│  4. Send notification to user                                    │
│     ┌────────────────────────────────────────────┐              │
│     │  Rubic needs your approval:                 │              │
│     │                                             │              │
│     │  Command: rm -rf ./old_project              │              │
│     │  Device:  MacBook Pro                       │              │
│     │  Task:    Clean up workspace                │              │
│     │                                             │              │
│     │  [Approve]  [Deny]  [View Details]          │              │
│     └────────────────────────────────────────────┘              │
│                                                                  │
│  5. User approves/denies                                         │
│     └─→ Approval recorded with user_id, timestamp               │
│                                                                  │
│  6. Execute or reject command                                    │
│     └─→ Full audit trail maintained                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Audit Logging

```go
type AuditLog struct {
    ID           string    `json:"id"`
    Timestamp    time.Time `json:"timestamp"`
    UserID       string    `json:"user_id"`
    DeviceID     string    `json:"device_id"`
    TaskID       string    `json:"task_id,omitempty"`

    // Command details
    Command      string    `json:"command"`
    CommandType  string    `json:"command_type"`
    Parameters   map[string]any `json:"parameters"`

    // Execution
    Status       string    `json:"status"`
    ExitCode     int       `json:"exit_code,omitempty"`
    Output       string    `json:"output,omitempty"`
    Error        string    `json:"error,omitempty"`

    // Timing
    QueuedAt     time.Time `json:"queued_at"`
    StartedAt    time.Time `json:"started_at,omitempty"`
    CompletedAt  time.Time `json:"completed_at,omitempty"`
    Duration     int64     `json:"duration_ms,omitempty"`

    // Approval (if required)
    RequiredApproval bool      `json:"required_approval"`
    ApprovedBy       string    `json:"approved_by,omitempty"`
    ApprovedAt       time.Time `json:"approved_at,omitempty"`

    // Source
    Source       string    `json:"source"` // "agent", "user", "automation"
    IPAddress    string    `json:"ip_address"`
    UserAgent    string    `json:"user_agent"`
}
```

---

## PC Agent Implementation

### Agent Configuration

```yaml
# ~/.rubic/config.yaml
server:
  url: wss://devices.rubic.ai
  reconnect_interval: 5s
  heartbeat_interval: 30s

security:
  sandbox_mode: true
  allowed_paths:
    - ~/Documents
    - ~/Projects
    - /tmp
  forbidden_paths:
    - ~/.ssh
    - ~/.aws
    - ~/.config/gcloud
  max_execution_time: 60s
  require_approval:
    - delete
    - install

features:
  shell: true
  browser: true
  file_operations: true
  screenshots: true
  system_info: true

logging:
  level: info
  file: ~/.rubic/agent.log
```

### Agent Core Logic

```typescript
// @rubic/agent/src/agent.ts
import WebSocket from 'ws';
import { spawn } from 'child_process';
import { SafetyValidator } from './safety';
import { BrowserController } from './browser';

export class RubicAgent {
  private ws: WebSocket | null = null;
  private config: AgentConfig;
  private safety: SafetyValidator;
  private browser: BrowserController;

  constructor(config: AgentConfig) {
    this.config = config;
    this.safety = new SafetyValidator(config.security);
    this.browser = new BrowserController();
  }

  async connect(token: string): Promise<void> {
    const url = `${this.config.server.url}/agent/${token}`;

    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('Connected to Rubic server');
      this.startHeartbeat();
    });

    this.ws.on('message', async (data) => {
      const message = JSON.parse(data.toString());
      await this.handleMessage(message);
    });

    this.ws.on('close', () => {
      console.log('Disconnected, reconnecting...');
      setTimeout(() => this.connect(token), this.config.server.reconnect_interval);
    });
  }

  private async handleMessage(message: AgentMessage): Promise<void> {
    switch (message.type) {
      case 'command':
        await this.executeCommand(message.data);
        break;
      case 'browser':
        await this.executeBrowserAction(message.data);
        break;
      case 'file':
        await this.executeFileOperation(message.data);
        break;
      case 'ping':
        this.send({ type: 'pong', timestamp: Date.now() });
        break;
    }
  }

  private async executeCommand(cmd: CommandRequest): Promise<void> {
    // Validate command against safety rules
    const validation = this.safety.validate(cmd);
    if (!validation.allowed) {
      this.send({
        type: 'command_result',
        execution_id: cmd.execution_id,
        status: 'rejected',
        error: validation.reason,
      });
      return;
    }

    // Check if approval is required
    if (validation.requiresApproval) {
      this.send({
        type: 'approval_required',
        execution_id: cmd.execution_id,
        command: cmd.command,
        reason: validation.approvalReason,
      });
      return;
    }

    // Execute command
    try {
      const result = await this.runCommand(cmd);
      this.send({
        type: 'command_result',
        execution_id: cmd.execution_id,
        status: 'completed',
        output: result.stdout,
        error: result.stderr,
        exit_code: result.exitCode,
      });
    } catch (error) {
      this.send({
        type: 'command_result',
        execution_id: cmd.execution_id,
        status: 'failed',
        error: error.message,
      });
    }
  }

  private runCommand(cmd: CommandRequest): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const timeout = cmd.timeout || this.config.security.max_execution_time;
      let stdout = '';
      let stderr = '';

      const process = spawn(cmd.command, {
        shell: true,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB
      });

      process.stdout.on('data', (data) => {
        stdout += data.toString();
        // Stream output in real-time
        this.send({
          type: 'command_output',
          execution_id: cmd.execution_id,
          stdout: data.toString(),
        });
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
        this.send({
          type: 'command_output',
          execution_id: cmd.execution_id,
          stderr: data.toString(),
        });
      });

      process.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });

      process.on('error', reject);
    });
  }

  private send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
```

---

## AWS IoT Core Integration

### Device Provisioning

```typescript
// services/device/src/mqtt/provisioning.ts
import { IoTClient, CreateThingCommand, CreateKeysAndCertificateCommand } from '@aws-sdk/client-iot';

export async function provisionMQTTDevice(
  userId: string,
  deviceId: string,
  deviceName: string
): Promise<MQTTCredentials> {
  const iot = new IoTClient({ region: process.env.AWS_REGION });

  // Create certificate
  const certResponse = await iot.send(new CreateKeysAndCertificateCommand({
    setAsActive: true,
  }));

  // Create thing
  const thingName = `rubic-${userId}-${deviceId}`;
  await iot.send(new CreateThingCommand({
    thingName,
    attributePayload: {
      attributes: {
        userId,
        deviceId,
        deviceName,
      },
    },
  }));

  // Attach certificate to thing
  await iot.send(new AttachThingPrincipalCommand({
    thingName,
    principal: certResponse.certificateArn!,
  }));

  // Attach policy
  await iot.send(new AttachPolicyCommand({
    policyName: 'rubic-device-policy',
    target: certResponse.certificateArn!,
  }));

  return {
    certificatePem: certResponse.certificatePem!,
    privateKey: certResponse.keyPair!.PrivateKey!,
    endpoint: await getIoTEndpoint(),
    thingName,
  };
}
```

### IoT Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:*:*:client/${iot:Connection.Thing.ThingName}"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": [
        "arn:aws:iot:*:*:topic/rubic/${iot:Connection.Thing.Attributes[userId]}/${iot:Connection.Thing.Attributes[deviceId]}/telemetry",
        "arn:aws:iot:*:*:topic/rubic/${iot:Connection.Thing.Attributes[userId]}/${iot:Connection.Thing.Attributes[deviceId]}/command/ack",
        "arn:aws:iot:*:*:topic/rubic/${iot:Connection.Thing.Attributes[userId]}/${iot:Connection.Thing.Attributes[deviceId]}/status"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": [
        "arn:aws:iot:*:*:topicfilter/rubic/${iot:Connection.Thing.Attributes[userId]}/${iot:Connection.Thing.Attributes[deviceId]}/command",
        "arn:aws:iot:*:*:topicfilter/rubic/${iot:Connection.Thing.Attributes[userId]}/${iot:Connection.Thing.Attributes[deviceId]}/config"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "iot:Receive",
      "Resource": [
        "arn:aws:iot:*:*:topic/rubic/${iot:Connection.Thing.Attributes[userId]}/${iot:Connection.Thing.Attributes[deviceId]}/command",
        "arn:aws:iot:*:*:topic/rubic/${iot:Connection.Thing.Attributes[userId]}/${iot:Connection.Thing.Attributes[deviceId]}/config"
      ]
    }
  ]
}
```

---

## Consequences

### Positive
- Unified API for all device types
- Strong security with safety rules and approval workflows
- Real-time communication via WebSocket and MQTT
- Scalable with AWS IoT Core
- Full audit trail for compliance

### Negative
- Complexity of supporting multiple protocols
- PC agent installation friction for end users
- MQTT device firmware development required

### Risks
- Security vulnerabilities in PC agent
- Device connectivity issues
- Command injection attacks

### Mitigations
- Regular security audits of PC agent
- Automatic reconnection logic
- Input sanitization and validation
- Sandboxed execution environment

---

## References

- [OpenClaw Architecture](https://docs.openclaw.ai/)
- [AWS IoT Core Documentation](https://docs.aws.amazon.com/iot/)
- [MQTT 5.0 Specification](https://mqtt.org/)
- [Playwright Documentation](https://playwright.dev/)
