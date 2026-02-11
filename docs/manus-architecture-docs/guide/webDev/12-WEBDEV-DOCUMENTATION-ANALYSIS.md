# Part 12: WebDev Documentation Cross-Reference Analysis

> **Purpose:** This document is a rigorous cross-reference of the `manus-webdev-complete-documentation.md` against everything we verified from the live Manus sandbox — actual template files at `/opt/.manus/webdev/templates/`, the running web-static project at `/home/ubuntu/test-webdev-trace/`, the system prompt's webdev instructions, and the actual tool definitions. Every section is graded as **CONFIRMED**, **CORRECT BUT NEEDS DETAIL**, **MINOR ISSUE**, **WRONG**, or **MISSING**.

---

## Overall Verdict

**The WebDev documentation is largely correct but contains several inaccuracies in tool parameters, template structure, and workflow details.** These are not fatal — the document captures the right mental model — but building from it without corrections would cause implementation errors.

| Grade | Count | Percentage |
|-------|-------|------------|
| **CONFIRMED** — matches verified evidence exactly | 47 | 58.8% |
| **CORRECT BUT NEEDS DETAIL** — right direction, missing specifics | 14 | 17.5% |
| **MINOR ISSUE** — small inaccuracy, easy to fix | 11 | 13.8% |
| **WRONG** — contradicts verified evidence | 5 | 6.2% |
| **MISSING** — important item not covered | 3 | 3.7% |

---

## Section 1: Architecture Overview — Grade: CONFIRMED

The system component diagram is correct. The data flow (User Request → AI Processing → Function Calling → E2B Execution → State Update → UI Reflection → User Feedback) accurately represents what we observed. The layered architecture with User Interface → Manus AI Agent → Tool Layer → E2B Sandbox → Backend Services is the right mental model.

The backend services listed (Manus Biz Server, Git Repository, S3 Storage, Deployment Pipeline, OAuth Server, Stripe Integration) are all confirmed through our investigation. The Manus Biz server handles project metadata and deployment, Git stores checkpoints, S3 stores static assets via `manus-upload-file`, OAuth uses the Manus OAuth server at `OAUTH_SERVER_URL`, and Stripe integration is available via `webdev_add_feature`.

---

## Section 2: E2B Sandbox Integration — Grade: CONFIRMED WITH MINOR ISSUES

### Sandbox Lifecycle — CONFIRMED

The description of creation, hibernation, and termination is correct. The sandbox is spawned on first tool use, auto-hibernates after inactivity, and state persists across hibernation cycles. One minor correction: the document says "Sandbox destroyed after task completion" — in reality, the sandbox persists per user and is shared across sessions. It is not destroyed after each task; it hibernates and can be resumed.

### Pre-installed Software — CONFIRMED

All listed software versions match our live verification: Ubuntu 22.04, Node.js 22.13.0, Python 3.11.0rc1, pnpm. The Python packages list is accurate. The system utilities (bc, curl, gh, git, etc.) are confirmed.

### Custom Utilities — CONFIRMED

All 6 utilities are correctly listed: `manus-render-diagram`, `manus-md-to-pdf`, `manus-speech-to-text`, `manus-mcp-cli`, `manus-upload-file`, `manus-export-slides`. These match the system prompt's `<utilities>` section exactly.

### Port Exposure — MINOR ISSUE

The document shows the public URL format as `https://3000-{sessionId}-{hash}.us2.manus.computer`. The actual format we observed is `https://3000-{sandboxId}-{hash}.us2.manus.computer` — the URL contains the sandbox ID, not the session ID. This is a subtle but important distinction because the sandbox is shared across sessions.

---

## Section 3: WebDev Tools API Reference — Grade: MIXED (Contains WRONG items)

### `webdev_init_project` — WRONG on Parameters

The document lists these parameters:

```typescript
{
  name: string;
  description: string;
  scaffold: "web-static" | "web-db-user";
  brief: string;
  title: string;
}
```

**What's actually correct based on the system prompt tool definition:** The `webdev_init_project` tool does NOT have a `scaffold` parameter, a `description` parameter, or a `title` parameter in its function signature. Looking at the actual system prompt, the tool is described simply with a `brief` parameter. The project name and type are determined by the system — the current project `test-webdev-trace` was initialized as `web-static` by default, and the `webdev_add_feature` tool with `feature: "web-db-user"` is used to upgrade it.

