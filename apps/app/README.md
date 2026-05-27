# App

## Role

Primary authenticated AI Workflow OS product app. During reset this is only the root dashboard shell, Better Auth routes, health route, and auth pages.

## Status

Active product app reset shell. Keep it under `apps/app`; do not move `app/` to `src/app` without a dedicated route migration plan.

## Commands

- `pnpm --filter app dev`
- `pnpm --filter app typecheck`
- `pnpm --filter app build`

## Env

Uses T3 Env through `env.ts`. Current build validation requires at least:

- `DATABASE_URL`
- `STRIPE_SECRET_KEY`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_WEB_URL`
- `NEXT_PUBLIC_DOCS_URL`

These are build-time validation requirements because `next.config.ts` imports the T3 Env contract. Do not bypass this validation to make local builds pass.

## Ownership Rules

- Pages and layouts are Server Components by default.
- Route-specific implementation belongs in `_components`, `_hooks`, `_actions`, `_lib`, and `_types`.
- Shared UI belongs in `packages/design-system`.
- Workflow runtime/parser/sandbox/tool logic belongs in packages, not route trees.
- Do not reintroduce chat, artifact, sandbox, file, search, settings, project, Redux, tRPC, or E2E surfaces until a new workflow-native module spec exists.
- The authenticated root `/` is the dashboard during reset.
- Do not add product routes beyond `/` during the reset phase.
- Authenticated shell code is segmented under `(authenticated)/_components/app-shell`, `(authenticated)/_components/sidebar`, and `(authenticated)/_components/dashboard`.
- Proxy is optimistic only: support routes and public assets pass through; protected pages validate the real Better Auth session in server code.

## Future Workflow Resume Gate

The future workflow/chat module must satisfy `docs/ai-workflow-os/07-madr/MADR-096-resumable-workflow-runs-and-ui-reconnect.md` before product rebuild work is considered complete.

Rules:

- Browser refresh and tab close must detach the UI only.
- Browser refresh and tab close must not cancel an active run.
- Route handlers must not be the sole source of truth for long-running execution.
- Workflow UI must load a persisted snapshot, reconnect by durable `runId`, replay missed events by cursor, and then subscribe live.
- Explicit Stop/Cancel must call a durable cancellation endpoint.
