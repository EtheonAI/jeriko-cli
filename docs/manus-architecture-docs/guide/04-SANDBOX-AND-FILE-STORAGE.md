# Part 4: Sandbox Integration, Tool Execution Engine, and File Storage

> **This is the execution layer.** The sandbox is where all real work happens — shell commands, file operations, browser automation, code execution. This document covers how to manage E2B sandboxes, route tool calls, and handle file storage with S3.

---

## 1. E2B Sandbox Manager

### 1.1 Sandbox Lifecycle

Based on our investigation, Manus manages sandboxes with these rules:
- **One sandbox per user**, shared across all sessions
- Sandboxes are kept warm (not destroyed after each task)
- Sandbox timeout is configurable (default ~1 hour of inactivity)
- The `map` tool is the only exception — it spawns N temporary sandboxes

```typescript
// src/server/sandbox/manager.ts

import { Sandbox } from 'e2b';

interface SandboxEntry {
  sandbox: Sandbox;
  userId: string;
  createdAt: Date;
  lastUsedAt: Date;
  status: 'ready' | 'busy' | 'warming';
}

export class SandboxManager {
  private userSandboxes: Map<string, SandboxEntry> = new Map();
  private pool: Sandbox[] = []; // Pre-warmed sandboxes for map tool
  private apiKey: string;
  private templateId: string;

  constructor(apiKey: string, templateId?: string) {
    this.apiKey = apiKey;
    this.templateId = templateId || 'base'; // Use custom template if provided

    // Start cleanup interval
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  // ============================================================
  // ACQUIRE SANDBOX FOR USER
  // ============================================================
  // This is the primary method — one sandbox per user
  async acquireForUser(userId: string): Promise<Sandbox> {
    const existing = this.userSandboxes.get(userId);

    if (existing && existing.status !== 'warming') {
      // Reuse existing sandbox
      existing.lastUsedAt = new Date();
      existing.status = 'busy';
      return existing.sandbox;
    }

    // Create new sandbox for this user
    const sandbox = await this.createSandbox(userId);
    return sandbox;
  }

  // ============================================================
  // CREATE SANDBOX
  // ============================================================
  private async createSandbox(userId: string): Promise<Sandbox> {
    const sandbox = await Sandbox.create(this.templateId, {
      apiKey: this.apiKey,
      timeoutMs: 3600000, // 1 hour
      metadata: { userId },
    });

    // ============================================================
    // BOOTSTRAP: Replicate what Manus does at sandbox startup
    // ============================================================
    // Manus's start_server binary does this automatically.
    // With E2B, we do it manually.

    // 1. Set environment variables
    await this.injectEnvironmentVariables(sandbox, userId);

    // 2. Create working directory structure
    await sandbox.commands.run('mkdir -p /home/user/Downloads /home/user/skills /tmp');

    // 3. Install any additional packages needed
    // (The custom template should have most things pre-installed)

    // 4. Start Chromium for browser tool (if using Playwright)
    // Playwright in E2B connects to Chromium via CDP
    await sandbox.commands.run(
      'nohup chromium --no-sandbox --disable-gpu --remote-debugging-port=9222 --headless &',
      { timeout: 10000 }
    );

    const entry: SandboxEntry = {
      sandbox,
      userId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      status: 'ready',
    };

    this.userSandboxes.set(userId, entry);
    return sandbox;
  }

  // ============================================================
  // INJECT ENVIRONMENT VARIABLES
  // ============================================================
  // Manus injects these via .env, .user_env, and .secrets files
  // We replicate this by writing to the sandbox
  private async injectEnvironmentVariables(sandbox: Sandbox, userId: string): Promise<void> {
    // Core variables that every sandbox needs
    const envVars: Record<string, string> = {
      HOME: '/home/user',
      USER: 'user',
      LANG: 'en_US.UTF-8',
      PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      NODE_ENV: 'development',
    };

    // User-specific secrets (fetched from database)
    // These are the secrets the user configured in their settings
    // e.g., their own API keys for services
    const userSecrets = await this.getUserSecrets(userId);
    for (const secret of userSecrets) {
      envVars[secret.key] = secret.value;
    }

    // Write as .env file
    const envContent = Object.entries(envVars)
      .map(([k, v]) => `export ${k}="${v}"`)
      .join('\n');

    await sandbox.files.write('/home/user/.env', envContent);
    await sandbox.commands.run('echo "source /home/user/.env" >> /home/user/.bashrc');
  }

  // ============================================================
  // ACQUIRE FROM POOL (for map tool subtasks)
  // ============================================================
  async acquireFromPool(): Promise<Sandbox> {
    // Try to get a pre-warmed sandbox
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }

    // Create a new one on demand
    return Sandbox.create(this.templateId, {
      apiKey: this.apiKey,
      timeoutMs: 600000, // 10 minutes for subtasks
    });
  }

  async releaseToPool(sandbox: Sandbox): Promise<void> {
    // For map subtasks, just destroy them
    // Pool management is for warm starts only
    try {
      await sandbox.kill();
    } catch (e) {
      // Sandbox may already be dead
    }
  }

  // ============================================================
  // PRE-WARM SANDBOX
  // ============================================================
  async warmForUser(userId: string): Promise<void> {
    if (this.userSandboxes.has(userId)) return;

    const entry: SandboxEntry = {
      sandbox: null as any, // Will be set
      userId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      status: 'warming',
    };
    this.userSandboxes.set(userId, entry);

    try {
      const sandbox = await this.createSandbox(userId);
      entry.sandbox = sandbox;
      entry.status = 'ready';
    } catch (error) {
      this.userSandboxes.delete(userId);
      throw error;
    }
  }

  // ============================================================
  // CLEANUP IDLE SANDBOXES
  // ============================================================
  private async cleanup(): Promise<void> {
    const now = Date.now();
    const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

    for (const [userId, entry] of this.userSandboxes) {
      if (now - entry.lastUsedAt.getTime() > IDLE_TIMEOUT && entry.status === 'ready') {
        try {
          await entry.sandbox.kill();
        } catch (e) {
          // Ignore
        }
        this.userSandboxes.delete(userId);
      }
    }
  }

  private async getUserSecrets(userId: string): Promise<Array<{key: string, value: string}>> {
    // Fetch from database
    return []; // Implement based on your DB schema
  }
}
```

