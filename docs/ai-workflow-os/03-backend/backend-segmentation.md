# Backend Segmentation

## Backend Domains

| Domain           | Responsibility                                                           |
| ---------------- | ------------------------------------------------------------------------ |
| Auth and orgs    | Users, organizations, memberships, authorization boundaries              |
| Workflow storage | Workflows, versions, files, compiled AST, active version                 |
| Runtime          | Runs, steps, dependency resolver, Inngest executor                       |
| Event context    | Append-only events, task reports, issue cards, reflection packets        |
| Sandbox          | Vercel Sandbox sessions, file staging, command policy, output collection |
| Tool router      | Connector scopes, permission checks, idempotency, tool logs              |
| Artifacts        | Metadata in Postgres, bytes in object storage                            |
| Billing          | Usage events, credit ledger, budgets, plan limits                        |

## Existing Source Copy

The database blueprint from the source pack is copied here:

- [`database-schema.md`](./database-schema.md)

## Implementation Gate

Before building backend code, audit existing packages and services for reusable pieces:

- `packages/database`
- `packages/auth`
- `packages/ai`
- `services/orchestrator`
- `services/task`
- `services/sandbox`
- `services/sandbox-proxy`
- `services/file`
- `services/gateway`

## Source References

- [`database-schema.md`](./database-schema.md)
- [`../01-architecture/technical-blueprint.md`](../01-architecture/technical-blueprint.md)
