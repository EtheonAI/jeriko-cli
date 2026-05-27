# UX Addendum — Chat, Side Panel, Notifications, Versioning, Sharing

## 1. App layout

The app should feel like ChatGPT plus a live workflow operations console.

Recommended layout:

```text
Left sidebar:
- New
- Workflows
- Runs
- Approvals
- Artifacts
- Pulse
- Connections
- Billing
- Settings

Center:
- Chat / workflow prompt / conversation

Right side panel:
- Active workflow
- Current run timeline
- Jobs and tasks
- Subworkers
- Events
- Issue cards
- Approval cards
- Artifacts
- Cost meter
```

## 2. Chat role

Chat is a control surface.

Users can:

- create workflows
- ask what happened
- edit workflows by natural language
- approve/reject actions
- pause/resume/cancel
- retry tasks
- ask for explanations
- request patches

Chat should not be the always-on executor.

## 3. Side panel role

The side panel is the live execution surface.

It should update from events, not from the main AI.

It shows:

- workflow status
- live task status
- worker status
- events emitted
- artifacts created
- approvals pending
- issues
- reflection summary
- costs

## 4. Notifications per chat/workflow

Each chat/workflow should support independent notification settings.

Settings:

- realtime
- digest
- only approvals/issues
- quiet hours
- escalation timeout
- Slack/email/SMS/webhook destinations

## 5. Version control on top of chat

Each chat has versioned workflow state.

Versioned:

- .flow source
- compiled runtime JSON
- imports/instruction files
- scripts
- permissions
- memory
- reflection settings

Top bar:

- current version dropdown
- revert
- fork
- share
- diff
- dry run

## 6. Share

Users can share:

- workflow template
- workflow version
- run report
- artifact
- issue card
- approval request

All sharing must redact:

- secrets
- OAuth data
- private tool payloads
- sensitive artifact content unless explicitly included

## 7. Manual editing

Normal users:

- edit cards/selectors
- use natural-language edit
- approve patches

Power users:

- raw .flow editor
- compiled JSON preview
- semantic validation panel
- repair with AI
- version diff

Every edit creates a new version.
