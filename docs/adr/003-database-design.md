# ADR-003: Database Architecture Design

**Status:** Proposed
**Date:** 2026-02-04
**Decision Makers:** Engineering Team
**Technical Story:** Designing the database architecture for the microservices backend

---

## Context and Problem Statement

Rubic requires a database architecture that supports:
- Relational data (users, projects, tasks, devices)
- Vector embeddings for RAG (knowledge base)
- High-throughput caching (sessions, rate limiting)
- Real-time pub/sub (WebSocket notifications)
- File metadata with TTL (temporary file storage)
- Time-series data (device telemetry, analytics)

We need to select the right database(s) for each use case while minimizing operational complexity.

---

## Decision Drivers

1. **Data Model Fit:** Relational vs document vs key-value vs vector
2. **AWS Compatibility:** Managed services preferred
3. **Scalability:** Handle growth from MVP to production
4. **Cost:** Balance between features and cost
5. **Operational Complexity:** Minimize number of database systems
6. **Existing Stack:** Leverage current Drizzle ORM setup

---

## Considered Options

### Option A: Single PostgreSQL Database
- PostgreSQL for all data
- pgvector for embeddings
- Use PostgreSQL LISTEN/NOTIFY for pub/sub

### Option B: PostgreSQL + Redis (Recommended)
- PostgreSQL (RDS) for relational data + pgvector
- Redis (ElastiCache) for cache, sessions, pub/sub

### Option C: PostgreSQL + Redis + Pinecone
- PostgreSQL for relational
- Redis for cache/pub/sub
- Pinecone for vector search (managed)

### Option D: Full AWS Native
- Aurora PostgreSQL
- ElastiCache Redis
- OpenSearch for full-text + vectors
- DynamoDB for device telemetry

---

## Decision Outcome

**Chosen Option:** Option B - PostgreSQL + Redis

### Rationale

| Database | Use Cases | Why |
|----------|-----------|-----|
| **PostgreSQL (RDS)** | All relational data, vector embeddings | Drizzle ORM compatibility, pgvector for embeddings, ACID compliance, AWS RDS managed |
| **Redis (ElastiCache)** | Cache, sessions, rate limiting, pub/sub, queues | Fast in-memory operations, native pub/sub, AWS ElastiCache managed |

### Why Not Others

| Option | Reason Not Selected |
|--------|---------------------|
| **Pinecone** | Added complexity; pgvector sufficient for MVP scale |
| **DynamoDB** | Different data model; adds operational complexity |
| **OpenSearch** | Overkill for current needs; can add later |
| **MongoDB** | Team expertise in PostgreSQL; Drizzle already set up |

---

## Database Schema Design

### PostgreSQL Schema Organization

```sql
-- Schema organization by domain
CREATE SCHEMA IF NOT EXISTS core;       -- Users, auth, settings
CREATE SCHEMA IF NOT EXISTS tasks;      -- Task management
CREATE SCHEMA IF NOT EXISTS devices;    -- Device control
CREATE SCHEMA IF NOT EXISTS knowledge;  -- RAG/embeddings
CREATE SCHEMA IF NOT EXISTS billing;    -- Payments/subscriptions
CREATE SCHEMA IF NOT EXISTS integrations; -- Connectors/webhooks
```

### Core Tables

