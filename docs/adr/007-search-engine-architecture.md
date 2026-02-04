# ADR-007: Search Engine Architecture

**Status:** Accepted
**Date:** 2026-02-04
**Decision Makers:** Engineering Team
**Technical Story:** Implementing global search functionality across files, sessions, tasks, projects, and actions

---

## Context and Problem Statement

Rubic requires a powerful, fast search functionality that allows users to search across multiple entity types:
- **Files** (uploaded documents, code files, media)
- **Sessions** (AI agent conversations)
- **Tasks** (scheduled and agent tasks)
- **Projects** (project metadata, descriptions)
- **Actions** (workflows, automations)
- **Knowledge items** (RAG documents)

The search needs to:
1. Provide **instant results** (< 50ms response time)
2. Support **typo tolerance** (handle user mistakes)
3. Enable **faceted search** (filter by type, date, status)
4. Show **highlighted matches** with context
5. Support **real-time search-as-you-type**
6. Scale with growing data volumes

Manus.im (a competitor product) uses Algolia for their search. We need to evaluate whether Typesense is a better fit for Rubic's architecture.

---

## Decision Drivers

1. **Performance:** Sub-50ms search latency for real-time search
2. **Typo Tolerance:** Forgiveness for typing mistakes
3. **Cost:** Sustainable pricing model at scale
4. **Self-Hosting Option:** Ability to host on our own infrastructure
5. **Developer Experience:** TypeScript SDK, easy integration
6. **Features:** Multi-collection search, faceting, filtering, highlighting
7. **Operational Complexity:** Easy to deploy and maintain
8. **Data Privacy:** Keeping user data on our infrastructure

---

## Considered Options

### Option A: PostgreSQL Full-Text Search (pg_trgm + tsvector)

Use PostgreSQL's built-in full-text search capabilities with trigram extension.

**Pros:**
- No additional infrastructure
- Already have PostgreSQL (RDS)
- Free (included in database)
- Data stays in one place
- ACID compliant

**Cons:**
- Limited typo tolerance
- No native search-as-you-type
- Performance degrades with data volume
- Complex query syntax
- No built-in faceting
- Requires manual relevance tuning

**Performance:** 100-500ms for large datasets

### Option B: Algolia (SaaS)

Use Algolia's managed search-as-a-service platform.

**Pros:**
- Best-in-class search UX
- Excellent documentation
- InstantSearch UI components
- 99.99% SLA
- Built-in analytics

**Cons:**
- **Expensive at scale** ($1.00/1,000 search operations + $0.40/1,000 records/month)
- Vendor lock-in
- Data leaves our infrastructure
- No self-hosting option
- Record size limits (10KB)

**Estimated Cost (10K users, 1M records):**
- Records: $400/month
- Operations: ~$500-2,000/month (depends on usage)
- Total: **$900-2,400/month**

### Option C: Typesense (Self-Hosted/Cloud) - RECOMMENDED

Use Typesense, an open-source, typo-tolerant search engine.

**Pros:**
- **Open source** (GPLv3 license)
- **Self-hosting option** (Docker, binary)
- **Sub-50ms latency** (typical: 5-20ms)
- **Built-in typo tolerance** (default enabled)
- Excellent TypeScript SDK
- Multi-collection search (federated)
- Faceting, filtering, highlighting
- Geo-search support
- **Predictable pricing** (Cloud: $0.08/hour for 0.5 vCPU)

**Cons:**
- Smaller community than Algolia
- Fewer pre-built UI components
- Need to manage infrastructure (if self-hosted)
- Less mature than Elasticsearch

**Estimated Cost (Self-hosted on AWS):**
- t3.medium EC2: ~$30/month
- EBS storage: ~$10/month
- Total: **$40/month**

**Typesense Cloud Cost:**
- Development: Free tier (100K documents)
- Production (2 vCPU, 4GB RAM): ~$116/month

### Option D: Elasticsearch/OpenSearch

Use Elasticsearch or AWS OpenSearch for full-text search.

**Pros:**
- Industry standard
- Extremely powerful
- Large ecosystem
- AWS OpenSearch is managed

**Cons:**
- **Overkill for our use case**
- Complex configuration
- High resource usage
- Steep learning curve
- No built-in typo tolerance
- Expensive (AWS OpenSearch: $150+/month for small cluster)

### Option E: Meilisearch

Open-source alternative similar to Typesense.