### 1.2 Custom E2B Sandbox Template

Manus uses a heavily customized sandbox. You should create a custom E2B template:

```dockerfile
# sandbox/Dockerfile
# Custom E2B sandbox template

FROM e2b/base:latest

# System packages (matching what Manus pre-installs)
RUN apt-get update && apt-get install -y \
    bc curl git gzip less net-tools psmisc socat tar unzip wget zip \
    build-essential libssl-dev libffi-dev \
    poppler-utils \
    xvfb \
    && rm -rf /var/lib/apt/lists/*

# Python 3.11
RUN apt-get update && apt-get install -y python3.11 python3-pip && \
    pip3 install \
    beautifulsoup4 fastapi flask fpdf2 markdown matplotlib numpy \
    openpyxl pandas pdf2image pillow plotly reportlab requests \
    seaborn tabulate uvicorn weasyprint xhtml2pdf

# Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm yarn

# Playwright + Chromium
RUN npx playwright install chromium --with-deps

# Create user directory structure
RUN mkdir -p /home/user/Downloads /home/user/skills /home/user/upload

WORKDIR /home/user
```

Build and register the template:
```bash
# Install E2B CLI
npm install -g @e2b/cli

# Login
e2b auth login

# Build template
e2b template build --name "agent-sandbox" --dockerfile sandbox/Dockerfile

# The template ID will be printed — use it in your .env
```

---

## 2. Tool Execution Router

The orchestrator needs to know which tools run in the sandbox and which run locally.

```typescript
// src/server/orchestrator/tool-router.ts

// This classification determines WHERE each tool executes
export const TOOL_EXECUTION_LOCATION = {
  // ===== SANDBOX TOOLS (execute via E2B SDK) =====
  shell:   'sandbox',   // Commands run in Firecracker VM
  file:    'sandbox',   // File I/O on sandbox filesystem
  match:   'sandbox',   // File search on sandbox filesystem
  browser: 'sandbox',   // Playwright controls Chromium in sandbox
  expose:  'sandbox',   // Port forwarding from sandbox

  // ===== ORCHESTRATOR TOOLS (execute locally) =====
  plan:     'orchestrator',  // State management, no sandbox needed
  message:  'orchestrator',  // Communication, no sandbox needed
  search:   'orchestrator',  // External API call (Tavily/Serper)
  generate: 'orchestrator',  // External API call (DALL-E/Flux)
  schedule: 'orchestrator',  // Job scheduling (BullMQ)
  map:      'orchestrator',  // Spawns N sandboxes (special case)
} as const;

// The AI SDK handles routing automatically through the execute() function
// in each tool definition. But this map is useful for:
// 1. Logging/tracing which tools need sandbox access
// 2. Deciding whether to keep the sandbox alive
// 3. Estimating execution time for progress indicators
```

