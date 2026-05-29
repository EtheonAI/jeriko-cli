# Research Notes

## YAML

`.flow` borrows YAML readability but rejects full YAML complexity.

Important YAML issues to avoid:

- anchors
- aliases
- custom tags
- multi-document YAML
- implicit type coercion
- flow-style confusion
- arbitrary object construction

## JSON Schema

Use JSON Schema Draft 2020-12 for compiled runtime JSON and ECP packets.

## Inngest

Use Inngest for:

- scheduled functions
- fan-out
- durable steps
- waitForEvent
- waitForSignal
- invoke
- sendEvent
- flow control
- retries
- observability

## Vercel Sandbox

Use Vercel Sandbox for generated code/scripts.

Never run user/AI-generated code in production runtime.

## Architecture lesson

`.flow` is the source language.

AST/ASG/DAG/event graph/state machine are internal layers.

## Build lesson

Do not overbuild parser first.

Build:

1. safe YAML subset loader
2. schema validator
3. semantic validator
4. generic runtime
5. ECP
6. custom parser later if needed

## References to revisit

- YAML 1.2.2 spec
- JSON Schema 2020-12
- Inngest steps
- Inngest scheduled functions
- Inngest user-defined workflows
- Inngest flow control
- Vercel Sandbox docs
- MCP spec for tool context inspiration
