# Rubic Platform: Comprehensive Architecture Analysis

**Version:** 1.0.0  
**Status:** Strategic Analysis  
**Last Updated:** 2026-02-04  
**Classification:** Internal - Engineering Team

---

## Executive Summary

Rubic is positioned as a next-generation autonomous AI agent platform that extends beyond Manus.im's capabilities by integrating comprehensive device control (PC, MQTT, WiFi, Bluetooth) into a DAG-based multi-agent orchestration system. This analysis provides a comprehensive review of the current architecture, competitive positioning, and strategic roadmap.

### Key Findings

| Aspect                   | Assessment                                | Priority |
| ------------------------ | ----------------------------------------- | -------- |
| **Architecture Design**  | Excellent polyglot microservices          | High     |
| **Device Control**       | Unique differentiator                     | Critical |
| **AI Orchestration**     | Well-designed, needs Composio integration | High     |
| **Frontend**             | Strong foundation with Next.js 16         | Medium   |
| **Service Completion**   | 4/14 services fully implemented           | Critical |
| **Production Readiness** | 30% - Major gaps exist                    | Critical |

### Competitive Position

```
Capability Comparison (Score: 1-10)

Feature                 | Manus.im | Rubic Current | Rubic Target
------------------------|----------|---------------|-------------
Multi-Agent DAG         |    9     |       4       |      10
Device Control          |    2     |       6       |      10
Code Sandbox            |    9     |       5       |       9
Website Builder         |    8     |       7       |       9
Third-Party Tools       |    8     |       3       |      10
Real-Time Streaming     |    9     |       7       |       9
User Experience         |    9     |       5       |       9
Production Maturity     |   10     |       3       |       9
```

---

## Table of Contents

