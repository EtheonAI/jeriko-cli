# Part 2: System Prompt Engineering and Complete Tool Definitions

> **This is the most important file in the entire guide.** The system prompt is what makes an AI agent intelligent. Without it, you have a chatbot. With it, you have Manus.

---

## 1. System Prompt Architecture

Manus's system prompt is approximately 15,000 tokens of structured XML. Every section controls a specific behavior. You must replicate all of them.

### 1.1 The Complete System Prompt Template

```typescript
// src/server/orchestrator/context-builder.ts

import { Session, User } from '../../shared/types';

export function buildSystemPrompt(session: Session, user: User): string {
  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  return `You are Agent, an autonomous AI agent created by YourCompany.

You are proficient in a wide range of tasks, including but not limited to:
1. Gather information, check facts, and produce comprehensive documents or presentations
2. Process data, perform analysis, and create insightful visualizations
3. Write multi-chapter articles and in-depth research reports
4. Build well-crafted websites, interactive applications, and software solutions
5. Generate and edit images, videos, audio, and speech
6. Apply programming to solve real-world problems
7. Collaborate with users to automate workflows
8. Execute scheduled tasks triggered at specific times or intervals
9. Perform any task achievable through a computer connected to the internet

You operate in a sandboxed virtual machine environment with internet access.

The current date is ${currentDate}.
The default working language is **English**.

<language>
- Use the language of the user's first message as the working language
- All thinking and responses MUST be conducted in the working language
- Natural language arguments in function calling MUST use the working language
- DO NOT switch the working language midway unless explicitly requested
</language>

<format>
- Use GitHub-flavored Markdown as the default format
- Write in a professional style using complete paragraphs
- Use **bold** for emphasis on key concepts
- Use blockquotes for definitions and citations
- Use inline hyperlinks when mentioning resources
</format>

<agent_loop>
You are operating in an *agent loop*, iteratively completing tasks through these steps:
1. Analyze context: Understand the user's intent and current state
2. Think: Reason about whether to update the plan, advance the phase, or take action
3. Select tool: Choose the next tool based on the plan and state
4. Execute action: The tool will be executed in the sandbox
5. Receive observation: The result will be appended to context
6. Iterate loop: Repeat until the task is fully completed
7. Deliver outcome: Send results to the user via the message tool
</agent_loop>

<tool_use>
- MUST respond with function calling (tool use); direct text responses are forbidden
- MUST respond with exactly one tool call per response
- Follow instructions in tool descriptions for proper usage
- NEVER mention specific tool names in user-facing messages
</tool_use>

<error_handling>
- On error, diagnose the issue and attempt a fix
- If unresolved, try alternative methods or tools
- After failing three times, explain the failure to the user and request guidance
</error_handling>

<sandbox>
System environment:
- OS: Ubuntu 22.04 (with internet access)
- User: user (with sudo privileges)
- Home directory: /home/user
- Pre-installed: Python 3.11, Node.js 22, git, curl, wget, etc.

Python: pip install available
Node.js: npm/pnpm available
Browser: Chromium with Playwright
</sandbox>

${buildSecretsSection(session)}
${buildSkillsSection(session)}
${buildKnowledgeSection(user)}
${buildConnectorsSection(user)}
`;
}

function buildSecretsSection(session: Session): string {
  if (!session.secrets || session.secrets.length === 0) return '';
  
  const secretsList = session.secrets.map(s => 
    `- Service: ${s.name}\n  Variables: ${s.variables.map(v => '`' + v + '`').join(', ')}\n  Description: ${s.description}`
  ).join('\n\n');

  return `<secrets>
The following secrets have been set in environment variables:

${secretsList}
</secrets>`;
}

function buildSkillsSection(session: Session): string {
  if (!session.skills || session.skills.length === 0) return '';
  
  const skillsList = session.skills.map(s =>
    `- ${s.name}: ${s.description}`
  ).join('\n');

  return `<skills>
Skills are modular capabilities that extend your functionality.
To use a skill, read /home/user/skills/{name}/SKILL.md and follow its instructions.

Available skills:
${skillsList}
</skills>`;
}

function buildKnowledgeSection(user: User): string {
  if (!user.knowledge || user.knowledge.length === 0) return '';
  
  const knowledgeItems = user.knowledge.map(k =>
    `<knowledge>
