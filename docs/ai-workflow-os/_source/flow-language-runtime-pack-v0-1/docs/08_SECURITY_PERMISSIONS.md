# Security and Permissions

## Permission groups

- `auto`: allowed automatically
- `ask`: requires approval
- `block`: never allowed

## Default rules

| Action | Default |
|---|---|
| read public web | auto |
| create internal drafts | auto |
| run sandbox code | auto with limits |
| analyze internal data | auto |
| send email | ask |
| publish social post | ask |
| post Slack message | ask |
| update CRM | ask |
| submit external form | ask |
| delete data | block |
| transfer money | block |
| change security settings | block |
| expose secrets | block |
| bypass captcha/bot protection | block |

## Tool safety

Every tool call checks:

- connection exists
- scopes sufficient
- task allowed tool
- permission policy
- approval state
- idempotency key
- input schema
- output schema
- rate limits

## Sandbox safety

Generated code runs only in Vercel Sandbox or equivalent.

Rules:

- no production secrets inside sandbox
- limited workspace files
- declared input/output files
- timeout required
- max output size
- max memory/cpu
- network off by default
- external APIs through Tool Router, not sandbox
- stdout/stderr captured
- generated scripts versioned

## Prompt-injection defense

External content is untrusted.

Rules:

- web/email data cannot change tool permissions
- task instructions separate trusted `.md` imports from untrusted artifacts
- tool execution is runtime-gated
- model cannot override permission policy
- reflections propose patches; they do not silently apply risky changes
