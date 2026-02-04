# ADR-002: Microservices Technology Stack Selection

**Status:** Proposed
**Date:** 2026-02-04
**Decision Makers:** Engineering Team
**Technical Story:** Selecting the technology stack for backend microservices architecture

---

## Context and Problem Statement

Rubic needs a robust backend microservices architecture to support:
- AI agent orchestration with LLM providers
- Real-time streaming and WebSocket communication
- Device control (PC, MQTT, IoT)
- File management and sandboxed code execution
- High availability and scalability on AWS

We need to decide on the technology stack for each service considering:
- Performance requirements
- Team expertise
- Ecosystem maturity
- AWS compatibility
- Maintenance burden

---

## Decision Drivers

1. **Performance:** Real-time streaming, concurrent device connections
2. **Developer Experience:** Existing team skills, tooling ecosystem
3. **Type Safety:** End-to-end type safety with frontend
4. **Ecosystem:** Library availability, community support
5. **AWS Integration:** Native support for AWS services
6. **Scalability:** Horizontal scaling, containerization support

---

## Considered Options

### Option A: Full TypeScript/Node.js Stack
- All services in Node.js with TypeScript
- Fastify for HTTP, Prisma/Drizzle for DB
- Single language across stack

### Option B: Polyglot Stack (Recommended)
- **Node.js/TypeScript:** API Gateway, Task, File, Project, Webhook, Notification, Connector, Billing
- **Python:** Agent Service (LLM orchestration), Knowledge Service (RAG)
- **Go:** Device Service (high-concurrency), Sandbox Service (performance-critical)

### Option C: Python-Heavy Stack
- Python for most services (FastAPI)
- Go only for device-critical services
- Node.js only for frontend API

### Option D: Go-Heavy Stack
- Go for all backend services
- Python only for AI/ML components

---

## Decision Outcome

**Chosen Option:** Option B - Polyglot Stack

### Rationale

| Language | Services | Why |
|----------|----------|-----|
| **Node.js/TypeScript** | Gateway, Task, File, Project, Webhook, Notification, Connector, Billing | Type sharing with Next.js frontend, excellent async I/O, vast npm ecosystem, team expertise |
| **Python** | Agent, Knowledge | Best LLM ecosystem (LangChain, LiteLLM), ML/AI library support, Composio SDK, E2B SDK |
| **Go** | Device, Sandbox | Superior concurrency for device connections, low latency, memory efficiency, gRPC performance |

### Service-by-Service Justification

#### 1. Gateway Service (Node.js/TypeScript)
- **Why Node.js:** WebSocket support, JSON-native, shared types with frontend
- **Framework:** Fastify (fastest Node.js HTTP framework)
- **Key Libraries:** ws, ioredis, jose (JWT)

#### 2. Task Service (Node.js/TypeScript)
- **Why Node.js:** Type sharing with frontend via tRPC, Drizzle ORM compatibility
- **Framework:** Fastify + tRPC
- **Key Libraries:** drizzle-orm, zod, inngest

#### 3. Agent Service (Python)
- **Why Python:** Best LLM ecosystem, LangChain/LiteLLM support, Composio SDK
- **Framework:** FastAPI (async-first, Pydantic validation)
- **Key Libraries:** langchain, litellm, composio, e2b, openai, anthropic

#### 4. Device Service (Go)
- **Why Go:**
  - Handles 100K+ concurrent device connections efficiently
  - Built-in concurrency (goroutines, channels)
  - Low memory footprint per connection
  - Native MQTT libraries (Paho)
- **Framework:** Gin/Fiber for HTTP, gRPC for internal
- **Key Libraries:** paho-mqtt, grpc-go, gorilla/websocket

#### 5. File Service (Node.js/TypeScript)
- **Why Node.js:** S3 SDK, streaming support, type sharing
- **Framework:** Fastify
- **Key Libraries:** @aws-sdk/client-s3, @aws-sdk/s3-presigner

#### 6. Sandbox Service (Go)
- **Why Go:** Performance-critical, low-latency process management
- **Framework:** gRPC server
- **Key Libraries:** e2b-go-sdk (if available), Docker SDK

#### 7. Knowledge Service (Python)
- **Why Python:** Vector DB libraries, embedding models, RAG frameworks
- **Framework:** FastAPI
- **Key Libraries:** sentence-transformers, pinecone-client, pgvector

---

## Technology Matrix

