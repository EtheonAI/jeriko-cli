# Event Context Protocol (ECP) v0.1

## Purpose

ECP is the internal context-sharing layer.

It connects:

- apps to workflows
- workflows to workflows
- tasks to tasks
- workers to workers
- workers to the UI
- workers to main AI only when needed

## Core rule

Workers do not free-chat by default.

They emit typed EventContextPackets.

## EventContextPacket

```json
{
  "id": "ecp_123",
  "type": "artifact.image.generated",
  "schema_version": "0.1",
  "org_id": "org_123",
  "workflow_id": "wf_social",
  "workflow_version_id": "wfv_7",
  "run_id": "run_456",
  "job_id": "daily_content",
  "task_id": "generate_images",
  "worker_id": "image_worker",
  "source": {
    "kind": "subagent",
    "provider": "internal"
  },
  "correlation_id": "corr_daily_2026_05_23",
  "causation_id": "evt_post_draft_ready",
  "summary": "Generated Instagram and LinkedIn image assets.",
  "payload": {
    "platforms": ["instagram", "linkedin"],
    "approval_required": true
  },
  "artifacts": [
    {
      "path": "artifacts/images/instagram.png",
      "type": "image",
      "related": "artifacts/posts/instagram.json",
      "status": "ready_for_review"
    }
  ],
  "quality": {
    "confidence": 0.88,
    "verifier_status": "passed"
  },
  "routing": {
    "notify_ui": true,
    "notify_tasks": ["approval", "schedule_posts"],
    "notify_main_ai": false
  },
  "cost": {
    "credits": 8
  }
}
```

## Routing destinations

- UI side panel
- dependent tasks
- subworkflow triggers
- notification system
- main AI reflection
- audit log
- artifact resolver

## Main AI routing

The main AI wakes when:

- repeated failure
- verifier failure
- approval rejected
- user edited heavily
- cost exceeded
- stuck run
- completed with issues
- scheduled improvement cycle
- user asks what happened

## Task Reports

Each task emits a TaskReport.

TaskReport is more detailed than ECP and is used for learning, billing, and reflection.

## Run Reflection Packet

Reflection packet is compressed context for main AI.

It includes:

- summary
- completed tasks
- failed tasks
- issue cards
- cost
- artifacts
- user edits
- patch opportunities

## Why ECP matters

Without ECP:

- downstream tasks guess
- main AI needs raw logs
- context is messy
- worker communication becomes expensive

With ECP:

- tasks receive exact context
- UI updates cheaply
- main AI only wakes when useful
- workflows are debuggable
