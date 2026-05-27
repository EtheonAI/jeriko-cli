# Platform Research Notes

Date researched: 2026-05-23

Scope: current primary-source checks for the redesign baseline: Next.js 16.2, Vercel Sandbox, Inngest, GitHub Actions workflow syntax, Better Auth organizations, Drizzle migrations, and Material 3 web implementation references.

## Summary

The concept is technically feasible, but the safest path is not a direct rewrite. The initial repo audit found useful foundations: Next.js App Router on Next 16.1.5, Better Auth with organization support, Drizzle/Postgres, Inngest scheduled task execution, billing/usage tables, an AI package with chat/tool UI, and an E2B sandbox service.

Post-upgrade note: active Next packages were later normalized to `next@16.2.6`, and active React packages to `19.2.6`, after checking the npm package versions tab and reinstalling from the public npm registry.

The risky parts are the missing `.flow` parser/compiler/runtime contract, the session/chat-first data model, and the deep E2B coupling across services and UI. The first build should create a workflow kernel and provider-neutral sandbox contract before any broad redesign.

## Sources Checked

| Track                     | Primary source                                                                         | Claim used                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.2              | https://nextjs.org/blog/next-16-2                                                      | Next.js 16.2 is real and was published March 18, 2026. It includes performance, debugging, agent, and Turbopack improvements.                  |
| Next.js 16 upgrade        | https://nextjs.org/docs/app/guides/upgrading/version-16                                | Next 16 requires Node.js 20.9+, uses Turbopack by default, and deprecates `middleware` in favor of `proxy`.                                    |
| Vercel Sandbox overview   | https://vercel.com/docs/vercel-sandbox                                                 | Vercel Sandbox is an ephemeral compute primitive for safely running untrusted/user-generated code; SDK integration uses `@vercel/sandbox`.     |
| Vercel Sandbox commands   | https://vercel.com/docs/vercel-sandbox/run-commands-in-sandbox                         | Sandbox CLI supports creating sandboxes, copying files in/out, executing commands, publishing ports, snapshots, and runtimes such as `node24`. |
| Vercel Sandbox SDK class  | https://docs.vercel.com/docs/vercel-sandbox/reference/classes/sandbox                  | SDK class exposes file writing and port URL resolution; `stop()` is part of the lifecycle surface.                                             |
| Inngest steps             | https://www.inngest.com/docs/learn/inngest-steps                                       | `step.run`, `step.sleep`, `step.sleepUntil`, and `step.waitForEvent` are available workflow primitives; step state is memoized by ID.          |
| Inngest wait for event    | https://www.inngest.com/docs/features/inngest-functions/steps-workflows/wait-for-event | `step.waitForEvent()` can pause a run until an event arrives or returns `null` after timeout; useful for human-in-the-loop flows.              |
| GitHub Actions syntax     | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax     | Workflow runs consist of jobs, jobs can use `needs`, env/default specificity, steps can use `uses`, `env`, timeout, and permissions.           |
| Better Auth orgs          | https://better-auth.com/docs/plugins/organization                                      | Organization plugin supports members, invitations, teams, active organization/team, roles, and permissions.                                    |
| Drizzle migrations        | https://orm.drizzle.team/docs/migrations                                               | Drizzle supports codebase-first TypeScript schema with generated SQL migrations and applying them with `drizzle-kit migrate`.                  |
| Material Web / Material 3 | https://material-web.dev/about/intro/                                                  | Material Web follows Material Design guidelines; Material 3 emphasizes dynamic color, accessibility, layouts, and design tokens.               |
| Material Web controls     | https://material-web.dev/components/icon-button/                                       | Icon buttons are appropriate for supplementary actions and have filled, tonal, and outlined variants.                                          |
| Material elevation        | https://material-web.dev/components/elevation/                                         | Material elevation has a constrained 0-5 level system and should be used deliberately.                                                         |

## Research Findings

