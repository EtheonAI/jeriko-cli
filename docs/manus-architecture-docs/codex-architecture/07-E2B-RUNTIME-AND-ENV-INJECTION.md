# E2B Runtime and Environment Injection

## Runtime model
1. Main sandbox per user.
2. Map subtasks spin up isolated temporary sandboxes.
3. Orchestrator is the source of environment truth.

## Required environment layers
1. Template baseline (`~/.env`): infra defaults.
2. Boot-generated vars: Neko and code-server credentials.
3. User secret layer (`~/.user_env`): user-provided secrets + connector tokens.
4. Runtime injection (per shell/tool context): OPENAI/BASE URLs, webdev runtime vars, owner metadata.

## Canonical injection behavior
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_API_BASE` are injected at process/session spawn time for runtime contexts.
- Runtime-injected values override lower layers.
- Secrets never emitted to frontend events.

## Sandbox modes to support
1. Base compute (shell/file/match).
2. Browser-capable desktop mode.
3. Webdev mode with project env overlays.
4. Map subtask mode with constrained toolset.

## Auxiliary sandbox services
1. `statesync` (default port `8333`) for browser state synchronization.
2. `code-server` (default port `8329`) for optional remote code editing flows.
3. `start_server` command gateway (default port `8330`) for tool execution routing.
4. Neko signaling/runtime ports for desktop streaming.

## File upload and CDN promotion flow
1. Sandbox artifacts are created in local filesystem paths.
2. Upload utility (equivalent of `manus-upload-file`) promotes file to object storage.
3. Upload returns CDN URL and storage metadata.
4. Canonical URL format must be stable and documented (for example: `https://files.<cdn-domain>/user_upload_by_module/session_file/{userId}/{randomId}.{ext}`).
5. Message/file events must reference CDN URL only, not ephemeral sandbox path.
6. Generated assets (images, exports, reports) must be promoted before final message result.

## Security requirements
1. Secret redaction in logs.
2. Explicit allowlist for env vars that can be exposed to frontend builds (`VITE_*` style).
3. Per-user sandbox ownership enforcement on every tool execution.
4. Forced cleanup for expired temporary map sandboxes.
5. No plaintext secret material in timeline events or user-visible tool output by default.
