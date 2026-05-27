# Frontend And Design Audit

Date: 2026-05-23

Scope: authenticated app shell, routing model, state shape, UI vocabulary, design tokens, Manus-style CSS, and redesign readiness.

## Verdict

The frontend has reusable engineering and visual material, but it is still a chat-first Manus clone. It should not be lightly reskinned. The new product needs a workflow-first information architecture with chat as a command/editor surface, not the primary object.

## Current Product Shape

Evidence:

- Authenticated home page still brands the app as Jeriko and renders a prompt-first chat experience.
- Sidebar hardcodes Jeriko branding and lists `agentSessions` through `ChatItem`.
- Current filters are task-ish labels over chat sessions, not workflow runs.
- The app has routes for chat, files/library, projects, applications, actions/automations, search, webhooks, and settings.

Interpretation:

The current UI is usable for agent sessions and coding tasks, but AI Workflow OS needs workflows, versions, runs, approvals, events, artifacts, issues, and integrations to become first-class.

## Keep

- Dense app shell and sidebar layout.
- Prompt composer mechanics.
- Streaming run/timeline visual ideas.
- File/library components as artifact shelf foundation.
- Tool call renderers as step report components.
- Settings/integration surfaces after ownership fixes.
- Markdown rendering style and restrained Manus-like productivity tone.
- Tailwind v4 and shadcn component base.

## Replace Or Reframe

- `ChatItem` should become workflow/run list items.
- Home prompt should become workflow cockpit plus command bar.
- Chat route should become one of:
  - workflow command center,
  - run conversation,
  - workflow editor assistant.
- E2B terminal/browser labels should become provider-neutral sandbox views.
- Hard-coded Jeriko/Manus names should be removed once product naming is decided.

## Proposed Workflow-First IA

Primary navigation:

- Workflows
- Runs
- Approvals
- Artifacts
- Issues
- Integrations
- Sandboxes
- Analytics
- Settings

Core routes:

- `/workflows`
- `/workflows/new`
- `/workflows/[workflowId]`
- `/workflows/[workflowId]/versions/[versionId]`
- `/runs`
- `/runs/[runId]`
- `/approvals`
- `/artifacts`
- `/issues`
- `/connections`
- `/sandboxes`

Advanced routes:

- `/workflows/[workflowId]/source`
- `/workflows/[workflowId]/graph`
- `/workflows/[workflowId]/events`
- `/runs/[runId]/logs`
- `/runs/[runId]/costs`
- `/runs/[runId]/sandbox`

## Main Screens Needed

### Workflow List

Expected content:

- Workflow name.
- Enabled/disabled status.
- Trigger summary.
- Last run state.
- Next scheduled run.
- Approval count.
- Error/issue count.
- Owner/project/org.

### Workflow Detail

Expected tabs:

- Overview
- Source `.flow`
- Runs
- Artifacts
- Approvals
- Issues
- Settings

### Run Detail

Expected areas:

- Run header with status, version, trigger, duration, cost.
- Step timeline with running/completed/failed/skipped states.
- Event log.
- Task reports.
- Artifacts.
- Sandbox output.
- Approval panels.
- Retry/resume/cancel controls.

### `.flow` Editor

Expected behavior:

- Source view.
- Diagnostics from parser and semantic validator.
- Compile preview.
- FlowPatch suggestions.
- Version diff.
- Save as draft.
- Publish version.

### Approvals Queue

Expected behavior:

- All pending approvals across workflows.
- Approve/reject/request changes.
- Show risk, tool, proposed external action, source task, and affected resource.

## Design Direction

The user asked for "Manus CSS" and something "material." The best interpretation is not a Google Material clone. It should be a material-inspired workbench:

- Layered surfaces with restrained elevation.
- Clear state layers on hover/focus/active.
- More semantic tokens than the current monochrome neutral set.
- Dense tables/lists for repeated operational use.
- Cards only for repeated items, modals, and framed tools.
- No marketing hero as the app entry point.
- No decorative gradient/orb background.

## Token Work

Current design tokens:

- Neutral OKLCH variables.
- Radius around `0.625rem`.
- Manus/Jeriko sidebar and canvas variables.
- Dark mode tokens.

Needed workflow tokens:

- `surface`
- `surface-container-low`
- `surface-container`
- `surface-container-high`
- `outline`
- `outline-variant`
- `primary`
- `secondary`
- `tertiary`
- `success`
- `warning`
- `error`
- `approval`
- `running`
- `blocked`
- `artifact`
- `sandbox`
- `event`

Component tokens:

- Step row status accent.
- Approval risk accent.
- Artifact type swatch.
- Run status badge.
- Event severity.
- Sandbox output terminal surface.

## Frontend Refactor Checklist

- [ ] Inventory all Jeriko/Manus strings and decide rename timing.
- [ ] Add workflow route skeletons before deleting chat routes.
- [ ] Add workflow store/server state model.
- [ ] Build run timeline from events, not chat messages.
- [ ] Build `.flow` editor diagnostics panel.
- [ ] Build approvals queue.
- [ ] Build artifact shelf from workflow artifacts.
- [ ] Rename E2B hooks to generic sandbox hooks with compatibility wrappers.
- [ ] Remove or gate test pages under non-production flag.
- [ ] Add Playwright tests for workflow list, workflow detail, run detail, approval decision, and source diagnostics.

## Frontend Risk

Medium. The UI is not the deepest technical risk, but changing visuals before changing product objects will create a polished chat app, not AI Workflow OS.