---

## 3. File Storage — The Complete Flow

### 3.1 How Files Move Through the System

```
USER UPLOADS FILE
  → Frontend: FormData POST to /api/files/upload
  → Server: Multer receives file → writes to S3
  → Server: Returns CDN URL
  → Server: Optionally copies file into sandbox via E2B SDK
  → Frontend: Displays file in chat

AGENT CREATES FILE IN SANDBOX
  → Agent calls file.write() → E2B SDK writes to sandbox filesystem
  → File exists only in sandbox at /home/user/...
  → When agent calls message() with attachments:
    → Orchestrator reads file from sandbox via E2B SDK
    → Uploads to S3
    → Returns CDN URL to frontend

AGENT READS FILE FROM SANDBOX
  → Agent calls file.read() → E2B SDK reads from sandbox filesystem
  → Content returned as text in tool result
  → No S3 involved (stays in context)

USER DOWNLOADS FILE
  → Frontend: Clicks download on CDN URL
  → CloudFront serves from S3
  → No sandbox involved
```

### 3.2 S3 Storage Client

```typescript
// src/server/storage/index.ts

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { nanoid } from 'nanoid';
import { Sandbox } from 'e2b';
import path from 'path';

export class StorageClient {
  private s3: S3Client;
  private bucket: string;
  private cdnBaseUrl: string;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.bucket = process.env.AWS_S3_BUCKET!;
    this.cdnBaseUrl = process.env.CDN_BASE_URL!;
  }

  // ============================================================
  // UPLOAD FROM SANDBOX
  // ============================================================
  // This is what happens when the agent attaches files to messages
  async uploadFromSandbox(
    sandbox: Sandbox,
    sandboxPath: string,
    userId: string
  ): Promise<string> {
    // Read file bytes from sandbox via E2B SDK
    const fileBytes = await sandbox.files.readBytes(sandboxPath);
    const buffer = Buffer.from(fileBytes);

    // Generate S3 key matching Manus's CDN pattern
    const ext = path.extname(sandboxPath).slice(1) || 'bin';
    const randomId = nanoid(24);
    const s3Key = `user_upload_by_module/session_file/${userId}/${randomId}.${ext}`;

    // Upload to S3
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: this.getMimeType(ext),
      CacheControl: 'public, max-age=31536000', // 1 year cache
    }));

    // Return CDN URL
    return `${this.cdnBaseUrl}/${s3Key}`;
  }

  // ============================================================
  // UPLOAD FROM URL (for image generation results)
  // ============================================================
  async uploadFromUrl(sourceUrl: string, userId: string): Promise<string> {
    const response = await fetch(sourceUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/png';
    const ext = contentType.split('/')[1] || 'png';

    const randomId = nanoid(24);
    const s3Key = `user_upload_by_module/session_file/${userId}/${randomId}.${ext}`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    }));

    return `${this.cdnBaseUrl}/${s3Key}`;
  }

  // ============================================================
  // UPLOAD FROM BUFFER (for user file uploads via HTTP)
  // ============================================================
  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    userId: string,
    contentType: string
  ): Promise<string> {
    const ext = path.extname(filename).slice(1) || 'bin';
    const randomId = nanoid(24);
    const s3Key = `user_upload_by_module/session_file/${userId}/${randomId}.${ext}`;

    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      },
    });

    await upload.done();
    return `${this.cdnBaseUrl}/${s3Key}`;
  }

  // ============================================================
  // COPY FILE INTO SANDBOX (for user uploads that agent needs)
  // ============================================================
  async copyToSandbox(
    sandbox: Sandbox,
    cdnUrl: string,
    sandboxPath: string
  ): Promise<void> {
    // Download from CDN
    const response = await fetch(cdnUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Write to sandbox
    await sandbox.files.write(sandboxPath, buffer);
  }

  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'svg': 'image/svg+xml',
      'pdf': 'application/pdf',
      'json': 'application/json',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript',
      'py': 'text/x-python',
      'zip': 'application/zip',
      'mp3': 'audio/mpeg',
      'mp4': 'video/mp4',
      'wav': 'audio/wav',
    };
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
}

export function createStorageClient(): StorageClient {
  return new StorageClient();
}
```

