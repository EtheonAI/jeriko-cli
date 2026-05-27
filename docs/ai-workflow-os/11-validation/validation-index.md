# Validation Index

This folder is for proving the concept works before committing to the full redesign.

## Current Reports

- [`platform-viability-validation.md`](./platform-viability-validation.md): verdict on whether the idea is achievable, viable, doable, better, and what is missing.

## Validation Gates

- `.flow` sample compiles to AST.
- Invalid `.flow` files are rejected with clear errors.
- AST compiles to deterministic runtime JSON.
- Generic executor can run a simple manual flow.
- Event log can reconstruct a run timeline.
- Human review can pause and resume a run.
- Sandbox command can stage files, execute, and collect outputs.
- Tool router can block, ask, or auto-run based on permission policy.
- Issue card is created for a failed optional task.
- Reflection packet is generated from run reports.

## MVP Proof Workflow

Start with social content operator:

1. Research topics.
2. Draft posts.
3. Generate or mock visual brief.
4. Validate with sandbox command.
5. Ask for approval.
6. Mock publish.
7. Create run report and reflection packet.
