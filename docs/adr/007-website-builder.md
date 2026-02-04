# ADR-007: Website Builder Architecture (v0/Bolt/Lovable Style)

**Status:** Proposed
**Date:** 2026-02-04
**Decision Makers:** Engineering Team
**Technical Story:** Adding AI-powered website builder like v0.dev, Bolt.new, Lovable, and Replit

---

## Context and Problem Statement

Rubic needs to support building websites and web applications autonomously, similar to:
- **v0.dev** (Vercel) - AI-generated React/Next.js components
- **Bolt.new** (StackBlitz) - Full-stack app generation with WebContainers
- **Lovable** - AI-first web app development
- **Replit** - Cloud-based IDE with AI assistance

Users should be able to describe what they want, and Rubic creates fully functional websites with database backends.

---

## Decision Drivers

1. **Browser-based Preview**: Users need instant preview without server deployments
2. **Full-stack Support**: Not just frontend - need database, API routes, authentication
3. **Production Deployment**: One-click deploy to production with custom domains
4. **Database Per Project**: Each website needs its own database (TiDB/PingCAP)
5. **AI Code Generation**: Claude/GPT generates and modifies code based on prompts

---

## Considered Options

### Option 1: WebContainers (StackBlitz) - **SELECTED**

**Pros:**
- Browser-native Node.js runtime (no server needed for preview)
- Sub-second preview updates
- Full npm ecosystem support
- Battle-tested (powers StackBlitz, Bolt.new)

**Cons:**
- Limited to Node.js environments
- WebContainer licenses for commercial use

### Option 2: E2B Sandboxes

**Pros:**
- Full VM isolation
- Any language/framework support
- Already in our stack

**Cons:**
- Slower startup (150ms vs instant)
- Requires server round-trips for preview
- Higher cost per session

### Option 3: Custom Docker Containers

**Pros:**
- Full control
- Any technology stack

**Cons:**
- Significant infrastructure overhead
- Cold start latency
- Complex orchestration

---

## Decision

**Use WebContainers for browser-based development** with **E2B for production builds** and **TiDB Serverless for databases**.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEBSITE BUILDER FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐     ┌────────────────┐     ┌────────────────┐          │
│  │   User Prompt  │────▶│  Agent Service │────▶│ Website Service│          │
│  │ "Build a todo  │     │  (Claude/GPT)  │     │ (Code Manager) │          │
│  │     app"       │     └────────┬───────┘     └────────┬───────┘          │
│  └────────────────┘              │                      │                   │
│                                  │                      │                   │
│                    ┌─────────────┴──────────────────────┴──────────┐       │
│                    │              CODE GENERATION                   │       │
│                    │  • React/Next.js components                   │       │
│                    │  • API routes                                 │       │
│                    │  • Database schemas                           │       │
│                    │  • Tailwind styling                           │       │
│                    └─────────────┬──────────────────────────────────┘       │
│                                  │                                          │
│         ┌────────────────────────┼────────────────────────┐                │
│         │                        │                        │                │
│         ▼                        ▼                        ▼                │
│  ┌─────────────┐        ┌─────────────┐         ┌─────────────┐           │
│  │ WebContainer│        │    TiDB     │         │   Vercel/   │           │
│  │  (Preview)  │        │ (Database)  │         │   Netlify   │           │
│  │  Browser    │        │  Serverless │         │  (Deploy)   │           │
│  └─────────────┘        └─────────────┘         └─────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Code Editor** | Monaco Editor | VS Code-like editing experience |
| **Preview Runtime** | WebContainers | Browser-based Node.js |
| **AI Generation** | Claude/GPT | Code generation from prompts |
| **File Storage** | PostgreSQL + S3 | Project files with versioning |
| **Database** | TiDB Serverless | Per-project MySQL-compatible DB |
| **Deployment** | Vercel/Netlify API | Production hosting |
| **Domains** | Route53 + ACM | Custom domain + SSL |

### Database Schema

```sql
-- Website Projects
CREATE TABLE website_projects (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  framework ENUM('nextjs', 'react', 'vue', 'svelte', 'astro') DEFAULT 'nextjs',
  template_id VARCHAR(36),
  preview_url VARCHAR(500),
  production_url VARCHAR(500),
  custom_domain VARCHAR(255),
  status ENUM('draft', 'building', 'ready', 'deployed', 'error') DEFAULT 'draft',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Project Files (with version history)
CREATE TABLE website_files (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
  path VARCHAR(500) NOT NULL, -- e.g., '/src/components/Button.tsx'
  content TEXT,
  content_hash VARCHAR(64),
  version INT DEFAULT 1,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, path, version)
);

-- Project Databases (TiDB)
CREATE TABLE website_databases (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES website_projects(id) ON DELETE CASCADE,
  tidb_cluster_id VARCHAR(100),
  tidb_branch_name VARCHAR(100) DEFAULT 'main',
  connection_string_encrypted TEXT, -- AES-256 encrypted
  host VARCHAR(255),
  port INT DEFAULT 4000,
  database_name VARCHAR(100),
  username VARCHAR(100),
  status ENUM('provisioning', 'ready', 'error', 'deleted') DEFAULT 'provisioning',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Deployments
CREATE TABLE website_deployments (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL REFERENCES website_projects(id),
  platform ENUM('vercel', 'netlify', 'custom') NOT NULL,
  deployment_id VARCHAR(100), -- Platform's deployment ID
  url VARCHAR(500),
  status ENUM('queued', 'building', 'ready', 'error', 'cancelled') DEFAULT 'queued',
  commit_sha VARCHAR(64),
  build_logs TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_website_projects_user ON website_projects(user_id);
CREATE INDEX idx_website_files_project ON website_files(project_id);
CREATE INDEX idx_website_deployments_project ON website_deployments(project_id);
```