name: ${k.name}
use_when: ${k.useWhen}
content: ${k.content}
</knowledge>`
  ).join('\n');

  return `<related_knowledge>
${knowledgeItems}
</related_knowledge>`;
}

function buildConnectorsSection(user: User): string {
  if (!user.connectors || user.connectors.length === 0) return '';
  
  return `<connectors>
The following external service connectors are available:
${user.connectors.map(c => `- ${c.name} (${c.type}): ${c.status}`).join('\n')}

Use the Composio tool to interact with these services.
</connectors>`;
}
```

### 1.2 Why Each Section Matters

| Section | Purpose | What Happens Without It |
|---------|---------|------------------------|
| `<language>` | Forces agent to match user's language | Agent responds in English regardless |
| `<format>` | Controls output quality | Agent produces sloppy, inconsistent formatting |
| `<agent_loop>` | Defines the reasoning cycle | Agent tries to answer in one shot, no planning |
| `<tool_use>` | Enforces function calling | Agent writes text responses instead of using tools |
| `<error_handling>` | Prevents infinite failure loops | Agent crashes on first error |
| `<sandbox>` | Tells agent what's available | Agent tries to use tools that don't exist |
| `<secrets>` | Exposes API keys safely | Agent can't access user's services |
| `<skills>` | Modular capability loading | Agent can't learn new workflows |
| `<related_knowledge>` | Persistent cross-session facts | Agent forgets user preferences |
| `<connectors>` | External service access | Agent can't use Gmail, Slack, etc. |

---

## 2. Complete Tool Definitions (AI SDK Format)

Every tool must be defined with a Zod schema for the AI SDK. The `execute` function is where the tool actually runs.

### 2.1 Tool Registry

```typescript
// src/server/tools/definitions.ts

import { tool } from 'ai';
import { z } from 'zod';
import { executePlan } from './plan';
import { executeMessage } from './message';
import { executeShell } from './shell';
import { executeFile } from './file';
import { executeMatch } from './match';
import { executeSearch } from './search';
import { executeBrowser } from './browser';
import { executeGenerate } from './generate';
import { executeSchedule } from './schedule';
import { executeMap } from './map';
import { executeExpose } from './expose';
import type { ToolContext } from '../../shared/types';

export function createToolSet(ctx: ToolContext) {
  return {
    plan: createPlanTool(ctx),
    message: createMessageTool(ctx),
    shell: createShellTool(ctx),
    file: createFileTool(ctx),
    match: createMatchTool(ctx),
    search: createSearchTool(ctx),
    browser: createBrowserTool(ctx),
    generate: createGenerateTool(ctx),
    schedule: createScheduleTool(ctx),
    map: createMapTool(ctx),
    expose: createExposeTool(ctx),
  };
}
```

### 2.2 The `plan` Tool — Task Planning

This is what makes the agent plan before acting. Without this tool, the agent just starts doing things randomly.

```typescript
// src/server/tools/plan.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createPlanTool(ctx: ToolContext) {
  return tool({
    description: `Create, update, and advance the structured task plan.

Supported actions:
- "update": Create or revise the current task plan
- "advance": Move to the next phase

Instructions:
- Create a task plan before execution using "update"
- A plan includes one goal and multiple phases
- Phase count scales with complexity: simple (2), typical (4-6), complex (10+)
- Each phase may require multiple iterations of thinking and tool use
- When confident a phase is complete, advance using "advance"
- Phases MUST be completed in order
- Actively update when significant new information emerges`,

    parameters: z.object({
      action: z.enum(['update', 'advance']).describe('The action to perform'),
      goal: z.string().optional().describe('Overall goal of the task. Required for update.'),
      phases: z.array(z.object({
        id: z.number().describe('Auto-incrementing phase ID starting from 1'),
        title: z.string().describe('Concise title of the phase'),
      })).optional().describe('Complete list of phases. Required for update.'),
      current_phase_id: z.number().describe('ID of the current phase'),
      next_phase_id: z.number().optional().describe('ID of the next phase. Required for advance.'),
    }),

    execute: async (params) => {
      return executePlan(ctx, params);
    }
  });
}

// Implementation
export async function executePlan(ctx: ToolContext, params: any) {
  const { action, goal, phases, current_phase_id, next_phase_id } = params;

  if (action === 'update') {
    // Persist plan to database
    const plan = await ctx.db.upsertPlan({
      sessionId: ctx.sessionId,
      goal: goal!,
      phases: phases!,
      currentPhaseId: current_phase_id,
    });

    // Broadcast to frontend via WebSocket
    ctx.ws.emit(ctx.sessionId, {
      type: 'plan_update',
      plan: { goal, phases, currentPhaseId: current_phase_id }
    });

    return {
      success: true,
      message: `Plan ${plan.id ? 'updated' : 'created'} with ${phases!.length} phases.`
    };
  }

  if (action === 'advance') {
    await ctx.db.updatePlanPhase(ctx.sessionId, next_phase_id!);

    ctx.ws.emit(ctx.sessionId, {
      type: 'plan_advance',
      currentPhaseId: next_phase_id
    });

    return {
      success: true,
      message: `Advanced to phase ${next_phase_id}.`
    };
  }
}
```

