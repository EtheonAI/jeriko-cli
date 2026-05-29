# Billing, Credits, and Scale

## Billing principle

Charge based on work performed, not only seats.

Meter:

- workflow runs
- steps executed
- events processed
- AI tasks
- model tokens
- image generation
- tool calls
- sandbox seconds
- artifact storage
- notification sends
- reflection/main AI wakes

## Credit model

Recommended:

| Primitive | Credit rule |
|---|---|
| workflow run start | 1 credit |
| ai_task | model/token based |
| tool_call | 0.1–1 credit |
| sandbox_command | seconds/resource based |
| image generation | pass-through + margin |
| voice/call | provider pass-through + margin |
| reflection | model/token based |
| events over included quota | small per-event cost |
| storage over included quota | storage-based |

## Plan limits

### Beta

- 1 active workflow
- 5 active triggers
- 20 credits
- manual runs or 1 scheduled workflow

### Starter

- 3 active workflows
- 10 active triggers
- 150 credits/month
- 1 concurrent run

### Pro

- 10 active workflows
- 100 active triggers
- 600 credits/month
- 5 concurrent runs

### Operator

- 25 active workflows
- 500 active triggers
- 1500 credits/month
- 15 concurrent runs

### Business

- custom triggers
- custom event limits
- team approvals
- audit logs
- shared credits

## Scale controls

- active workflow limits
- active trigger limits
- max events/min/org
- max events/source
- max runs/day
- max concurrent runs
- max concurrent steps
- max foreach parallelism
- max sandbox seconds
- max tool calls
- max AI tasks
- max reflection wakes

## Event storm policy

If event volume exceeds threshold:

1. pause source
2. create issue card
3. notify owner
4. stop triggering new runs
5. allow manual resume

## Cheapness strategy

The platform is cost-friendly because:

- main AI writes `.flow` once
- deterministic steps do not call AI
- tool calls do not call AI
- sandbox commands do not call AI
- approvals do not call AI
- event routing does not call AI
- main AI wakes only for reflection triggers