1. [Vision & Strategy](#vision--strategy)
2. [Architecture Deep Dive](#architecture-deep-dive)
3. [Manus.im Reverse Engineering](#manusim-reverse-engineering)
4. [Technology Stack Analysis](#technology-stack-analysis)
5. [Implementation Status](#implementation-status)
6. [Gap Analysis](#gap-analysis)
7. [Roadmap & Priorities](#roadmap--priorities)
8. [Risk Assessment](#risk-assessment)
9. [Recommendations](#recommendations)

---

## Vision & Strategy

### Rubic's Unique Value Proposition

```
┌─────────────────────────────────────────────────────────────────────┐
│                    RUBIC POSITIONING MAP                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Low Device Control Capability                                       │
│         ▲                                                            │
│         │         ChatGPT                                           │
│         │              Claude                                       │
│         │                   ┌──────────────┐                        │
│         │                   │  Manus.im    │                        │
│         │                   └──────────────┘                        │
│         │                                                            │
│         │     ┌────────────────────────────────────────┐            │
│         │     │         RUBIC TARGET ZONE              │            │
│         │     │  ┌──────────────────────────────────┐  │            │
│         │     │  │  ★ DAG AI + Full Device Control  │  │            │
│         │     │  │  ★ Real-time Automation          │  │            │
│         │     │  │  ★ Personal AI Assistant         │  │            │
│         │     │  └──────────────────────────────────┘  │            │
│         │     └────────────────────────────────────────┘            │
│         │                                                            │
│         │    Home Assistant      OpenClaw                           │
│         │         ┌───┐           ┌───┐                            │
│         │         │   │           │   │                            │
│         └─────────┴───┴───────────┴───┴────────────────────────▶   │
│                     Low AI Capability    High AI Capability         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Core Differentiators

1. **DAG-Based Multi-Agent Orchestration**

   - Hierarchical agent delegation
   - Parallel task execution
   - Dynamic workflow generation

2. **Universal Device Control**

   - PC remote control (OpenClaw-style)
   - MQTT IoT device management
   - WiFi/Bluetooth device integration
   - Human-in-the-loop safety

3. **Real-Time Personal Automation**

   - Sub-second response times
   - Continuous device monitoring
   - Proactive task execution

4. **Integrated Development Environment**
   - AI-powered website builder
   - Code sandboxing (E2B)
   - Database provisioning (TiDB)

---

## Architecture Deep Dive

### Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CURRENT RUBIC ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FRONTEND (Next.js 16.1, React 19.2)                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ Redux Toolkit + RTK Query                                 │   │
│  │  ✓ Real-time WebSocket client                                │   │
│  │  ✓ Comprehensive settings UI                                 │   │
│  │  ✓ Device management interface                               │   │
│  │  ⚠ Prompt input needs refactoring (@repo/ai)                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  GATEWAY (Node.js/Fastify) - ✓ IMPLEMENTED                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ✓ HTTP routing                                              │   │
│  │  ✓ WebSocket proxy                                           │   │
│  │  ✓ Rate limiting                                             │   │
│  │  ✓ Auth middleware                                           │   │
│  │  ✓ 7 route files, ~600 lines                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│         ┌────────────────────┼────────────────────┐                  │
│         ▼                    ▼                    ▼                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │ Task Service │   │ Agent Service│   │Device Service│            │
│  │ Node.js/TS   │   │ Python/FastAPI│   │     Go       │            │
│  │ ⚠ Partial    │   │ ✓ Implemented│   │ ✓ Implemented│            │
│  │ ~430 lines   │   │ ~680 lines   │   │ ~1110 lines  │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │
│  │Website Svc   │   │ Other Svcs   │   │              │            │
│  │ ✓ Implemented│   │ ✗ Stubs only │   │              │            │
│  │ ~810 lines   │   │ ~150 lines   │   │              │            │
│  └──────────────┘   └──────────────┘   └──────────────┘            │
│                                                                      │
│  LEGEND: ✓ Complete | ⚠ Partial | ✗ Not Started                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Service Implementation Matrix

| Service          | Language | Status     | LOC   | Completeness | Priority |
| ---------------- | -------- | ---------- | ----- | ------------ | -------- |
| **Gateway**      | Node.js  | ✓ Complete | 602   | 90%          | High     |
| **Agent**        | Python   | ✓ Complete | 677   | 85%          | Critical |
| **Device**       | Go       | ✓ Complete | 1,111 | 80%          | Critical |
| **Task**         | Node.js  | ⚠ Partial | 428   | 60%          | High     |
| **Website**      | Node.js  | ✓ Complete | 812   | 85%          | Medium   |
| **File**         | Node.js  | ✗ Stub     | 104   | 10%          | Medium   |
| **Project**      | Node.js  | ✗ Stub     | 148   | 10%          | Low      |
| **Webhook**      | Node.js  | ✗ Stub     | 150   | 10%          | Low      |
| **Notification** | Node.js  | ✗ Stub     | 116   | 10%          | Medium   |
| **Connector**    | Node.js  | ✗ Stub     | 140   | 10%          | High     |
| **Billing**      | Node.js  | ✗ Stub     | 153   | 10%          | Low      |
| **Sandbox**      | Go       | ✗ Stub     | 189   | 10%          | High     |
| **Knowledge**    | Python   | ✗ Stub     | 155   | 10%          | Medium   |
| **Search**       | Node.js  | ✗ Stub     | 185   | 10%          | Low      |

### Critical Path Analysis

```
User Request Flow:
─────────────────────────────────────────────────────────────

User Input
    ↓
[Gateway] ✓ Implemented
    ↓
[Auth Check] ✓ Implemented
    ↓
[Task Service] ⚠ Partial - Needs completion
    ↓
[Agent Service] ✓ Implemented
    ├─→ [LLM Call] ✓ Implemented
    ├─→ [Tool Execution] ⚠ Needs Composio integration
    │       ├─→ [Device Service] ✓ Implemented
    │       │       ├─→ [PC Agent] ⚠ Needs desktop client
    │       │       └─→ [MQTT] ✓ Implemented
    │       └─→ [External APIs] ⚠ Needs Composio
    └─→ [Code Sandbox] ⚠ Stub - Needs E2B integration
    ↓
[Stream Response] ✓ Implemented
    ↓
[Store Results] ⚠ Task persistence incomplete
```

---

## Manus.im Reverse Engineering

### Manus Architecture (Inferred)

Based on extensive research from bundle analysis, leaked prompts, and system behavior:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MANUS.IM ARCHITECTURE (Inferred)                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FRONTEND                                                            │
│  ├─ React 19 (canary) with 39 Redux slices                          │
│  ├─ Ant Design + MUI + Chakra (multiple UI libs)                    │
│  ├─ Monaco Editor (VS Code in browser)                              │
│  ├─ Webpack + Babel build system                                    │
│  └─ WebSocket/Socket.io for real-time                               │
│                                                                      │
│  BACKEND                                                             │
│  ├─ Node.js microservices (Express/Fastify)                         │
│  ├─ Multi-agent orchestration (Claude 3.5 primary)                  │
│  ├─ Firecracker MicroVMs for sandboxing                             │
│  ├─ PostgreSQL + MongoDB + Redis                                    │
│  └─ Cloudflare CDN + AWS infrastructure                             │
│                                                                      │
│  AI ORCHESTRATION                                                    │
│  ├─ Claude 3.5 Sonnet (primary reasoning)                           │
│  ├─ GPT-4o (fallback/fast tasks)                                    │
│  ├─ Qwen fine-tuned (code generation)                               │
│  ├─ CodeAct pattern (code as actions)                               │
│  └─ 47+ built-in tools                                              │
│                                                                      │
│  SANDBOX                                                             │
│  ├─ Ubuntu 22.04 VMs                                                │
│  ├─ Playwright for browser automation                               │
│  ├─ Python 3.10 + Node.js 20                                        │
│  └─ Git, SQLite, common dev tools                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Manus Tool System (from leaked prompts)

```yaml
Core Tools:
  - message_notify_user # User notifications
  - message_ask_user # Interactive questions
  - file_read # Read files
  - file_write # Write files
  - file_str_replace # Edit files
  - file_find_in_content # Search in files
  - file_find_by_name # Find files
  - shell_exec # Execute commands
  - shell_view # View terminal output
  - shell_wait # Wait for process
  - shell_write_to_process # Send input
  - browser_navigate # Browser control
  - browser_click
  - browser_input
  - browser_scroll
  - info_search_web # Web search
  - deploy_expose_port # Deploy services
  - make_manus_page # Create pages

Tool Rules:
  - Always respond with tool calls (no plain text)
  - One tool per iteration
  - Never mention tool names to users
  - Wait for observation before next action
```

### Rubic vs Manus: Feature Comparison

| Feature             | Manus.im      | Rubic Current    | Rubic Advantage              |
| ------------------- | ------------- | ---------------- | ---------------------------- |
| **Multi-Agent DAG** | ✓ Advanced    | ⚠ Basic         | Target: Better orchestration |
| **Device Control**  | ✗ None        | ✓ Unique         | PC + MQTT + IoT              |
| **Code Sandbox**    | ✓ Firecracker | ⚠ E2B planned   | Same capability              |
| **Website Builder** | ✓ v0-style    | ✓ Implemented    | + TiDB integration           |
| **Integrations**    | ✓ 47 tools    | ✗ Needs Composio | Target: 800+ tools           |
| **Real-Time**       | ✓ WebSocket   | ✓ WebSocket      | Parity achieved              |
| **Mobile App**      | ✗ None        | ✗ None           | Opportunity                  |
| **Self-Hosting**    | ✗ Cloud only  | ✓ Docker         | Enterprise advantage         |
| **Open Source**     | ✗ Closed      | ⚠ Parts         | Community potential          |

---

## Technology Stack Analysis

### Composio Integration

**Why Composio is Critical:**

- 800+ pre-built integrations
- Managed OAuth token refresh
- SOC 2 compliant
- Supports all major AI frameworks

```python
# Integration Pattern
from composio import ComposioToolSet

toolset = ComposioToolSet(api_key=os.getenv('COMPOSIO_API_KEY'))

# Add to Agent Service
gmail_tools = toolset.get_tools(actions=['GMAIL_SEND_EMAIL'])
slack_tools = toolset.get_tools(actions=['SLACK_SEND_MESSAGE'])
notion_tools = toolset.get_tools(actions=['NOTION_CREATE_PAGE'])

# Execute
result = toolset.execute_action(
    action='GMAIL_SEND_EMAIL',
    params={'to': 'user@example.com', 'subject': 'Hello'},
    entity_id=user_id
)
```

**Priority Integrations:**

1. Gmail, Google Calendar, Google Drive
2. Slack, Discord
3. GitHub, GitLab
4. Notion, Linear
5. HubSpot, Salesforce

### AWS IoT Core for Device Management

**Architecture:**

```
Device (PC/IoT) ──MQTT──► AWS IoT Core ──► Device Service (Go)
                              │
                              ▼
                        PostgreSQL (state)
```

**Pricing Considerations:**

- $1 per million messages (first 1B messages)
- Device connection: $0.08 per million minutes
- Certificate management: Included

**Topic Structure:**

```
rubic/{user_id}/{device_id}/telemetry    # Device → Cloud
rubic/{user_id}/{device_id}/command      # Cloud → Device
rubic/{user_id}/{device_id}/status       # Bidirectional
```

### E2B Sandboxing

**Why E2B:**

- 150ms sandbox startup
- Firecracker MicroVMs (same as AWS Lambda)
- Hardware-level isolation
- 24-hour session support

```python
from e2b import Sandbox

# Create sandbox
sandbox = Sandbox(template='nodejs')

# Execute code
result = sandbox.run_code('console.log("Hello")')

# File operations
sandbox.filesystem.write('/app/file.txt', 'content')
content = sandbox.filesystem.read('/app/file.txt')

# Keep alive for long tasks
sandbox.keep_alive(3600)  # 1 hour
```

### Inngest for Workflow Orchestration

**Why Inngest:**

- Durable execution with checkpointing
- Built-in retries and idempotency
- Scheduled tasks
- Event-driven architecture

```typescript
// Workflow definition
import { inngest } from "@/lib/inngest";

export const agentWorkflow = inngest.createFunction(
  { id: "agent-task" },
  { event: "task/created" },
  async ({ event, step }) => {
    // Step 1: Plan
    const plan = await step.run("plan", async () => {
      return await agent.plan(event.data.prompt);
    });

    // Step 2: Execute steps in parallel
    const results = await step.parallel(
      plan.steps.map((step) => ({
        name: `execute-${step.id}`,
        fn: async () => await agent.execute(step),
      }))
    );

    // Step 3: Summarize
    return await step.run("summarize", async () => {
      return await agent.summarize(results);
    });
  }
);
```

---

## Gap Analysis

### Critical Gaps

| Gap                              | Impact | Effort | Priority |
| -------------------------------- | ------ | ------ | -------- |
| **Task persistence incomplete**  | High   | Medium | P0       |
| **Missing Composio integration** | High   | Medium | P0       |
| **PC Agent desktop app**         | High   | High   | P0       |
| **E2B sandbox integration**      | Medium | Medium | P1       |
| **Inngest workflow setup**       | Medium | Medium | P1       |
| **Service stubs incomplete**     | Medium | High   | P1       |
| **AWS IoT mTLS config**          | High   | Medium | P0       |
| **Frontend prompt refactoring**  | Medium | Medium | P1       |

### Production Readiness Checklist

```yaml
Infrastructure:
  - [ ] AWS account setup
  - [ ] ECS Fargate cluster
  - [ ] RDS PostgreSQL with pgvector
  - [ ] ElastiCache Redis
  - [ ] S3 buckets
  - [ ] AWS IoT Core
  - [ ] Application Load Balancer
  - [ ] Route53 DNS

Services:
  - [ ] Gateway service deployed
  - [ ] Agent service deployed
  - [ ] Device service deployed
  - [ ] Task service completed & deployed
  - [ ] File service implemented
  - [ ] Billing service implemented

Security:
  - [ ] JWT authentication
  - [ ] API key management
  - [ ] Rate limiting
  - [ ] CORS configuration
  - [ ] VPC security groups
  - [ ] Secrets management (AWS Secrets Manager)

Monitoring:
  - [ ] CloudWatch dashboards
  - [ ] Sentry error tracking
  - [ ] Health checks
  - [ ] Log aggregation
  - [ ] Alerting rules

Integrations:
  - [ ] Composio API keys
  - [ ] E2B API keys
  - [ ] OpenAI/Anthropic API keys
  - [ ] Stripe account
  - [ ] AWS IoT certificates
```

---

## Roadmap & Priorities

### Phase 1: MVP Core (Weeks 1-4)

**Goal:** Working chat with device control

```
Week 1:
├── Complete Task service persistence
├── Fix database schema (add tasks table)
└── Integrate Agent → Task communication

Week 2:
├── Composio integration (top 10 tools)
├── Test end-to-end task execution
└── Fix service discovery (env vars)

Week 3:
├── AWS IoT mTLS configuration
├── Device registration flow
└── PC Agent prototype (Node.js)

Week 4:
├── Device command execution
├── Safety rules implementation
└── Integration testing
```

### Phase 2: Device Control (Weeks 5-8)

**Goal:** Full device ecosystem

```
Week 5:
├── PC Agent (cross-platform)
├── Shell command execution
└── File operations

Week 6:
├── Browser automation (Playwright)
├── Screenshot capture
└── System information

Week 7:
├── MQTT device onboarding
├── Device templates
└── Telemetry dashboard

Week 8:
├── WiFi/Bluetooth discovery
├── Mobile device support
└── Device groups
```

### Phase 3: Production (Weeks 9-12)

**Goal:** Production-ready platform

```
Week 9:
├── E2B sandbox integration
├── Code execution
└── File management

Week 10:
├── Inngest workflows
├── Scheduled tasks
└── Multi-step DAG

Week 11:
├── Billing service
├── Credit system
└── Subscription tiers

Week 12:
├── Performance optimization
├── Security audit
└── Documentation
```

---

## Risk Assessment

### Technical Risks

| Risk                                | Likelihood | Impact   | Mitigation                             |
| ----------------------------------- | ---------- | -------- | -------------------------------------- |
| **Multi-language complexity**       | High       | Medium   | Standardize on protobuf, OpenTelemetry |
| **Device security vulnerabilities** | Medium     | Critical | Safety rules, sandboxing, audits       |
| **LLM provider rate limits**        | High       | Medium   | Multi-provider fallback, caching       |
| **AWS IoT scaling costs**           | Medium     | Medium   | Monitor, optimize message size         |
| **WebSocket connection limits**     | Medium     | High     | Horizontal scaling, Redis pub/sub      |

### Business Risks

| Risk                                 | Likelihood | Impact | Mitigation                             |
| ------------------------------------ | ---------- | ------ | -------------------------------------- |
| **Manus.im feature expansion**       | High       | High   | Faster iteration, device focus         |
| **OpenAI/Anthropic pricing changes** | Medium     | Medium | Multi-provider strategy                |
| **Composio acquisition/shutdown**    | Low        | High   | Abstraction layer, backup integrations |
| **AWS service disruptions**          | Low        | High   | Multi-region deployment                |

---

## Recommendations

### Immediate Actions (This Week)

1. **Fix Critical Bugs**

   - Service discovery (localhost → env vars)
   - Task persistence (complete DB integration)
   - Add missing `tasks` table to Drizzle schema

2. **Security Hardening**

   - Implement command safety rules
   - Add device approval workflow
   - Setup AWS IoT mTLS

3. **Developer Experience**
   - Complete docker-compose setup
   - Add health checks to all services
   - Document local development flow

### Short-Term (Next 4 Weeks)

1. **Complete Core Services**

   - Task service (persistence, status mgmt)
   - File service (S3 integration)
   - Connector service (Composio wrapper)

2. **Device Ecosystem**

   - PC Agent MVP
   - MQTT device templates
   - Device UI components

3. **Integration**
   - Composio SDK integration
   - Top 10 most-used tools
   - Tool execution flow

### Long-Term (Next 3 Months)

1. **Scale & Performance**

   - Implement caching layers
   - Add read replicas
   - Optimize WebSocket scaling

2. **Advanced Features**

   - DAG workflow visualization
   - Agent marketplace
   - Custom tool builder

3. **Enterprise Ready**
   - SSO (SAML/OIDC)
   - Audit logging
   - Compliance certifications

---

## Conclusion

Rubic has a solid architectural foundation with unique differentiation in device control. The polyglot microservices approach is well-suited for the diverse requirements of AI orchestration, device management, and real-time communication.

**Key Success Factors:**

1. Complete the critical path (Task → Agent → Device)
2. Integrate Composio for instant tool ecosystem
3. Ship PC Agent for unique device control capability
4. Focus on real-time performance
5. Maintain security-first approach

**Estimated Timeline to MVP:** 4-6 weeks  
**Estimated Timeline to Production:** 12-16 weeks  
**Team Size Recommended:** 4-6 engineers (2 frontend, 4 backend)

---

## Appendices

### A. Reference Documents

- [Frontend Documentation](../frontend/README.md)
- [Backend Documentation](../backend/README.md)
- [Testing Documentation](../testing/README.md)
- [ADR-001: Prompt Input Architecture](../adr/001-prompt-input-architecture.md)
- [ADR-002: Microservices Stack](../adr/002-microservices-stack.md)
- [ADR-003: Database Design](../adr/003-database-design.md)
- [ADR-004: Device Control System](../adr/004-device-control-system.md)
- [ADR-005: Third-Party Services](../adr/005-third-party-services.md)
- [ADR-006: Monorepo Structure](../adr/006-monorepo-structure.md)

### B. External Resources

- [Composio Documentation](https://docs.composio.dev/)
- [E2B Documentation](https://e2b.dev/docs)
- [Inngest Documentation](https://www.inngest.com/docs)
- [AWS IoT Core Documentation](https://docs.aws.amazon.com/iot/)
- [Fastify Documentation](https://www.fastify.io/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

### C. Manus Research Files

All Manus.im reverse engineering research is located in:
`/Users/khaleelmusleh/Desktop/Projects/Etheon/Manus/`

Key files:

- `Manus.im Complete Tech Stack - Comprehensive Reverse Engineering Report.md`
- `Manus_Backend_Architecture_A_Detailed_Breakdown.docx`
- `manus_tech_stack_analysis.md`
- `manus_deep_dive.md`
- `Manus-Class Agentic System Blueprint.md`