### 3.3 File Upload HTTP Route

```typescript
// src/server/routes/files.ts

import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../auth/middleware';
import type { StorageClient } from '../storage';
import type { DatabaseClient } from '../db/queries';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
});

export function createFileRoutes(storage: StorageClient, db: DatabaseClient): Router {
  const router = Router();

  // ============================================================
  // POST /api/files/upload — User uploads a file
  // ============================================================
  router.post('/api/files/upload', authMiddleware, upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const cdnUrl = await storage.uploadBuffer(
      req.file.buffer,
      req.file.originalname,
      req.user.id,
      req.file.mimetype
    );

    // Persist file record
    await db.insertFile({
      userId: req.user.id,
      sessionId: req.body.sessionId,
      originalName: req.file.originalname,
      cdnUrl,
      size: req.file.size,
      mimeType: req.file.mimetype,
    });

    res.json({
      url: cdnUrl,
      originalName: req.file.originalname,
      size: req.file.size,
    });
  });

  // ============================================================
  // GET /api/files/:sessionId — List files for a session
  // ============================================================
  router.get('/api/files/:sessionId', authMiddleware, async (req, res) => {
    const files = await db.getSessionFiles(req.params.sessionId);
    res.json(files);
  });

  return router;
}
```

---

## 4. Browser Automation — The Complete Flow

Manus uses Playwright inside the sandbox to control Chromium. Here's the complete implementation:

```typescript
// src/server/tools/browser-impl.ts

// The browser tool works by executing Playwright scripts inside the sandbox.
// Chromium is started at sandbox boot with --remote-debugging-port=9222.
// Playwright connects via CDP (Chrome DevTools Protocol).

export async function executeBrowserNavigation(
  sandbox: Sandbox,
  url: string,
  intent: string,
  focus?: string,
): Promise<BrowserResult> {
  
  // Write a Playwright script to the sandbox
  const script = `
    import { chromium } from 'playwright';

    async function browse() {
      // Connect to existing Chromium instance via CDP
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      const context = browser.contexts()[0] || await browser.newContext();
      const page = context.pages()[0] || await context.newPage();

      // Navigate
      await page.goto(${JSON.stringify(url)}, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait for content to load
      await page.waitForTimeout(2000);

      // Get page info
      const title = await page.title();
      const currentUrl = page.url();

      // Extract content based on intent
      let content = '';
      if (${JSON.stringify(intent)} === 'informational') {
        content = await page.evaluate(() => {
          // Try to find main content
          const selectors = ['article', 'main', '[role="main"]', '.content', '#content'];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.innerText.length > 100) return el.innerText;
          }
          return document.body.innerText;
        });
      } else {
        content = await page.evaluate(() => document.body.innerText);
      }

      // Take screenshot
      await page.screenshot({ path: '/tmp/browser_screenshot.png', fullPage: false });

      // Get page metadata
      const metadata = await page.evaluate(() => ({
        description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        links: Array.from(document.querySelectorAll('a[href]')).slice(0, 20).map(a => ({
          text: a.textContent?.trim().substring(0, 100),
          href: a.getAttribute('href'),
        })),
      }));

      return JSON.stringify({
        title,
        url: currentUrl,
        content: content.substring(0, 50000),
        metadata,
      });
    }

    browse().then(r => process.stdout.write(r)).catch(e => {
      process.stderr.write(e.message);
      process.exit(1);
    });
  `;

  await sandbox.files.write('/tmp/browse_task.mjs', script);
  const result = await sandbox.commands.run('node /tmp/browse_task.mjs', {
    timeout: 45000,
  });

  if (result.exitCode !== 0) {
    return { error: result.stderr, title: '', url, content: '' };
  }

  return JSON.parse(result.stdout);
}
```