**Pros:**
- Fast search
- Good TypeScript SDK
- Self-hosting option

**Cons:**
- Less mature than Typesense
- Smaller community
- Fewer enterprise features
- No geo-search

---

## Decision Outcome

**Chosen Option:** Option C - Typesense (Self-Hosted with Typesense Cloud as backup)

### Rationale

| Criteria | PostgreSQL | Algolia | Typesense | Elasticsearch |
|----------|------------|---------|-----------|---------------|
| Performance | 100-500ms | <50ms | **<50ms** | <50ms |
| Typo Tolerance | Poor | Excellent | **Excellent** | Manual config |
| Cost (10K users) | $0 | $900-2,400/mo | **$40-116/mo** | $150+/mo |
| Self-Hosting | N/A | No | **Yes** | Yes |
| TypeScript SDK | N/A | Good | **Excellent** | Good |
| Setup Complexity | Low | Low | **Low** | High |
| Data Privacy | On-prem | Cloud only | **On-prem/Cloud** | On-prem/Cloud |

### Why Typesense Over Algolia

1. **Cost Efficiency:** 10-50x cheaper at scale
2. **Self-Hosting:** Keep data on our infrastructure (compliance)
3. **Open Source:** No vendor lock-in
4. **Performance Parity:** Equivalent search speed
5. **TypeScript First:** Modern SDK with excellent DX

### Why Typesense Over PostgreSQL FTS

1. **Typo Tolerance:** Built-in fuzzy matching
2. **Performance:** 5-20ms vs 100-500ms
3. **Features:** Faceting, highlighting, federated search
4. **Real-Time:** Optimized for search-as-you-type

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Rubic App                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                 Search Modal (CMD+K)                      │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Search input with debounce (300ms)                  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │ Results: Files | Sessions | Tasks | Projects | ...  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TRPC API Layer                             │
│  search.router.ts                                               │
│  - global(query, filters)  → Federated multi-collection search  │
│  - reindex(collection)     → Manual reindex trigger             │
└──────────────────────────────────┬──────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @repo/search Package                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ TypesenseClient │  │ CollectionDefs  │  │   IndexService  │ │
│  │   (singleton)   │  │   (schemas)     │  │   (sync logic)  │ │
│  └────────┬────────┘  └─────────────────┘  └────────┬────────┘ │
│           │                                          │          │
│           ▼                                          ▼          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              Typesense Server (Docker/Cloud)                ││
│  │  Collections: files | sessions | tasks | projects | actions ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                   ▲
                                   │
┌─────────────────────────────────────────────────────────────────┐
│                     Index Sync Layer                            │
│  ┌─────────────────┐                     ┌───────────────────┐ │
│  │ TRPC Mutation   │                     │  Background Job   │ │
│  │   Middleware    │──────────────────▶  │   (Bull Queue)    │ │
│  │ (on create/     │                     │  - Index new doc  │ │
│  │  update/delete) │                     │  - Reindex batch  │ │
│  └─────────────────┘                     └───────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Collection Schemas

```typescript
// files collection
{
  name: 'files',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'userId', type: 'string', facet: true },
    { name: 'name', type: 'string' },
    { name: 'path', type: 'string' },
    { name: 'mimeType', type: 'string', facet: true },
    { name: 'size', type: 'int32' },
    { name: 'createdAt', type: 'int64' },
    { name: 'updatedAt', type: 'int64' },
  ],
  default_sorting_field: 'updatedAt'
}

// sessions collection
{
  name: 'sessions',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'userId', type: 'string', facet: true },
    { name: 'title', type: 'string' },
    { name: 'status', type: 'string', facet: true },
    { name: 'createdAt', type: 'int64' },
    { name: 'updatedAt', type: 'int64' },
  ],
  default_sorting_field: 'updatedAt'
}

// tasks collection
{
  name: 'tasks',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'userId', type: 'string', facet: true },
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string', optional: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'taskType', type: 'string', facet: true },
    { name: 'createdAt', type: 'int64' },
    { name: 'nextRunAt', type: 'int64', optional: true },
  ],
  default_sorting_field: 'createdAt'
}

// projects collection
{
  name: 'projects',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'userId', type: 'string', facet: true },
    { name: 'name', type: 'string' },
    { name: 'description', type: 'string', optional: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'tags', type: 'string[]', facet: true, optional: true },
    { name: 'createdAt', type: 'int64' },
    { name: 'updatedAt', type: 'int64' },
  ],
  default_sorting_field: 'updatedAt'
}

// actions collection (agent tasks)
{
  name: 'actions',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'userId', type: 'string', facet: true },
    { name: 'title', type: 'string' },
    { name: 'description', type: 'string', optional: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'agentType', type: 'string', facet: true },
    { name: 'createdAt', type: 'int64' },
  ],
  default_sorting_field: 'createdAt'
}
```

