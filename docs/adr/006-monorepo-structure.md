# ADR-006: Monorepo Structure for Polyglot Backend

**Status:** Proposed
**Date:** 2026-02-04
**Decision Makers:** Engineering Team
**Technical Story:** Restructuring the monorepo to support polyglot backend services (Node.js, Python, Go)

---

## Context and Problem Statement

The current Rubic repository uses Turborepo for the frontend monorepo (Next.js apps and packages). We need to extend this to support backend microservices written in multiple languages while maintaining:
- Fast builds and CI
- Shared configuration
- Easy local development
- Docker containerization
- AWS deployment

---

## Decision Drivers

1. **Build Performance:** Fast incremental builds
2. **Developer Experience:** Easy setup and development
3. **Polyglot Support:** Node.js, Python, Go services
4. **Docker Integration:** Containerized deployment
5. **CI/CD:** Efficient pipelines
6. **Monorepo Maturity:** Production-ready tooling

---

## Considered Options

### Option A: Turborepo (Current) + Docker
- Keep Turborepo for JS/TS packages
- Use Docker Compose for polyglot services
- Separate build systems per language

### Option B: NX Monorepo
- Migrate to NX for full monorepo management
- Better polyglot support with plugins
- Integrated dependency graph

### Option C: Bazel
- Google's build system
- Hermetic builds
- Steep learning curve

### Option D: Turborepo + NX Hybrid (Recommended)
- Turborepo for frontend/packages
- NX project.json for backend services
- Shared infrastructure configuration

---

## Decision Outcome

**Chosen Option:** Option A - Turborepo + Docker (for MVP)

### Rationale

| Factor | Turborepo + Docker | NX | Bazel |
|--------|-------------------|-----|-------|
| **Migration Effort** | Low | Medium | High |
| **Learning Curve** | Low | Medium | High |
| **JS/TS Support** | Excellent | Excellent | Good |
| **Python/Go Support** | Via Docker | Good (plugins) | Excellent |
| **Team Familiarity** | High | Medium | Low |
| **MVP Timeline** | Fast | Medium | Slow |

**Decision:** Start with Turborepo + Docker for MVP. Evaluate NX migration after MVP when polyglot complexity increases.

---

## Proposed Monorepo Structure

```
rubic/
├── .github/                        # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml                  # Continuous integration
│       ├── deploy-staging.yml      # Staging deployment
│       └── deploy-production.yml   # Production deployment
│
├── apps/                           # Deployable frontend applications
│   ├── app/                        # Main Next.js application
│   │   ├── app/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   └── tsconfig.json
│   │
│   ├── api/                        # API webhooks server
│   │   ├── app/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── web/                        # Marketing website
│   ├── docs/                       # Documentation (Mintlify)
│   ├── email/                      # Email templates
│   ├── storybook/                  # Component library
│   └── studio/                     # Admin studio
│
├── services/                       # Backend microservices (NEW)
│   │
│   ├── gateway/                    # API Gateway (Node.js/TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── websocket/
│   │   │   └── lib/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   ├── task/                       # Task Service (Node.js/TypeScript)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   └── lib/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   ├── agent/                      # Agent Service (Python)
│   │   ├── src/
│   │   │   ├── __init__.py
│   │   │   ├── main.py
│   │   │   ├── api/
│   │   │   │   ├── routes/
│   │   │   │   └── schemas/
│   │   │   ├── core/
│   │   │   │   ├── config.py
│   │   │   │   └── dependencies.py
│   │   │   ├── services/
│   │   │   │   ├── orchestrator.py
│   │   │   │   ├── llm_router.py
│   │   │   │   └── tool_executor.py
│   │   │   └── tools/
│   │   │       ├── composio_tools.py
│   │   │       └── custom_tools.py
│   │   ├── tests/
│   │   ├── pyproject.toml
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   ├── device/                     # Device Service (Go)
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go
│   │   ├── internal/
│   │   │   ├── api/
│   │   │   │   ├── handlers/
│   │   │   │   └── middleware/
│   │   │   ├── domain/
│   │   │   ├── repository/
│   │   │   ├── service/
│   │   │   └── mqtt/
│   │   ├── pkg/
│   │   │   ├── safety/
│   │   │   └── protocol/
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── Dockerfile
│   │   └── .env.example
│   │
│   ├── file/                       # File Service (Node.js)
│   ├── project/                    # Project Service (Node.js)
│   ├── webhook/                    # Webhook Service (Node.js)
│   ├── notification/               # Notification Service (Node.js)
│   ├── connector/                  # Connector Service (Node.js)
│   ├── sandbox/                    # Sandbox Service (Go)
│   ├── knowledge/                  # Knowledge Service (Python)
│   └── billing/                    # Billing Service (Node.js)
│
├── packages/                       # Shared packages (existing)
│   ├── ai/                         # AI SDK, hooks, components
│   ├── database/                   # Drizzle ORM, schemas
│   ├── auth/                       # Better-Auth
│   ├── design-system/              # UI components
│   ├── notifications/              # Knock
│   ├── webhooks/                   # Svix
│   ├── payments/                   # Stripe
│   ├── storage/                    # S3/Blob
│   ├── analytics/                  # PostHog
│   ├── observability/              # Sentry
│   ├── rate-limit/                 # Upstash
│   ├── email/                      # Resend
│   ├── collaboration/              # LiveBlocks
│   ├── cms/                        # BaseHub
│   ├── feature-flags/
│   ├── internationalization/
│   ├── security/
│   ├── seo/
│   ├── testing/
│   ├── typescript-config/
│   └── next-config/
│
├── proto/                          # Protocol Buffers (NEW)
│   ├── device/
│   │   └── v1/
│   │       └── device.proto
│   ├── agent/
│   │   └── v1/
│   │       └── agent.proto
│   └── common/
│       └── v1/
│           └── types.proto
│
├── infrastructure/                 # Infrastructure as Code (NEW)
│   ├── terraform/
│   │   ├── environments/
│   │   │   ├── development/
│   │   │   │   ├── main.tf
│   │   │   │   ├── variables.tf
│   │   │   │   └── terraform.tfvars
│   │   │   ├── staging/
│   │   │   └── production/
│   │   └── modules/
│   │       ├── vpc/
│   │       ├── ecs/
│   │       ├── rds/
│   │       ├── elasticache/
│   │       ├── s3/
│   │       └── iot/
│   │
│   └── docker/
│       ├── docker-compose.yml          # Production-like
│       ├── docker-compose.dev.yml      # Development
│       └── docker-compose.test.yml     # Testing
│
├── tools/                          # Development tools (NEW)
│   ├── scripts/
│   │   ├── setup.sh                # Initial setup
│   │   ├── dev.sh                  # Start development
│   │   ├── migrate.sh              # Database migrations
│   │   └── deploy.sh               # Deployment helper
│   └── generators/
│       └── service/                # Service scaffolding
│
├── docs/                           # Documentation
│   ├── architecture/
│   │   └── BACKEND_ARCHITECTURE.md
│   └── adr/
│       ├── 001-prompt-input-architecture.md
│       ├── 002-microservices-stack.md
│       ├── 003-database-design.md
│       ├── 004-device-control-system.md
│       ├── 005-third-party-services.md
│       └── 006-monorepo-structure.md
│
├── turbo.json                      # Turborepo configuration
├── pnpm-workspace.yaml             # PNPM workspace
├── package.json                    # Root package.json
├── docker-compose.yml              # Root Docker Compose (link)
├── Makefile                        # Common commands (NEW)
├── .env.example                    # Environment template
└── README.md
```

