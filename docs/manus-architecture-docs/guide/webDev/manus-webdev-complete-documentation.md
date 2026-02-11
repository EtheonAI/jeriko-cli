# Manus Web Development System - Complete Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [E2B Sandbox Integration](#e2b-sandbox-integration)
3. [WebDev Tools API Reference](#webdev-tools-api-reference)
4. [Template System](#template-system)
5. [State Management & Lifecycle](#state-management--lifecycle)
6. [File System Operations](#file-system-operations)
7. [Database Management](#database-management)
8. [Deployment & Hosting](#deployment--hosting)
9. [UI/IDE Components](#uiide-components)
10. [Complete Workflow Example](#complete-workflow-example)

---

## 1. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│  (Chat + Management UI + Preview + Code Editor + Database)  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Manus AI Agent                            │
│  - Function Calling Engine                                   │
│  - Task Planning & Execution                                 │
│  - Context Management                                        │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Tool Layer (Function Calls)                 │
│  - webdev_init_project                                       │
│  - webdev_save_checkpoint                                    │
│  - webdev_check_status                                       │
│  - webdev_execute_sql                                        │
│  - file (read/write/edit/view)                               │
│  - shell (exec/view/wait)                                    │
│  - browser, search, generate, etc.                           │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│              E2B Sandbox (Ubuntu 22.04)                      │
│  - File System: /home/ubuntu/                                │
│  - Node.js 22.13.0 + pnpm                                    │
│  - Python 3.11                                               │
│  - MySQL/TiDB Database                                       │
│  - Dev Server (Vite + Express)                               │
│  - Port Exposure (3000 → public URL)                         │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Services                            │
│  - Manus Biz Server (project management)                    │
│  - Git Repository (checkpoints)                              │
│  - S3 Storage (static assets)                                │
│  - Deployment Pipeline (production hosting)                  │
│  - OAuth Server (authentication)                             │
│  - Stripe Integration (payments)                             │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Request** → Chat interface
2. **AI Processing** → Manus agent analyzes intent
3. **Function Calling** → Tool invocation with parameters
4. **E2B Execution** → Commands run in sandbox
5. **State Update** → Project metadata persisted
6. **UI Reflection** → Management UI updates
7. **User Feedback** → Preview/results displayed

---

## 2. E2B Sandbox Integration

### Sandbox Lifecycle

**Creation:**
- E2B sandbox spawned on first tool use
- Ubuntu 22.04 base image with pre-installed packages
- Persistent storage at `/home/ubuntu/`
- Network access enabled

**Hibernation:**
- Auto-hibernates after inactivity
- State persisted (files, processes, databases)
- Resumes transparently on next tool call

**Termination:**
- Sandbox destroyed after task completion
- Checkpoints saved to Git before termination

### Pre-installed Software

```bash
# System
OS: Ubuntu 22.04 linux/amd64
User: ubuntu (sudo privileges, no password)

# Languages & Runtimes
Node.js: 22.13.0
Python: 3.11.0rc1
pnpm: 10.4.1

# Databases
MySQL client (connects to external TiDB)

# Utilities
bc, curl, gh, git, gzip, less, net-tools, poppler-utils, 
psmisc, socat, tar, unzip, wget, zip

# Python Packages (pre-installed)
beautifulsoup4, fastapi, flask, fpdf2, markdown, matplotlib,
numpy, openpyxl, pandas, pdf2image, pillow, plotly, reportlab,
requests, seaborn, tabulate, uvicorn, weasyprint, xhtml2pdf

# Node.js Packages (installed per-project)
See package.json in template section
```

### Custom Utilities

```bash
# Manus-provided CLI tools in sandbox
manus-render-diagram <input> <output>     # Render .mmd/.d2/.puml to PNG
manus-md-to-pdf <input> <output>          # Convert Markdown to PDF
manus-speech-to-text <input>              # Transcribe audio to text
manus-mcp-cli <command> [args]            # MCP server interaction
manus-upload-file <input>                 # Upload to S3, get public URL
manus-export-slides <uri> <format>        # Export slides to PDF/PPT
```

### Port Exposure

```javascript
// Internal sandbox port
const port = 3000;

// Exposed via Manus proxy
const publicUrl = "https://3000-{sessionId}-{hash}.us2.manus.computer";

// Automatic mapping - no manual configuration needed
```

---

## 3. WebDev Tools API Reference

### `webdev_init_project`

**Purpose:** Initialize a new web project with scaffolding

**Parameters:**
```typescript
{
  name: string;              // Project name (lowercase-with-hyphens)
  description: string;       // Project description
  scaffold: "web-static" | "web-db-user";  // Template type
  brief: string;             // One-sentence purpose
  title: string;             // Website title (displayed in UI)
}
```

**Scaffolds Available:**

1. **web-static**
   - React 19 + Vite + Tailwind 4
   - Static site generation
   - No backend/database
   - Fast deployment

2. **web-db-user**
   - React 19 + Vite + Tailwind 4
   - Express 4 backend
   - tRPC 11 (type-safe API)
   - MySQL/TiDB database
   - Manus OAuth authentication
   - Drizzle ORM
   - shadcn/ui components

**Return Value:**
```typescript
{
  projectPath: string;       // /home/ubuntu/{project-name}
  versionId: string;         // Initial checkpoint ID
  devServerUrl: string;      // Public preview URL
  features: string[];        // ["server", "db", "user"]
  readme: string;            // Full template README content
  createdFiles: string[];    // List of scaffolded files
}
```

**State Changes:**
- Creates project directory in sandbox
- Installs dependencies via pnpm
- Starts dev server on port 3000
- Creates initial Git checkpoint
- Registers project with Manus Biz server
- Exposes port publicly

**Example Call:**
```typescript
webdev_init_project({
  name: "sally-salon",
  description: "Salon booking website with payments",
  scaffold: "web-db-user",
  brief: "Initialize salon website project",
  title: "Sally - Premier Women's Salon"
})
```

---

### `webdev_add_feature`

**Purpose:** Add additional features to existing project

**Parameters:**
```typescript
{
  brief: string;
  feature: "web-db-user" | "stripe";
}
```

**Features:**

1. **web-db-user** (upgrade from web-static)
   - Adds Express backend
   - Adds database integration
   - Adds user authentication
   - Migrates static site to full-stack

2. **stripe**
   - Installs Stripe SDK
   - Creates webhook endpoint
   - Adds payment helpers
   - Configures test sandbox
   - Sets environment variables

**Return Value:**
```typescript
{
  success: boolean;
  instructions: string;      // Setup guide
  newFiles: string[];        // Added files
  envVars: string[];         // New environment variables
}
```

**State Changes:**
- Installs new dependencies
- Adds boilerplate files
- Updates project metadata
- Restarts dev server
- May trigger database migrations

---

### `webdev_save_checkpoint`

**Purpose:** Create Git checkpoint for deployment

**Parameters:**
```typescript
{
  brief: string;
  description: string;       // Commit message
  timeout?: number;          // Default 45s, increase for large projects
}
```

**Process:**
1. Scans project directory for changes
2. Uploads media files to S3 (images/videos/audio)
3. Replaces local paths with CDN URLs
4. Commits all changes to Git
5. Pushes to Manus Git server
6. Generates version ID
7. Captures screenshot of preview
8. Enables "Publish" button in UI

**Return Value:**
```typescript
{
  versionId: string;         // Unique checkpoint ID (e.g., "0041434c")
  commitHash: string;        // Git commit SHA
  screenshotUrl: string;     // Preview screenshot
  timestamp: number;         // Unix timestamp
}
```

**State Changes:**
- Creates Git commit
- Updates project version
- Enables deployment
- Stores checkpoint metadata

**Critical Requirements:**
- Media files MUST be uploaded to S3 first
- Local media paths cause deployment timeout
- Use `manus-upload-file` before checkpoint

---

### `webdev_check_status`

**Purpose:** Inspect project health and dev server state

**Parameters:**
```typescript
{
  brief: string;
}
```

**Return Value:**
```typescript
{
  devServer: {
    status: "running" | "stopped" | "error";
    port: number;
    url: string;
    recentOutput: string[];  // Last 50 lines of logs
  };
  healthChecks: {
    buildErrors: boolean;
    dependencies: "OK" | "missing" | "outdated";
    lsp: "no errors" | string;
    typescript: "no errors" | string;
  };
  projectPath: string;
  versionId: string;
  features: string[];
}
```

**When to Use:**
- After dependency installs
- After configuration changes
- During troubleshooting
- Before checkpoints (to verify state)

**State Changes:**
- None (read-only operation)
- May trigger health check scans

---

### `webdev_restart_server`

**Purpose:** Restart dev server and services

**Parameters:**
```typescript
{
  brief: string;
}
```

**Process:**
1. Kills existing dev server process
2. Clears build cache
3. Restarts Vite + Express
4. Re-establishes port exposure
5. Waits for server ready

**When to Use:**
- Server becomes unresponsive
- After env variable changes
- After framework config changes
- When HMR stops working

**State Changes:**
- Terminates old process
- Spawns new dev server
- Updates server status

---

### `webdev_rollback_checkpoint`

**Purpose:** Restore project to previous checkpoint

**Parameters:**
```typescript
{
  brief: string;
  versionId: string;         // Checkpoint ID to restore
}
```

**Process:**
1. Fetches checkpoint from Git
2. Deletes current project directory
3. Checks out specified version
4. Reinstalls dependencies
5. Restarts dev server
6. Updates project metadata

**When to Use:**
- Recent changes broke functionality
- Failed experiments
- Accidental deletions
- Project directory missing/corrupted

**State Changes:**
- Replaces entire project directory
- Resets to checkpoint state
- Updates current version ID

---

### `webdev_execute_sql`

**Purpose:** Execute SQL queries on project database

**Parameters:**
```typescript
{
  brief: string;
  query: string;             // SQL statement(s), semicolon-separated
}
```

**Supported Operations:**
- CREATE TABLE
- ALTER TABLE
- INSERT, UPDATE, DELETE
- SELECT (for verification)
- DROP (use with caution)

**Return Value:**
```typescript
{
  success: boolean;
  rows: any[];               // Query results
  rowCount: number;
  executionTime: number;     // Milliseconds
  error?: string;
}
```

**Best Practices:**
1. Edit `drizzle/schema.ts`
2. Run `pnpm drizzle-kit generate`
3. Review generated SQL
4. Execute via `webdev_execute_sql`
5. Verify with SELECT query

**State Changes:**
- Modifies database schema/data
- No automatic rollback
- Destructive operations are permanent

---

### `webdev_request_secrets`

**Purpose:** Add/update environment variables and secrets

**Parameters:**
```typescript
{
  brief: string;
  message: string;           // User-facing explanation
  secrets: Array<{
    key: string;             // ENV variable name
    description: string;     // Purpose explanation
    value?: string;          // Omit to prompt user input
    preventMatching?: boolean; // Don't auto-match BYOK
  }>;
}
```

**Auto-Matching (BYOK):**
- If `value` omitted, checks user's BYOK connectors
- Matches by key name (e.g., OPENAI_API_KEY)
- Falls back to user input if no match

**System-Injected Secrets:**
```typescript
// Always available (no request needed)
DATABASE_URL
JWT_SECRET
VITE_APP_ID
OAUTH_SERVER_URL
VITE_OAUTH_PORTAL_URL
OWNER_OPEN_ID
OWNER_NAME
BUILT_IN_FORGE_API_KEY
BUILT_IN_FORGE_API_URL
VITE_FRONTEND_FORGE_API_KEY
VITE_FRONTEND_FORGE_API_URL
VITE_ANALYTICS_ENDPOINT
VITE_ANALYTICS_WEBSITE_ID
VITE_APP_LOGO
VITE_APP_TITLE
STRIPE_SECRET_KEY (if Stripe feature added)
STRIPE_WEBHOOK_SECRET (if Stripe feature added)
VITE_STRIPE_PUBLISHABLE_KEY (if Stripe feature added)
```

**State Changes:**
- Updates .env file
- Restarts dev server
- Persists to production deployment

---

## 4. Template System

### web-db-user Template Structure

```
/home/ubuntu/{project-name}/
├── client/                    # Frontend (React + Vite)
│   ├── public/               # Static assets (served at /)
│   ├── src/
│   │   ├── _core/           # Framework internals (don't edit)
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   └── ...
│   │   ├── components/
│   │   │   ├── ui/          # shadcn/ui components
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── AIChatBox.tsx
│   │   │   ├── Map.tsx
│   │   │   └── ErrorBoundary.tsx
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/
│   │   │   └── trpc.ts      # tRPC client setup
│   │   ├── pages/           # Route components
│   │   │   ├── Home.tsx
│   │   │   └── NotFound.tsx
│   │   ├── App.tsx          # Router + layout
│   │   ├── main.tsx         # Entry point
│   │   ├── index.css        # Global styles + theme
│   │   └── const.ts         # Constants (getLoginUrl)
│   └── index.html
├── server/                    # Backend (Express + tRPC)
│   ├── _core/               # Framework internals (don't edit)
│   │   ├── index.ts         # Express server
│   │   ├── context.ts       # tRPC context (user auth)
│   │   ├── trpc.ts          # tRPC router setup
│   │   ├── oauth.ts         # OAuth flow
│   │   ├── cookies.ts       # Session management
│   │   ├── systemRouter.ts  # System procedures
│   │   ├── llm.ts           # LLM integration
│   │   ├── voiceTranscription.ts
│   │   ├── imageGeneration.ts
│   │   ├── notification.ts  # Owner notifications
│   │   ├── map.ts           # Google Maps proxy
│   │   └── env.ts           # Environment validation
│   ├── db.ts                # Database queries
│   ├── routers.ts           # tRPC procedures (main API)
│   └── *.test.ts            # Vitest tests
├── drizzle/                  # Database schema + migrations
│   ├── schema.ts            # Table definitions
│   └── *.sql                # Generated migrations
├── storage/                  # S3 helpers
│   └── index.ts
├── shared/                   # Shared types/constants
│   └── const.ts
├── .manus-logs/             # Log files
│   ├── devserver.log
│   ├── browserConsole.log
│   ├── networkRequests.log
│   └── sessionReplay.log
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
└── vitest.config.ts
```

### Key Files Explained

**`client/src/App.tsx`**
```typescript
// Router configuration
// Add routes here for new pages
import { Route, Switch } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/services" component={Services} />
      {/* Add more routes */}
      <Route component={NotFound} />
    </Switch>
  );
}
```

**`client/src/index.css`**
```css
/* Theme variables (OKLCH color format for Tailwind 4) */
:root {
  --primary: oklch(0.65 0.25 350);        /* Pink primary color */
  --primary-foreground: oklch(1 0 0);     /* White text on primary */
  --background: oklch(0.99 0.01 350);     /* Light pink background */
  /* ... more theme variables */
}

/* Font configuration */
body {
  font-family: 'Montserrat', sans-serif;
}
h1, h2, h3, h4, h5, h6 {
  font-family: 'Playfair Display', serif;
}
```

**`server/routers.ts`**
```typescript
// tRPC API definition
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      // Clear session cookie
    }),
  }),
  
  // Add feature routers
  services: router({
    list: publicProcedure.query(async () => {
      return await db.select().from(services);
    }),
  }),
  
  appointments: router({
    create: protectedProcedure
      .input(z.object({ serviceId: z.number(), appointmentTime: z.date() }))
      .mutation(async ({ ctx, input }) => {
        // Create appointment for ctx.user
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

**`drizzle/schema.ts`**
```typescript
// Database schema (Drizzle ORM)
import { mysqlTable, int, varchar, timestamp } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceId: int("serviceId").notNull(),
  appointmentTime: timestamp("appointmentTime").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled"]),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  // ... more fields
});
```

### Template Customization Points

**Colors (index.css):**
- Change `--primary`, `--secondary`, `--accent` in `:root`
- Use OKLCH format: `oklch(lightness chroma hue)`
- Example: Pink = `oklch(0.65 0.25 350)`

**Fonts (index.html + index.css):**
- Add Google Fonts link in `<head>`
- Apply in `body` and heading selectors

**Routes (App.tsx):**
- Add `<Route path="/new-page" component={NewPage} />`
- Import component at top

**Database (schema.ts):**
- Add new tables with `mysqlTable()`
- Run `pnpm drizzle-kit generate`
- Execute SQL via `webdev_execute_sql`

**API (routers.ts):**
- Add procedures in `appRouter`
- Use `publicProcedure` (no auth) or `protectedProcedure` (requires login)
- Access user via `ctx.user`

---

## 5. State Management & Lifecycle

### Project State Machine

```
┌─────────────┐
│   CREATED   │  (webdev_init_project)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ DEVELOPING  │  (file edits, shell commands)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ CHECKPOINT  │  (webdev_save_checkpoint)
└──────┬──────┘
       │
       ├─────────────────┐
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  PUBLISHED  │   │ DEVELOPING  │  (continue editing)
└─────────────┘   └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │  ROLLBACK   │  (webdev_rollback_checkpoint)
                  └──────┬──────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ DEVELOPING  │
                  └─────────────┘
```

### State Persistence

**In E2B Sandbox:**
- File system: `/home/ubuntu/{project-name}/`
- Dev server process: PID tracked
- Database: External TiDB (persists beyond sandbox)
- Environment variables: Loaded from Manus Biz server

**In Manus Biz Server:**
- Project metadata (name, description, features)
- Version history (checkpoints)
- Environment variables (secrets)
- Deployment configuration
- Analytics data

**In Git Repository:**
- Full project code (each checkpoint)
- Commit history
- Branch: `main` (linear history)

### Checkpoint Versioning

**Version ID Format:**
- 12-character alphanumeric (e.g., `0041434c`)
- Generated from Git commit hash
- Unique per checkpoint
- Used for rollback and deployment

**Checkpoint Contents:**
- All project files (except node_modules, .git)
- package.json with locked versions
- Database schema (drizzle/schema.ts)
- Environment variable keys (not values)

**Deployment from Checkpoint:**
1. Fetch checkpoint from Git
2. Install dependencies
3. Build production bundle (`pnpm build`)
4. Inject environment variables
5. Start production server
6. Route domain to deployment

---

## 6. File System Operations

### File Tool API

**Read:**
```typescript
file.read({
  path: "/home/ubuntu/sally-salon/client/src/App.tsx",
  range: [1, 50]  // Optional: lines 1-50
})
```

**Write (create/overwrite):**
```typescript
file.write({
  path: "/home/ubuntu/sally-salon/client/src/pages/NewPage.tsx",
  text: "import React from 'react';\n\nexport default function NewPage() {\n  return <div>New Page</div>;\n}"
})
```

**Edit (targeted replacements):**
```typescript
file.edit({
  path: "/home/ubuntu/sally-salon/client/src/index.css",
  edits: [
    {
      find: "--primary: oklch(0.65 0.25 350);",
      replace: "--primary: oklch(0.70 0.30 350);",
      all: false  // Replace first occurrence only
    },
    {
      find: "font-family: 'Montserrat'",
      replace: "font-family: 'Inter'",
      all: true  // Replace all occurrences
    }
  ]
})
```

**View (multimodal - for images/PDFs):**
```typescript
file.view({
  path: "/home/ubuntu/screenshot.png",
  range: [1, 3]  // For PDFs: pages 1-3
})
```

### Shell Tool API

**Execute:**
```typescript
shell.exec({
  session: "main",  // Session identifier
  command: "cd /home/ubuntu/sally-salon && pnpm install",
  timeout: 60  // Seconds
})
```

**View (check output):**
```typescript
shell.view({
  session: "main"
})
```

**Wait (for long-running commands):**
```typescript
shell.wait({
  session: "main",
  timeout: 30
})
```

**Send (input to interactive process):**
```typescript
shell.send({
  session: "main",
  input: "y\n"  // Send "y" + Enter
})
```

**Kill (terminate process):**
```typescript
shell.kill({
  session: "main"
})
```

### File Matching

**Glob (find files):**
```typescript
match.glob({
  scope: "/home/ubuntu/sally-salon/**/*.tsx"
})
// Returns: ["client/src/App.tsx", "client/src/pages/Home.tsx", ...]
```

**Grep (search content):**
```typescript
match.grep({
  scope: "/home/ubuntu/sally-salon/client/src/**/*.tsx",
  regex: "useAuth\\(\\)",
  leading: 2,   // 2 lines before match
  trailing: 2   // 2 lines after match
})
// Returns: [{ file, line, match, context }]
```

---

## 7. Database Management

### Database Architecture

**Provider:** TiDB (MySQL-compatible)
- Hosted externally (not in E2B sandbox)
- Connection via `DATABASE_URL` env variable
- Persists across sandbox restarts
- Shared across dev/preview/production

**ORM:** Drizzle
- Type-safe query builder
- Schema-first approach
- Migration generation
- MySQL dialect

### Schema Workflow

**1. Define Schema:**
```typescript
// drizzle/schema.ts
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: int("duration").notNull(),
  category: mysqlEnum("category", ["haircut", "coloring", "styling"]).notNull(),
});
```

**2. Generate Migration:**
```bash
cd /home/ubuntu/sally-salon
pnpm drizzle-kit generate
# Output: drizzle/0001_migration_name.sql
```

**3. Review SQL:**
```sql
-- drizzle/0001_migration_name.sql
CREATE TABLE `services` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `duration` int NOT NULL,
  `category` enum('haircut','coloring','styling') NOT NULL,
  CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
```

**4. Execute Migration:**
```typescript
webdev_execute_sql({
  query: `
    CREATE TABLE services (
      id int AUTO_INCREMENT NOT NULL,
      name varchar(255) NOT NULL,
      price decimal(10,2) NOT NULL,
      duration int NOT NULL,
      category enum('haircut','coloring','styling') NOT NULL,
      CONSTRAINT services_id PRIMARY KEY(id)
    );
  `
})
```

**5. Verify:**
```typescript
webdev_execute_sql({
  query: "SELECT * FROM services LIMIT 1;"
})
```

### Database Queries (server/db.ts)

```typescript
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { services } from "../drizzle/schema";

const db = drizzle(process.env.DATABASE_URL);

// Get all active services
export async function getActiveServices() {
  return await db
    .select()
    .from(services)
    .where(eq(services.isActive, 1));
}

// Get service by ID
export async function getServiceById(id: number) {
  const result = await db
    .select()
    .from(services)
    .where(eq(services.id, id))
    .limit(1);
  return result[0];
}

// Create service
export async function createService(data: InsertService) {
  return await db.insert(services).values(data);
}
```

### Management UI Database Panel

**Features:**
- CRUD operations (Create, Read, Update, Delete)
- Table browser with pagination
- SQL query editor
- Connection info (host, port, username, database)
- SSL toggle
- Export data (CSV, JSON)

**Access:**
- Click "Database" button in checkpoint card
- Or open Management UI → Database tab

---

## 8. Deployment & Hosting

### Deployment Pipeline

**Trigger:** User clicks "Publish" button in UI

**Process:**
1. **Fetch Checkpoint**
   - Pull specified version from Git
   - Extract to deployment environment

2. **Install Dependencies**
   - Run `pnpm install --frozen-lockfile`
   - Use production-only dependencies

3. **Build Production Bundle**
   - Run `pnpm build`
   - Vite builds client (static assets)
   - esbuild bundles server (Node.js)

4. **Inject Secrets**
   - Load environment variables from Manus Biz
   - Include system secrets + user secrets

5. **Start Production Server**
   - Run `pnpm start` (Node.js server)
   - Serves static files + API endpoints
   - Binds to internal port

6. **Route Domain**
   - Auto-generated: `{prefix}.manus.space`
   - Custom domain: User-configured in Settings

7. **Health Check**
   - Verify server responds
   - Check database connectivity
   - Monitor for errors

**Hosting Infrastructure:**
- Containerized deployment (Docker/K8s)
- Auto-scaling based on traffic
- CDN for static assets
- SSL/TLS certificates (Let's Encrypt)
- DDoS protection

### Domain Management

**Auto-generated Domain:**
- Format: `{user-chosen-prefix}.manus.space`
- Editable in Settings → Domains
- Instant propagation

**Custom Domain:**
- User provides domain (e.g., `sallysalon.com`)
- Manus provides DNS records (CNAME/A)
- User updates DNS at registrar
- SSL certificate auto-issued
- Verification via DNS challenge

**Domain Purchase (In-App):**
- Search available domains
- Purchase directly in Manus
- Automatic DNS configuration
- No external registrar needed

### Environment Variables in Production

**System Secrets (auto-injected):**
- `DATABASE_URL` (production database)
- `JWT_SECRET`
- `OAUTH_SERVER_URL`
- `STRIPE_SECRET_KEY` (live mode after KYC)
- All `VITE_*` variables

**User Secrets:**
- Set via `webdev_request_secrets`
- Stored encrypted in Manus Biz
- Injected at deployment time
- Editable in Settings → Secrets

---

## 9. UI/IDE Components

### Management UI Architecture

**Location:** Right panel (collapsible)

**Tabs:**

1. **Preview**
   - Live iframe of dev server
   - Persistent login state
   - Visual editor (select elements, edit styles)
   - Natural language editing
   - Responsive preview (mobile/tablet/desktop)

2. **Code**
   - File tree (all project files)
   - Download all files (ZIP)
   - Read-only view (editing via AI agent)

3. **Dashboard**
   - Dev server status
   - Visibility settings (public/private)
   - Analytics (UV/PV for published sites)
   - Deployment history

4. **Database**
   - Table browser
   - CRUD operations
   - SQL query editor
   - Connection info
   - Export data

5. **Settings**
   - **General:** Site name, visibility, favicon
   - **Domains:** Auto-domain prefix, purchase domains, bind custom domains
   - **Notifications:** Built-in notification API settings
   - **Secrets:** Manual secret management
   - **GitHub:** Export code to new repository

### Visual Editor (Preview Panel)

**Features:**
- Click any element to select
- Edit properties:
  - Colors (background, text, border)
  - Spacing (padding, margin)
  - Layout (width, height, display)
  - Typography (font, size, weight)
  - Borders (width, style, radius)
- Natural language editing:
  - "Make the header background pink"
  - "Increase padding on all buttons"
  - "Change font to Playfair Display"
- Changes create new checkpoint
- Rollback anytime

**Implementation:**
- Injects edit overlay into iframe
- Captures element selection
- Generates CSS changes
- Applies via style injection
- Persists to source files

### Code Editor (NOT Monaco)

**Clarification:** Manus does NOT use Monaco Editor or any visual IDE

**Actual Implementation:**
- AI agent edits files via `file` tool
- No interactive code editor in UI
- User views code in "Code" tab (read-only)
- Editing happens through chat (AI makes changes)

**Why No IDE:**
- AI agent is the "IDE"
- Function calling is the "editing interface"
- Faster than manual coding
- No syntax errors (AI validates)
- Context-aware changes

### Chatbox Interface

**Components:**

1. **Message Input**
   - Text input for user requests
   - File upload (images, documents)
   - Voice input (speech-to-text)

2. **Message History**
   - User messages
   - AI responses (Markdown rendered)
   - Tool execution results
   - Error messages

3. **Interactive Cards**
   - **Project Card:** After `webdev_init_project`
     - "View" button → Opens Preview panel
   - **Checkpoint Card:** After `webdev_save_checkpoint`
     - Screenshot (clickable → Preview)
     - "Dashboard" button → Opens Dashboard panel
     - "Publish" button (latest checkpoint only)
     - "Rollback" button (older checkpoints)
   - **Secrets Card:** After `webdev_request_secrets`
     - Input fields for user to enter values
     - Locked fields (AI-proposed values)

4. **Header Icons**
   - Management UI toggle
   - Settings
   - Help/Documentation

---

## 10. Complete Workflow Example

### Scenario: Building Sally Salon Website

**User Request:**
> "Build me a website for a salon in Chicago for women"

**Step 1: Project Initialization**

```typescript
// AI calls:
webdev_init_project({
  name: "sally-salon",
  description: "Women's salon website with booking system",
  scaffold: "web-db-user",
  brief: "Initialize salon website project",
  title: "Sally - Premier Women's Salon in Chicago"
})

// State changes:
// - E2B sandbox creates /home/ubuntu/sally-salon/
// - pnpm installs dependencies
// - Dev server starts on port 3000
// - Public URL: https://3000-xyz.manus.computer
// - Initial checkpoint: 0041434c
// - Project registered in Manus Biz
```

**Step 2: Add Stripe Feature**

```typescript
// AI calls:
webdev_add_feature({
  brief: "Add Stripe payment integration",
  feature: "stripe"
})

// State changes:
// - Installs @stripe/stripe-js, stripe SDK
// - Creates server/stripe.ts helpers
// - Creates server/webhooks/stripe.ts
// - Sets STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, VITE_STRIPE_PUBLISHABLE_KEY
// - Restarts dev server
```

**Step 3: Create Database Schema**

```typescript
// AI edits:
file.edit({
  path: "/home/ubuntu/sally-salon/drizzle/schema.ts",
  edits: [
    {
      find: "// TODO: Add your tables here",
      replace: `
export const services = mysqlTable("services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: int("duration").notNull(),
  category: mysqlEnum("category", ["haircut", "coloring", "styling"]).notNull(),
});

export const appointments = mysqlTable("appointments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  serviceId: int("serviceId").notNull(),
  appointmentTime: timestamp("appointmentTime").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "completed", "cancelled"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
});
      `
    }
  ]
})

// AI runs:
shell.exec({
  session: "main",
  command: "cd /home/ubuntu/sally-salon && pnpm drizzle-kit generate"
})

// AI reads generated SQL:
file.read({
  path: "/home/ubuntu/sally-salon/drizzle/0001_migration.sql"
})

// AI executes migration:
webdev_execute_sql({
  query: `
    CREATE TABLE services (...);
    CREATE TABLE appointments (...);
    ALTER TABLE users ADD stripeCustomerId varchar(255);
  `
})
```

**Step 4: Seed Initial Data**

```typescript
// AI creates seed script:
file.write({
  path: "/home/ubuntu/sally-salon/seed-services.mjs",
  text: `
import { drizzle } from "drizzle-orm/mysql2";
import { services } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL);

const initialServices = [
  { name: "Classic Cut", description: "...", price: "65.00", duration: 60, category: "haircut" },
  { name: "Full Color", description: "...", price: "145.00", duration: 120, category: "coloring" },
  // ... more services
];

async function seed() {
  for (const service of initialServices) {
    await db.insert(services).values(service);
  }
  console.log("✓ Seeded services");
  process.exit(0);
}

seed();
  `
})

// AI runs:
shell.exec({
  session: "seed",
  command: "cd /home/ubuntu/sally-salon && pnpm tsx seed-services.mjs"
})
```

**Step 5: Customize Theme**

```typescript
// AI edits colors:
file.edit({
  path: "/home/ubuntu/sally-salon/client/src/index.css",
  edits: [
    {
      find: "--primary: oklch(0.65 0.25 350);",
      replace: "--primary: oklch(0.65 0.25 350);",  // Pink
      all: false
    },
    {
      find: "--background: oklch(1 0 0);",
      replace: "--background: oklch(0.99 0.01 350);",  // Light pink tint
      all: false
    }
  ]
})

// AI adds fonts:
file.edit({
  path: "/home/ubuntu/sally-salon/client/index.html",
  edits: [
    {
      find: "<!-- Google Fonts here -->",
      replace: `
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      `
    }
  ]
})

file.edit({
  path: "/home/ubuntu/sally-salon/client/src/index.css",
  edits: [
    {
      find: "body {\n    @apply bg-background text-foreground;\n  }",
      replace: `
body {
  @apply bg-background text-foreground;
  font-family: 'Montserrat', sans-serif;
}
h1, h2, h3, h4, h5, h6 {
  font-family: 'Playfair Display', serif;
}
      `
    }
  ]
})
```

**Step 6: Build Pages**

```typescript
// AI creates Home page:
file.write({
  path: "/home/ubuntu/sally-salon/client/src/pages/Home.tsx",
  text: `
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen">
      <nav>...</nav>
      <section className="hero">...</section>
      <section className="services">...</section>
      <footer>...</footer>
    </div>
  );
}
  `
})

// AI creates Services page:
file.write({
  path: "/home/ubuntu/sally-salon/client/src/pages/Services.tsx",
  text: `...`
})

// AI creates Booking page:
file.write({
  path: "/home/ubuntu/sally-salon/client/src/pages/Booking.tsx",
  text: `...`
})

// AI updates router:
file.edit({
  path: "/home/ubuntu/sally-salon/client/src/App.tsx",
  edits: [
    {
      find: '<Route path={"/"} component={Home} />',
      replace: `
<Route path={"/"} component={Home} />
<Route path={"/services"} component={Services} />
<Route path={"/booking"} component={Booking} />
<Route path={"/contact"} component={Contact} />
<Route path={"/my-appointments"} component={MyAppointments} />
      `
    }
  ]
})
```

**Step 7: Build Backend API**

```typescript
// AI creates database helpers:
file.write({
  path: "/home/ubuntu/sally-salon/server/db.ts",
  text: `
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { services, appointments } from "../drizzle/schema";

const db = drizzle(process.env.DATABASE_URL);

export async function getActiveServices() {
  return await db.select().from(services).where(eq(services.isActive, 1));
}

export async function createAppointment(data) {
  return await db.insert(appointments).values(data);
}

export async function getUserAppointments(userId) {
  return await db.select().from(appointments).where(eq(appointments.userId, userId));
}
  `
})

// AI creates tRPC procedures:
file.edit({
  path: "/home/ubuntu/sally-salon/server/routers.ts",
  edits: [
    {
      find: "// TODO: add feature routers here",
      replace: `
services: router({
  list: publicProcedure.query(async () => {
    return await getActiveServices();
  }),
}),

appointments: router({
  create: protectedProcedure
    .input(z.object({
      serviceId: z.number(),
      appointmentTime: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const service = await getServiceById(input.serviceId);
      const depositAmount = service.price * 0.25; // 25% deposit
      
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(depositAmount * 100),
        currency: "usd",
        metadata: { userId: ctx.user.id, serviceId: input.serviceId },
      });
      
      // Create appointment
      await createAppointment({
        userId: ctx.user.id,
        serviceId: input.serviceId,
        appointmentTime: new Date(input.appointmentTime),
        notes: input.notes,
        stripePaymentIntentId: paymentIntent.id,
        depositAmount,
      });
      
      return { clientSecret: paymentIntent.client_secret };
    }),
  
  myAppointments: protectedProcedure.query(async ({ ctx }) => {
    return await getUserAppointments(ctx.user.id);
  }),
}),
      `
    }
  ]
})
```

**Step 8: Add Stripe Webhook**

```typescript
// AI creates webhook handler:
file.write({
  path: "/home/ubuntu/sally-salon/server/webhooks/stripe.ts",
  text: `
import express from "express";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export function registerStripeWebhook(app: express.Application) {
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send("Webhook signature verification failed");
    }
    
    // Handle test events
    if (event.id.startsWith("evt_test_")) {
      return res.json({ verified: true });
    }
    
    // Handle real events
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object;
      // Update appointment status to confirmed
      await updateAppointmentStatus(paymentIntent.id, "confirmed");
      // Send notification to owner
      await notifyOwner({
        title: "New Appointment Booked",
        content: \`Customer paid deposit for appointment\`,
      });
    }
    
    res.json({ received: true });
  });
}
  `
})

// AI registers webhook in server:
file.edit({
  path: "/home/ubuntu/sally-salon/server/_core/index.ts",
  edits: [
    {
      find: "app.use(express.json());",
      replace: `
registerStripeWebhook(app);  // BEFORE express.json()
app.use(express.json());
      `
    }
  ]
})
```

**Step 9: Add Google Maps**

```typescript
// AI adds map to Contact page:
file.edit({
  path: "/home/ubuntu/sally-salon/client/src/pages/Contact.tsx",
  edits: [
    {
      find: '<div className="bg-muted rounded-2xl h-[400px]"></div>',
      replace: `
<MapView
  center={{ lat: 41.8781, lng: -87.6298 }}
  zoom={15}
  onMapReady={(map, google) => {
    new google.maps.Marker({
      position: { lat: 41.8781, lng: -87.6298 },
      map,
      title: "Sally Salon",
    });
  }}
/>
      `
    }
  ]
})
```

**Step 10: Test & Checkpoint**

```typescript
// AI checks status:
webdev_check_status({
  brief: "Verify project health before checkpoint"
})

// Response:
{
  devServer: { status: "running", port: 3000, url: "https://..." },
  healthChecks: {
    buildErrors: false,
    dependencies: "OK",
    lsp: "no errors",
    typescript: "no errors"
  }
}

// AI creates checkpoint:
webdev_save_checkpoint({
  brief: "Save initial salon website version",
  description: "Complete salon website with booking system, Stripe payments, and Google Maps integration"
})

// Response:
{
  versionId: "a3f9b2e4",
  commitHash: "a3f9b2e4c1d8f7e6...",
  screenshotUrl: "https://...",
  timestamp: 1707580800000
}

// State changes:
// - Git commit created
// - Screenshot captured
// - "Publish" button enabled in UI
// - User can now deploy to production
```

**Step 11: User Publishes**

```
User clicks "Publish" button in Management UI

Manus Biz Server:
1. Fetches checkpoint a3f9b2e4 from Git
2. Deploys to production environment
3. Runs `pnpm install && pnpm build && pnpm start`
4. Routes domain: sally-salon.manus.space
5. Issues SSL certificate
6. Monitors health

Result:
- Live website at https://sally-salon.manus.space
- Database connected (production TiDB)
- Stripe live mode (after KYC)
- Analytics tracking enabled
```

---

## Summary

**Key Takeaways:**

1. **No Manual IDE:** AI agent edits files via function calling, not Monaco/VSCode
2. **E2B Sandbox:** Provides compute environment, file system, dev server
3. **Template System:** Pre-built scaffolds (web-static, web-db-user) with full-stack features
4. **State Management:** Project metadata in Manus Biz, code in Git, files in E2B
5. **Checkpoint-Based:** Version control via Git, deploy from checkpoints
6. **Integrated Services:** Database, OAuth, Stripe, S3, Maps all pre-configured
7. **Management UI:** Preview, Code, Dashboard, Database, Settings tabs
8. **Deployment:** One-click publish to production hosting with custom domains

**Architecture Philosophy:**
- AI agent as the developer
- Function calling as the development interface
- Templates as the foundation
- Checkpoints as the deployment unit
- Management UI as the control panel

This system eliminates manual coding, dependency management, deployment configuration, and infrastructure setup. The AI agent handles everything through structured tool calls, while the user focuses on requirements and design decisions.