### Next.js 16.2

Claim: upgrading from the initial `16.1.5` baseline to `16.2.x` is a minor-version upgrade, not a v15 to v16 migration.

Evidence:

- Initial local app dependency: `apps/app/package.json` pinned `"next": "16.1.5"` at line 69 during audit.
- Post-upgrade verification: active Next app/package dependencies resolve to `16.2.6`.
- Root engine already matches the v16 minimum: `package.json` requires `node >=20.9.0` at lines 68-70.
- The app already uses `apps/app/proxy.ts`, matching the v16 `proxy` convention.

Impact:

- The immediate upgrade checklist is dependency bump plus regression verification, not a full framework migration.
- Risk remains in Turbopack/default build behavior, React Compiler, package externalization, and auth behavior in `proxy.ts`.
- The auth proxy currently checks cookie presence directly instead of validating a Better Auth session (`apps/app/proxy.ts` lines 61-63). That is an auth audit item before launch.

Open questions:

- Resolved in upgrade phase: the public npm versions tab showed `next@16.2.6`; workspace packages were upgraded to `16.2.6` after reinstalling against `registry.npmjs.org`.
- Does the repo's `@next/eslint-plugin-next` pin need to match the selected Next patch?
- Do existing Playwright and Vitest suites pass under 16.2 with Turbopack default behavior?

### Vercel Sandbox

Claim: Vercel Sandbox is a good target for isolated AI-generated code execution, but the current repo is not ready for a direct swap.

Evidence:

- Official docs position Vercel Sandbox for untrusted code, AI agents, code generation, live previews, and isolated tests.
- Official command docs show sandbox creation, file copy, command execution, port publishing, snapshots, and cleanup.
- Local repo has no `@vercel/sandbox` dependency in audited package manifests.
- Local sandbox service depends on `@e2b/code-interpreter` (`services/sandbox/package.json` line 15).
- Local E2B coupling includes DB fields, services, templates, CSP, proxy routes, frontend hooks, and test fixtures.

Impact:

- Add a provider-neutral sandbox interface first.
- Implement Vercel Sandbox as a second provider.
- Preserve E2B paths until Vercel Sandbox passes a proof workflow with command execution, file IO, port preview, logs, timeouts, and cleanup.

Open questions:

- What port URL format and CSP domains should be allowed for Vercel Sandbox previews in production?
- Which Vercel auth path will be used locally and in production: OIDC token or access token?
- Does Vercel Sandbox support every desktop/browser capability currently assumed by Neko/code-server/WebRTC, or do those features need redesign?

### Inngest

Claim: Inngest fits the `.flow` executor if it runs a generic interpreter, not one custom function per user workflow.

Evidence:

- Inngest docs support durable steps, sleeps, event waits, retries, and long-running pauses.
- Local task service already depends on Inngest (`services/task/package.json` line 22).
- Existing `executeTask` uses step boundaries for session creation and orchestrator calls (`services/task/src/routes/inngest.ts` lines 155-260).

Impact:

- Keep Inngest, but introduce a `workflow/run.execute` generic executor event.
- Compiled `.flow` runtime JSON should drive step dispatch.
- Step IDs must be stable because Inngest memoizes step state by ID.

Open questions:

- The repo uses `inngest ^3.32.3`; Inngest docs now mention TypeScript SDK v4 availability. Decide whether to upgrade the SDK before or after `.flow` MVP.
- Need a cancellation model for workflow runs and step waits.

### GitHub Actions Inspiration

Claim: GitHub Actions is a good mental model for `.flow`, but `.flow` should not copy GitHub Actions syntax wholesale.

Evidence:

- GitHub Actions uses jobs, dependencies through `needs`, env/default specificity, steps, `uses`, per-job permissions, and timeouts.
- AI Workflow OS needs non-CI primitives: approvals, issue cards, reflections, artifacts, tool permissions, budgets, memory patches, and sandboxed scripts.