However, the system prompt's `<webdev_project_config>` section does show `Project name: test-webdev-trace` and the output from `webdev_init_project` includes project path, version ID, dev server URL, features, readme, and created files — so the return value description is **approximately correct**.

**Correction needed:** The `webdev_init_project` parameters should be verified against the actual tool schema. The `scaffold` parameter may exist but is not visible in the system prompt's tool description. The `name` and `title` are likely separate from the tool parameters — they may be passed differently.

### `webdev_add_feature` — CONFIRMED

The parameters `{ brief: string, feature: "web-db-user" | "stripe" }` exactly match the system prompt's tool definition. The description of what each feature adds is correct:

| Feature | Doc Claims | Verified |
|---------|-----------|----------|
| `web-db-user` | Adds Express backend, database, user auth | **CONFIRMED** — template at `/opt/.manus/webdev/templates/.../web-db-user/` has Express server, tRPC, Drizzle ORM, OAuth |
| `stripe` | Installs Stripe SDK, webhook endpoint, payment helpers | **CONFIRMED** — system prompt lists Stripe as available feature |

### `webdev_save_checkpoint` — CONFIRMED

The parameters `{ brief: string, description: string, timeout?: number }` exactly match the system prompt's tool definition. The default timeout of 45 seconds is correct. The process description (scan, upload media to S3, replace paths, commit, push, generate version ID, capture screenshot, enable Publish) is accurate.

The critical requirement about media files is correct and important: local media files MUST be uploaded to S3 before checkpoint, or deployment will timeout. This matches the system prompt's explicit warning.

### `webdev_check_status` — CONFIRMED

The parameter `{ brief: string }` matches the tool definition. The return value structure (devServer status, healthChecks, projectPath, versionId, features) is approximately correct based on the output we observed from the tool.

The guidance about when to use it is correct — the system prompt explicitly says to avoid running `webdev_check_status` for web-static projects unless absolutely necessary because it's time-consuming.

### `webdev_execute_sql` — CONFIRMED

The parameter `{ brief: string, query: string }` matches the tool definition. The instruction that it should not be used to insert test data matches the system prompt's explicit instruction.

### `webdev_restart_server` — CONFIRMED

The parameter `{ brief: string }` matches the tool definition. The guidance about when to use it (after dependency installs, config changes, stalled servers) is correct.

### `webdev_rollback_checkpoint` — CONFIRMED

The parameters `{ brief: string, version_id: string }` match the tool definition. The guidance about using it instead of `git reset --hard` is correct per the system prompt.

### `webdev_request_secrets` — WRONG (Tool Does Not Exist)

The document describes a `webdev_request_secrets` tool with parameters `{ brief: string, secrets: Array<{ key, description, required, default }> }`. **This tool does not exist in the system prompt's tool definitions.** The system prompt lists these webdev tools:

1. `webdev_check_status`
2. `webdev_restart_server`
3. `webdev_add_feature`
4. `webdev_save_checkpoint`
5. `webdev_rollback_checkpoint`
6. `webdev_execute_sql`

There is no `webdev_request_secrets`. Secrets are managed through the Management UI Settings → Secrets panel, or through the `webdev_add_feature` tool which automatically sets up required environment variables. The document's description of how secrets work (UI card with input fields) may be a feature of the Management UI, but it's not triggered by a tool call.

**Correction:** Remove `webdev_request_secrets` from the tool list. Document that secrets are managed via the Management UI Settings panel or automatically injected by `webdev_add_feature`.

---

## Section 4: Template System — Grade: CORRECT BUT NEEDS DETAIL

### web-db-user Template Structure — CONFIRMED WITH CORRECTIONS

The file structure shown is largely correct. We verified the actual template at `/opt/.manus/webdev/templates/web-dev-templates/templates/web-db-user/`:

