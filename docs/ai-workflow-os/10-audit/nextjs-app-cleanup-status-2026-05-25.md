# Next.js App Cleanup Status

Date: 2026-05-25

Scope: `apps/app` only. Backend services are intentionally paused for this phase.

## External Evidence Checked

- T3 Env Next.js docs: `https://env.t3.gg/docs/nextjs`
- T3 Env customization docs: `https://env.t3.gg/docs/customization`
- Next.js App Router project structure docs: `https://nextjs.org/docs/app/getting-started/project-structure`
- Local Vercel Next.js guidance: App Router route groups, Server/Client Component boundaries, async request APIs, and Next 16 `proxy.ts` migration rules.

## Current Verdict

The Next app is not senior-clean yet, but the env/service URL layer is now materially cleaner.

This pass removed scattered app-specific service URL reads from route handlers, tRPC routers, chat helpers, and client modules. The app now has a typed T3 Env contract and a server-only service URL helper. That gives us one controlled place to migrate old service endpoints, sandbox endpoints, and public client constants during the reset.

## Completed In This Pass

- Added app-local T3 Env schema in `apps/app/env.ts` for:
  - `ORCHESTRATOR_SERVICE_URL`
  - `SANDBOX_SERVICE_URL`
  - `BILLING_SERVICE_URL`
  - `FILE_SERVICE_URL`
  - `CONNECTOR_SERVICE_URL`
  - `TASK_SERVICE_URL`
  - `AGENT_SERVICE_URL`
  - `DEVICE_SERVICE_URL`
  - `WEBSITE_SERVICE_URL`
  - `JWT_SECRET`
  - `REDIS_URL`
  - `SECRETS_ENCRYPTION_KEY`
  - `CHAT_SSE_PING_INTERVAL_MS`
  - `E2E_AUTH_BYPASS`
  - `NEXT_PUBLIC_ORCHESTRATOR_URL`
  - `NEXT_PUBLIC_GATEWAY_WS_URL`
  - `NEXT_PUBLIC_SANDBOX_DOMAIN`
  - `NEXT_PUBLIC_APP_VERSION`
  - `NEXT_PUBLIC_DEBUG_TOOLS`
- Added `apps/app/lib/server/service-urls.ts` with `server-only` protection.
- Refactored app API proxies away from raw app-specific `process.env` reads:
  - OAuth proxy
  - chat completion proxy
  - chat stop proxy
  - IDE proxy
  - sandbox routes
  - session media routes
  - gateway token route
- Refactored tRPC routers away from raw service URL env reads:
  - connectors
  - scheduled tasks
  - files
  - devices
  - smart home
  - website builder
  - secrets
- Refactored client/public env reads to use `@/env`:
  - API client
  - websocket middleware
  - settings help tab
  - sandbox test IDE public sandbox domain
- Removed adjacent lint debt in touched files:
  - unused imports and variables
  - `let` values that should be `const`
  - internal `<a>` links replaced with `next/link`

## Validation

Passed:

```bash
pnpm --filter app typecheck
pnpm exec eslint <touched apps/app files>
```

Scan result after this pass:

```text
No remaining app-specific service URL process.env reads in apps/app/app or apps/app/lib.
```

Remaining direct `process.env` reads in `apps/app/app` and `apps/app/lib` are currently limited to:

- `NODE_ENV`, `VERCEL_URL`, and `PORT` framework/runtime cases.
- Unit tests mutating `process.env.REDIS_URL`.
- A fixture script reading `DATABASE_URL`.
- A generated code string inside `chat/test-ide/page.tsx` that intentionally emits `process.env.DATABASE_URL` into a sandbox sample app.
- A commented AgentMail webhook secret line.

## Important Behavior Notes

- Local service URL defaults are preserved for development.
- On Vercel, missing core service URLs now fail validation instead of silently falling back to localhost.
- `SECRETS_ENCRYPTION_KEY` is now validated as a 64-character hex value when provided.
- `TASK_SERVICE_URL` keeps the current app default of `http://localhost:3002` because local Docker service wiring still references that port. This must be revisited when service ports are rebuilt.
- `NEXT_PUBLIC_SANDBOX_DOMAIN` still defaults to `e2b.dev` because the current UI/test IDE still contains legacy E2B assumptions. This is a migration target, not the final architecture.

## Keep / Refactor / Delete