### Federated Search Query

```typescript
// Multi-collection search in one API call
const searchResults = await typesenseClient.multiSearch.perform({
  searches: [
    {
      collection: 'files',
      q: query,
      query_by: 'name,path',
      filter_by: `userId:=${userId}`,
      limit: 5,
    },
    {
      collection: 'sessions',
      q: query,
      query_by: 'title',
      filter_by: `userId:=${userId}`,
      limit: 5,
    },
    {
      collection: 'tasks',
      q: query,
      query_by: 'title,description',
      filter_by: `userId:=${userId}`,
      limit: 5,
    },
    {
      collection: 'projects',
      q: query,
      query_by: 'name,description',
      filter_by: `userId:=${userId}`,
      limit: 5,
    },
    {
      collection: 'actions',
      q: query,
      query_by: 'title,description',
      filter_by: `userId:=${userId}`,
      limit: 5,
    },
  ],
});
```

---

## Deployment Strategy

### Development Environment

```yaml
# docker-compose.yml
services:
  typesense:
    image: typesense/typesense:27.1
    container_name: rubic-typesense
    ports:
      - "8108:8108"
    environment:
      - TYPESENSE_API_KEY=local-dev-key
      - TYPESENSE_DATA_DIR=/data
    volumes:
      - typesense-data:/data
    restart: unless-stopped

volumes:
  typesense-data:
```

### Production Environment (AWS)

**Option A: Self-Hosted on EC2**
- t3.medium instance (2 vCPU, 4GB RAM)
- EBS volume for data persistence
- Application Load Balancer
- Auto-scaling group for high availability

**Option B: Typesense Cloud**
- Production cluster (2 vCPU, 4GB RAM)
- 99.99% SLA
- Automatic backups
- Multi-region replication

**Recommended:** Start with Typesense Cloud for Production, self-host for Development.

---

## Environment Variables

```bash
# Typesense Configuration
TYPESENSE_HOST=localhost          # or cloud endpoint
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http           # https for production
TYPESENSE_API_KEY=your-api-key    # Admin key for server
TYPESENSE_SEARCH_KEY=your-search-key  # Read-only for client
```

---

## Consequences

### Positive

- **10-50x cost savings** compared to Algolia
- **Sub-50ms search latency** for excellent UX
- **Built-in typo tolerance** requires no configuration
- **Self-hosting option** for data privacy compliance
- **Open source** eliminates vendor lock-in
- **Federated search** enables unified search across all entities
- **Easy integration** with TypeScript SDK

### Negative

- **Additional infrastructure** to manage (mitigated by using Typesense Cloud)
- **Index synchronization** complexity
- **Learning curve** for team (minimal - good documentation)

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Typesense goes down | Low | High | Fallback to PostgreSQL FTS |
| Index out of sync | Medium | Medium | Periodic reindex job |
| Scale limits | Low | Medium | Horizontal scaling / Typesense Cloud |

---

## Implementation Plan

### Phase 1: Package Setup (Week 1)
1. Create `@repo/search` package
2. Implement Typesense client singleton
3. Define collection schemas
4. Write index service

### Phase 2: API Integration (Week 1-2)
1. Add search TRPC router
2. Implement federated search endpoint
3. Add index mutation middleware

### Phase 3: UI Implementation (Week 2)
1. Create SearchModal component (CMD+K)
2. Implement search results display
3. Add keyboard navigation
4. Wire up Redux state

### Phase 4: Sync & Testing (Week 3)
1. Implement background index sync
2. Add initial data migration script
3. Write integration tests
4. Load testing

---

## References

- [Typesense Documentation](https://typesense.org/docs/)
- [Typesense GitHub](https://github.com/typesense/typesense)
- [Typesense vs Algolia Comparison](https://typesense.org/typesense-vs-algolia-vs-elasticsearch-vs-meilisearch/)
- [Multi-Search API](https://typesense.org/docs/30.1/api/federated-multi-search.html)
- [cmdk React Component](https://cmdk.paco.me/) (for search UI)
