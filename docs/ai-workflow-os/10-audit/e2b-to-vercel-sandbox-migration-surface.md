# E2B To Vercel Sandbox Migration Surface

Date: 2026-05-23

Status: first-pass migration audit.

## Verdict

The current project is deeply E2B-specific. Migrating to Vercel Sandbox is feasible only as a staged provider migration. A direct delete/replace will likely break terminal execution, file IO, browser previews, deploy previews, WebRTC/Neko, code-server, CSP, DB records, billing metering, and frontend hooks.

## Cleanup Status Added 2026-05-23

Decision: keep E2B source/runtime code as a compatibility provider for now.

Cleanup performed:

- [x] Removed ignored generated E2B template `node_modules` under `e2b-templates/desktop/jeriko-files/app_data/js`.
- [x] Removed ignored generated E2B template `node_modules` under `e2b-templates/desktop/jeriko-files/runtime/app_data/js`.
- [x] Removed ignored generated `portfolio-new/dist` build output.
- [x] Removed checked-in `e2b-templates/**` from the active repo after the template payload was classified as old Manus/E2B image-build material, not runtime compatibility code.

Do not delete remaining E2B runtime source in this cleanup phase. The next valid E2B SDK/runtime deletion point is after the provider-neutral sandbox interface exists and the Vercel Sandbox proof checklist below passes.

Current cleanup boundary: E2B template payload is gone; E2B runtime code stays as compatibility debt. Do not rename or delete runtime imports piecemeal until the provider-neutral adapter exists.

## Current E2B Surfaces

| Surface                    | Evidence                                                                                       | Migration action                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Sandbox service dependency | `services/sandbox/package.json` uses `@e2b/code-interpreter` at line 15.                       | Add `@vercel/sandbox` only after provider interface exists.                                              |
| Runtime import             | `services/sandbox/src/index.ts` imports E2B at line 2.                                         | Move provider-specific SDK imports into provider adapter files.                                          |
| In-memory provider map     | `services/sandbox/src/index.ts` stores `Map<string, E2BSandbox>` at lines 14-18.               | Store a provider runtime handle behind adapter registry.                                                 |
| Port URL model             | `getTerminalServerUrl()` calls `e2bSandbox.getHost(8330)` at lines 34-41.                      | Replace with provider method `getPortUrl(port)`.                                                         |
| Required env               | `E2B_API_KEY` is read at line 167.                                                             | Add Vercel auth path: OIDC/access token; keep E2B env until removed.                                     |
| DB schema                  | `packages/database/src/schema/sandboxes.ts` has `e2bSandboxId` and `templateId` lines 35-38.   | Add provider-neutral fields before migration.                                                            |
| Orchestrator manager       | `services/orchestrator/src/lib/e2b-manager.ts` has Manus/E2B lifecycle assumptions lines 1-21. | Rename to sandbox runtime manager and isolate E2B assumptions.                                           |
| CSP                        | `packages/next-config/index.ts` allows `*.e2b.app` and `*.e2b.dev` lines 42-43.                | Add Vercel Sandbox preview domains after official URL format is verified.                                |
| Frontend exports           | `packages/ai/package.json` exports `use-e2b-stream` and `use-e2b-terminal` lines 39-46.        | Rename to generic sandbox stream/terminal hooks and keep compatibility wrappers temporarily.             |
| Templates                  | `e2b-templates/*` included base, code interpreter, and desktop runtime files.                  | Deleted from active repo; replace with a fresh Vercel Sandbox provider/snapshot recipe only after proof. |
| Proxy service              | `services/sandbox-proxy/src/index.ts` routes `{port}-{sandboxId}.e2b.dev` style URLs.          | Replace with provider route resolver, not string concatenation.                                          |

## Provider-Neutral Contract

The existing adapter interface is the right starting point, but its names should change.

Current evidence:

- `services/sandbox/src/lib/adapters/e2b-adapter.interface.ts` defines `SandboxConfig`, `ExecutionResult`, `FileOperation`, `BrowserAction`, and `IE2BAdapter`.
- Methods include create, connect, execute code, execute shell, browser action, write/read/list files, destroy, isActive, and status.

Proposed replacement:

