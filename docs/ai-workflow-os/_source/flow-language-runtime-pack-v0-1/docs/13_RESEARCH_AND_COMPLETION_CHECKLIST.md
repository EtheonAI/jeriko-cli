# Research and Completion Checklist

Use this to make `.flow` production-ready.

## Language/design research

- YAML 1.2.2 spec: identify features to reject.
- JSON Schema Draft 2020-12: schema validation.
- GitHub Actions workflow syntax: triggers/jobs/steps/artifacts inspiration.
- Docker Compose/Kubernetes/Ansible: YAML config patterns.
- Terraform/HCL: resource graph semantics.
- BPMN/Camunda/Temporal: long-running workflow concepts.
- LangGraph/CrewAI/LlamaIndex: AI workflow concepts.
- Inngest user-defined workflows and flow control.
- Vercel Sandbox execution/security.
- MCP spec: tool context boundary inspiration.
- OpenAPI/AsyncAPI/CloudEvents: event schemas and tool schemas.

## Parser requirements

- tolerant formatting
- strict semantics
- useful error messages
- source spans
- repair prompts
- schema validation
- semantic validation
- versioned grammar
- migration support

## Runtime requirements

- one generic executor
- static Inngest functions only
- DB trigger registry
- ECP event context
- task reports
- artifact resolver
- issue cards
- reflection packets
- cost metering
- concurrency control
- event storm controls
- sandbox safety
- permission gates
- approval waits

## UI requirements

- chat as control surface
- side panel as live workflow surface
- task cards
- event timeline
- issue cards
- approval cards
- artifact viewer
- version control
- FlowPatch editor
- raw .flow advanced editor

## Production readiness

- end-to-end tests
- sandbox escape tests
- tool permission tests
- event storm tests
- idempotency tests
- billing tests
- migration tests
- failure recovery tests
- approval safety tests