---

## Configuration Files

### Updated turbo.json

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "ui": "tui",
  "envMode": "loose",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "**/generated/**",
        "storybook-static/**",
        ".react-email/**",
        "dist/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["^test"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "clean": {
      "cache": false
    },
    "//#clean": {
      "cache": false
    }
  }
}
```

### Updated pnpm-workspace.yaml

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/gateway"
  - "services/task"
  - "services/file"
  - "services/project"
  - "services/webhook"
  - "services/notification"
  - "services/connector"
  - "services/billing"
```

### Root Makefile

```makefile
.PHONY: setup dev build test clean docker-up docker-down migrate

# Setup development environment
setup:
	pnpm install
	cp .env.example .env
	cd services/agent && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
	cd services/device && go mod download

# Start development (all services)
dev:
	docker-compose -f infrastructure/docker/docker-compose.dev.yml up -d postgres redis mosquitto
	pnpm dev

# Start only frontend
dev-frontend:
	pnpm dev --filter=app --filter=api --filter=web

# Start only backend services
dev-backend:
	docker-compose -f infrastructure/docker/docker-compose.dev.yml up

# Build all
build:
	pnpm build
	docker-compose -f infrastructure/docker/docker-compose.yml build

# Run tests
test:
	pnpm test
	cd services/agent && pytest
	cd services/device && go test ./...

# Clean
clean:
	pnpm clean
	docker-compose -f infrastructure/docker/docker-compose.yml down -v

# Docker operations
docker-up:
	docker-compose -f infrastructure/docker/docker-compose.yml up -d

docker-down:
	docker-compose -f infrastructure/docker/docker-compose.yml down

docker-logs:
	docker-compose -f infrastructure/docker/docker-compose.yml logs -f

# Database operations
migrate:
	pnpm --filter=@repo/database migrate

migrate-generate:
	pnpm --filter=@repo/database generate

# Service-specific commands
agent-dev:
	cd services/agent && source .venv/bin/activate && uvicorn src.main:app --reload --port 3002

device-dev:
	cd services/device && go run cmd/server/main.go

# Proto generation
proto:
	cd proto && buf generate
```

### Root docker-compose.yml