Impact:

- Use familiar words where useful: `jobs`, `tasks`, `needs`, `env`, `permissions`, `timeout`, `runs`.
- Do not expose raw GitHub Actions expressions or third-party actions in MVP.
- Parser must reject unknown keys and unsupported YAML features.

Open questions:

- Whether `.flow` v0 should use `steps` or `tasks` as the primary unit. The brief uses both; docs should normalize one term before implementation.

### Better Auth Organizations

Claim: Better Auth can support the org/team foundation, but product authorization still needs a platform-level policy model.

Evidence:

- Local auth server uses the Better Auth organization plugin (`packages/auth/src/server.ts` lines 104-127).
- Official Better Auth org docs cover members, invitations, active org/team, roles, permissions, and dynamic access control.
- Current proxy only checks the session cookie value (`apps/app/proxy.ts` lines 61-63), so route protection and platform authorization are separate concerns.

Impact:

- Keep Better Auth.
- Add workflow/resource permissions at the API/service layer: workflow owner, org role, connection scope, tool permission, approval authority.
- Do not rely on UI hiding for workflow security.

Open questions:

- Need final org roles: owner/admin/operator/viewer? Current source blueprint says owner/admin/member/viewer, while Better Auth defaults are owner/admin/member.
- Need approval delegation rules by org role and workflow role.

### Drizzle/Postgres

Claim: Drizzle/Postgres is compatible with workflow versioning, run state, append-only events, and artifact metadata.

Evidence:

- Official Drizzle docs support codebase-first TypeScript schema with generated SQL migrations.
- Local database package already exposes `db:generate`, `db:migrate`, and `db:push` scripts (`packages/database/package.json` lines 28-33).
- Existing tables cover sessions, scheduled tasks, sandboxes, files, billing, orgs, connectors, and projects, but not the target workflow runtime tables in the source blueprint.

Impact:

- Add new workflow tables rather than mutating session tables into workflow tables.
- Keep existing scheduled tasks and sessions during transition.
- Use append-only `workflow_events` and immutable usage ledger patterns for run audit.

Open questions:

- The repo has mixed local dependency declarations for Drizzle and Zod across packages. Root overrides force Drizzle `0.38.4` and Zod `4.3.6`; package manifests still declare older Zod 3 and newer Drizzle in some services. This needs dependency audit before DB migration work.

### Material Direction

Claim: "Manus CSS but more material" should be a token and interaction redesign, not an import of Material Web components into the existing shadcn/Tailwind stack by default.

Evidence:

- Local design system already uses Tailwind v4 tokens and Manus/Jeriko CSS variables (`packages/design-system/styles/globals.css` lines 9-65).
- App-specific markdown CSS explicitly says "Manus-matching" (`apps/app/app/styles.css` lines 5-9).
- Material Web docs provide useful component/tokens guidance, but `@material/web` is web-component based and notes maintenance status on the home page.

Impact:

- Keep Tailwind/shadcn/Radix foundations unless a component-specific reason emerges.
- Add Material-inspired token roles: surfaces, tonal surfaces, elevation levels, state layers, shape scale, icon-first controls.
- Avoid a wholesale component library replacement during phase one.

Open questions:

- Define a new brand palette that preserves Manus restraint without staying one-note neutral.
- Decide whether to support light/dark first or dark-only workbench first.

## Feasibility Verdict

Feasible with staged execution:

1. Normalize the concept docs and decisions.
2. Build `.flow` parser/compiler with tests.
3. Add workflow DB tables and generic run/event model.
4. Execute a mocked local workflow through a generic executor.
5. Add Vercel Sandbox behind a provider-neutral adapter.
6. Redesign UI around workflow runs, approvals, artifacts, and issue cards.

Not feasible as a direct "upgrade and replace E2B" sprint. The existing app is too coupled to chat sessions and E2B runtime assumptions for a safe one-shot rewrite.