---

## 5. Voice/Speech Transcription

Manus uses Whisper for speech-to-text. Here's how to implement it:

```typescript
// src/server/tools/voice.ts

// Voice input flow:
// 1. Frontend captures audio via MediaRecorder API
// 2. Frontend uploads audio file to /api/files/upload
// 3. Audio file is copied into sandbox
// 4. Whisper transcribes it
// 5. Transcription becomes the user message

export async function transcribeAudio(
  sandbox: Sandbox,
  audioPath: string,
): Promise<string> {
  // Option 1: Use OpenAI Whisper API (recommended)
  // Read audio from sandbox, send to Whisper API
  const audioBytes = await sandbox.files.readBytes(audioPath);
  const formData = new FormData();
  formData.append('file', new Blob([audioBytes]), 'audio.webm');
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` },
    body: formData,
  });

  const result = await response.json();
  return result.text;
}
```

---

## 6. Composio Integration (Replacing Manus's MCP Connectors)

Manus uses its own MCP connector system. You use Composio for the same functionality:

```typescript
// src/server/connectors/composio.ts

import { Composio } from 'composio-core';

export class ConnectorManager {
  private composio: Composio;

  constructor() {
    this.composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! });
  }

  // ============================================================
  // GET AVAILABLE TOOLS FOR A USER
  // ============================================================
  async getToolsForUser(userId: string): Promise<any[]> {
    // Get user's connected integrations
    const entity = await this.composio.getEntity(userId);
    const connections = await entity.getConnections();

    // Get tools for each connected service
    const tools = [];
    for (const conn of connections) {
      const serviceTools = await this.composio.getTools({
        apps: [conn.appName],
      });
      tools.push(...serviceTools);
    }

    return tools;
  }

  // ============================================================
  // EXECUTE COMPOSIO TOOL
  // ============================================================
  async executeTool(
    userId: string,
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    const entity = await this.composio.getEntity(userId);
    const result = await entity.execute(toolName, params);
    return result;
  }

  // ============================================================
  // CONVERT TO AI SDK TOOLS
  // ============================================================
  // This converts Composio tools to AI SDK format so Claude can call them
  async getAISDKTools(userId: string): Promise<Record<string, any>> {
    const composioTools = await this.getToolsForUser(userId);
    const aiTools: Record<string, any> = {};

    for (const ct of composioTools) {
      aiTools[ct.name] = tool({
        description: ct.description,
        parameters: z.object(ct.parameters), // Composio provides Zod-compatible schemas
        execute: async (params) => {
          return this.executeTool(userId, ct.name, params);
        },
      });
    }

    return aiTools;
  }
}
```

Then in the agent loop, merge Composio tools with your built-in tools:

```typescript
// In agent-loop.ts, modify the tools section:
const builtInTools = createToolSet(toolContext);
const composioTools = await connectorManager.getAISDKTools(user.id);

const allTools = { ...builtInTools, ...composioTools };

const result = streamText({
  model: anthropic('claude-sonnet-4-20250514'),
  system: systemPrompt,
  messages: [...history, { role: 'user', content: userMessage }],
  tools: allTools,  // Both built-in and Composio tools
  maxSteps: 30,
  // ...
});
```

---

## 7. Sandbox Process Summary

Here's exactly what runs inside the sandbox, mapped from our Manus investigation:

| Process | Manus PID | Purpose | Your Implementation |
|---------|-----------|---------|-------------------|
| `init` | 1 | Root process | E2B handles this |
| `start_server` | 794 | TCP command server | E2B SDK replaces this |
| `chromium` | 901 | Browser for Playwright | Start at sandbox boot |
| `Xvfb` | ~850 | Virtual display for Chromium | E2B template includes this |
| `neko-server` | ~860 | WebRTC streaming of display | Optional — use noVNC or skip |
| `code-server` | ~870 | VS Code in browser | Optional — for code editing UI |
| `statesync` | ~880 | File sync to orchestrator | E2B SDK handles file access |

For your implementation, you only **need**:
1. E2B sandbox (replaces init + start_server)
2. Chromium with `--remote-debugging-port=9222` (for browser tool)
3. Everything else is optional enhancement