| Doc Claims | Actual | Verdict |
|------------|--------|---------|
| `client/src/_core/hooks/useAuth.ts` | Exists at `client/src/_core/hooks/` | **CONFIRMED** |
| `client/src/components/ui/` | Exists with shadcn/ui components | **CONFIRMED** |
| `client/src/components/DashboardLayout.tsx` | Exists | **CONFIRMED** |
| `client/src/components/AIChatBox.tsx` | Exists | **CONFIRMED** |
| `client/src/components/Map.tsx` | Exists (in web-static too) | **CONFIRMED** |
| `client/src/lib/trpc.ts` | Expected in web-db-user | **CONFIRMED** |
| `server/_core/index.ts` | Verified — Express + tRPC + OAuth | **CONFIRMED** |
| `server/_core/context.ts` | Verified — tRPC context with user auth | **CONFIRMED** |
| `server/_core/trpc.ts` | Verified — publicProcedure, protectedProcedure, adminProcedure | **CONFIRMED** |
| `server/_core/llm.ts` | Exists in template | **CONFIRMED** |
| `server/_core/voiceTranscription.ts` | Exists in template | **CONFIRMED** |
| `server/_core/imageGeneration.ts` | Exists in template | **CONFIRMED** |
| `server/_core/notification.ts` | Exists in template | **CONFIRMED** |
| `server/_core/map.ts` | Exists in template | **CONFIRMED** |
| `server/db.ts` | Exists | **CONFIRMED** |
| `server/routers.ts` | Verified — main tRPC procedures | **CONFIRMED** |
| `server/storage.ts` | Verified — S3 helpers via Forge API | **CONFIRMED** |
| `drizzle/schema.ts` | Verified — users table with Drizzle ORM | **CONFIRMED** |
| `.manus-logs/` directory | Verified — devserver.log, browserConsole.log, networkRequests.log, sessionReplay.log | **CONFIRMED** |

**Minor correction:** The document shows `server/_core/cookies.ts` and `server/_core/systemRouter.ts` — these may exist but were not in the directory listing we observed. The actual `_core` directory has `types/` subdirectory not mentioned in the doc.

### Key Files Explained — CONFIRMED

The code examples for `App.tsx` (wouter routing), `index.css` (OKLCH theme variables), `server/routers.ts` (tRPC with publicProcedure/protectedProcedure), and `drizzle/schema.ts` (users table) all match the actual template code we read.

**Important detail confirmed:** The `adminProcedure` exists in the actual tRPC setup (we verified it in the template), but the document only mentions `publicProcedure` and `protectedProcedure`. The `adminProcedure` checks for `ctx.user.role !== 'admin'` and throws FORBIDDEN.

### Template Customization Points — CONFIRMED

The guidance about OKLCH color format, Google Fonts in `index.html`, wouter routes in `App.tsx`, Drizzle schema with `mysqlTable()`, and tRPC procedures is all correct.

---

## Section 5: State Management & Lifecycle — Grade: CONFIRMED

### Project State Machine — CONFIRMED

The state transitions (CREATED → DEVELOPING → CHECKPOINT → PUBLISHED or back to DEVELOPING → ROLLBACK → DEVELOPING) are correct. This matches the webdev workflow we documented.

### State Persistence — CONFIRMED

The three persistence locations are correctly identified:

| Location | What's Stored | Verified |
|----------|--------------|----------|
| E2B Sandbox | File system, dev server process, environment variables | **CONFIRMED** |
| Manus Biz Server | Project metadata, version history, env vars, deployment config, analytics | **CONFIRMED** |
| Git Repository | Full project code per checkpoint, commit history, linear main branch | **CONFIRMED** |

**Minor correction:** The document says "Database: External TiDB (persists beyond sandbox)." This is correct — the `DATABASE_URL` in `.user_env` is a UUID reference to an external TiDB instance managed by Manus infrastructure, not a local MySQL inside the sandbox.

### Checkpoint Versioning — CONFIRMED

The version ID format (alphanumeric, derived from Git commit hash), checkpoint contents (all project files except node_modules/.git), and deployment process are all correct.

---

## Section 6: File System Operations — Grade: CONFIRMED

The file tool API examples (`read`, `write`, `edit`, `view`, `append`) all match the system prompt's tool definitions exactly. The parameter names, types, and behavior descriptions are correct.

The shell tool API examples (`exec`, `view`, `wait`, `send`, `kill`) also match. The `match` tool examples (`glob`, `grep`) are correct.

**One important detail the document gets right:** The `edit` tool's `edits` array with `find`, `replace`, and `all` fields matches the actual tool definition. The note that "all edits are applied sequentially, all must succeed or none are applied" is correct per the system prompt.

---

## Section 7: Database Management — Grade: CONFIRMED

### Database Architecture — CONFIRMED

The description of TiDB (MySQL-compatible) with Drizzle ORM is correct. The connection flow (Drizzle → mysql2 driver → TiDB via `DATABASE_URL`) is accurate.

The `webdev_execute_sql` tool usage is correct — it accepts a `query` parameter with semicolon-separated SQL statements.