### 2.3 The `message` Tool — Communication Control

This is how the agent talks to the user. It's NOT just `console.log`. It controls the conversation flow.

```typescript
// src/server/tools/message.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createMessageTool(ctx: ToolContext) {
  return tool({
    description: `Send messages to interact with the user.

Supported types:
- "info": Progress update, no response needed from user
- "ask": Ask user a question, blocks until response
- "result": Deliver final results and end the task

Instructions:
- MUST use this tool for any communication with users
- For new tasks, first reply MUST be a brief acknowledgment
- Use "info" for progress updates
- Use "ask" only when necessary to avoid blocking
- Use "result" to present final results at end of task
- MUST attach all relevant files in attachments`,

    parameters: z.object({
      type: z.enum(['info', 'ask', 'result']).describe('Message type'),
      text: z.string().describe('Message text to show the user'),
      attachments: z.array(z.string()).optional()
        .describe('List of absolute file paths to attach'),
    }),

    execute: async (params) => {
      const { type, text, attachments } = params;

      // Upload attachments to S3 if they exist
      const uploadedAttachments = [];
      if (attachments) {
        for (const filePath of attachments) {
          const cdnUrl = await ctx.storage.uploadFromSandbox(
            ctx.sandbox, filePath, ctx.userId
          );
          uploadedAttachments.push({ path: filePath, url: cdnUrl });
        }
      }

      // Persist message
      await ctx.db.insertMessage({
        sessionId: ctx.sessionId,
        role: 'assistant',
        content: text,
        contentType: type,
        metadata: { attachments: uploadedAttachments }
      });

      // Broadcast to frontend
      ctx.ws.emit(ctx.sessionId, {
        type: 'message',
        role: 'assistant',
        content: text,
        messageType: type,
        attachments: uploadedAttachments,
        timestamp: Date.now()
      });

      // If type is "ask", we need to pause the agent loop
      // This is handled by the orchestrator checking the message type
      if (type === 'ask') {
        return { 
          status: 'waiting_for_user',
          message: 'Message sent. Waiting for user response.'
        };
      }

      if (type === 'result') {
        return {
          status: 'task_complete',
          message: 'Final results delivered to user.'
        };
      }

      return { status: 'sent', message: 'Info message sent to user.' };
    }
  });
}
```

### 2.4 The `shell` Tool — Command Execution

```typescript
// src/server/tools/shell.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createShellTool(ctx: ToolContext) {
  return tool({
    description: `Execute commands in the sandbox shell.

Supported actions:
- "exec": Execute a command
- "view": View shell session history
- "send": Send input to interactive process (stdin)
- "kill": Terminate running process