### API Endpoints

```typescript
// Website Service API Routes

// Projects
POST   /v1/websites                    // Create new project
GET    /v1/websites                    // List user's projects
GET    /v1/websites/:id                // Get project details
PUT    /v1/websites/:id                // Update project settings
DELETE /v1/websites/:id                // Delete project

// AI Code Generation
POST   /v1/websites/:id/generate       // Generate code from prompt
POST   /v1/websites/:id/modify         // Modify existing code
POST   /v1/websites/:id/fix            // Fix errors in code

// File Management
GET    /v1/websites/:id/files          // List all files
GET    /v1/websites/:id/files/*path    // Get file content
PUT    /v1/websites/:id/files/*path    // Update file
DELETE /v1/websites/:id/files/*path    // Delete file
POST   /v1/websites/:id/files/batch    // Batch file operations

// Preview & Deployment
POST   /v1/websites/:id/preview        // Start preview session
GET    /v1/websites/:id/preview/status // Get preview URL
POST   /v1/websites/:id/deploy         // Deploy to production
GET    /v1/websites/:id/deployments    // List deployments

// Database
POST   /v1/websites/:id/database       // Provision TiDB database
GET    /v1/websites/:id/database       // Get database connection info
DELETE /v1/websites/:id/database       // Delete database
POST   /v1/websites/:id/database/branch // Create preview branch
```

### TiDB/PingCAP Integration

```typescript
// services/website/src/lib/tidb.ts

import { TiDBCloudClient } from '@tidbcloud/sdk';

interface DatabaseConfig {
  projectId: string;
  userId: string;
  branchName?: string;
}

export class TiDBManager {
  private client: TiDBCloudClient;

  constructor() {
    this.client = new TiDBCloudClient({
      publicKey: process.env.TIDB_PUBLIC_KEY!,
      privateKey: process.env.TIDB_PRIVATE_KEY!,
    });
  }

  async provisionDatabase(config: DatabaseConfig): Promise<DatabaseConnection> {
    // Create serverless cluster for the project
    const cluster = await this.client.serverless.create({
      name: `rubic-${config.projectId}`,
      region: 'us-east-1',
      labels: {
        userId: config.userId,
        projectId: config.projectId,
      },
    });

    // Wait for cluster to be ready
    await this.waitForReady(cluster.id);

    // Create database user
    const credentials = await this.client.users.create(cluster.id, {
      username: `app_${config.projectId.slice(0, 8)}`,
      roles: ['readWrite'],
    });

    return {
      clusterId: cluster.id,
      host: cluster.endpoints.public,
      port: 4000,
      database: 'main',
      username: credentials.username,
      password: credentials.password,
      connectionString: this.buildConnectionString(cluster, credentials),
    };
  }

  async createBranch(clusterId: string, branchName: string): Promise<BranchInfo> {
    // TiDB branching for preview deployments
    return await this.client.branches.create(clusterId, {
      name: branchName,
      parentBranch: 'main',
    });
  }

  async deleteDatabase(clusterId: string): Promise<void> {
    await this.client.serverless.delete(clusterId);
  }

  private buildConnectionString(
    cluster: Cluster,
    credentials: Credentials
  ): string {
    return `mysql://${credentials.username}:${credentials.password}@${cluster.endpoints.public}:4000/main?ssl=true`;
  }
}
```

### WebContainer Integration

```typescript
// apps/app/components/website-builder/preview.tsx

import { WebContainer } from '@webcontainer/api';

export class WebContainerManager {
  private container: WebContainer | null = null;

  async boot(): Promise<void> {
    this.container = await WebContainer.boot();
  }

  async mountFiles(files: FileTree): Promise<void> {
    await this.container!.mount(files);
  }

  async installDependencies(): Promise<void> {
    const installProcess = await this.container!.spawn('npm', ['install']);

    installProcess.output.pipeTo(
      new WritableStream({
        write(chunk) {
          console.log(chunk); // Stream to UI
        },
      })
    );

    const exitCode = await installProcess.exit;
    if (exitCode !== 0) {
      throw new Error('Installation failed');
    }
  }

  async startDevServer(): Promise<string> {
    const devProcess = await this.container!.spawn('npm', ['run', 'dev']);

    // Wait for server to start and return URL
    return new Promise((resolve) => {
      this.container!.on('server-ready', (port, url) => {
        resolve(url);
      });
    });
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.container!.fs.writeFile(path, content);
  }
}
```

### Code Generation Prompt Template

```typescript
// services/website/src/lib/prompts.ts