```yaml
# infrastructure/docker/docker-compose.dev.yml
version: "3.9"

services:
  # Infrastructure
  postgres:
    image: pgvector/pgvector:pg16
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: rubic
      POSTGRES_PASSWORD: rubic
      POSTGRES_DB: rubic
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rubic"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
      - "9001:9001"
    volumes:
      - ./mosquitto/config:/mosquitto/config
      - mosquitto_data:/mosquitto/data
      - mosquitto_log:/mosquitto/log

  # Node.js Services
  gateway:
    build:
      context: ../../services/gateway
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://rubic:rubic@postgres:5432/rubic
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  task-service:
    build:
      context: ../../services/task
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://rubic:rubic@postgres:5432/rubic
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # Python Services
  agent-service:
    build:
      context: ../../services/agent
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - E2B_API_KEY=${E2B_API_KEY}
      - COMPOSIO_API_KEY=${COMPOSIO_API_KEY}
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy

  # Go Services
  device-service:
    build:
      context: ../../services/device
      dockerfile: Dockerfile
    ports:
      - "3005:3005"
    environment:
      - DATABASE_URL=postgresql://rubic:rubic@postgres:5432/rubic
      - REDIS_URL=redis://redis:6379
      - MQTT_BROKER_URL=mqtt://mosquitto:1883
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      mosquitto:
        condition: service_started

volumes:
  postgres_data:
  redis_data:
  mosquitto_data:
  mosquitto_log:
```

---

## Service Dockerfiles

### Node.js Service Dockerfile

```dockerfile
# services/gateway/Dockerfile
FROM node:22-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 rubic

COPY --from=builder --chown=rubic:nodejs /app/dist ./dist
COPY --from=builder --chown=rubic:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=rubic:nodejs /app/package.json ./

USER rubic
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Python Service Dockerfile

```dockerfile
# services/agent/Dockerfile
FROM python:3.12-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

FROM base AS runner
WORKDIR /app
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

RUN addgroup --system --gid 1001 python
RUN adduser --system --uid 1001 rubic

COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --chown=rubic:python src ./src

USER rubic
EXPOSE 3002
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3002"]
```

### Go Service Dockerfile

```dockerfile
# services/device/Dockerfile
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /device-service ./cmd/server

FROM alpine:3.19 AS runner
WORKDIR /app

RUN addgroup -S rubic && adduser -S rubic -G rubic

COPY --from=builder /device-service .

USER rubic
EXPOSE 3005
CMD ["./device-service"]
```

---

## CI/CD Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  # Frontend/Packages (Turborepo)
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm build
      - run: pnpm test

  # Python Services
  agent-service:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/agent
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - run: pip install -r requirements.txt
      - run: pip install pytest pytest-cov ruff
      - run: ruff check src/
      - run: pytest --cov=src tests/

  # Go Services
  device-service:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: services/device
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'

      - run: go mod download
      - run: go vet ./...
      - run: go test -race -coverprofile=coverage.out ./...
      - run: go build ./cmd/server

  # Docker Build
  docker:
    needs: [frontend, agent-service, device-service]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3

      - name: Build Gateway
        run: docker build -t rubic/gateway services/gateway

      - name: Build Agent
        run: docker build -t rubic/agent services/agent

      - name: Build Device
        run: docker build -t rubic/device services/device
```

---

## Migration Plan

### Phase 1: Setup Structure (Week 1)
- [ ] Create `services/` directory
- [ ] Create `infrastructure/` directory
- [ ] Create `proto/` directory
- [ ] Create `tools/` directory
- [ ] Update turbo.json and pnpm-workspace.yaml
- [ ] Create Makefile

### Phase 2: Gateway Service (Week 2)
- [ ] Scaffold gateway service (Fastify)
- [ ] Implement health check
- [ ] Implement WebSocket handler
- [ ] Create Dockerfile
- [ ] Test locally with Docker

### Phase 3: Task Service (Week 2-3)
- [ ] Scaffold task service
- [ ] Implement task CRUD
- [ ] Integrate with database (Drizzle)
- [ ] Test locally

### Phase 4: Agent Service (Week 3-4)
- [ ] Scaffold Python service (FastAPI)
- [ ] Implement LLM orchestration
- [ ] Integrate Composio
- [ ] Integrate E2B
- [ ] Test locally

### Phase 5: Device Service (Week 4-5)
- [ ] Scaffold Go service
- [ ] Implement device CRUD
- [ ] Implement MQTT handler
- [ ] Implement WebSocket handler
- [ ] Test with mock devices

### Phase 6: Integration (Week 5-6)
- [ ] Connect all services
- [ ] Test end-to-end
- [ ] Update frontend to use new APIs
- [ ] Performance testing

---

## Consequences

### Positive
- Clear separation of concerns
- Independent service deployment
- Language-appropriate tooling per service
- Scalable CI/CD

### Negative
- Multiple build systems to manage
- More complex local development
- Proto sync overhead

### Mitigations
- Makefile abstracts complexity
- Docker Compose for local development
- CI validates all languages

---

## References

- [Turborepo Documentation](https://turbo.build/repo/docs)
- [PNPM Workspaces](https://pnpm.io/workspaces)
- [Docker Compose](https://docs.docker.com/compose/)
- [GitHub Actions](https://docs.github.com/en/actions)