Instructions:
- Use file tool instead of shell for file content operations
- Avoid commands that require confirmation; use -y or -f flags
- Avoid commands with excessive output; redirect to files
- Chain commands with && to reduce interruptions
- NEVER run code directly; save to file first then execute
- Set short timeout for commands that don't return (like servers)`,

    parameters: z.object({
      action: z.enum(['exec', 'view', 'send', 'kill']).describe('Action to perform'),
      session: z.string().describe('Unique shell session identifier'),
      command: z.string().optional().describe('Shell command. Required for exec.'),
      input: z.string().optional().describe('Input for interactive process. Required for send.'),
      timeout: z.number().optional().default(30).describe('Timeout in seconds'),
    }),

    execute: async (params) => {
      const { action, session: sessionName, command, input, timeout } = params;

      // Broadcast tool start
      ctx.ws.emit(ctx.sessionId, {
        type: 'tool_call',
        toolName: 'shell',
        status: 'running',
        params: { action, command: command?.substring(0, 200) }
      });

      try {
        if (action === 'exec') {
          const result = await ctx.sandbox.commands.run(command!, {
            timeout: timeout! * 1000,
            cwd: '/home/user',
          });

          return {
            stdout: result.stdout.substring(0, 50000),  // Truncate large outputs
            stderr: result.stderr.substring(0, 10000),
            exitCode: result.exitCode,
          };
        }

        if (action === 'send') {
          // For interactive processes, use the process API
          const proc = ctx.sandboxProcesses.get(sessionName);
          if (!proc) return { error: 'No active process in this session' };
          proc.sendStdin(input!);
          return { status: 'input_sent' };
        }

        if (action === 'kill') {
          const proc = ctx.sandboxProcesses.get(sessionName);
          if (proc) proc.kill();
          return { status: 'process_killed' };
        }

        if (action === 'view') {
          return { status: 'session_history', output: 'Session history not available in this implementation' };
        }
      } catch (error: any) {
        return { error: error.message, exitCode: -1 };
      }
    }
  });
}
```

### 2.5 The `file` Tool — File Operations

```typescript
// src/server/tools/file.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createFileTool(ctx: ToolContext) {
  return tool({
    description: `Perform operations on files in the sandbox.

Supported actions:
- "read": Read file content as text
- "write": Overwrite full content of a text file
- "edit": Make targeted edits (find and replace)
- "append": Append content to a file
- "view": View file through multimodal understanding (images, PDFs)

Instructions:
- Prioritize this tool over shell for file operations
- "write" and "append" auto-create files if they don't exist
- DO NOT read files that were just written
- Code MUST be saved to file before execution
- "edit" can make multiple edits at once`,

    parameters: z.object({
      action: z.enum(['read', 'write', 'edit', 'append', 'view']).describe('Action'),
      path: z.string().describe('Absolute path to target file'),
      text: z.string().optional().describe('Content for write/append'),
      range: z.array(z.number()).optional().describe('Line range [start, end] for read'),
      edits: z.array(z.object({
        find: z.string().describe('Text to find'),
        replace: z.string().describe('Replacement text'),
        all: z.boolean().optional().default(false).describe('Replace all occurrences'),
      })).optional().describe('List of edits for edit action'),
    }),

    execute: async (params) => {
      const { action, path, text, range, edits } = params;

      try {
        if (action === 'write') {
          await ctx.sandbox.files.write(path, text!);
          return { status: 'success', path, bytesWritten: text!.length };
        }

        if (action === 'read') {
          const content = await ctx.sandbox.files.read(path);
          if (range) {
            const lines = content.split('\n');
            const [start, end] = range;
            const sliced = lines.slice(start - 1, end === -1 ? undefined : end);
            return { content: sliced.map((l, i) => `${start + i}: ${l}`).join('\n') };
          }
          // Add line numbers
          const numbered = content.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
          return { content: numbered.substring(0, 100000) };  // Truncate
        }

        if (action === 'edit') {
          let content = await ctx.sandbox.files.read(path);
          for (const edit of edits!) {
            if (edit.all) {
              content = content.replaceAll(edit.find, edit.replace);
            } else {
              content = content.replace(edit.find, edit.replace);
            }
          }
          await ctx.sandbox.files.write(path, content);
          return { status: 'success', editsApplied: edits!.length };
        }

        if (action === 'append') {
          const existing = await ctx.sandbox.files.read(path).catch(() => '');
          await ctx.sandbox.files.write(path, existing + text!);
          return { status: 'success', path };
        }

        if (action === 'view') {
          // For images/PDFs, read as base64 and send to multimodal LLM
          const bytes = await ctx.sandbox.files.readBytes(path);
          const base64 = Buffer.from(bytes).toString('base64');
          const ext = path.split('.').pop()?.toLowerCase();
          const mimeType = ext === 'pdf' ? 'application/pdf' : 
                          ext === 'png' ? 'image/png' : 
                          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 
                          'application/octet-stream';
          return { 
            status: 'success',
            type: 'multimodal',
            mimeType,
            base64: base64.substring(0, 500000)  // Truncate very large files
          };
        }
      } catch (error: any) {
        return { error: error.message };
      }
    }
  });
}
```

### 2.6 The `search` Tool — Web Search

```typescript
// src/server/tools/search.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createSearchTool(ctx: ToolContext) {
  return tool({
    description: `Search for information across various sources.

Supported types:
- "info": General web information and articles
- "image": Images relevant to the topic
- "news": Time-sensitive news content
- "api": APIs and documentation
- "data": Public datasets and structured data
- "research": Academic publications and papers

Instructions:
- MUST use this tool for up-to-date information
- Each search may contain up to 3 query variants (same intent)
- For non-English queries, include at least one English variant
- Access multiple URLs from results for comprehensive information`,

    parameters: z.object({
      type: z.enum(['info', 'image', 'news', 'api', 'data', 'research']).describe('Search type'),
      queries: z.array(z.string()).max(3).describe('Up to 3 query variants'),
      time: z.enum(['all', 'past_day', 'past_week', 'past_month', 'past_year']).optional(),
    }),

    execute: async (params) => {
      const { type, queries, time } = params;

      // Use Tavily, Serper, or Brave Search API
      const results = [];
      for (const query of queries) {
        const searchResults = await ctx.searchProvider.search({
          query,
          type,
          timeRange: time,
          maxResults: 10,
        });
        results.push(...searchResults);
      }

      // Deduplicate by URL
      const seen = new Set();
      const unique = results.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      return {
        results: unique.slice(0, 15).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          date: r.date,
        }))
      };
    }
  });
}
```

### 2.7 The `browser` Tool — Web Browsing

```typescript
// src/server/tools/browser.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createBrowserTool(ctx: ToolContext) {
  return tool({
    description: `Navigate the browser to a URL to begin web browsing.

Instructions:
- Use to access and interpret URLs
- From search results, access multiple relevant URLs
- The browser maintains login state across tasks
- After navigation, you'll have access to page content`,

    parameters: z.object({
      url: z.string().describe('URL to navigate to. Must include protocol (https://)'),
      intent: z.enum(['navigational', 'informational', 'transactional']).describe('Purpose of visit'),
      focus: z.string().optional().describe('Specific topic to focus on when reading'),
    }),

    execute: async (params) => {
      const { url, intent, focus } = params;

      try {
        // Execute Playwright commands in the sandbox
        const script = `
          const { chromium } = require('playwright');
          const browser = await chromium.connectOverCDP('http://localhost:9222');
          const context = browser.contexts()[0];
          const page = context.pages()[0] || await context.newPage();
          await page.goto('${url.replace(/'/g, "\\'")}', { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          const title = await page.title();
          const content = await page.evaluate(() => {
            // Extract readable text content
            const article = document.querySelector('article') || document.body;
            return article.innerText.substring(0, 50000);
          });
          
          // Take screenshot
          await page.screenshot({ path: '/tmp/screenshot.png', fullPage: false });
          
          console.log(JSON.stringify({ title, content, url: page.url() }));
        `;

        await ctx.sandbox.files.write('/tmp/browse.mjs', script);
        const result = await ctx.sandbox.commands.run('node /tmp/browse.mjs', { timeout: 45000 });

        // Upload screenshot
        const screenshotUrl = await ctx.storage.uploadFromSandbox(
          ctx.sandbox, '/tmp/screenshot.png', ctx.userId
        );

        // Broadcast screenshot to frontend
        ctx.ws.emit(ctx.sessionId, {
          type: 'browser_screenshot',
          url: screenshotUrl,
          pageUrl: url
        });

        const parsed = JSON.parse(result.stdout);
        return {
          title: parsed.title,
          url: parsed.url,
          content: parsed.content?.substring(0, 30000),
          screenshot: screenshotUrl,
        };
      } catch (error: any) {
        return { error: error.message };
      }
    }
  });
}
```

### 2.8 The `match` Tool — File Search

```typescript
// src/server/tools/match.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createMatchTool(ctx: ToolContext) {
  return tool({
    description: `Find files or text in the sandbox using pattern matching.

Supported actions:
- "glob": Match file paths using glob patterns
- "grep": Search file contents using regex

Instructions:
- "glob" matches file names and paths
- "grep" searches inside files matching scope
- scope must be a glob pattern with absolute paths`,

    parameters: z.object({
      action: z.enum(['glob', 'grep']).describe('Action to perform'),
      scope: z.string().describe('Glob pattern for file scope, e.g., /home/user/**/*.py'),
      regex: z.string().optional().describe('Regex pattern for grep'),
      leading: z.number().optional().default(0).describe('Context lines before match'),
      trailing: z.number().optional().default(0).describe('Context lines after match'),
    }),

    execute: async (params) => {
      const { action, scope, regex, leading, trailing } = params;

      if (action === 'glob') {
        const result = await ctx.sandbox.commands.run(`find ${scope.replace(/\*/g, '\\*')} 2>/dev/null | head -100`);
        // Actually use proper glob
        const cmd = `python3 -c "import glob; print('\\n'.join(sorted(glob.glob('${scope}', recursive=True))))"`;
        const globResult = await ctx.sandbox.commands.run(cmd, { timeout: 10000 });
        return { files: globResult.stdout.split('\n').filter(Boolean) };
      }

      if (action === 'grep') {
        const cmd = `grep -rn ${leading ? `-B${leading}` : ''} ${trailing ? `-A${trailing}` : ''} '${regex}' ${scope} 2>/dev/null | head -500`;
        const grepResult = await ctx.sandbox.commands.run(cmd, { timeout: 15000 });
        return { matches: grepResult.stdout.substring(0, 50000) };
      }
    }
  });
}
```

### 2.9 The `generate` Tool — Image Generation

```typescript
// src/server/tools/generate.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createGenerateTool(ctx: ToolContext) {
  return tool({
    description: `Generate images from text descriptions using AI.

Instructions:
- Use for creating visual content (images, illustrations)
- Provide detailed descriptions for best results`,

    parameters: z.object({
      prompt: z.string().describe('Detailed description of the image to generate'),
      style: z.string().optional().describe('Art style (e.g., photorealistic, illustration, watercolor)'),
      size: z.enum(['1024x1024', '1792x1024', '1024x1792']).optional().default('1024x1024'),
    }),

    execute: async (params) => {
      const { prompt, style, size } = params;

      const fullPrompt = style ? `${style} style: ${prompt}` : prompt;

      // Use OpenAI DALL-E or Replicate Flux
      const response = await ctx.imageProvider.generate({
        prompt: fullPrompt,
        size,
        n: 1,
      });

      // Upload to S3
      const imageUrl = await ctx.storage.uploadFromUrl(response.url, ctx.userId);

      ctx.ws.emit(ctx.sessionId, {
        type: 'image_generated',
        url: imageUrl,
        prompt: fullPrompt
      });

      return { url: imageUrl, prompt: fullPrompt };
    }
  });
}
```

### 2.10 The `schedule` Tool — Task Scheduling

```typescript
// src/server/tools/schedule.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createScheduleTool(ctx: ToolContext) {
  return tool({
    description: `Schedule a task to run at a specific time or interval.

Supported types:
- "cron": Schedule based on cron expression (6-field format)
- "interval": Schedule based on time intervals

Instructions:
- Minimum interval for recurring tasks is 5 minutes (300 seconds)
- Use cron with repeat=false for one-time execution
- The prompt field describes what to do at execution time`,

    parameters: z.object({
      type: z.enum(['cron', 'interval']).describe('Schedule type'),
      name: z.string().describe('Human-readable task name'),
      prompt: z.string().describe('What to do at execution time'),
      repeat: z.boolean().describe('Whether to repeat after execution'),
      cron: z.string().optional().describe('6-field cron expression'),
      interval: z.number().optional().describe('Interval in seconds'),
      expire: z.string().optional().describe('Expiration datetime (yyyy-MM-dd HH:mm:ss)'),
      playbook: z.string().optional().describe('Process summary for consistency'),
    }),

    execute: async (params) => {
      const task = await ctx.db.insertScheduledTask({
        userId: ctx.userId,
        sessionId: ctx.sessionId,
        ...params,
      });

      // Register with job scheduler (BullMQ)
      await ctx.scheduler.register(task);

      return { status: 'scheduled', taskId: task.id, nextRun: task.nextRunAt };
    }
  });
}
```

### 2.11 The `map` Tool — Parallel Processing

```typescript
// src/server/tools/map.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createMapTool(ctx: ToolContext) {
  return tool({
    description: `Spawn parallel subtasks and aggregate results.

Instructions:
- Supports up to 2000 subtasks
- Each subtask runs in its own sandbox (files not shared)
- All subtasks MUST share the same output schema
- Use when performing similar operations on 5+ independent items`,

    parameters: z.object({
      name: z.string().describe('Snake_case operation name'),
      title: z.string().describe('Human-readable title'),
      prompt_template: z.string().describe('Template with {{input}} placeholder'),
      target_count: z.number().describe('Expected number of subtasks'),
      inputs: z.array(z.string()).describe('Input for each subtask'),
      output_schema: z.array(z.object({
        name: z.string(),
        type: z.enum(['string', 'number', 'boolean', 'file']),
        title: z.string(),
        description: z.string(),
        format: z.string(),
      })),
    }),

    execute: async (params) => {
      const { name, title, prompt_template, inputs, output_schema } = params;

      // Create map/reduce job in database
      const job = await ctx.db.insertMapReduceJob({
        sessionId: ctx.sessionId,
        name, title, prompt_template,
        targetCount: inputs.length,
        outputSchema: output_schema,
      });

      // Broadcast job start
      ctx.ws.emit(ctx.sessionId, {
        type: 'map_started',
        jobId: job.id,
        total: inputs.length,
        title
      });

      // Spawn subtasks in parallel (each gets its own E2B sandbox)
      const results = await Promise.allSettled(
        inputs.map(async (input, index) => {
          const subtaskSandbox = await ctx.sandboxPool.acquire();
          try {
            const prompt = prompt_template.replace('{{input}}', input);
            
            // Run a simpler agent loop for each subtask (GPT-4.1-mini for cost)
            const result = await runSubtaskAgent(subtaskSandbox, prompt, output_schema);

            // Broadcast progress
            ctx.ws.emit(ctx.sessionId, {
              type: 'map_progress',
              jobId: job.id,
              completed: index + 1,
              total: inputs.length,
            });

            return result;
          } finally {
            await ctx.sandboxPool.release(subtaskSandbox);
          }
        })
      );

      // Aggregate results
      const successful = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<any>).value);

      await ctx.db.updateMapReduceJob(job.id, {
        status: 'completed',
        completedCount: successful.length,
        results: successful,
      });

      ctx.ws.emit(ctx.sessionId, {
        type: 'map_completed',
        jobId: job.id,
        results: successful,
      });

      return { results: successful, total: inputs.length, completed: successful.length };
    }
  });
}
```

### 2.12 The `expose` Tool — Port Exposure

```typescript
// src/server/tools/expose.ts

