# Reset And Upgrade Research

Date researched: 2026-05-23

Purpose: support the codebase reset/upgrade audit with current external evidence for Next.js, Vercel Sandbox, AI SDK, and GitHub Actions-inspired workflow authoring.

## Research Verdict

The platform should be reset and upgraded in phases, not with one broad dependency sweep.

External docs support the target direction:

- Next.js has an official upgrade path and current App Router guidance.
- Vercel Sandbox is a good target for isolated code execution, file operations, command execution, previews, and snapshots, but the app needs a provider-neutral sandbox contract first.
- AI SDK v6 patterns already match parts of the repo, so the work is dependency normalization and tool governance, not a full AI SDK rewrite.
- GitHub Actions is a strong inspiration for `.flow` concepts, but `.flow` should not clone GitHub's syntax directly. It should use similar ideas: workflows, jobs, steps/tasks, triggers, conditionals, permissions, env, retries, artifacts, and logs.

## Sources

| Source                         | Type          | URL                                                                                | Relevant claim                                                                                                          |
| ------------------------------ | ------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Next.js upgrading docs         | Official docs | https://nextjs.org/docs/app/getting-started/upgrading                              | Next supports `pnpm next upgrade`; manual path is latest `next`, `react`, `react-dom`, and `eslint-config-next`.        |
| Next.js 16 guide               | Official docs | https://nextjs.org/docs/app/guides/upgrading/version-16                            | Next 16 migration has specific framework behavior changes that need codemod/manual review.                              |
| Vercel Sandbox overview        | Official docs | https://vercel.com/docs/vercel-sandbox                                             | Sandbox is intended for isolated execution of untrusted/user-generated code and AI-agent workloads.                     |
| Vercel Sandbox command guide   | Official docs | https://vercel.com/docs/vercel-sandbox/run-commands-in-sandbox                     | Sandbox supports create, copy in/out, command execution, published ports, snapshots, network policy, and cleanup flows. |
| AI SDK introduction            | Official docs | https://ai-sdk.dev/docs/introduction                                               | AI SDK v6 is current and supports AI applications and agents across providers.                                          |
| AI SDK `streamText` reference  | Official docs | https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text                          | `streamText`, `inputSchema`, `stopWhen`, `stepCountIs`, and UI message stream responses are current patterns.           |
| AI SDK UI chatbot docs         | Official docs | https://ai-sdk.dev/docs/ai-sdk-ui/chatbot                                          | `useChat` with `DefaultChatTransport` is the current UI transport pattern.                                              |
| GitHub Actions workflow syntax | Official docs | https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax | A workflow is YAML-defined and composed from jobs and steps, with ids, conditions, inputs, env, services, and timeouts. |

## Implementation Impact

### Next.js Upgrade

Evidence:

- Official docs list the latest version on the docs page and recommend `pnpm next upgrade` for current projects.
- Manual upgrade path is the Next/React family, not isolated `next` alone.
- The local repo already has root engine `node >=20.9.0`, which aligns with Next 16's baseline requirement, but the repo has mixed Next/React versions across packages.

Impact:

- Do not run `pnpm next upgrade` before the active app/service set is reduced.
- Normalize active Next apps together.
- Treat inactive apps as dev-only or archived before making them block the upgrade.
- After upgrade, run typecheck/build on the active app set only, then expand coverage intentionally.

### Vercel Sandbox Migration

Evidence:

- Vercel positions Sandbox for safe execution of untrusted/user-generated code, AI agents, code generation, and live previews.
- The documented flow includes sandbox creation, copying files in/out, command execution, published ports, snapshots, network policy, and cleanup.
- System specs identify the default runtime as `node24`, with `node22` and `python3.13` also available.
- Authentication supports Vercel OIDC as the recommended path and access tokens where OIDC is unavailable.

Impact:

- The current E2B code should not be edited directly into Vercel-specific code everywhere.
- Create a provider-neutral `SandboxProviderAdapter` first.
- Keep temporary E2B compatibility until the Vercel provider proves parity for:
  - create/resume/stop
  - command execution
  - file read/write/list/copy
  - published preview ports
  - logs/terminal stream replacement or acceptable substitute
  - browser automation strategy
  - artifact export
  - lifecycle cleanup
  - network policy
  - billing/usage metering hooks

### AI SDK Upgrade

Evidence:

- AI SDK docs identify v6 as current.
- Current local code already uses v6-shaped APIs in places: `streamText`, `stepCountIs`, `ModelMessage`, `inputSchema`, `jsonSchema`, `DefaultChatTransport`, and `toUIMessageStreamResponse`.

Impact:

- AI SDK work should focus on package normalization and runtime policy, not wholesale rewriting.
- Keep `streamText` where it fits.
- Do not pass every static/dynamic tool to every run. `.flow` compiled task permissions must select the allowed tool subset.
- Tool descriptions and schemas need artifact, permission, idempotency, risk, and approval metadata.

### GitHub Actions Inspiration

Evidence:

- GitHub Actions defines workflows as YAML configuration made from jobs and steps.
- It has ids, conditions, env, services, timeouts, reusable workflows, inputs, and secrets.

Impact:

- `.flow` should borrow the mental model, not the exact syntax.
- The user-facing language should be:
  - goal
  - jobs
  - tasks
  - trigger
  - needs
  - uses
  - run
  - env
  - permissions
  - artifacts
  - approvals
  - if
  - retry
  - timeout
  - on_fail
- Internally, `.flow` still compiles to AST, symbol table, ASG, DAG slices, control-flow graph, event graph, and run state machine.

## Open Questions Before Implementation

- Exact Vercel Sandbox SDK method names and response types must be checked at implementation time against the current SDK reference.
- Whether live desktop control should be first-class in MVP is unresolved. Current Vercel Sandbox docs prove code/file/command/preview primitives, but not direct Neko/noVNC parity.
- Browser automation should likely move to Playwright inside sandbox plus screenshot/artifact streaming, not direct reuse of the current E2B/Neko design.
- The final active app split still needs a decision: one `apps/app` product app, or separate marketing/API apps.
- Pricing/limits for Vercel Sandbox and long-running workflow behavior must be checked before production billing design.
