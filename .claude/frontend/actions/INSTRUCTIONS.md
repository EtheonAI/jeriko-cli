# Actions (Tasks / Actions / Schedules) - Build Instructions

## Current State

### Frontend Page

`apps/app/app/(authenticated)/actions/page.tsx` (111 lines) - Server component with three empty tabs:

- **Tasks tab**: Empty state with ListTodoIcon, "No tasks yet"
- **Actions tab**: Empty state with ZapIcon, "No actions configured"
- **Schedules tab**: Empty state with CalendarIcon, "No schedules set"

Uses `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` from `@repo/design-system`. Each tab shows a dashed-border empty state with an `EmptyState` helper component.

### tRPC Router

`apps/app/lib/trpc/routers/scheduledTasks.router.ts` (407 lines) - Comprehensive Drizzle CRUD:

- `list` - Filter by status (pending/running/completed/failed/cancelled/paused) and taskType (agent_run/report/sync/backup/custom). Paginated with limit/offset.
- `get` - Single task by ID with ownership check
- `create` - Full schedule configuration:
  - `scheduleType`: once | recurring | cron
  - For once: `scheduledAt` (Date)
  - For recurring: `recurrencePattern` (daily/weekly/biweekly/monthly/yearly/custom), `recurrenceInterval`, `recurrenceDaysOfWeek` (0-6), `recurrenceDayOfMonth`, `recurrenceTime` (HH:MM)
  - For cron: `cronExpression`
  - `timezone` (default UTC), `maxRetries` (0-10, default 3), `retryDelaySeconds` (default 60)
  - `endDate`, `maxRuns`, `payload` (jsonb), `organizationId`
  - Has TODO: "Calculate next run time based on schedule"
- `update` - Partial update of any field
- `pause` - Set status "paused", isEnabled false
- `resume` - Set status "pending", isEnabled true
- `cancel` - Set status "cancelled", isEnabled false
- `delete` - Hard delete
- `runNow` - Creates taskExecution record (status: pending), sets task status to "running", has TODO: "Trigger actual task execution via queue/worker"
- `getExecutions` - List execution history for a task, paginated

### Database Schema

`packages/database/src/schema/scheduledTasks.ts` (162 lines):

**scheduledTasks table:**

- `id`, `userId` (FK), `organizationId` (FK)
- Task: `name`, `description`, `taskType` (agent_run/report/sync/backup/custom)
- Schedule: `scheduleType` (once/recurring/cron), `scheduledAt`, `recurrencePattern`, `recurrenceInterval`, `recurrenceDaysOfWeek` (jsonb number[]), `recurrenceDayOfMonth`, `recurrenceTime`, `cronExpression`, `timezone`
- Status: `status` (pending/running/completed/failed/cancelled/paused), `isEnabled`
- Execution: `lastRunAt`, `lastRunStatus`, `lastRunError`, `nextRunAt`, `runCount`
- Retry: `maxRetries` (default 3), `retryDelaySeconds` (default 60), `currentRetryCount`
- Payload: `payload` (jsonb: { agentId?, sessionId?, prompt?, parameters?, webhookUrl?, ... })
- End conditions: `endDate`, `maxRuns`
- `metadata`, `createdAt`, `updatedAt`

**taskExecutions table:**

- `id`, `scheduledTaskId` (FK, cascade)
- `status` (pending/running/success/failed/cancelled)
- Timing: `startedAt`, `completedAt`, `durationMs`
- Results: `output` (jsonb), `error`, `errorStack`
- `retryNumber`, `sessionId` (if agent run)
- `createdAt`

### Redux State

`apps/app/lib/store/slices/scheduledTasks.slice.ts` (8524 bytes) - Task scheduling state management.

### Task Service

`services/task/src/index.ts` - Fastify service with routes:

- `services/task/src/routes/tasks.ts` - Task CRUD endpoints
- `services/task/src/routes/inngest.ts` - Inngest integration for background task execution

---

## What Needs Building

### 1. Tasks Tab - Task Management Views

Convert the Tasks tab from empty state to a full task management interface.

**Create:** `apps/app/app/(authenticated)/actions/components/tasks/`

#### List View (`task-list-view.tsx`)