| Component | Technology | Version | Rationale |
|-----------|------------|---------|-----------|
| **Node.js Runtime** | Node.js | 22 LTS | Latest LTS, native fetch, improved performance |
| **TypeScript** | TypeScript | 5.9+ | Latest features, improved type inference |
| **HTTP Framework (JS)** | Fastify | 5.x | Fastest, plugin ecosystem, TypeScript support |
| **ORM** | Drizzle | 0.38+ | Type-safe, edge-compatible, SQL-first |
| **Validation (JS)** | Zod | 3.x | Runtime validation, TypeScript inference |
| **Python Runtime** | Python | 3.12+ | Performance improvements, pattern matching |
| **HTTP Framework (Py)** | FastAPI | 0.110+ | Async-first, automatic OpenAPI, Pydantic |
| **Go Runtime** | Go | 1.22+ | Generics, improved performance |
| **HTTP Framework (Go)** | Fiber/Gin | 2.x | Fast, Express-like API |
| **gRPC** | gRPC | Latest | Inter-service communication |
| **Database** | PostgreSQL | 16 | pgvector support, reliability |
| **Cache** | Redis | 7.x | Pub/sub, caching, rate limiting |
| **Message Queue** | AWS SQS | - | Managed, scalable |
| **Object Storage** | AWS S3 | - | Managed, presigned URLs |
| **Container Runtime** | Docker | 25.x | Industry standard |
| **Container Orchestration** | ECS Fargate | - | Serverless containers |

---

## Cross-Service Communication

```
┌─────────────────────────────────────────────────────────────────┐
│                  COMMUNICATION PATTERNS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Synchronous (Low Latency)                                       │
│  ┌──────────┐     gRPC      ┌──────────┐                        │
│  │ Gateway  │──────────────►│  Task    │                        │
│  └──────────┘               └──────────┘                        │
│       │                                                          │
│       │ gRPC                                                     │
│       ▼                                                          │
│  ┌──────────┐     gRPC      ┌──────────┐                        │
│  │  Agent   │──────────────►│ Sandbox  │                        │
│  └──────────┘               └──────────┘                        │
│                                                                  │
│  Asynchronous (Event-Driven)                                     │
│  ┌──────────┐    SQS/SNS    ┌──────────┐                        │
│  │   Task   │──────────────►│ Webhook  │                        │
│  └──────────┘               └──────────┘                        │
│       │                                                          │
│       │ EventBridge                                              │
│       ▼                                                          │
│  ┌──────────┐   EventBridge ┌──────────┐                        │
│  │  Billing │◄──────────────│ Notific. │                        │
│  └──────────┘               └──────────┘                        │
│                                                                  │
│  Real-Time (Streaming)                                           │
│  ┌──────────┐  Redis Pub/Sub ┌──────────┐                       │
│  │ Gateway  │◄──────────────►│  Device  │                       │
│  └──────────┘                └──────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Consequences

### Positive
- Best tool for each job maximizes performance
- Python AI ecosystem access for Agent/Knowledge services
- Go performance for high-concurrency device handling
- Type safety between frontend and Node.js services
- Team can leverage existing expertise

### Negative
- Multiple languages increase operational complexity
- Hiring requires broader skill set
- Shared code must be duplicated or use language-agnostic formats
- Different testing/debugging workflows per language

### Risks
- Service boundary communication overhead
- Inconsistent error handling across languages
- Different logging/monitoring patterns

### Mitigations
- Use Protocol Buffers for cross-language types
- Standardize on OpenTelemetry for observability
- Create shared error code taxonomy
- Use consistent Docker/Kubernetes patterns

---

## Implementation Notes

### Docker Base Images

```dockerfile
# Node.js services
FROM node:22-alpine AS node-base

# Python services
FROM python:3.12-slim AS python-base

# Go services
FROM golang:1.22-alpine AS go-builder
FROM alpine:3.19 AS go-runtime
```

### Health Check Standard

All services must implement:
```
GET /health
Response: { "status": "healthy", "version": "x.x.x" }
```

### Logging Format

All services use structured JSON logging:
```json
{
  "timestamp": "2026-02-04T12:00:00Z",
  "level": "info",
  "service": "task-service",
  "traceId": "xxx",
  "message": "Task created",
  "data": {}
}
```

---

## References

- [Fastify Benchmarks](https://www.fastify.io/benchmarks/)
- [FastAPI Performance](https://fastapi.tiangolo.com/#performance)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
- [Manus Architecture Analysis](../architecture/BACKEND_ARCHITECTURE.md)
- [AWS ECS Fargate Best Practices](https://docs.aws.amazon.com/AmazonECS/latest/bestpracticesguide/)
