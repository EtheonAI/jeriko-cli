# `.flow` Language + Runtime Pack v0.1

This package is the implementation blueprint for a `.flow`-based autonomous workflow runtime.

It includes:

- `.flow` language specification
- YAML-compatible safe-subset rules
- EBNF grammar
- JSON Schema for compiled runtime structure
- TypeScript parser/compiler/runtime scaffolding
- Semantic validation design
- ECP/Event Context Packet schema and router
- TaskReport and RunReflection schemas
- Inngest durable execution mapping
- Vercel Sandbox execution model
- Worker/subagent router
- Permission/security model
- KV cache and artifact/state model
- Billing/credit metering
- Versioning/migration strategy
- Example `.flow` workflows

## Core idea

```text
User prompt
→ Main AI writes workflow.flow
→ Parser validates safe .flow
→ Compiler creates runtime JSON
→ Semantic validator resolves tools/files/artifacts/events/permissions
→ Inngest runs generic executor
→ Subworkers execute scoped tasks
→ ECP routes typed event context
→ Issue cards expose failures
→ Reflection packets wake main AI only when needed
→ FlowPatch improves future workflow versions
```

## What this pack is

This is not a finished npm package. It is a build-ready v0.1 scaffold and spec for Codex/Claude Code to implement.

Recommended first build order:

1. `schemas/flow.schema.json`
2. `src/parser.ts`
3. `src/compiler.ts`
4. `src/semantic-validator.ts`
5. `src/runtime/dispatcher.ts`
6. `src/runtime/inngest.ts`
7. `src/runtime/event-router.ts`
8. `src/runtime/sandbox-runner.ts`
9. `src/workers/worker-router.ts`
10. `examples/social_media_manager.flow`