| Area                                             | Decision                         | Reason                                                                                                                        |
| ------------------------------------------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/app/env.ts`                                | Keep and grow carefully          | Correct typed env boundary for the Next app.                                                                                  |
| `apps/app/lib/server/service-urls.ts`            | Keep                             | Single server-only endpoint map for service migration.                                                                        |
| API proxy route handlers                         | Refactor next                    | Too much repeated auth, fetch, timeout, and response forwarding logic.                                                        |
| `chat/test`, `chat/test-stream`, `chat/test-ide` | Move or delete                   | Test/demo routes should not live in the production authenticated route tree.                                                  |
| `NEXT_PUBLIC_SANDBOX_DOMAIN=e2b.dev`             | Replace during sandbox migration | Legacy E2B URL model does not match the desired Vercel Sandbox architecture.                                                  |
| broad page-level Client Components               | Refactor                         | Pages should be Server Components with focused client islands.                                                                |
| huge Redux slice folder                          | Audit and prune                  | Many slices appear old Manus/product experiments and are too broad for the reset.                                             |
| `apps/app/app/(authenticated)/_components`       | Break up                         | It is now private/non-routing, but still a shared bucket; route-owned components should move under route-local `_components`. |

## Next App Cleanup Phases

### Phase 1: Route Tree Reset

- [ ] Keep route groups, but rename target reset groups to `(auth)`, `(app)`, and `(public)`.
- [ ] Move route-specific components into route-local `_components`.
- [ ] Move route-specific hooks into route-local `_hooks`.
- [ ] Move route-specific server helpers into route-local `_lib`.
- [ ] Delete or isolate `chat/test`, `chat/test-stream`, and `chat/test-ide`.
- [ ] Move route fixtures out of production route folders.

### Phase 2: Server/Client Boundary Cleanup

- [ ] Convert page-level Client Components to Server Components where possible.
- [ ] Keep interactivity inside focused client islands.
- [ ] Add Suspense boundaries around routes using `useSearchParams`.
- [ ] Prevent server-only imports from leaking into client modules.
- [ ] Split `providers` into server-safe and client-only layers.

### Phase 3: API Route Proxy Cleanup

- [ ] Add shared authenticated proxy helpers for JSON passthrough routes.
- [ ] Standardize timeout values and error envelopes.
- [ ] Add explicit runtime decisions where needed.
- [ ] Remove duplicated auth/session boilerplate in route handlers.
- [ ] Separate browser/sandbox route facade from provider-specific implementation.

### Phase 4: Sandbox And IDE Migration Surface

- [ ] Replace E2B naming in UI, hooks, comments, and test routes.
- [ ] Introduce a provider-neutral sandbox adapter boundary.
- [ ] Map required capabilities to Vercel Sandbox: file operations, shell, browser stream, terminal stream, preview URL, lifecycle.
- [ ] Delete E2B-specific URL construction after the Vercel Sandbox adapter is live.

### Phase 5: State And Data Layer Cleanup

- [ ] Inventory Redux slices by active route usage.
- [ ] Delete unused slices.
- [ ] Move route-local state out of global Redux.
- [ ] Keep global state only for cross-route shell, chat/run streaming, notifications, and workspace state.
- [ ] Move direct service calls behind server actions, route handlers, or tRPC server routers.

### Phase 6: File Rendering And Artifact Viewer

- [ ] Consolidate file rendering around artifacts, MIME type, permissions, and safe preview rules.
- [ ] Keep presigned URL generation server-side.
- [ ] Add explicit preview components for text, markdown, image, PDF, code, audio, and video.
- [ ] Add download/open policies per artifact type.

### Phase 7: Tests

- [ ] Move route demo pages into tests/devtools or delete them.
- [ ] Keep unit tests near non-route libraries only when they do not pollute route structure.
- [ ] Add route handler tests for proxy helpers after proxy consolidation.
- [ ] Add env contract tests for app-local T3 Env defaults and Vercel required vars.

## Not Done Yet

- The full `apps/app` route tree has not been reorganized yet.
- The giant authenticated component bucket is still present.
- The Redux store has not been audited slice-by-slice yet.
- E2B naming and behavior still exists in the UI and test IDE route.
- API routes still duplicate proxy/auth code, even though env access is now centralized.
- Services are intentionally not being cleaned in this phase.