```sql
-- core.users (managed by Better-Auth, extended)
-- See packages/database/src/schema/users.ts

-- tasks.tasks
CREATE TABLE tasks.tasks (
  id VARCHAR(26) PRIMARY KEY,  -- CUID2
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),
  project_id VARCHAR(26) REFERENCES tasks.projects(id),

  -- Task definition
  prompt TEXT NOT NULL,
  agent_profile VARCHAR(50) DEFAULT 'rubic-1.0',
  task_mode VARCHAR(20) DEFAULT 'agent' CHECK (task_mode IN ('chat', 'adaptive', 'agent')),

  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  error JSONB,

  -- Configuration
  config JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',

  -- Usage tracking
  credit_usage INTEGER DEFAULT 0,
  token_usage JSONB DEFAULT '{"input": 0, "output": 0}',

  -- Localization
  locale VARCHAR(10) DEFAULT 'en-US',

  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_tasks_user_id ON tasks.tasks(user_id);
CREATE INDEX idx_tasks_project_id ON tasks.tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks.tasks(status);
CREATE INDEX idx_tasks_created_at ON tasks.tasks(created_at DESC);
CREATE INDEX idx_tasks_user_status ON tasks.tasks(user_id, status);

-- tasks.task_messages
CREATE TABLE tasks.task_messages (
  id VARCHAR(26) PRIMARY KEY,
  task_id VARCHAR(26) NOT NULL REFERENCES tasks.tasks(id) ON DELETE CASCADE,

  -- Message content
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content JSONB NOT NULL,  -- Array of MessagePart

  -- Tool call tracking
  tool_call_id VARCHAR(100),
  tool_name VARCHAR(100),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_messages_task_id ON tasks.task_messages(task_id);
CREATE INDEX idx_task_messages_created_at ON tasks.task_messages(task_id, created_at);

-- tasks.projects
CREATE TABLE tasks.projects (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),

  name VARCHAR(255) NOT NULL,
  description TEXT,
  instruction TEXT,  -- Default system prompt

  config JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON tasks.projects(user_id);
```

### Device Tables

```sql
-- devices.devices
CREATE TABLE devices.devices (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),

  -- Device info
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('pc', 'mqtt', 'wifi', 'bluetooth')),
  description TEXT,

  -- Connection
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'connecting', 'error')),
  last_seen_at TIMESTAMPTZ,

  -- Authentication
  access_token_hash VARCHAR(255),
  certificate_fingerprint VARCHAR(255),

  -- Configuration
  config JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]',  -- What the device can do

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_user_id ON devices.devices(user_id);
CREATE INDEX idx_devices_status ON devices.devices(status);
CREATE INDEX idx_devices_type ON devices.devices(type);

-- devices.commands
CREATE TABLE devices.commands (
  id VARCHAR(26) PRIMARY KEY,
  device_id VARCHAR(26) NOT NULL REFERENCES devices.devices(id),
  task_id VARCHAR(26) REFERENCES tasks.tasks(id),
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),

  -- Command details
  command TEXT NOT NULL,
  command_type VARCHAR(50) NOT NULL CHECK (command_type IN ('shell', 'script', 'action', 'query')),
  parameters JSONB DEFAULT '{}',

  -- Execution
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'executing', 'completed', 'failed', 'timeout', 'cancelled')),
  output TEXT,
  error TEXT,
  exit_code INTEGER,

  -- Timing
  timeout_ms INTEGER DEFAULT 30000,
  queued_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Safety
  requires_approval BOOLEAN DEFAULT FALSE,
  approved_at TIMESTAMPTZ,
  approved_by VARCHAR(26) REFERENCES core.users(id)
);

CREATE INDEX idx_commands_device_id ON devices.commands(device_id);
CREATE INDEX idx_commands_status ON devices.commands(status);
CREATE INDEX idx_commands_task_id ON devices.commands(task_id);

-- devices.telemetry (time-series data)
CREATE TABLE devices.telemetry (
  id BIGSERIAL PRIMARY KEY,
  device_id VARCHAR(26) NOT NULL REFERENCES devices.devices(id),

  metric_name VARCHAR(100) NOT NULL,
  metric_value DOUBLE PRECISION NOT NULL,
  tags JSONB DEFAULT '{}',

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by time for efficient querying
CREATE INDEX idx_telemetry_device_time ON devices.telemetry(device_id, recorded_at DESC);
```