- Table with columns: Status (icon), Name, Type, Schedule, Next Run, Last Run, Actions
- Status icons: pending (clock), running (spinner), completed (check), failed (x), paused (pause)
- Row click opens task detail panel
- Sortable columns
- Filter bar: status filter, type filter, search by name

#### Board View / Kanban (`task-board-view.tsx`)

- Columns: Pending | Running | Completed | Failed
- Drag-and-drop cards between columns (for manual status changes)
- Each card: task name, schedule summary, last run time, type badge
- Column counts in headers
- Use a lightweight drag library (e.g., `@dnd-kit/core`)

#### Calendar View (`task-calendar-view.tsx`)

- Monthly calendar showing scheduled task runs
- Day cells show task dots/pills with names
- Click day to see detailed schedule
- Color-coded by task type
- Navigation: prev/next month, today button

#### View Toggle

- Three view buttons in tab header: List | Board | Calendar
- Persist selected view in localStorage

### 2. Task Detail Panel

When a task is selected, show a slide-over panel or dedicated view.

**Create:** `apps/app/app/(authenticated)/actions/components/tasks/task-detail-panel.tsx`

**Sections:**

- **Header**: Task name (editable), status badge, enable/disable toggle
- **Schedule Summary**: Human-readable schedule ("Every Monday at 9:00 AM UTC")
- **Configuration**: Task type, payload preview (JSON viewer), timezone
- **Execution History**: Table of past executions from `getExecutions`, showing: run #, status, started, duration, output preview, error
- **Actions**: Run Now, Pause/Resume, Edit Schedule, Delete
- **Logs**: Expandable log viewer for each execution's output/error

### 3. Actions Tab - Reusable Workflow Templates

"Actions" are pre-built workflow templates that users can configure and reuse.

**Create:** `apps/app/app/(authenticated)/actions/components/actions/`

#### Action Template Card (`action-template-card.tsx`)

- Icon, title, description
- Category badge (data, reporting, automation, notification)
- "Use this action" button -> opens configuration dialog

#### Built-in Action Templates

Define in a config file `apps/app/app/(authenticated)/actions/components/actions/action-templates.ts`:

```typescript
const ACTION_TEMPLATES = [
  {
    id: "daily-report",
    name: "Daily Summary Report",
    description: "Generate and email a daily summary of your tasks and activity",
    icon: "FileText",
    category: "reporting",
    payload: { type: "report", format: "email" },
  },
  {
    id: "data-sync",
    name: "Connector Data Sync",
    description: "Sync data from connected applications",
    icon: "RefreshCw",
    category: "data",
    payload: { type: "sync" },
  },
  {
    id: "backup",
    name: "Data Backup",
    description: "Backup your files and data to cloud storage",
    icon: "HardDrive",
    category: "data",
    payload: { type: "backup" },
  },
  {
    id: "agent-task",
    name: "Scheduled AI Task",
    description: "Run an AI agent with a specific prompt on a schedule",
    icon: "Bot",
    category: "automation",
    payload: { type: "agent_run" },
  },
  {
    id: "webhook-trigger",
    name: "Webhook Notification",
    description: "Send a webhook when conditions are met",
    icon: "Webhook",
    category: "notification",
    payload: { type: "custom", webhookUrl: "" },
  },
];
```

#### Action Configuration Dialog (`action-config-dialog.tsx`)

- Template-specific configuration form
- Schedule picker (reuses schedule builder from Schedules tab)
- "Create Scheduled Task" button -> calls `scheduledTasks.create` mutation

### 4. Schedules Tab - Cron-Based Scheduling

**Create:** `apps/app/app/(authenticated)/actions/components/schedules/`

#### Schedule List (`schedule-list.tsx`)

- List of all scheduled tasks grouped by frequency (Daily, Weekly, Monthly, Custom)
- Each item: name, schedule description, next run, enable/disable toggle
- Quick actions: edit, pause, delete, run now

#### Schedule Builder (`schedule-builder.tsx`)

The core component for creating/editing schedules.

**Schedule Type Selector:**

- **One-time**: Date picker + time picker
- **Recurring**: Pattern selector (Daily/Weekly/Biweekly/Monthly/Yearly) with options:
  - Daily: time picker
  - Weekly: day-of-week checkboxes (Mon-Sun) + time picker
  - Monthly: day-of-month selector (1-31) + time picker
  - Custom: interval number + unit (hours/days/weeks)
