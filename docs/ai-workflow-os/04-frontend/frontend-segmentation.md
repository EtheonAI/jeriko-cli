# Frontend Segmentation

## Primary Product Surfaces

- New workflow prompt
- Workflow preview
- Workflow list
- Workflow detail
- Run detail and live timeline
- Global approval inbox
- Artifact viewer
- Connections
- Billing and credits
- Settings

## Route Source

The initial route inventory is copied here:

- [`sitemap-routes.csv`](./sitemap-routes.csv)

## UX Contract

Chat is the command surface. The right side panel is the operational state surface. Users should see jobs, tasks, workers, events, artifacts, approvals, issue cards, cost, and reflection without forcing the main AI to reprocess every routine event.

## Existing App Audit Targets

- `apps/app/app/(authenticated)`
- `apps/app/app/(unauthenticated)`
- `apps/app/app/api`
- `apps/app/lib/store`
- `packages/ai/components`
- `packages/design-system`

## Source References

- [`../_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt`](../_source/full-brief/AI_Workflow_OS_Full_Brief_for_Codex.txt)
- [`../01-architecture/technical-blueprint.md`](../01-architecture/technical-blueprint.md)