### Knowledge/Vector Tables

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- knowledge.items
CREATE TABLE knowledge.items (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),
  group_id VARCHAR(26) REFERENCES knowledge.groups(id),

  -- Content
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  content_type VARCHAR(50) NOT NULL CHECK (content_type IN ('document', 'webpage', 'file', 'note')),

  -- Source
  source_url TEXT,
  source_file_id VARCHAR(26) REFERENCES files.files(id),

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- knowledge.chunks (for RAG)
CREATE TABLE knowledge.chunks (
  id VARCHAR(26) PRIMARY KEY,
  item_id VARCHAR(26) NOT NULL REFERENCES knowledge.items(id) ON DELETE CASCADE,

  -- Chunk content
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,

  -- Embedding (OpenAI ada-002 = 1536 dimensions)
  embedding vector(1536),

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector index for similarity search
CREATE INDEX idx_chunks_embedding ON knowledge.chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_chunks_item_id ON knowledge.chunks(item_id);

-- knowledge.groups (folders)
CREATE TABLE knowledge.groups (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),
  parent_id VARCHAR(26) REFERENCES knowledge.groups(id),

  name VARCHAR(255) NOT NULL,
  description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_user_id ON knowledge.groups(user_id);
CREATE INDEX idx_groups_parent_id ON knowledge.groups(parent_id);
```

### File Management Tables

```sql
-- files.files
CREATE TABLE files.files (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),
  task_id VARCHAR(26) REFERENCES tasks.tasks(id),

  -- File info
  filename VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  size_bytes BIGINT,

  -- Storage
  s3_bucket VARCHAR(100) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,

  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'uploaded', 'processing', 'ready', 'error', 'deleted')),

  -- TTL (for temporary files)
  expires_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_user_id ON files.files(user_id);
CREATE INDEX idx_files_task_id ON files.files(task_id);
CREATE INDEX idx_files_expires_at ON files.files(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_files_status ON files.files(status);
```

### Integration Tables

```sql
-- integrations.webhooks
CREATE TABLE integrations.webhooks (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),

  url VARCHAR(2000) NOT NULL,
  events VARCHAR(50)[] DEFAULT '{}',  -- ['task.completed', 'task.failed', ...]

  -- Security
  secret_hash VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'disabled')),
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_user_id ON integrations.webhooks(user_id);
CREATE INDEX idx_webhooks_status ON integrations.webhooks(status);

-- integrations.webhook_deliveries
CREATE TABLE integrations.webhook_deliveries (
  id VARCHAR(26) PRIMARY KEY,
  webhook_id VARCHAR(26) NOT NULL REFERENCES integrations.webhooks(id),

  event_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,

  -- Delivery status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,

  -- Retry tracking
  attempt_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_deliveries_webhook_id ON integrations.webhook_deliveries(webhook_id);
CREATE INDEX idx_deliveries_status ON integrations.webhook_deliveries(status);
CREATE INDEX idx_deliveries_next_retry ON integrations.webhook_deliveries(next_retry_at)
  WHERE status = 'retrying';

-- integrations.connectors
CREATE TABLE integrations.connectors (
  id VARCHAR(26) PRIMARY KEY,
  user_id VARCHAR(26) NOT NULL REFERENCES core.users(id),

  type VARCHAR(50) NOT NULL,  -- google, notion, slack, github, etc.
  name VARCHAR(255),

  -- OAuth tokens (encrypted at rest)
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,

  -- Scopes granted
  scopes VARCHAR(100)[] DEFAULT '{}',

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'error')),
  last_error TEXT,

  -- Metadata
  account_info JSONB DEFAULT '{}',  -- Connected account details

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_connectors_user_type ON integrations.connectors(user_id, type);
CREATE INDEX idx_connectors_status ON integrations.connectors(status);
```

---

## Redis Data Structures

```yaml
# Session Management
session:{user_id}:{session_id}: Hash
  - user_id: string
  - created_at: timestamp
  - expires_at: timestamp
  - metadata: json