- **Cron**: Cron expression input with:
  - Visual cron builder (dropdowns for minute, hour, day, month, weekday)
  - Raw cron expression text input
  - Human-readable preview: "At 09:00 on every Monday"
  - Next 5 execution times preview

**Timezone Selector:**

- Searchable dropdown of IANA timezones
- Show current time in selected timezone
- Default to user's browser timezone

#### Cron Expression Editor (`cron-editor.tsx`)

- Visual builder with 5 fields: minute, hour, day-of-month, month, day-of-week
- Each field: dropdown for specific values, "every" option, range option
- Preview: "This will run at 09:00 AM every Monday and Wednesday"
- Validation: highlight invalid expressions

### 5. Inngest Integration

The task service at `services/task/src/routes/inngest.ts` already has Inngest integration scaffolding.

**Wire up:**

- When `scheduledTasks.create` is called with a cron schedule, register an Inngest cron function
- When `runNow` is called, trigger an Inngest event
- Inngest function executes the task payload (e.g., runs AI agent, triggers sync, sends report)
- On completion, update `taskExecutions` record with output/error/duration

**Add to `apps/app/lib/trpc/routers/scheduledTasks.router.ts`:**

```typescript
// Enhance existing procedures:
create; // After DB insert, register with Inngest if cron/recurring
delete (
  // After DB delete, unregister from Inngest
  pause
); // Pause Inngest function
resume; // Resume Inngest function
```

### 6. Real-Time Task Status via WebSocket

**Add to `apps/app/lib/socket/events.ts`:**

```typescript
"task:started"; // { taskId, executionId }
"task:progress"; // { taskId, executionId, progress: number, message: string }
"task:completed"; // { taskId, executionId, output }
"task:failed"; // { taskId, executionId, error }
```

**Add to WebSocket provider** (`apps/app/lib/socket/provider.tsx`) listeners that dispatch to `scheduledTasks.slice.ts`.

---

## Components to Create

In `apps/app/app/(authenticated)/actions/components/`:

```
tasks/
  task-list-view.tsx          # Table view of tasks
  task-board-view.tsx         # Kanban board
  task-calendar-view.tsx      # Calendar view
  task-detail-panel.tsx       # Slide-over detail view
  task-card.tsx               # Card for board view
  task-status-badge.tsx       # Status indicator
  execution-history.tsx       # Execution log table
  view-toggle.tsx             # List/Board/Calendar toggle

actions/
  action-template-card.tsx    # Template card
  action-templates.ts         # Template definitions
  action-config-dialog.tsx    # Configuration dialog
  action-grid.tsx             # Grid of available actions

schedules/
  schedule-list.tsx           # List of schedules
  schedule-builder.tsx        # Full schedule creation form
  schedule-type-selector.tsx  # Once/Recurring/Cron selector
  cron-editor.tsx             # Visual cron expression editor
  timezone-selector.tsx       # Timezone dropdown
  next-runs-preview.tsx       # Preview of next execution times
```

---

## Key File Paths

| Purpose                      | Path                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Actions page                 | `apps/app/app/(authenticated)/actions/page.tsx`                                 |
| Scheduled tasks router       | `apps/app/lib/trpc/routers/scheduledTasks.router.ts`                            |
| Scheduled tasks schema       | `packages/database/src/schema/scheduledTasks.ts`                                |
| Scheduled tasks slice        | `apps/app/lib/store/slices/scheduledTasks.slice.ts`                             |
| Settings scheduled tasks tab | `apps/app/app/(authenticated)/components/settings/tabs/scheduled-tasks-tab.tsx` |
| Task service                 | `services/task/src/index.ts`                                                    |
| Inngest routes               | `services/task/src/routes/inngest.ts`                                           |
| Task routes                  | `services/task/src/routes/tasks.ts`                                             |

## Priority Order

1. Tasks tab list view with real data from `scheduledTasks.router.ts`
2. Task detail panel with execution history
3. Schedule builder (one-time and recurring)
4. Create task flow (template selection -> configuration -> schedule -> create)
5. Cron expression editor
6. Board (Kanban) view
7. Calendar view
8. Actions tab with templates
9. Real-time status updates via WebSocket
10. Inngest integration for actual execution
