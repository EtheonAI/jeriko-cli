# Rubic Documentation

Welcome to the Rubic documentation. This repository contains comprehensive documentation for the Rubic AI Agent Platform.

## Table of Contents

### Getting Started

- [Overview](#overview)
- [Quick Start](./quickstart.md)
- [Architecture Overview](./architecture/COMPREHENSIVE_ANALYSIS.md)

### Architecture Documentation

- [Comprehensive Analysis](./architecture/COMPREHENSIVE_ANALYSIS.md) - Full architecture analysis and strategic recommendations
- [Backend Architecture](./architecture/BACKEND_ARCHITECTURE.md) - Backend microservices architecture

### Frontend Documentation

- [Frontend README](./frontend/README.md) - Frontend architecture, components, and development guidelines
- [State Management](./frontend/state-management.md) - Redux patterns and best practices
- [API Integration](./frontend/api-integration.md) - tRPC and REST API integration

### Backend Documentation

- [Backend README](./backend/README.md) - Backend services, APIs, and infrastructure
- [Service Catalog](./backend/service-catalog.md) - Detailed service documentation
- [Database Schema](./backend/database-schema.md) - PostgreSQL and Redis schemas

### Testing Documentation

- [Testing README](./testing/README.md) - Testing strategy and implementation
- [Unit Testing](./testing/unit-testing.md) - Unit test patterns
- [Integration Testing](./testing/integration-testing.md) - Integration test setup
- [E2E Testing](./testing/e2e-testing.md) - End-to-end testing with Cypress

### Architecture Decision Records (ADRs)

- [ADR-001: Prompt Input Architecture](./adr/001-prompt-input-architecture.md)
- [ADR-002: Microservices Stack](./adr/002-microservices-stack.md)
- [ADR-003: Database Design](./adr/003-database-design.md)
- [ADR-004: Device Control System](./adr/004-device-control-system.md)
- [ADR-005: Third-Party Services](./adr/005-third-party-services.md)
- [ADR-006: Monorepo Structure](./adr/006-monorepo-structure.md)

## Overview

Rubic is a next-generation autonomous AI agent platform with unique device control capabilities:

- **DAG-based multi-agent orchestration** - Hierarchical agent delegation for complex tasks
- **Universal device control** - PC, MQTT IoT, WiFi, and Bluetooth device management
- **Real-time automation** - Sub-second response times with continuous monitoring
- **Integrated development environment** - AI-powered website builder with code sandboxing

## Architecture Highlights

```
┌─────────────────────────────────────────────────────────────────────┐
│                        RUBIC ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FRONTEND                    BACKEND              EXTERNAL           │
│  ┌─────────────┐            ┌─────────────┐       ┌─────────────┐   │
│  │  Next.js 16 │────────────│   Gateway   │◄──────│   Composio  │   │
│  │  React 19   │            │   (Node)    │       │  (800+ APIs)│   │
│  │  Redux TK   │            └──────┬──────┘       └─────────────┘   │
│  └─────────────┘                   │                                │
│         │              ┌───────────┼───────────┐                    │
│         │              ▼           ▼           ▼                    │
│         │         ┌────────┐  ┌────────┐  ┌────────┐               │
│         │         │ Task   │  │ Agent  │  │ Device │               │
│         │         │ (Node) │  │(Python)│  │  (Go)  │               │
│         │         └────────┘  └────────┘  └────────┘               │
│         │                                                   ┌──────┴───┐
│         └──────────────────────────────────────────────────►│  AWS IoT │
│                                                             │   Core   │
│                                                             └──────────┘
│
└─────────────────────────────────────────────────────────────────────┘
```

## Quick Links

- [GitHub Repository](https://github.com/EtheonAI/rubic)
- [Development Setup](./development.md)
- [Deployment Guide](./deployment.md)
- [API Reference](./api-reference.md)

## Contributing

Please read our [Contributing Guide](./CONTRIBUTING.md) before submitting PRs.

## License

MIT License - see [LICENSE](../LICENSE) for details.
