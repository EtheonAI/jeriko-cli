# Security And Billing Plan

## Permission Model

| Tier    | Meaning                                                       |
| ------- | ------------------------------------------------------------- |
| `auto`  | Runtime may execute without user approval after policy checks |
| `ask`   | Runtime must create an approval request and pause             |
| `block` | Runtime must reject the action                                |

## Approval Required By Default

- Send email
- Publish social post
- Update CRM
- Post Slack
- Create calendar invite
- Update external systems

## Blocked By Default

- Delete user or customer data
- Transfer money
- Expose secrets
- Change security settings
- Create fake accounts
- Bypass bot protection

## Sandbox Boundary

- Generated code never runs in the production process.
- OAuth/API tokens do not enter sandbox files.
- Commands require a policy scanner.
- Network access must be explicit.
- Runtime, memory, output size, and file count are capped.

## Billing Control

- Meter model calls, image generation, tool calls, sandbox seconds, search calls, storage, artifacts, and event volume.
- Enforce per-run, per-day, and per-month budgets.
- Pause or fail safely when a budget is exceeded.
- Avoid unlimited autonomous workflow plans.

## Source References

- [`../_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt`](../_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt)
- [`../03-backend/database-schema.md`](../03-backend/database-schema.md)