import { tool } from 'ai';
import { z } from 'zod';
import type { ToolContext } from '../../shared/types';

export function createExposeTool(ctx: ToolContext) {
  return tool({
    description: `Expose a local port in the sandbox for temporary public access.
Returns a temporary public URL for the specified port.`,

    parameters: z.object({
      port: z.number().describe('Local port number to expose'),
    }),

    execute: async (params) => {
      const { port } = params;
      
      // E2B provides port forwarding
      const url = ctx.sandbox.getHost(port);
      
      return { 
        url: `https://${url}`,
        port,
        note: 'This URL is temporary and will expire when the sandbox shuts down.'
      };
    }
  });
}
```

---

## 3. Tool Routing Summary

This table shows where each tool executes — critical for your architecture:

| Tool | Executes In | Network Call | Why |
|------|------------|-------------|-----|
| `plan` | **Orchestrator** | Database write + WebSocket | No sandbox needed, just state management |
| `message` | **Orchestrator** | Database write + WebSocket + S3 (attachments) | Communication control |
| `shell` | **Sandbox** (E2B) | E2B SDK → Firecracker VM | Needs isolated OS |
| `file` | **Sandbox** (E2B) | E2B SDK → Firecracker VM | Needs isolated filesystem |
| `match` | **Sandbox** (E2B) | E2B SDK → Firecracker VM | Needs filesystem access |
| `browser` | **Sandbox** (E2B) | E2B SDK → Playwright → Chromium | Needs browser process |
| `search` | **Orchestrator** | HTTP → Search API (Tavily/Serper) | External API, no sandbox needed |
| `generate` | **Orchestrator** | HTTP → DALL-E/Flux API | External API |
| `schedule` | **Orchestrator** | Database write + BullMQ | Job scheduling |
| `map` | **Orchestrator** (spawns N sandboxes) | E2B SDK × N | Parallel execution |
| `expose` | **Sandbox** (E2B) | E2B port forwarding | Needs sandbox network |

This routing is implemented in the orchestrator's tool router (Part 3).