```ts
export type SandboxProvider = "vercel_sandbox" | "e2b" | "local";

export interface SandboxRuntimeConfig {
  provider: SandboxProvider;
  runtime?: "node24" | "node22" | "python3.13" | "custom";
  timeoutMs?: number;
  env?: Record<string, string>;
  ports?: number[];
  metadata?: Record<string, unknown>;
}

export interface SandboxProviderAdapter {
  create(config: SandboxRuntimeConfig): Promise<SandboxHandle>;
  connect(providerSandboxId: string): Promise<SandboxHandle>;
  runCommand(handle: SandboxHandle, command: SandboxCommand): Promise<SandboxCommandResult>;
  writeFiles(handle: SandboxHandle, files: SandboxFileWrite[]): Promise<void>;
  readFile(handle: SandboxHandle, path: string): Promise<Buffer | string>;
  listFiles(handle: SandboxHandle, path: string): Promise<SandboxFileInfo[]>;
  getPortUrl(handle: SandboxHandle, port: number): Promise<string | null>;
  stop(handle: SandboxHandle): Promise<void>;
}
```

Rules:

- Provider IDs never leak into UI labels.
- Provider-specific fields live in `metadata` or provider-specific subobjects, not top-level product objects.
- Workflow steps consume `sandbox_command` outputs, not provider SDK objects.
- Port preview is optional capability, not assumed for every runtime.

## Database Migration Plan

Current `sandboxes` table should not be deleted immediately. Add columns first:

- `provider text default 'e2b'`
- `provider_sandbox_id text`
- `runtime text`
- `provider_state jsonb`
- `capabilities jsonb`
- `port_urls jsonb`
- `workflow_run_id text nullable`
- `run_step_id text nullable`

Then:

1. Backfill `provider = 'e2b'`.
2. Copy `e2b_sandbox_id` into `provider_sandbox_id`.
3. Update service code to read provider-neutral fields.
4. Add Vercel Sandbox records for new workflow runs only.
5. Remove E2B-specific columns only after no code reads them and old sessions are expired.

## Service Migration Plan

1. Create `services/sandbox/src/lib/providers/provider.interface.ts`.
2. Move current E2B SDK code into `providers/e2b-provider.ts`.
3. Add `providers/vercel-sandbox-provider.ts`.
4. Add provider registry keyed by `provider`.
5. Update create/resume/execute/file routes to call the registry.
6. Add integration contract tests using a fake provider first.
7. Add Vercel Sandbox integration tests behind env-gated live credentials.

## Orchestrator Migration Plan

Current `e2b-manager.ts` should be split:

- `sandbox-runtime-manager.ts`: product-level lifecycle, session/run association, proxy token, metering.
- `providers/e2b-lifecycle.ts`: E2B hibernation/resume, E2B port host formatting.
- `providers/vercel-lifecycle.ts`: Vercel Sandbox create/get/stop/port URL/file/command behavior.

Do not preserve "one sandbox per chat session" as the only model. For AI Workflow OS the natural ownership is:

- workflow run sandbox for `sandbox_command` tasks,
- optional long-lived workflow sandbox only if a workflow explicitly needs persistent workspace state,
- local fake sandbox for parser/executor tests.

## Frontend Migration Plan

1. Add generic sandbox hook names.
2. Keep E2B hook exports as wrappers during transition.
3. Rename UI copy from "E2B" to "Sandbox".
4. Make browser/terminal views capability-driven:
   - command logs available,
   - file output available,
   - port preview available,
   - desktop stream available only if provider supports it.

## Vercel Sandbox Proof Checklist

- [ ] Create sandbox from app/server context.
- [ ] Authenticate locally and in Vercel production.
- [ ] Write multiple files into sandbox workspace.
- [ ] Run `node --version`.
- [ ] Run `pnpm install` on a tiny fixture.
- [ ] Run a generated script and collect stdout/stderr/exit code.
- [ ] Read output artifact file.
- [ ] Publish port 3000 and resolve preview URL.
- [ ] Stop sandbox and confirm status.
- [ ] Record usage event and sandbox session row.
- [ ] Stream command logs to the run timeline.
- [ ] Enforce command timeout and max output size.
- [ ] Confirm CSP/frame/connect settings for preview URL.

## Delete Gates

E2B code can be removed only after:

- Vercel Sandbox proof checklist passes.
- Workflow executor no longer imports E2B-specific APIs.
- Orchestrator no longer imports `e2b-manager`.
- Sandbox DB reads provider-neutral fields.
- Frontend hooks use generic names.
- Tests cover shell, files, preview URL, failure, timeout, and cleanup.
- Production sessions depending on old E2B IDs are either migrated or intentionally expired.