TTL: 7 days

# Rate Limiting
ratelimit:{user_id}:{endpoint}: String (counter)
TTL: 60 seconds (window)

ratelimit:api_key:{key_prefix}:{endpoint}: String
TTL: 60 seconds

# Task Streaming
task:stream:{task_id}: Stream (Redis Streams)
  - Events: task_update, output_delta, tool_call, etc.
TTL: 24 hours

# Device State
device:{device_id}:state: Hash
  - status: online|offline
  - last_seen: timestamp
  - metrics: json
TTL: 1 hour (refreshed on heartbeat)

device:{device_id}:commands: List (pending commands)
TTL: 1 hour

# Real-Time Channels (Pub/Sub)
channel:user:{user_id}: Pub/Sub
  - Notifications, updates

channel:task:{task_id}: Pub/Sub
  - Task progress, completion

channel:device:{device_id}: Pub/Sub
  - Device status, telemetry

# Caching
cache:user:{user_id}: Hash (user profile cache)
TTL: 5 minutes

cache:project:{project_id}: Hash (project cache)
TTL: 5 minutes

cache:connector:{user_id}:{type}: Hash (connector config)
TTL: 1 minute

# Background Job Queues
queue:webhooks: List (webhook delivery queue)
queue:notifications: List (notification queue)
queue:device_commands: List (device command queue)
```

---

## Drizzle ORM Integration

### Updated Schema Files

```typescript
// packages/database/src/schema/tasks.ts
import { pgSchema, varchar, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';
import { users } from './users';

export const tasksSchema = pgSchema('tasks');

export const tasks = tasksSchema.table('tasks', {
  id: varchar('id', { length: 26 }).primaryKey().$defaultFn(() => createId()),
  userId: varchar('user_id', { length: 26 }).notNull().references(() => users.id),
  projectId: varchar('project_id', { length: 26 }).references(() => projects.id),

  prompt: text('prompt').notNull(),
  agentProfile: varchar('agent_profile', { length: 50 }).default('rubic-1.0'),
  taskMode: varchar('task_mode', { length: 20 }).default('agent'),

  status: varchar('status', { length: 20 }).default('pending'),
  error: jsonb('error'),

  config: jsonb('config').default({}),
  metadata: jsonb('metadata').default({}),

  creditUsage: integer('credit_usage').default(0),
  tokenUsage: jsonb('token_usage').default({ input: 0, output: 0 }),

  locale: varchar('locale', { length: 10 }).default('en-US'),

  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_tasks_user_id').on(table.userId),
  projectIdIdx: index('idx_tasks_project_id').on(table.projectId),
  statusIdx: index('idx_tasks_status').on(table.status),
  createdAtIdx: index('idx_tasks_created_at').on(table.createdAt),
}));

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
```

---

## Migration Strategy

### Phase 1: Schema Updates
1. Add new schemas (tasks, devices, knowledge, etc.)
2. Create tables with indexes
3. Update Drizzle schema files

### Phase 2: Data Migration
1. Migrate existing session data to new structure
2. Create default projects for existing users

### Phase 3: Validation
1. Run integrity checks
2. Verify index performance
3. Test vector search

---

## Consequences

### Positive
- Unified relational model with Drizzle ORM
- pgvector eliminates need for separate vector DB (for MVP)
- Redis handles all caching/pub-sub needs
- Minimal operational complexity (2 databases)
- AWS managed services reduce maintenance

### Negative
- pgvector may need replacement at high scale
- Redis persistence requires careful configuration
- PostgreSQL connection limits need monitoring

### Risks
- Vector search performance at scale
- Redis memory limits

### Mitigations
- Monitor pgvector query times; migrate to Pinecone if needed
- Implement Redis cluster for high availability
- Use connection pooling (PgBouncer)

---

## References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [AWS RDS Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [Redis Data Modeling](https://redis.io/docs/data-types/)