export const generateWebsitePrompt = (
  userPrompt: string,
  existingFiles: FileTree,
  framework: 'nextjs' | 'react'
) => `
You are an expert web developer. Generate code for the following request.

Framework: ${framework}
User Request: ${userPrompt}

Existing Files:
${JSON.stringify(existingFiles, null, 2)}

Guidelines:
1. Use TypeScript
2. Use Tailwind CSS for styling
3. Follow ${framework} best practices
4. Include proper error handling
5. Make components reusable
6. Add appropriate comments

Return a JSON object with file changes:
{
  "files": {
    "/path/to/file.tsx": "file content",
    ...
  },
  "dependencies": ["package-name", ...],
  "explanation": "Brief explanation of changes"
}
`;
```

---

## Deployment Pipeline

### Preview Flow
1. User makes changes in browser editor
2. WebContainer updates files instantly
3. Dev server hot-reloads (sub-second)
4. Preview URL available in iframe

### Production Flow
1. User clicks "Deploy"
2. Website Service packages files
3. Triggers Vercel/Netlify deployment API
4. Waits for build completion
5. Returns production URL
6. Optionally configures custom domain

```typescript
// services/website/src/lib/deploy.ts

import { Vercel } from '@vercel/client';

export class DeploymentManager {
  private vercel: Vercel;

  constructor() {
    this.vercel = new Vercel({
      token: process.env.VERCEL_TOKEN!,
    });
  }

  async deployToVercel(project: WebsiteProject): Promise<Deployment> {
    // Create deployment
    const deployment = await this.vercel.deployments.create({
      name: project.name,
      files: await this.getProjectFiles(project.id),
      projectSettings: {
        framework: project.framework,
        buildCommand: 'npm run build',
        outputDirectory: '.next',
      },
      env: await this.getEnvironmentVariables(project),
    });

    // Wait for deployment
    await this.waitForDeployment(deployment.id);

    return {
      id: deployment.id,
      url: deployment.url,
      status: 'ready',
    };
  }

  async configureCustomDomain(
    projectId: string,
    domain: string
  ): Promise<void> {
    // Add domain to Vercel
    await this.vercel.domains.add(projectId, domain);

    // Return DNS records for user to configure
    return {
      type: 'CNAME',
      name: domain,
      value: 'cname.vercel-dns.com',
    };
  }
}
```

---

## Cost Analysis

### TiDB Serverless Pricing
- **Free Tier**: 5 GiB storage, 50M Request Units/month
- **Pay-as-you-go**: $0.12/million RUs, $0.02/GiB/month
- **Estimated per project**: $0-5/month for small apps

### Vercel Pricing
- **Hobby**: Free (personal projects)
- **Pro**: $20/user/month (team features)
- **Estimated per deployment**: $0 for previews, $0-10/month for production

### Total Additional Cost
| Component | MVP (100 websites) | Growth (1000 websites) |
|-----------|-------------------|------------------------|
| TiDB | ~$50/month | ~$500/month |
| Vercel | $20/month | $200/month |
| Storage | ~$10/month | ~$100/month |
| **Total** | **~$80/month** | **~$800/month** |

---

## Templates

Pre-built templates to accelerate development:

| Template | Framework | Features |
|----------|-----------|----------|
| **Landing Page** | Next.js | Hero, Features, Pricing, CTA |
| **SaaS Dashboard** | Next.js | Auth, Dashboard, Settings |
| **E-commerce** | Next.js | Products, Cart, Checkout |
| **Blog** | Next.js | Posts, Categories, MDX |
| **Portfolio** | Astro | Projects, About, Contact |
| **API Backend** | Express | REST API, Auth, Database |

---

## Security Considerations

1. **Code Isolation**: WebContainers run in browser sandbox
2. **Database Isolation**: Separate TiDB cluster per project
3. **Secrets Management**: Encrypted storage for API keys
4. **Rate Limiting**: Prevent abuse of generation API
5. **Content Scanning**: Detect malicious code patterns

---

## Implementation Phases

### Phase 1: MVP (2 weeks)
- [ ] Basic project CRUD
- [ ] Monaco editor integration
- [ ] WebContainer preview
- [ ] Next.js template
- [ ] Vercel deployment

### Phase 2: Database (1 week)
- [ ] TiDB integration
- [ ] Connection management
- [ ] Schema migrations

### Phase 3: AI Generation (2 weeks)
- [ ] Claude code generation
- [ ] Iterative modification
- [ ] Error fixing

### Phase 4: Polish (1 week)
- [ ] Custom domains
- [ ] Team collaboration
- [ ] Template gallery

---

## References

- [WebContainers Documentation](https://webcontainers.io/docs)
- [TiDB Cloud SDK](https://docs.pingcap.com/tidbcloud/api-overview)
- [Vercel API](https://vercel.com/docs/rest-api)
- [v0 by Vercel](https://v0.dev)
- [Bolt.new](https://bolt.new)