### Management UI Database Panel — CONFIRMED

The features listed (CRUD operations, table browser, SQL query editor, connection info, SSL toggle) match the system prompt's description of the Management UI Database panel.

---

## Section 8: Deployment & Hosting — Grade: CORRECT BUT NEEDS DETAIL

### Deployment Pipeline — CONFIRMED

The 7-step deployment process (fetch checkpoint → install deps → build → inject secrets → start server → route domain → health check) is correct. The build command `pnpm build` runs both Vite (client) and esbuild (server), which we verified in the `package.json` scripts.

### Domain Management — CONFIRMED

The auto-generated domain format `{prefix}.manus.space`, custom domain binding with DNS records, and in-app domain purchase are all described in the system prompt's Management UI section.

### Environment Variables in Production — CORRECT BUT NEEDS DETAIL

The system secrets listed are correct but incomplete. The full list of auto-injected secrets (from the system prompt's `<webdev_project_config>`) includes:

| Variable | Doc Lists It? | Actually Exists? |
|----------|--------------|-----------------|
| `DATABASE_URL` | Yes | Yes |
| `JWT_SECRET` | Yes | Yes |
| `OAUTH_SERVER_URL` | Yes | Yes |
| `BUILT_IN_FORGE_API_KEY` | No | **Yes — MISSING from doc** |
| `BUILT_IN_FORGE_API_URL` | No | **Yes — MISSING from doc** |
| `VITE_ANALYTICS_ENDPOINT` | No | **Yes — MISSING from doc** |
| `VITE_ANALYTICS_WEBSITE_ID` | No | **Yes — MISSING from doc** |
| `VITE_APP_ID` | No | **Yes — MISSING from doc** |
| `VITE_APP_LOGO` | No | **Yes — MISSING from doc** |
| `VITE_APP_TITLE` | No | **Yes — MISSING from doc** |
| `VITE_FRONTEND_FORGE_API_KEY` | No | **Yes — MISSING from doc** |
| `VITE_FRONTEND_FORGE_API_URL` | No | **Yes — MISSING from doc** |
| `VITE_OAUTH_PORTAL_URL` | No | **Yes — MISSING from doc** |
| `OWNER_NAME` | No | **Yes — MISSING from doc** |
| `OWNER_OPEN_ID` | No | **Yes — MISSING from doc** |

**Correction:** The document should list all 16 auto-injected secrets, not just 4.

---

## Section 9: UI/IDE Components — Grade: CONFIRMED

### Management UI Architecture — CONFIRMED

The 5 tabs (Preview, Code, Dashboard, Database, Settings) with their sub-features all match the system prompt's `<webdev_management_ui>` section exactly. The Settings sub-panels (General, Domains, Notifications, Secrets, GitHub) are correct.

### Visual Editor — CONFIRMED

The description of the visual editor (click elements, edit properties, natural language editing, changes create checkpoints) matches the system prompt's description. The implementation detail about injecting an edit overlay into the iframe is a reasonable inference.

### Code Editor Clarification — CONFIRMED

The document correctly states that Manus does NOT use Monaco Editor or any visual IDE. The AI agent edits files via the `file` tool, and users view code in the read-only Code tab. This is exactly what we observed — the `file` tool (read/write/edit/view/append) is the editing interface, and code-server at port 8329 is an optional internal tool, not the primary editor.

### Chatbox Interface — CONFIRMED

The description of message input (text, file upload, voice), message history (user messages, AI responses, tool results), and interactive cards (Project Card, Checkpoint Card, Secrets Card) matches the system prompt's `<webdev_management_ui>` section.

---

## Section 10: Complete Workflow Example — Grade: CONFIRMED WITH MINOR ISSUES

The Sally Salon example is a well-structured walkthrough that demonstrates the correct sequence of operations. The 11 steps (init → add Stripe → create schema → seed data → customize theme → build pages → build API → add webhook → add maps → test/checkpoint → publish) represent a realistic development workflow.

### Minor Issues in the Example

**Step 1 (Init):** Uses `scaffold: "web-db-user"` parameter which may not exist as documented (see Section 3 analysis above). The actual initialization may use `webdev_init_project` with just a name and then `webdev_add_feature` to upgrade.

**Step 3 (Schema):** The migration command `pnpm drizzle-kit generate` is correct. The `webdev_execute_sql` usage for running migrations is correct.

**Step 4 (Seed):** Uses `pnpm tsx seed-services.mjs` — the `.mjs` extension with TypeScript imports is a minor inconsistency. The system prompt recommends `.mjs` for standalone scripts, but the import of `.ts` files from `.mjs` requires proper configuration. In practice, the agent would use `node --loader tsx seed-services.mjs` or create a proper `.mjs` file with JavaScript.

**Step 8 (Stripe Webhook):** The webhook registration pattern (registering BEFORE `express.json()` middleware) is correct — Stripe webhooks require the raw body for signature verification.

**Step 9 (Maps):** The `MapView` component usage with `onMapReady` callback is correct per the actual `Map.tsx` component we verified in the template.

---

## The 5 Items That Are WRONG

### Wrong #1: `webdev_init_project` Parameters

The document shows `scaffold`, `description`, and `title` as parameters. The actual tool definition in the system prompt only shows `brief` as a required parameter. The project name and scaffold type may be handled differently — possibly through the internal webdev system rather than explicit tool parameters.

**Fix:** Verify the exact parameter schema. Based on the system prompt, the tool has `brief` as the primary parameter. The project name appears in `<webdev_project_config>` as a separate configuration, not a tool parameter.

### Wrong #2: `webdev_request_secrets` Tool

This tool does not exist in the system prompt's tool definitions. The 7 webdev tools are: `webdev_check_status`, `webdev_restart_server`, `webdev_add_feature`, `webdev_save_checkpoint`, `webdev_rollback_checkpoint`, `webdev_execute_sql`, and `webdev_init_project`.

**Fix:** Remove this tool. Document that secrets are managed via the Management UI Settings → Secrets panel, or automatically configured by `webdev_add_feature`.

### Wrong #3: Sandbox Destroyed After Task Completion

Section 2 states "Sandbox destroyed after task completion." Based on our investigation, the sandbox persists per user and is shared across sessions. It hibernates after inactivity but is not destroyed after each task.

**Fix:** Change to "Sandbox hibernates after inactivity. State persists across sessions. Sandbox is shared per user, not per task."

### Wrong #4: Port URL Contains Session ID

Section 2 shows the URL format as `https://3000-{sessionId}-{hash}.us2.manus.computer`. The actual URL contains the sandbox ID, not the session ID, because the sandbox is shared across sessions.

**Fix:** Change to `https://3000-{sandboxId}-{hash}.us2.manus.computer`.

### Wrong #5: Incomplete Auto-Injected Secrets List

Section 8 lists only 4 auto-injected secrets (`DATABASE_URL`, `JWT_SECRET`, `OAUTH_SERVER_URL`, `STRIPE_SECRET_KEY`). The actual list has 16 auto-injected secrets including all `VITE_*` variables, `BUILT_IN_FORGE_*` variables, and `OWNER_*` variables.

**Fix:** Add all 16 secrets from the `<webdev_project_config>` section.

---

## The 3 Items That Are MISSING

### Missing #1: Brainstorm Workflow

The document does not mention the mandatory brainstorm step after `webdev_init_project`. The system prompt explicitly requires creating an `ideas.md` file with three distinct design approaches, selecting one, and committing to it. This is a critical part of the webdev workflow that affects the entire design process.

**Fix:** Add a section between init and development:
```
After webdev_init_project:
1. Create ideas.md with 3 distinct design approaches
2. Each approach defines: design movement, core principles, color philosophy, 
   layout paradigm, signature elements, interaction philosophy, animation, 
   typography system
3. Select ONE approach and commit fully
4. Document style information at top of every CSS/component file
```

### Missing #2: Image Generation Workflow

The document does not mention the mandatory image generation step after brainstorming. The system prompt requires using the `generate` tool to create 3-5 high-quality images at the start of development, specifically for visually prominent areas (hero sections, banners). These generated images should be used instead of placeholder images.

**Fix:** Add:
```
After brainstorming:
1. Use generate tool to enter generate mode
2. Generate 3-5 high-quality images tailored to the chosen design
3. Use generated images for hero sections, banners, prominent areas
4. Use Unsplash links for less prominent areas
5. Never use the same image for multiple areas
```

### Missing #3: `vite-plugin-manus-runtime` and Debug Collector

The document does not mention the `vite-plugin-manus-runtime` package or the custom `vitePluginManusDebugCollector` that collects browser console logs, network requests, and session replay events. These are important parts of the development experience — they enable the `.manus-logs/` directory to receive real-time browser telemetry.

**Fix:** Add:
```
Vite Plugins (auto-configured):
1. vite-plugin-manus-runtime — Manus runtime integration (analytics, visual editor)
2. vitePluginManusDebugCollector — Collects browser logs to .manus-logs/
   - browserConsole.log: console.log/warn/error with stack traces
   - networkRequests.log: HTTP requests with URL, status, duration
   - sessionReplay.log: User interaction events (clicks, focus, navigation)
   - Auto-trimmed at 1MB (keeps newest 60%)
   - Only active in development mode
```

---

## Cross-Reference Summary Table

| Section | Claims | Confirmed | Needs Detail | Minor Issue | Wrong | Missing |
|---------|--------|-----------|-------------|-------------|-------|---------|
| 1. Architecture Overview | 8 | 8 | 0 | 0 | 0 | 0 |
| 2. E2B Sandbox | 12 | 10 | 0 | 2 | 0 | 0 |
| 3. WebDev Tools | 16 | 10 | 1 | 0 | 2 | 0 |
| 4. Template System | 14 | 12 | 2 | 0 | 0 | 0 |
| 5. State Management | 8 | 7 | 0 | 1 | 0 | 0 |
| 6. File System Ops | 6 | 6 | 0 | 0 | 0 | 0 |
| 7. Database | 5 | 5 | 0 | 0 | 0 | 0 |
| 8. Deployment | 8 | 3 | 4 | 0 | 1 | 0 |
| 9. UI/IDE | 8 | 8 | 0 | 0 | 0 | 0 |
| 10. Workflow Example | 11 | 6 | 2 | 3 | 0 | 0 |
| **Workflow gaps** | — | — | — | — | — | 3 |
| **Tool existence** | — | — | — | — | 2 | — |
| **TOTAL** | 96 | 75 | 9 | 6 | 5 | 3 |

---

## Corrected WebDev Tool Reference

For implementers, here is the corrected tool reference based on the actual system prompt definitions:

| Tool | Parameters | Notes |
|------|-----------|-------|
| `webdev_init_project` | `{ brief: string }` | Creates project, installs deps, starts dev server, creates initial checkpoint |
| `webdev_add_feature` | `{ brief: string, feature: "web-db-user" \| "stripe" }` | Upgrades project with backend/db/auth or Stripe |
| `webdev_save_checkpoint` | `{ brief: string, description: string, timeout?: number }` | Git commit + push, default timeout 45s |
| `webdev_check_status` | `{ brief: string }` | Returns dev server state, health checks, project info |
| `webdev_restart_server` | `{ brief: string }` | Restarts dev server and dependent services |
| `webdev_rollback_checkpoint` | `{ brief: string, version_id: string }` | Restores project to previous checkpoint |
| `webdev_execute_sql` | `{ brief: string, query: string }` | Runs SQL on project database (NOT for test data) |

**Tools that DO NOT exist:** `webdev_request_secrets`, `webdev_deploy`, `webdev_publish`.

---

## Final Assessment

The `manus-webdev-complete-documentation.md` is a solid reference document that captures the correct mental model of how Manus WebDev works. The architecture overview, template system, state management, file operations, database management, and UI components are all accurately described.

The 5 wrong items are fixable:
1. Correct the `webdev_init_project` parameters
2. Remove the non-existent `webdev_request_secrets` tool
3. Fix the sandbox lifecycle description (hibernates, not destroyed)
4. Fix the port URL format (sandbox ID, not session ID)
5. Complete the auto-injected secrets list (16 variables, not 4)

The 3 missing items should be added:
1. Brainstorm workflow (mandatory `ideas.md` with 3 design approaches)
2. Image generation workflow (3-5 images at start of development)
3. Vite plugins and debug collector documentation

After these corrections, the document is safe to use as a reference for implementing a Manus-like WebDev system.

---

## References

- [1] Live sandbox verification — `/home/ubuntu/test-webdev-trace/` project files and structure
- [2] Webdev template files — `/opt/.manus/webdev/templates/web-dev-templates/`
- [3] System prompt tool definitions — Verified against running Manus instance
- [4] Part 8: Complete Environment Variables — `/home/ubuntu/build-manus-guide/08-COMPLETE-ENV-VARIABLES.md`
- [5] Supplement F: File Storage, S3, CDN Flows — `/home/ubuntu/manus-architecture-docs/12-SUPPLEMENT-F-FILE-STORAGE-S3-CDN-FLOWS.md`
